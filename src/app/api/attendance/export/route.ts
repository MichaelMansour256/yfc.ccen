/**
 * GET /api/attendance/export?meetingId=<uuid>
 *
 * Downloads one meeting's attendance as a real .xlsx workbook
 * (exceljs, generated in-memory — no paid service, no temp files).
 * Present AND absent members are included.
 *
 * The file is fetched with the admin header and saved from a blob, because a
 * plain <a href> cannot send x-admin-password.
 *
 * Auth: x-admin-password.
 */
import { NextResponse } from "next/server";
import { getMeetingById, meetingReport } from "@/lib/attendance";
import { badRequest, databaseError, notFound, requireAdmin } from "@/lib/attendance-api";
import { generateAttendanceWorkbook } from "@/lib/excel-export";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const meetingId = new URL(req.url).searchParams.get("meetingId");
  if (!meetingId) return badRequest("meetingId query param is required");

  try {
    const meeting = await getMeetingById(meetingId);
    if (!meeting) return notFound("Meeting not found");

    const report = await meetingReport(meeting.id);
    const workbook = await generateAttendanceWorkbook(meeting, report);
    const buffer = await workbook.xlsx.writeBuffer();

    // ASCII-only filename so every browser/Vercel edge accepts the header.
    const filename = `attendance-${meeting.meeting_date}.xlsx`;

    return new NextResponse(buffer as ArrayBuffer, {
      status: 200,
      headers: {
        "Content-Type":
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Content-Length": String(buffer.byteLength),
        "Cache-Control": "no-store",
      },
    });
  } catch (err) {
    return databaseError("export", err);
  }
}
