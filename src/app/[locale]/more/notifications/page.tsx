"use client";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import { useLocale, useTranslations } from "next-intl";
import PageHeader from "@/components/PageHeader";
import {
  getReadNotificationIds,
  markAllNotificationsRead,
  markAllNotificationsReadRemote,
  markNotificationRead,
  markNotificationReadRemote,
  subscribeToReadChanges,
  syncLocalReadsRemote,
} from "@/lib/notification-read-state";
import { peekSubscriberId, resolveSubscriberId } from "@/lib/onesignal-subscriber";
import type { PublicNotification } from "@/lib/notifications-history";

/**
 * User notification inbox — reads the same `notifications_history` records
 * the Admin History tab shows (via /api/notifications) and layers
 * per-subscriber read-state on top:
 *
 *   • subscriber = the device's OneSignal Push Subscription id, persisted
 *     server-side in `notification_reads` through POST /api/notifications/read
 *     (RLS locked; the browser never talks to Supabase directly);
 *   • devices without a push subscription — and everything until
 *     supabase-notification-reads.sql is applied — fall back to device-local
 *     reads (localStorage, see src/lib/notification-read-state.ts);
 *   • both layers are unioned so fallback-mode reads are never lost, and
 *     local reads are synced up to the server once per load.
 */

type Filter = "all" | "unread" | "read";

/** A fetched notification plus its precomputed display timestamp. */
type InboxItem = PublicNotification & { whenLabel: string };

const PAGE_SIZE = 20;

