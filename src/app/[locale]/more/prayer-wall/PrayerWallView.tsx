"use client";
import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import PageHeader from "@/components/PageHeader";
import { toAppLocale, getDirection } from "@/i18n/locales";

type Prayer = { id: string; name: string; request: string; pray_count: number; created_at: string };

/**
 * Prayer wall.
 *
 * The copy was inline `isAr ? "…" : "…"` ternaries and the form, success
 * panel and every prayer card were pinned to `dir="rtl"` regardless of the
 * active language — so on /en the English text was laid out right-to-left.
 * Both problems are fixed by reading the `prayerWall` namespace and deriving
 * the direction from the locale.
 */
export default function PrayerWallPage() {
  const t = useTranslations("prayerWall");
  const format = useFormatter();
  const dir = getDirection(toAppLocale(useLocale()));
  const [prayers, setPrayers] = useState<Prayer[]>([]);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState("");
  const [request, setRequest] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [prayedIds, setPrayedIds] = useState<Set<string>>(new Set());

  useEffect(() => {
    fetch("/api/prayer")
      .then((r) => r.json())
      .then((data) => { setPrayers(Array.isArray(data) ? data : []); setLoading(false); });
    // Load prayed ids from localStorage. Deferred to a microtask so the effect
    // body never calls setState synchronously (react-hooks/set-state-in-effect).
    queueMicrotask(() => {
      const stored = localStorage.getItem("prayedIds");
      if (stored) setPrayedIds(new Set(JSON.parse(stored)));
    });
  }, []);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!request.trim()) return;
    setSubmitting(true);
    await fetch("/api/prayer", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ name, request }),
    });
    setSubmitting(false);
    setSubmitted(true);
    setName("");
    setRequest("");
  }

  async function handlePray(id: string) {
    if (prayedIds.has(id)) return;
    const newIds = new Set(prayedIds).add(id);
    setPrayedIds(newIds);
    localStorage.setItem("prayedIds", JSON.stringify([...newIds]));
    const res = await fetch("/api/prayer/pray", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ id }),
    });
    const data = await res.json();
    if (data.pray_count !== undefined) {
      setPrayers((prev) => prev.map((p) => p.id === id ? { ...p, pray_count: data.pray_count } : p));
    }
  }

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={t("title")} icon="✝️" />

      <div className="flex flex-col gap-4 px-4 py-4 max-w-lg mx-auto">

        {/* Submit form */}
        {submitted ? (
          <div className="rounded-2xl border border-green-400/30 bg-green-400/10 p-5 text-center" dir={dir}>
            <p className="text-2xl mb-2">🙏</p>
            <p className="font-semibold text-white">{t("thankYou")}</p>
            <p className="text-sm text-blue-light/60 mt-1">{t("underReview")}</p>
            <button onClick={() => setSubmitted(false)}
              className="mt-3 text-sm text-blue-accent underline">
              {t("addAnother")}
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} dir={dir}
            className="rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-4 backdrop-blur-sm">
            <p className="font-semibold text-white mb-3">
              {t("formTitle")}
            </p>
            <div className="flex flex-col gap-2">
              <input
                placeholder={t("namePlaceholder")}
                value={name} onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl bg-blue-dark/60 px-4 py-2 text-white placeholder-blue-light/40 outline-none ring-1 ring-blue-mid/40 focus:ring-blue-accent text-sm"
              />
              <textarea
                placeholder={t("requestPlaceholder")}
                value={request} onChange={(e) => setRequest(e.target.value)}
                rows={3}
                className="w-full rounded-xl bg-blue-dark/60 px-4 py-2 text-white placeholder-blue-light/40 outline-none ring-1 ring-blue-mid/40 focus:ring-blue-accent text-sm resize-none"
              />
              <button type="submit" disabled={submitting || !request.trim()}
                className="rounded-xl bg-blue-accent py-2 text-sm font-semibold text-white hover:bg-blue-mid disabled:opacity-50 transition">
                {submitting ? "…" : t("send")}
              </button>
            </div>
          </form>
        )}

        {/* Prayer cards */}
        {loading ? (
          <div className="flex justify-center pt-8 text-blue-light/50 text-sm">
            {t("loading")}
          </div>
        ) : prayers.length === 0 ? (
          <div className="flex flex-col items-center pt-8 gap-2 text-blue-light/40">
            <span className="text-4xl">✝️</span>
            <p className="text-sm">{t("empty")}</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {prayers.map((prayer) => {
              const prayed = prayedIds.has(prayer.id);
              const date = format.dateTime(new Date(prayer.created_at), {
                month: "short", day: "numeric",
              });
              return (
                <div key={prayer.id} dir={dir}
                  className="rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-4 backdrop-blur-sm">
                  <div className="flex items-start justify-between gap-2 mb-2">
                    <div>
                      <p className="text-sm font-semibold text-white">{prayer.name}</p>
                      <p className="text-xs text-blue-light/40">{date}</p>
                    </div>
                    <button onClick={() => handlePray(prayer.id)}
                      aria-label={t("pray")}
                      className={`flex items-center gap-1 rounded-full px-3 py-1 text-xs font-semibold transition shrink-0 ${
                        prayed
                          ? "bg-blue-accent/20 text-blue-accent cursor-default"
                          : "bg-blue-primary/60 text-blue-light/70 hover:bg-blue-accent/20 hover:text-blue-accent"
                      }`}>
                      🙏 {prayer.pray_count}
                    </button>
                  </div>
                  <p className="text-sm leading-relaxed text-white/80">{prayer.request}</p>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
