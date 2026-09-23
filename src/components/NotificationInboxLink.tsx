"use client";
import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { getReadNotificationIds, subscribeToReadChanges } from "@/lib/notification-read-state";
import { peekSubscriberId, resolveSubscriberId } from "@/lib/onesignal-subscriber";

/**
 * "Notifications" row for the More menu with a live unread badge (🔔 3).
 *
 * Unread is computed as:
 *   • with a push subscription — the server's exact `unreadCount`
 *     (two Supabase head-count queries, NO history rows downloaded),
 *     minus device-local reads the server doesn't know about yet;
 *   • without one (or until supabase-notification-reads.sql is applied) —
 *     the newest BADGE_FETCH_LIMIT sent notifications minus the IDs this
 *     device has stored as read (the pre-migration fallback).
 * Recomputes when read-state changes anywhere (including other tabs).
 */
const BADGE_FETCH_LIMIT = 30;

export default function NotificationInboxLink() {
  const t = useTranslations("notifications");
  const locale = useLocale();
  const [unread, setUnread] = useState<number | null>(null);

  const recompute = useCallback(async () => {
    try {
      let sid = peekSubscriberId();
      if (sid === undefined) sid = await resolveSubscriberId();
      const localIds = getReadNotificationIds();

      // Server-counted unread for this subscriber (limit=1 → just the counts).
      if (sid) {
        const res = await fetch(
          `/api/notifications?limit=1&subscriber=${encodeURIComponent(sid)}`
        );
        if (res.ok) {
          const data = (await res.json()) as {
            readsSupported?: boolean;
            unreadCount?: number;
            readIds?: string[];
          };
          if (data.readsSupported !== false) {
            const serverRead = new Set(data.readIds ?? []);
            const localOnly = localIds.filter((id) => !serverRead.has(id)).length;
            setUnread(Math.max(0, (data.unreadCount ?? 0) - localOnly));
            return;
          }
        }
        // Server read-state unavailable → fall through to local fallback.
      }

      // Fallback: newest page vs this device's read-state.
      const res = await fetch(`/api/notifications?limit=${BADGE_FETCH_LIMIT}`);
      if (!res.ok) return;
      const data = (await res.json()) as { notifications?: { id: string }[] };
      const read = new Set(localIds);
      const count = (data.notifications ?? []).filter((n) => !read.has(n.id)).length;
      setUnread(count);
    } catch {
      /* the badge is non-critical — leave the previous value on failure */
    }
  }, []);

  useEffect(() => {
    // Deferred so the effect body never calls setState synchronously
    // (react-hooks/set-state-in-effect).
    let cancelled = false;
    queueMicrotask(async () => {
      await recompute();
      // A subscription may appear right after mount (user just enabled push
      // on this page) — revalidate the id once, then recompute if new.
      const fresh = await resolveSubscriberId({ force: true });
      if (!cancelled && fresh) await recompute();
    });
    const unsubscribe = subscribeToReadChanges(recompute);
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, [recompute]);

  return (
    <Link href={`/${locale}/more/notifications`}
      className="flex items-center gap-4 rounded-2xl border border-blue-mid/40 bg-blue-primary/40 p-4 backdrop-blur-sm transition hover:bg-blue-mid/50 active:scale-95">
      <span className="text-2xl">🔔</span>
      <span className="text-base font-semibold text-white">{t("title")}</span>
      {unread !== null && unread > 0 ? (
        <span className="ms-auto flex h-6 min-w-6 items-center justify-center rounded-full bg-blue-accent px-2 text-xs font-bold text-white">
          {unread > 9 ? "9+" : unread}
        </span>
      ) : (
        <span className="ms-auto text-blue-light/50">›</span>
      )}
    </Link>
  );
}