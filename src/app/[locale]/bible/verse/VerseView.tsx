"use client";
import { useEffect, useState } from "react";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import PageHeader from "@/components/PageHeader";
import { toAppLocale, getDirection } from "@/i18n/locales";

type Verse = {
  book: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  name: string;
  note?: string;
};

/**
 * Verse of the week.
 *
 * Every string on this page used to be a hard-coded Arabic literal — the
 * heading, the loading state, the empty state, the translation credit, the
 * note label and the month name (`toLocaleDateString("ar-EG", …)`) — so the
 * page rendered Arabic even on /en/bible/verse. All of it now comes from the
 * `verse` message namespace, formatted with the active locale.
 */
export default function VerseOfWeekPage() {
  const t = useTranslations("verse");
  const format = useFormatter();
  const locale = toAppLocale(useLocale());
  const dir = getDirection(locale);
  const [verse, setVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/verse")
      .then((r) => r.json())
      .then((data) => { setVerse(data); setLoading(false); });
  }, []);

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={t("title")} icon="✨" />

      <div className="flex flex-col items-center px-5 pt-8 pb-6 max-w-lg mx-auto">
        {loading ? (
          <div className="flex flex-col items-center gap-3 pt-20 text-blue-light/50">
            <span className="text-4xl animate-pulse">✨</span>
            <p className="text-sm">{t("loading")}</p>
          </div>
        ) : !verse || !verse.text ? (
          <div className="flex flex-col items-center gap-3 pt-20 text-blue-light/40">
            <span className="text-5xl">📖</span>
            <p className="text-sm">{t("empty")}</p>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-4">
            {/* Verse card */}
            <div className="relative w-full rounded-3xl border border-blue-accent/30 bg-gradient-to-br from-blue-primary/60 to-blue-dark/80 p-6 backdrop-blur-sm shadow-xl shadow-blue-accent/10"
              dir={dir}>
              {/* Decorative quote mark */}
              <span className="absolute top-4 right-5 text-6xl text-blue-accent/10 font-serif leading-none select-none">&quot;</span>

              <p className="text-xl leading-loose text-white font-medium tracking-wide">
                {verse.text}
              </p>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-bold text-blue-accent">
                  {verse.bookName} {verse.chapter}:{verse.verse}
                </span>
                <span className="text-xs text-blue-light/40">{t("translation")}</span>
              </div>
            </div>

            {/* Servant note */}
            {verse.note && (
              <div className="w-full rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4" dir={dir}>
                <p className="text-xs font-semibold text-yellow-400 mb-1">💬 {t("note")}</p>
                <p className="text-sm leading-relaxed text-white/80">{verse.note}</p>
              </div>
            )}

            {/* Week label */}
            <p className="text-center text-xs text-blue-light/30">
              {t("weekOf", {
                month: format.dateTime(new Date(), { month: "long", year: "numeric" }),
              })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
