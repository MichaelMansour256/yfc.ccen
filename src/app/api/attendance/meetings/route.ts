/**
 * GET /api/attendance/meetings — meetings list + management actions.
 *
 * GET    ?withStats=1   meetings with present/absent counts (admin lists)
 * GET    (no params)    plain list + the currently open meeting
 * POST                  create a meeting (title, meeting_date, times)
 * PATCH ?action=open|close|update
 * DELETE ?id=<uuid>     delete a meeting (its attendance rows cascade)
 *
 * Auth: x-admin-password.
 */
import { NextResponse } from "next/server";
import {
  closeMeeting,
  createMeeting,
  deleteMeeting,
  getActiveMeeting,
  listMeetings,
  meetingSummaries,
  openMeeting,
  updateMeeting,
  type MeetingStatus,
} from "@/lib/attendance";
import { badRequest, databaseError, readJson, requireAdmin } from "@/lib/attendance-api";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);

  try {
    const activeMeeting = await getActiveMeeting();

    if (searchParams.get("withStats")) {
      return NextResponse.json({ meetings: await meetingSummaries(), activeMeeting });
    }

    let meetings = await listMeetings();
    const status = searchParams.get("status");
    if (status) meetings = meetings.filter((m) => m.status === status);

    return NextResponse.json({ meetings, activeMeeting });
  } catch (err) {
    return databaseError("meetings.GET", err);
  }
}

export async function POST(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await readJson<{
    title?: unknown;
    meeting_date?: unknown;
    start_time?: unknown;
    end_time?: unknown;
    open?: unknown;
  }>(req);

  const title = typeof body.title === "string" ? body.title.trim() : "";
  const meeting_date = typeof body.meeting_date === "string" ? body.meeting_date.trim() : "";
  const start_time = typeof body.start_time === "string" ? body.start_time : null;
  const end_time = typeof body.end_time === "string" ? body.end_time : null;

  if (!title) return badRequest("title is required");
  if (!/^\d{4}-\d{2}-\d{2}$/.test(meeting_date)) {
    return badRequest("meeting_date must be YYYY-MM-DD");
  }

  try {
    const meeting = await createMeeting({
      title,
      meeting_date,
      start_time,
      end_time,
      status: "scheduled",
    });

    // Creating a meeting with "open now" checked opens attendance immediately.
    if (body.open === true) {
      return NextResponse.json(await openMeeting(meeting.id), { status: 201 });
    }

    return NextResponse.json(meeting, { status: 201 });
  } catch (err) {
    return databaseError("meetings.POST", err);
  }
}

export async function PATCH(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const body = await readJson<{
    id?: unknown;
    action?: unknown;
    title?: unknown;
    meeting_date?: unknown;
    start_time?: unknown;
    end_time?: unknown;
  }>(req);

  const id = typeof body.id === "string" ? body.id : "";
  if (!id) return badRequest("id is required");

  try {
    if (body.action === "open") return NextResponse.json(await openMeeting(id));
    if (body.action === "close") return NextResponse.json(await closeMeeting(id));

    const patch: {
      title?: string;
      meeting_date?: string;
      start_time?: string | null;
      end_time?: string | null;
      status?: MeetingStatus;
    } = {};
    if (typeof body.title === "string" && body.title.trim()) patch.title = body.title;
    if (typeof body.meeting_date === "string" && body.meeting_date) {
      patch.meeting_date = body.meeting_date;
    }
    if (typeof body.start_time === "string") patch.start_time = body.start_time;
    if (typeof body.end_time === "string") patch.end_time = body.end_time;
    if (Object.keys(patch).length === 0) return badRequest("nothing to update");

    return NextResponse.json(await updateMeeting(id, patch));
  } catch (err) {
    return databaseError("meetings.PATCH", err);
  }
}

export async function DELETE(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const id = new URL(req.url).searchParams.get("id");
  if (!id) return badRequest("id query param is required");

  try {
    await deleteMeeting(id);
    return NextResponse.json({ ok: true });
  } catch (err) {
    return databaseError("meetings.DELETE", err);
  }
}
