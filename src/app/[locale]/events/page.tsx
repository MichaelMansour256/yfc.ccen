"use client";
import { useEffect, useState } from "react";
import { useLocale } from "next-intl";
import Image from "next/image";
import PageHeader from "@/components/PageHeader";
import WeeklyMeetingCard from "@/components/WeeklyMeetingCard";
import { meetingConfig } from "@/config";
import { getNextMeetingISO } from "@/lib/schedule";

type SpecialEvent = { id: string; title: string; titleAr: string; date: string; time: string; description?: string; descriptionAr?: string };
type Invitation = { date: string; url: string; publicId: string };

function DateStrip({ events, invitations, onInvitationTap }: {
  events: SpecialEvent[];
  invitations: Invitation[];
  onInvitationTap: (url: string) => void;
}) {
  const today = new Date();
  const days = Array.from({ length: 14 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    return d;
  });

  const eventDates = new Set(events.map((e) => e.date));
  const invitationMap = new Map(invitations.map((i) => [i.date, i.url]));

  return (
    <div className="flex gap-2 overflow-x-auto px-4 py-3 scrollbar-none">
      {days.map((d) => {
        const iso = d.toISOString().split("T")[0];
        const isToday = iso === today.toISOString().split("T")[0];
        const hasEvent = eventDates.has(iso);
        const meetingDay = d.getDay() === meetingConfig.schedule.weekday;
        const invUrl = invitationMap.get(iso);

        return (
          <button key={iso} onClick={() => invUrl && onInvitationTap(invUrl)}
            className={`flex shrink-0 flex-col items-center rounded-xl px-3 py-2 w-12 transition ${
              invUrl ? "ring-2 ring-yellow-400/60" : ""
            } ${
              isToday ? "bg-blue-accent text-white" :
              meetingDay ? "bg-blue-primary/60 text-white border border-blue-accent/40" :
              "bg-blue-primary/20 text-blue-light/60"
            }`}>
            <span className="text-xs">{d.toLocaleDateString("en", { weekday: "short" })}</span>
            <span className="text-base font-bold">{d.getDate()}</span>
            <span className={`mt-0.5 h-1.5 w-1.5 rounded-full ${
              invUrl ? "bg-yellow-400" :
              hasEvent ? "bg-yellow-400/60" :
              meetingDay ? "bg-blue-accent/60" :
              "opacity-0"
            }`} />
          </button>
        );
      })}
    </div>
  );
}

