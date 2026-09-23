// Shared helpers for weekly invitations (Cloudinary folder: `invitations`).
// public_id format: `invitations/YYYY-MM-DD` (date = the weekly meeting day).
import cloudinary from "./cloudinary";
import { meetingConfig } from "@/config";

export type Invitation = {
  date: string; // YYYY-MM-DD
  url: string;
  publicId: string;
};

export async function getInvitations(): Promise<Invitation[]> {
  try {
    const { resources } = await cloudinary.search
      .expression("folder:invitations")
      .sort_by("public_id", "desc")
      .max_results(200)
      .execute();

    return resources.map(
      (r: { public_id: string; secure_url: string }) => ({
        // public_id format: invitations/YYYY-MM-DD (may have suffix on overwrite)
        date: r.public_id.replace("invitations/", "").split("_")[0],
        url: r.secure_url,
        publicId: r.public_id,
      })
    );
  } catch {
    return [];
  }
}

/** Today's date (YYYY-MM-DD) in Cairo, regardless of server region. */
export function todayCairoISO(now = new Date()): string {
  const fmt = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Africa/Cairo",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  return fmt.format(now); // en-CA => YYYY-MM-DD
}

/**
 * Next meeting day (YYYY-MM-DD) in Cairo time.
 * If today (Cairo) is the meeting day, returns *next week's* date so the
 * reminder always points at the upcoming meeting, not today's.
 */
export function nextFridayCairoISO(now = new Date()): string {
  const MEETING_WEEKDAY = meetingConfig.schedule.weekday; // 0=Sun..6=Sat
  // Cairo weekday: 0=Sun..5=Fri..6=Sat
  const short = new Intl.DateTimeFormat("en-US", {
    timeZone: "Africa/Cairo",
    weekday: "short",
  }).format(now); // e.g. "Fri"
  const cairoWeekday = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"].indexOf(short);

  const diff = cairoWeekday === -1 ? 7 : (MEETING_WEEKDAY - cairoWeekday + 7) % 7 || 7;

  // Add `diff` days to Cairo wall-clock date (UTC noon avoids DST edges).
  const cairoToday = todayCairoISO(now); // YYYY-MM-DD
  const [y, m, d] = cairoToday.split("-").map(Number);
  const target = new Date(Date.UTC(y, m - 1, d, 12, 0, 0) + diff * 86400000);
  return target.toISOString().split("T")[0];
}
