"use client";
import { useEffect, useState } from "react";
import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import Slideshow from "@/components/Slideshow";

type Photo = { id: string; url: string; width: number; height: number };
type Event = { name: string; path: string; photos: Photo[] };

export default function GalleryPage() {
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [activeEvent, setActiveEvent] = useState<string | null>(null); // null = all
  const [slideshow, setSlideshow] = useState<{ photos: Photo[]; index: number } | null>(null);

  useEffect(() => {
    fetch("/api/gallery")
      .then((r) => r.json())
      .then((data) => { setEvents(data); setLoading(false); });
  }, []);

  const allPhotos = events.flatMap((e) => e.photos);
  const displayedPhotos =
    activeEvent === null
      ? allPhotos
      : events.find((e) => e.path === activeEvent)?.photos ?? [];

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title="Gallery" icon="🖼️" />

      {/* Event filter tabs */}
      <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
        <button
          onClick={() => setActiveEvent(null)}
          className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
            activeEvent === null ? "bg-blue-accent text-white" : "bg-blue-primary/40 text-blue-light/70"
          }`}>
          All
        </button>
        {events.map((e) => (
          <button key={e.path} onClick={() => setActiveEvent(e.path)}
            className={`shrink-0 rounded-full px-4 py-1.5 text-sm font-semibold transition ${
              activeEvent === e.path ? "bg-blue-accent text-white" : "bg-blue-primary/40 text-blue-light/70"
            }`}>
            {e.name}
          </button>
        ))}
      </div>

      {/* Slideshow all button */}
      {displayedPhotos.length > 0 && (
        <div className="px-4 pb-2">
          <button
            onClick={() => setSlideshow({ photos: displayedPhotos, index: 0 })}
            className="flex items-center gap-2 rounded-xl bg-blue-primary/40 px-4 py-2 text-sm text-white border border-blue-mid/40">
            ▶ Play Slideshow ({displayedPhotos.length} photos)
          </button>
        </div>
      )}

      {/* Grid */}
      {loading ? (
        <div className="flex justify-center pt-20 text-blue-light/50">Loading…</div>
      ) : displayedPhotos.length === 0 ? (
        <div className="flex flex-col items-center pt-20 text-blue-light/50 gap-2">
          <span className="text-5xl">🖼️</span>
          <p className="text-sm">No photos yet</p>
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-0.5 px-0.5">
          {displayedPhotos.map((photo, i) => (
            <button key={photo.id} onClick={() => setSlideshow({ photos: displayedPhotos, index: i })}
              className="relative aspect-square overflow-hidden bg-blue-primary/20">
              <Image src={photo.url} alt="" fill className="object-cover transition hover:scale-105" sizes="33vw" />
            </button>
          ))}
        </div>
      )}

      {/* Slideshow overlay */}
      {slideshow && (
        <Slideshow
          photos={slideshow.photos}
          startIndex={slideshow.index}
          onClose={() => setSlideshow(null)}
        />
      )}
    </div>
  );
}