export default function EventsPage() {
  const locale = useLocale();
  const isAr = locale === "ar";
  const [events, setEvents] = useState<SpecialEvent[]>([]);
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);
  const [fullscreenImg, setFullscreenImg] = useState<string | null>(null);
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    Promise.all([
      fetch("/api/events").then((r) => r.json()),
      fetch("/api/invitations").then((r) => r.json()),
    ]).then(([eventsData, invData]) => {
      setEvents(Array.isArray(eventsData) ? eventsData : []);
      setInvitations(Array.isArray(invData) ? invData : []);
      setLoading(false);
    });
  }, []);

  const today = new Date().toISOString().split("T")[0];
  const upcoming = events.filter((e) => e.date >= today);
  const past = events.filter((e) => e.date < today);

  // Next meeting-day invitation
  const nextFriday = getNextMeetingISO();
  const nextInvitation = invitations.find((i) => i.date === nextFriday);

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={isAr ? "الفعاليات" : "Events"} icon="📅" />

      <div className="pt-4 pb-2">
        <WeeklyMeetingCard />
      </div>

      {/* Next Friday invitation banner */}
      {nextInvitation && (
        <button onClick={() => setFullscreenImg(nextInvitation.url)}
          className="mx-4 mb-2 w-[calc(100%-2rem)] overflow-hidden rounded-2xl border border-yellow-400/30 shadow-lg shadow-yellow-400/10 active:scale-95 transition">
          <Image src={nextInvitation.url} alt="invitation" width={600} height={300}
            className="w-full object-cover max-h-48" />
        </button>
      )}

      <DateStrip events={events} invitations={invitations} onInvitationTap={setFullscreenImg} />

      {loading ? (
        <div className="flex justify-center pt-10 text-blue-light/50 text-sm">Loading…</div>
      ) : (
        <div className="px-4 pb-4">
          {upcoming.length > 0 && (
            <section className="mb-4">
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-light/50">
                {isAr ? "فعاليات قادمة" : "Upcoming"}
              </p>
              <div className="flex flex-col gap-3">
                {upcoming.map((e) => <EventCard key={e.id} event={e} isAr={isAr} invitation={invitations.find((i) => i.date === e.date)} onInvitationTap={setFullscreenImg} />)}
              </div>
            </section>
          )}

          {past.length > 0 && (
            <section>
              <p className="mb-2 text-xs font-semibold uppercase tracking-widest text-blue-light/50">
                {isAr ? "فعاليات سابقة" : "Past Events"}
              </p>
              <div className="flex flex-col gap-3 opacity-60">
                {[...past].reverse().map((e) => <EventCard key={e.id} event={e} isAr={isAr} invitation={invitations.find((i) => i.date === e.date)} onInvitationTap={setFullscreenImg} />)}
              </div>
            </section>
          )}

          {/* Invitation history */}
          {invitations.length > 0 && (
            <section className="mt-4">
              <button onClick={() => setShowHistory((p) => !p)}
                className="flex items-center gap-2 text-xs font-semibold uppercase tracking-widest text-blue-light/50 mb-2">
                <span>{isAr ? "سجل الدعوات" : "Invitation History"}</span>
                <span>{showHistory ? "▲" : "▼"}</span>
              </button>
              {showHistory && (
                <div className="grid grid-cols-3 gap-2">
                  {invitations.map((inv) => (
                    <button key={inv.publicId} onClick={() => setFullscreenImg(inv.url)}
                      className="relative aspect-square overflow-hidden rounded-xl border border-blue-mid/30 active:scale-95 transition">
                      <Image src={inv.url} alt={inv.date} fill className="object-cover" sizes="33vw" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/50 py-0.5 text-center text-xs text-white/70">
                        {inv.date}
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </section>
          )}

          {upcoming.length === 0 && past.length === 0 && invitations.length === 0 && (
            <div className="flex flex-col items-center pt-8 text-blue-light/40 gap-2">
              <span className="text-4xl">📅</span>
              <p className="text-sm">{isAr ? "لا توجد فعاليات حالياً" : "No events yet"}</p>
            </div>
          )}
        </div>
      )}

      {/* Fullscreen image viewer */}
      {fullscreenImg && (
        <div className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-black/95"
          onClick={() => setFullscreenImg(null)}>
          <button className="absolute top-4 right-4 text-white/70 text-2xl">✕</button>
          <Image src={fullscreenImg} alt="invitation" width={800} height={800}
            className="max-h-[90dvh] max-w-full object-contain rounded-xl" />
        </div>
      )}
    </div>
  );
}

function EventCard({ event, isAr, invitation, onInvitationTap }: {
  event: SpecialEvent; isAr: boolean;
  invitation?: Invitation;
  onInvitationTap: (url: string) => void;
}) {
  const title = isAr ? event.titleAr : event.title;
  const desc = isAr ? event.descriptionAr : event.description;
  const date = new Date(event.date).toLocaleDateString(isAr ? "ar-EG" : "en-US", {
    weekday: "long", year: "numeric", month: "long", day: "numeric",
  });

  return (
    <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/5 overflow-hidden backdrop-blur-sm">
      {invitation && (
        <button onClick={() => onInvitationTap(invitation.url)} className="w-full">
          <Image src={invitation.url} alt="invitation" width={600} height={200}
            className="w-full object-cover max-h-40" />
        </button>
      )}
      <div className="flex items-start gap-3 p-4">
        <span className="text-2xl mt-0.5">✨</span>
        <div className="flex-1">
          <p className="font-bold text-white">{title}</p>
          <p className="text-xs text-blue-light/60 mt-0.5">{date} · {event.time}</p>
          {desc && <p className="text-sm text-blue-light/80 mt-1">{desc}</p>}
        </div>
      </div>
    </div>
  );
}
