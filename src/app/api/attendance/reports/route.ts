/**
 * GET /api/attendance/reports
 *
 *   (no params)          → { meetings (with stats), activeMeeting }
 *   ?meetingId=<uuid>    → { meeting, report, stats }
 *   ?from=&to=YYYY-MM-DD → { range }
 *
 * Auth: x-admin-password.
 */
import { NextResponse } from "next/server";
import {
  getActiveMeeting,
  getMeetingById,
  meetingReport,
  meetingSummaries,
  rangeReport,
  statsFromReport,
} from "@/lib/attendance";
import { badRequest, databaseError, requireAdmin } from "@/lib/attendance-api";

const ISO_DATE = /^\d{4}-\d{2}-\d{2}$/;

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const meetingId = searchParams.get("meetingId");
  const from = searchParams.get("from");
  const to = searchParams.get("to");

  try {
    if (meetingId) {
      const meeting = await getMeetingById(meetingId);
      if (!meeting) return badRequest("Meeting not found");
      const report = await meetingReport(meeting.id);
      return NextResponse.json({ meeting, report, stats: statsFromReport(report) });
    }

    if (from || to) {
      if (!from || !to || !ISO_DATE.test(from) || !ISO_DATE.test(to)) {
        return badRequest("from and to must both be YYYY-MM-DD");
      }
      if (from > to) return badRequest("from must be before to");
      return NextResponse.json({ range: await rangeReport(from, to) });
    }

    const [meetings, activeMeeting] = await Promise.all([
      meetingSummaries(),
      getActiveMeeting(),
    ]);
    return NextResponse.json({ meetings, activeMeeting });
  } catch (err) {
    return databaseError("reports", err);
  }
}
