"use client";
import { useNextMeeting } from "@/hooks/useNextMeeting";
import { useFormatter, useLocale, useTranslations } from "next-intl";
import { meetingConfig } from "@/config";
import { localizedValue } from "@/lib/localized";
import { toAppLocale } from "@/i18n/locales";

export default function WeeklyMeetingCard() {
  const { countdown, nextDate } = useNextMeeting();
  const t = useTranslations("weeklyMeeting");
  const format = useFormatter();
  const locale = toAppLocale(useLocale());

  const dateStr = nextDate
    ? format.dateTime(nextDate, { weekday: "long", month: "long", day: "numeric" })
    : null;

  return (
    <div className="mx-4 rounded-2xl border border-blue-accent/40 bg-gradient-to-br from-blue-primary/60 to-blue-dark/80 p-5 backdrop-blur-sm shadow-lg shadow-blue-accent/10">
      {/* Header */}
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">⛪</span>
        <div>
          <p className="text-sm font-bold text-white">{t("title")}</p>
          <p className="text-xs text-blue-light/70">
            {localizedValue(meetingConfig.schedule.label, locale)}
          </p>
        </div>
        {countdown.isToday && (
          <span className="ms-auto rounded-full bg-blue-accent px-3 py-0.5 text-xs font-bold text-white animate-pulse">
            {t("today")}
          </span>
        )}
      </div>

      {/* Next date */}
      <p className="text-xs text-blue-light/60 mb-3">{t("next")} {dateStr}</p>

      {/* Countdown */}
      <div className="grid grid-cols-4 gap-2">
        {[
          { value: countdown.days, label: t("days") },
          { value: countdown.hours, label: t("hours") },
          { value: countdown.minutes, label: t("minutes") },
          { value: countdown.seconds, label: t("seconds") },
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
