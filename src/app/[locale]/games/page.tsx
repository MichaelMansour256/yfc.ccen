"use client";
import { useState } from "react";
import { useLocale } from "next-intl";
import Image from "next/image";
import PageHeader from "@/components/PageHeader";

export default function GamesPage() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const [open, setOpen] = useState(false);

  if (open) {
    return (
      <div className="fixed inset-0 z-50 flex flex-col bg-black">
        <div className="flex items-center gap-3 bg-blue-dark px-4 py-3 shrink-0">
          <button onClick={() => setOpen(false)} className="text-white/80 text-xl leading-none">‹</button>
          <span className="text-sm font-semibold text-white">Verse Up Arena</span>
        </div>
        <iframe
          src="https://verse-up-arena.vercel.app"
          className="flex-1 w-full border-none"
          allow="fullscreen"
          title="Verse Up Arena"
        />
      </div>
    );
  }

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={isAr ? "الألعاب" : "Games"} icon="🎮" />

      <div className="flex flex-col items-center px-6 pt-8">
        <button onClick={() => setOpen(true)}
          className="w-full max-w-sm rounded-3xl border border-yellow-400/30 bg-blue-primary/40 p-6 text-center backdrop-blur-sm transition hover:bg-blue-mid/50 active:scale-95 shadow-xl shadow-yellow-400/10">
          <div className="relative mx-auto mb-4 h-48 w-48">
            <Image src="/verse-up-logo.png" alt="Verse Up Arena" fill className="object-contain drop-shadow-2xl" />
          </div>
          <p className="text-lg font-bold text-white">Verse Up Arena</p>
          <p className="mt-1 text-sm text-blue-light/60">
            {isAr ? "تحدي آيات الكتاب المقدس" : "Bible verse challenge game"}
          </p>
          <span className="mt-4 inline-block rounded-full bg-yellow-400 px-6 py-2 text-sm font-bold text-blue-dark">
            {isAr ? "العب الآن ▶" : "Play Now ▶"}
          </span>
        </button>
      </div>
    </div>
  );
}
