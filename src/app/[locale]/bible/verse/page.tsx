"use client";
import { useEffect, useState } from "react";
import PageHeader from "@/components/PageHeader";

type Verse = {
  book: number;
  bookName: string;
  chapter: number;
  verse: number;
  text: string;
  name: string;
  note?: string;
};

export default function VerseOfWeekPage() {
  const [verse, setVerse] = useState<Verse | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetch("/api/verse")
      .then((r) => r.json())
      .then((data) => { setVerse(data); setLoading(false); });
  }, []);

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title="آية الأسبوع" icon="✨" />

      <div className="flex flex-col items-center px-5 pt-8 pb-6 max-w-lg mx-auto">
        {loading ? (
          <div className="flex flex-col items-center gap-3 pt-20 text-blue-light/50">
            <span className="text-4xl animate-pulse">✨</span>
            <p className="text-sm">جاري التحميل…</p>
          </div>
        ) : !verse || !verse.text ? (
          <div className="flex flex-col items-center gap-3 pt-20 text-blue-light/40">
            <span className="text-5xl">📖</span>
            <p className="text-sm">لم يتم تحديد آية الأسبوع بعد</p>
          </div>
        ) : (
          <div className="w-full flex flex-col gap-4">
            {/* Verse card */}
            <div className="relative w-full rounded-3xl border border-blue-accent/30 bg-gradient-to-br from-blue-primary/60 to-blue-dark/80 p-6 backdrop-blur-sm shadow-xl shadow-blue-accent/10"
              dir="rtl">
              {/* Decorative quote mark */}
              <span className="absolute top-4 right-5 text-6xl text-blue-accent/10 font-serif leading-none select-none">"</span>

              <p className="text-xl leading-loose text-white font-medium tracking-wide">
                {verse.text}
              </p>

              <div className="mt-4 flex items-center justify-between">
                <span className="text-sm font-bold text-blue-accent">
                  {verse.bookName} {verse.chapter}:{verse.verse}
                </span>
                <span className="text-xs text-blue-light/40">ترجمة فاندايك</span>
              </div>
            </div>

            {/* Servant note */}
            {verse.note && (
              <div className="w-full rounded-2xl border border-yellow-400/20 bg-yellow-400/5 p-4" dir="rtl">
                <p className="text-xs font-semibold text-yellow-400 mb-1">💬 ملاحظة</p>
                <p className="text-sm leading-relaxed text-white/80">{verse.note}</p>
              </div>
            )}

            {/* Week label */}
            <p className="text-center text-xs text-blue-light/30">
              آية أسبوع {new Date().toLocaleDateString("ar-EG", { month: "long", year: "numeric" })}
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
