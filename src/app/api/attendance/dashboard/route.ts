/**
 * GET /api/attendance/dashboard — live attendance board for one meeting.
 *
 *   ?meetingId=<uuid>   the meeting to show (defaults to the open meeting)
 *   ?search=<text>      filter by member name or code
 *   ?filter=present|absent
 *   ?sort=check_in_time|name|member_code   ?dir=asc|desc
 *
 * Returns the meeting, every expected member with their check-in time, and the
 * aggregate stats. The dashboard polls this (5–10s) instead of subscribing to
 * Supabase Realtime, because the project's Supabase key is a server-side secret
 * and must not be shipped to the browser.
 *
 * Auth: x-admin-password.
 */
import { NextResponse } from "next/server";
import {
  getActiveMeeting,
  getMeetingById,
  meetingReport,
  statsFromReport,
  type MeetingMemberRow,
} from "@/lib/attendance";
import { badRequest, databaseError, requireAdmin } from "@/lib/attendance-api";

type SortKey = "check_in_time" | "name" | "member_code";

function sortRows(rows: MeetingMemberRow[], key: SortKey, dir: "asc" | "desc") {
  const factor = dir === "asc" ? 1 : -1;
  return [...rows].sort((a, b) => {
    let cmp = 0;
    if (key === "name") {
      cmp = a.name.localeCompare(b.name, "ar");
    } else if (key === "member_code") {
      cmp = a.member_code.localeCompare(b.member_code);
    } else {
      // Present members first (newest check-in when descending), absent last.
      if (a.check_in_time && b.check_in_time) {
        cmp = new Date(a.check_in_time).getTime() - new Date(b.check_in_time).getTime();
      } else if (a.check_in_time) {
        cmp = -1;
      } else if (b.check_in_time) {
        cmp = 1;
      }
    }
    return cmp * factor;
  });
}

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const meetingId = searchParams.get("meetingId");
  const search = (searchParams.get("search") ?? "").toLowerCase().trim();
  const filter = searchParams.get("filter");
  const sort = (searchParams.get("sort") ?? "check_in_time") as SortKey;
  const dir = searchParams.get("dir") === "asc" ? "asc" : "desc";

  try {
    const activeMeeting = await getActiveMeeting();
    const meeting = meetingId ? await getMeetingById(meetingId) : activeMeeting;

    if (meetingId && !meeting) return badRequest("Meeting not found");

    if (!meeting) {
      return NextResponse.json({
        meeting: null,
        activeMeeting: null,
        members: [],
        stats: { totalMembers: 0, present: 0, absent: 0, attendanceRate: 0 },
      });
    }

    const report = await meetingReport(meeting.id);
    const stats = statsFromReport(report);

    let rows = report;
    if (search) {
      rows = rows.filter(
        (r) =>
          r.name.toLowerCase().includes(search) ||
          r.member_code.toLowerCase().includes(search)
      );
    }
    if (filter === "present") rows = rows.filter((r) => r.present);
    else if (filter === "absent") rows = rows.filter((r) => !r.present);

    rows = sortRows(rows, sort, dir);

    return NextResponse.json({
      meeting,
      activeMeeting,
      isActive: activeMeeting?.id === meeting.id,
      stats,
      members: rows,
    });
  } catch (err) {
    return databaseError("dashboard", err);
  }
}