export default function NotificationsPage() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const isAr = locale === "ar";
  const router = useRouter();

  const [items, setItems] = useState<InboxItem[]>([]);
  const [readIds, setReadIds] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState(false);
  const [hasMore, setHasMore] = useState(false);
  const [filter, setFilter] = useState<Filter>("all");

  /** Resolved OneSignal Push Subscription id (null = no subscription yet). */
  const sidRef = useRef<string | null>(null);
  /** True once the server read-state (notification_reads) is confirmed usable. */
  const serverModeRef = useRef(false);

  const refreshReadIds = useCallback(
    () => setReadIds(new Set(getReadNotificationIds())),
    []
  );

  const rtf = useMemo(
    () =>
      new Intl.RelativeTimeFormat(isAr ? "ar-EG" : "en-US", { numeric: "auto" }),
    [isAr]
  );

  /**
   * Relative/formatted timestamp — declared before fetchPage (its only
   * caller) and only ever invoked from async callbacks so Date.now() never
   * runs during a render pass (react-hooks/purity / immutability).
   */
  function formatWhen(sentAt: string): string {
    const date = new Date(sentAt);
    if (Number.isNaN(date.getTime())) return "";
    const diffMs = date.getTime() - Date.now();
    const mins = Math.round(diffMs / 60000);
    if (Math.abs(mins) < 60) return rtf.format(mins, "minute");
    const hours = Math.round(diffMs / 3600000);
    if (Math.abs(hours) < 24) return rtf.format(hours, "hour");
    const days = Math.round(diffMs / 86400000);
    if (Math.abs(days) < 8) return rtf.format(days, "day");
    return date.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  }

  const fetchPage = useCallback(async (offset: number, sid: string | null) => {
    const isInitial = offset === 0;
    if (isInitial) setLoading(true);
    else setLoadingMore(true);
    setError(false);
    try {
      const params = new URLSearchParams({
        limit: String(PAGE_SIZE),
        offset: String(offset),
      });
      if (sid) params.set("subscriber", sid);
      const res = await fetch(`/api/notifications?${params.toString()}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        notifications?: PublicNotification[];
        hasMore?: boolean;
        readsSupported?: boolean;
        readIds?: string[];
        unreadCount?: number;
      };

      serverModeRef.current = Boolean(sid) && data.readsSupported !== false;
      const serverIds = serverModeRef.current ? data.readIds ?? [] : [];
      const localIds = getReadNotificationIds();

      // Relative-time labels are computed here (inside the async callback,
      // not during render) so Date.now() never runs in a render pass —
      // react-hooks/purity requires impure calls to stay outside render.
      const page: InboxItem[] = (data.notifications ?? []).map((n) => ({
        ...n,
        whenLabel: formatWhen(n.sentAt),
      }));
      setItems((prev) => (isInitial ? page : [...prev, ...page]));
      setHasMore(Boolean(data.hasMore));

      // Union of server + device read-state: device covers reads made before
      // the migration or before this device had a push subscription.
      const merged = new Set([...serverIds, ...localIds]);
      setReadIds((prev) => {
        if (isInitial) return merged;
        const next = new Set(prev);
        for (const id of merged) next.add(id);
        return next;
      });

      // Bridge (fire-and-forget, idempotent): push device-local reads the
      // server doesn't know about yet so they survive across devices later.
      if (isInitial && serverModeRef.current && sid) {
        const serverSet = new Set(serverIds);
        const missing = localIds.filter((id) => !serverSet.has(id));
        if (missing.length > 0) void syncLocalReadsRemote(sid, missing);
      }
    } catch {
      setError(true);
      if (isInitial) setItems([]);
    } finally {
      setLoading(false);
      setLoadingMore(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale]);

  useEffect(() => {
    // Everything runs from a microtask/async callbacks so the effect body
    // itself never calls setState synchronously (react-hooks/set-state-in-effect).
    let cancelled = false;
    queueMicrotask(async () => {
      refreshReadIds();
      const cached = peekSubscriberId();
      let sid: string | null;
      let revalidate = false;
      if (cached === undefined) {
        // First visit this session: await the bounded OneSignal probe.
        sid = await resolveSubscriberId();
      } else {
        // Known device: render immediately, revalidate in the background.
        sid = cached;
        revalidate = true;
      }
      if (cancelled) return;
      sidRef.current = sid;
      await fetchPage(0, sid);
      if (cancelled || !revalidate) return;
      const fresh = await resolveSubscriberId({ force: true });
      if (cancelled || !fresh || fresh === sidRef.current) return;
      // Subscription appeared/changed since it was cached (user just enabled
      // push, or re-subscribed) — restart once with the correct identity.
      sidRef.current = fresh;
      await fetchPage(0, fresh);
    });
    // Keep read-state in sync with other tabs (storage event) and re-render
    // when this page's own marks fire the custom event.
    const unsubscribe = subscribeToReadChanges(refreshReadIds);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [fetchPage, refreshReadIds]);

  const unreadCount = useMemo(
    () => items.filter((n) => !readIds.has(n.id)).length,
    [items, readIds]
  );

  const visible = useMemo(() => {
    if (filter === "unread") return items.filter((n) => !readIds.has(n.id));
    if (filter === "read") return items.filter((n) => readIds.has(n.id));
    return items;
  }, [items, readIds, filter]);

  /** Record the read (server + device), then open the notification's target url. */
  async function open(n: PublicNotification) {
    const sid = sidRef.current;
    if (sid && serverModeRef.current) {
      // Server row recorded BEFORE navigating — bounded so a slow network can
      // never block the tap (the device-local copy is written first anyway).
      await Promise.race([
        markNotificationReadRemote(sid, n.id),
        new Promise((resolve) => setTimeout(resolve, 1500)),
      ]);
    } else {
      markNotificationRead(n.id);
    }
    refreshReadIds(); // instant dot/badge feedback (the event also covers it)
    if (/^https?:\/\//i.test(n.url)) {
      window.open(n.url, "_blank", "noopener,noreferrer");
    } else {
      router.push(n.url || `/${locale}`);
    }
  }

  /** Mark every loaded notification read (server marks ALL sent for this subscriber). */
  function markAll() {
    markAllNotificationsRead(items.map((n) => n.id));
    refreshReadIds();
    const sid = sidRef.current;
    if (sid && serverModeRef.current) {
      // Fire-and-forget: server-side this covers notifications beyond the
      // loaded page, for THIS subscriber only — other subscribers untouched.
      void markAllNotificationsReadRemote(sid);
    }
  }

  const filters: { key: Filter; label: string; count: number }[] = [
    { key: "all", label: t("all"), count: items.length },
    { key: "unread", label: t("unread"), count: unreadCount },
    { key: "read", label: t("read"), count: items.length - unreadCount },
  ];

  const heading = (n: PublicNotification) =>
    (isAr ? n.headingAr : n.headingEn) || n.headingAr || n.headingEn || "";
  const body = (n: PublicNotification) =>
    (isAr ? n.messageAr : n.messageEn) || n.messageAr || n.messageEn || "";

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={t("title")} icon="🔔" />

      <div className="flex flex-col gap-4 px-4 py-4 max-w-lg mx-auto">
        {/* Filter chips + mark-all-as-read */}
        {!loading && items.length > 0 && (
          <div className="flex items-center gap-2">
            {filters.map(({ key, label, count }) => (
              <button key={key} onClick={() => setFilter(key)}
                className={`flex-1 rounded-xl py-2 text-xs font-semibold transition ${
                  filter === key
                    ? "bg-blue-accent text-white"
                    : "bg-blue-dark/40 text-blue-light/60"
                }`}>
                {label} {count > 0 && `(${count})`}
              </button>
            ))}
            <button
              onClick={markAll}
              disabled={unreadCount === 0}
              title={t("markAllRead")}
              aria-label={t("markAllRead")}
              className="rounded-xl bg-blue-dark/40 px-3 py-2 text-xs font-semibold text-blue-accent transition hover:bg-blue-mid/40 disabled:opacity-40"
            >
              ✅
            </button>
          </div>
        )}

        {/* Loading skeletons — same card language, pulse instead of content */}
        {loading && (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i}
                className="animate-pulse rounded-2xl border border-blue-mid/30 bg-blue-primary/20 p-4">
                <div className="mb-2 h-4 w-2/3 rounded bg-blue-mid/40" />
                <div className="mb-3 h-3 w-full rounded bg-blue-mid/25" />
                <div className="h-3 w-1/3 rounded bg-blue-mid/20" />
              </div>
            ))}
          </div>
        )}

        {/* Error state — friendly message + retry, never a raw API error */}
        {!loading && error && (
          <div className="flex flex-col items-center gap-3 rounded-2xl border border-red-400/30 bg-red-400/10 p-6 text-center">
            <span className="text-3xl">📡</span>
            <p className="text-sm text-white/80">{t("error")}</p>
            <button onClick={() => fetchPage(0, sidRef.current)}
              className="rounded-xl bg-blue-accent px-4 py-2 text-xs font-semibold text-white hover:bg-blue-mid transition">
              {t("retry")}
            </button>
          </div>
        )}

        {/* Empty states */}
        {!loading && !error && items.length === 0 && (
          <div className="flex flex-col items-center pt-10 gap-2 text-blue-light/40">
            <span className="text-4xl">🔕</span>
            <p className="text-sm">{t("empty")}</p>
          </div>
        )}
        {!loading && !error && items.length > 0 && visible.length === 0 && (
          <div className="flex flex-col items-center pt-10 gap-2 text-blue-light/40">
            <span className="text-4xl">🔔</span>
            <p className="text-sm">{t("emptyFiltered")}</p>
          </div>
        )}

        {/* Notification cards */}
        {!loading && !error && visible.length > 0 && (
          <div className="flex flex-col gap-3">
            {visible.map((n) => {
              const unread = !readIds.has(n.id);
              return (
                <button key={n.id} onClick={() => open(n)}
                  className={`relative w-full rounded-2xl border p-4 text-start backdrop-blur-sm transition active:scale-[0.98] ${
                    unread
                      ? "border-blue-accent/50 bg-blue-primary/40"
                      : "border-blue-mid/30 bg-blue-primary/20 opacity-80"
                  }`}>
                  {/* unread dot */}
                  {unread && (
                    <span aria-hidden
                      className="absolute top-3 end-3 h-2 w-2 animate-pulse rounded-full bg-blue-accent" />
                  )}
                  {n.image && (
                    <div className="relative mb-3 h-40 w-full overflow-hidden rounded-xl border border-blue-mid/30">
                      <Image src={n.image} alt="" fill unoptimized
                        sizes="(max-width: 512px) 100vw, 512px"
                        className="object-cover" />
                    </div>
                  )}
                  <p className={`mb-1 text-sm leading-snug text-white ${unread ? "font-bold" : "font-semibold"}`}
                    dir="auto">
                    {heading(n)}
                  </p>
                  <p className="mb-2 line-clamp-3 text-xs leading-relaxed text-blue-light/70" dir="auto">
                    {body(n)}
                  </p>
                  <p className="text-[11px] text-blue-light/40">{n.whenLabel}</p>
                </button>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {!loading && !error && hasMore && items.length > 0 && (
          <button onClick={() => fetchPage(items.length, sidRef.current)} disabled={loadingMore}
            className="rounded-2xl border border-blue-mid/40 bg-blue-primary/30 py-3 text-sm font-semibold text-blue-light/80 backdrop-blur-sm transition hover:bg-blue-mid/40 disabled:opacity-50">
            {loadingMore ? "…" : t("loadMore")}
          </button>
        )}
      </div>
    </div>
  );
}