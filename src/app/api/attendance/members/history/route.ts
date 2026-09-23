/**
 * GET /api/attendance/members/history?id=<memberId>
 *
 * Attendance history for one member: every meeting they were expected at, with
 * present/absent, plus Meetings Attended / Missed / Rate.
 *
 * Auth: x-admin-password.
 */
import { NextResponse } from "next/server";
import { memberHistory } from "@/lib/attendance";
import { badRequest, databaseError, notFound, requireAdmin } from "@/lib/attendance-api";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return badRequest("id query param is required");

  try {
    const history = await memberHistory(id);
    if (!history.member) return notFound("Member not found");
    return NextResponse.json(history);
  } catch (err) {
    return databaseError("members.history", err);
  }
}
