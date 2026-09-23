"use client";
import { useNextMeeting } from "@/hooks/useNextMeeting";
import { useLocale } from "next-intl";
import { meetingConfig } from "@/config";

export default function WeeklyMeetingCard() {
  const { countdown, nextDate } = useNextMeeting();
  const locale = useLocale();
  const isAr = locale === "ar";

  const dateStr = nextDate?.toLocaleDateString(isAr ? "ar-EG" : "en-US", {
    weekday: "long", month: "long", day: "numeric",
  });

  return (
    <div className="mx-4 rounded-2xl border border-blue-accent/40 bg-gradient-to-br from-blue-primary/60 to-blue-dark/80 p-5 backdrop-blur-sm shadow-lg shadow-blue-accent/10">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⛪</span>
        <div>
          <p className="text-sm font-bold text-white">{isAr ? "الاجتماع الأسبوعي" : "Weekly Meeting"}</p>
          <p className="text-xs text-blue-light/70">
            {isAr ? meetingConfig.schedule.labelAr : meetingConfig.schedule.labelEn}
          </p>
        </div>
        {countdown.isToday && (
          <span className="ms-auto rounded-full bg-blue-accent px-3 py-0.5 text-xs font-bold text-white animate-pulse">
            {isAr ? "اليوم!" : "Today!"}
          </span>
        )}
      </div>

      {/* Next date */}
      <p className="text-xs text-blue-light/60 mb-3">{isAr ? "القادم:" : "Next:"} {dateStr}</p>

      {/* Countdown */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { value: countdown.days, label: isAr ? "يوم" : "Days" },
          { value: countdown.hours, label: isAr ? "ساعة" : "Hours" },
          { value: countdown.minutes, label: isAr ? "دقيقة" : "Mins" },
          { value: countdown.seconds, label: isAr ? "ثانية" : "Secs" },
        ].map(({ value, label }) => (
          <div key={label} className="flex flex-col items-center rounded-xl bg-blue-dark/60 py-2">
            <span className="text-xl font-bold text-white tabular-nums">
              {String(value).padStart(2, "0")}
            </span>
            <span className="text-xs text-blue-light/50">{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
