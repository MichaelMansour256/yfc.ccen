"use client";
import { useEffect, useCallback, useState } from "react";
import Image from "next/image";

type Photo = { id: string; url: string; width: number; height: number };

export default function Slideshow({
  photos,
  startIndex,
  onClose,
}: {
  photos: Photo[];
  startIndex: number;
  onClose: () => void;
}) {
  const [index, setIndex] = useState(startIndex);
  const [playing, setPlaying] = useState(false);
  const [touchStart, setTouchStart] = useState<number | null>(null);

  const prev = useCallback(() => setIndex((i) => (i - 1 + photos.length) % photos.length), [photos.length]);
  const next = useCallback(() => setIndex((i) => (i + 1) % photos.length), [photos.length]);

  // Keyboard navigation
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
      else if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [prev, next, onClose]);

  // Auto-play
  useEffect(() => {
    if (!playing) return;
    const id = setInterval(next, 3000);
    return () => clearInterval(id);
  }, [playing, next]);

  // Swipe
  const onTouchStart = (e: React.TouchEvent) => setTouchStart(e.touches[0].clientX);
  const onTouchEnd = (e: React.TouchEvent) => {
    if (touchStart === null) return;
    const diff = touchStart - e.changedTouches[0].clientX;
    if (Math.abs(diff) > 50) diff > 0 ? next() : prev();
    setTouchStart(null);
  };

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black"
      onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* Top bar */}
      <div className="flex items-center justify-between px-4 py-3">
        <span className="text-sm text-white/60">{index + 1} / {photos.length}</span>
        <div className="flex gap-3">
          <button onClick={() => setPlaying((p) => !p)}
            className="rounded-full bg-white/10 px-3 py-1 text-xs text-white">
            {playing ? "⏸ Pause" : "▶ Play"}
          </button>
          <button onClick={onClose} className="text-white/80 text-xl">✕</button>
        </div>
      </div>

      {/* Image */}
      <div className="relative flex-1">
        <Image src={photos[index].url} alt="" fill className="object-contain" sizes="100vw" />
      </div>

      {/* Prev / Next */}
      <button onClick={prev}
        className="absolute left-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white text-xl">
        ‹
      </button>
      <button onClick={next}
        className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full bg-black/40 p-3 text-white text-xl">
        ›
      </button>

      {/* Thumbnail strip */}
      <div className="flex gap-1 overflow-x-auto px-2 py-2">
        {photos.map((p, i) => (
          <button key={p.id} onClick={() => setIndex(i)}
            className={`relative h-12 w-12 shrink-0 overflow-hidden rounded ${i === index ? "ring-2 ring-blue-accent" : "opacity-50"}`}>
            <Image src={p.url} alt="" fill className="object-cover" sizes="48px" />
          </button>
        ))}
      </div>
    </div>
  );
}
