/**
 * Shared presentation atoms for the attendance screens.
 *
 * Everything here reuses the existing visual language of the project (the
 * blue-* theme tokens defined in src/config/theme.ts → globals.css, and the same
 * card/input/button recipes as src/app/admin/page.tsx) so attendance looks like
 * a native part of the admin dashboard instead of a second design system.
 */
"use client";
import type { ReactNode } from "react";

/* ── Class recipes (same values as the existing admin page) ───────────────── */

export const inputClass =
  "w-full rounded-xl bg-blue-dark/60 px-4 py-2 text-white placeholder-blue-light/40 outline-none ring-1 ring-blue-mid/40 focus:ring-blue-accent text-sm";

export const primaryBtn =
  "rounded-xl bg-blue-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-mid disabled:opacity-50 disabled:cursor-not-allowed";

export const subtleBtn =
  "rounded-xl bg-blue-dark/60 px-3 py-2 text-sm font-semibold text-blue-light/80 transition hover:bg-blue-mid hover:text-white disabled:opacity-50";

export const dangerBtn =
  "rounded-xl bg-red-500/20 px-3 py-2 text-sm font-semibold text-red-300 transition hover:bg-red-500/30";

export const successBtn =
  "rounded-xl bg-green-500/20 px-3 py-2 text-sm font-semibold text-green-300 transition hover:bg-green-500/30";

export const cardClass = "rounded-2xl border border-blue-mid/40 bg-blue-primary/30";

/* ── Date / time formatting (Arabic month & day names, Latin digits) ─────── */

/**
 * "2026-09-20" → local Date. Date-only strings are parsed by hand so a
 * UTC server can never shift a meeting to the previous day.
 */
function toLocalDate(value: string): Date {
  const dateOnly = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (dateOnly) {
    return new Date(
      parseInt(dateOnly[1], 10),
      parseInt(dateOnly[2], 10) - 1,
      parseInt(dateOnly[3], 10)
    );
  }
  return new Date(value);
}

const AR = "ar-EG-u-nu-latn";

/** "20 سبتمبر 2026" */
export function formatDateAr(value: string): string {
  return toLocalDate(value).toLocaleDateString(AR, {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

/** "20 سبتمبر" — chips and dense tables. */
export function formatShortDateAr(value: string): string {
  return toLocalDate(value).toLocaleDateString(AR, { day: "numeric", month: "short" });
}

/** "الجمعة، 20 سبتمبر" */
export function formatWeekdayAr(value: string): string {
  return toLocalDate(value).toLocaleDateString(AR, {
    weekday: "long",
    day: "numeric",
    month: "long",
  });
}

/** "11:32 م" — rendered in the viewer's own time zone (the servants' phones). */
export function formatTimeAr(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(AR, { hour: "2-digit", minute: "2-digit", hour12: true });
}

/** "11:32:05 م" — used in the scanner log, where seconds matter. */
export function formatClockAr(value: string | null | undefined): string {
  if (!value) return "—";
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleTimeString(AR, {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });
}

/* ── Components ───────────────────────────────────────────────────────────── */

export function Card({
  title,
  actions,
  children,
  className = "",
}: {
  title?: ReactNode;
  actions?: ReactNode;
  children: ReactNode;
  className?: string;
}) {
  return (
    <section className={`${cardClass} p-4 sm:p-5 ${className}`}>
      {(title || actions) && (
        <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
          {title ? <h2 className="font-semibold text-white">{title}</h2> : <span />}
          {actions}
        </header>
      )}
      {children}
    </section>
  );
}

export function StatCard({
  label,
  value,
  icon,
  valueClassName,
  className,
}: {
  label: string;
  value: ReactNode;
  icon?: string;
  valueClassName?: string;
  className?: string;
}) {
  return (
    <div className={`rounded-2xl ${className ?? "bg-blue-dark/60"} p-4 text-center`}>
      {icon && <div className="mb-1 text-2xl">{icon}</div>}
      <div className={`text-2xl font-bold ${valueClassName ?? "text-white"}`}>{value}</div>
      <div className="text-xs text-blue-light/60">{label}</div>
    </div>
  );
}

export function EmptyState({
  icon = "ℹ️",
  title,
  hint,
  action,
}: {
  icon?: string;
  title: string;
  hint?: string;
  action?: ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-blue-mid/40 bg-blue-primary/20 p-8 text-center">
      <div className="mb-3 text-4xl">{icon}</div>
      <h3 className="mb-1 text-lg font-semibold text-white">{title}</h3>
      {hint && <p className="mb-4 text-sm text-blue-light/60">{hint}</p>}
      {action}
    </div>
  );
}

export function Banner({
  tone = "info",
  children,
}: {
  tone?: "info" | "success" | "warning" | "error";
  children: ReactNode;
}) {
  const tones = {
    info: "bg-blue-dark/50 text-blue-light",
    success: "bg-green-500/15 text-green-300",
    warning: "bg-amber-500/15 text-amber-200",
    error: "bg-red-500/15 text-red-300",
  } as const;
  return (
    <div className={`rounded-xl px-4 py-3 text-sm ${tones[tone]}`} role="status">
      {children}
    </div>
  );
}

export function Spinner({ label = "جارٍ التحميل…" }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-3 py-10 text-sm text-blue-light/70">
      <span
        className="h-4 w-4 animate-spin rounded-full border-2 border-blue-light/30 border-t-blue-light"
        aria-hidden
      />
      <span>{label}</span>
    </div>
  );
}

/** Present/absent pill shared by every attendance table. */
export function PresentPill({ present }: { present: boolean }) {
  return present ? (
    <span className="font-semibold text-green-400">✅ حاضر</span>
  ) : (
    <span className="font-semibold text-red-400">❌ غائب</span>
  );
}

