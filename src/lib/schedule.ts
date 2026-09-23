import { meetingConfig } from "@/config";

/**
 * Weekly-schedule helpers driven by `meetingConfig.schedule`
 * (weekday + time), so a new meeting only changes the config.
 * Both helpers work in the viewer's local time, matching the original
 * client-side behavior.
 */

/**
 * Next meeting date/time in local time (used by the countdown hook).
 * If the meeting already started today, rolls forward one week.
 */
export function getNextMeetingDate(now = new Date()): Date {
  const next = new Date(now);
  const daysUntil = (meetingConfig.schedule.weekday - now.getDay() + 7) % 7;
  next.setDate(now.getDate() + (daysUntil === 0 ? 0 : daysUntil));
  const [hours, minutes] = meetingConfig.schedule.time.split(":").map(Number);
  next.setHours(hours, minutes, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 7);
  return next;
}

/**
 * Next meeting day (YYYY-MM-DD) in local time — always strictly in the
 * future, even when today is the meeting day (used to find the upcoming
 * invitation on the events page).
 */
export function getNextMeetingISO(now = new Date()): string {
  const d = new Date(now);
  const diff = (meetingConfig.schedule.weekday - d.getDay() + 7) % 7 || 7;
  d.setDate(d.getDate() + diff);
  return d.toISOString().split("T")[0];
}
