/**
 * POST /api/attendance/checkin — STAFF-ONLY attendance recording.
 *
 * The only endpoint in the project that can create an attendance row.
 * Authorization is enforced HERE, server-side, BEFORE Supabase is touched —
 * frontend buttons, hidden fields, query parameters, QR contents and any
 * client-side role values are never trusted:
 *
 *   no x-admin-password header      → 401 (unauthenticated visitor/student)
 *   wrong x-admin-password          → 403 (authenticated but not staff)
 *   valid admin/servant password    → allowed (recorded once)
 *
 * The Supabase-level hole is closed too: supabase-attendance-lockdown.sql
 * revokes execute on check_in_with_token() from anon/authenticated, so a
 * student holding their own QR token can no longer self-check-in directly
 * with the publishable key. Duplicate scans are answered with
 * "already_recorded" and insert nothing — enforced by the DB's
 * UNIQUE(meeting_id, member_id) plus `on conflict do nothing` in the RPC.
 *
 * Responses (always HTTP 200 for business outcomes):
 *   { ok: true,  status: "success" | "already_recorded", member, meeting,
 *     check_in_time, message }
 *   { ok: false, status: "invalid_token" | "inactive_member" |
 *                        "no_active_meeting" | "error", message }
 *   HTTP 401/403 unauthorized • HTTP 400 malformed • HTTP 503 database
 */
import { NextResponse } from "next/server";
import { checkIn, isPlausibleQrToken, type CheckInStatus } from "@/lib/attendance";
import { readJson, requireStaff } from "@/lib/attendance-api";

const MESSAGES: Record<CheckInStatus, string> = {
  success: "تم تسجيل الحضور",
  already_recorded: "الحضور مسجل بالفعل",
  invalid_token: "QR Code غير صالح",
  inactive_member: "هذا العضو غير نشط",
  no_active_meeting: "لا يوجد اجتماع مفتوح حاليًا",
};

export async function POST(req: Request) {
  // 1) Authorization FIRST — nothing is read or written before this passes.
  const denied = requireStaff(req);
  if (denied) return denied;

  // 2) Shape validation.
  const body = await readJson<{ token?: unknown }>(req);
  const token = typeof body.token === "string" ? body.token : "";

  if (!isPlausibleQrToken(token)) {
    return NextResponse.json(
      { ok: false, status: "invalid_token", message: MESSAGES.invalid_token },
      { status: 400 }
    );
  }

  // 3) Record (once) via the SECURITY DEFINER RPC / tables fallback.
  const result = await checkIn(token);

  if (result.infrastructureError) {
    // Technical cause is logged in src/lib/attendance.ts — never sent here.
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        message: "تعذّر تسجيل الحضور. حاول مرة أخرى بعد قليل.",
      },
      { status: 503 }
    );
  }

  const ok = result.status === "success" || result.status === "already_recorded";

  return NextResponse.json(
    {
      ok,
      status: result.status,
      message: MESSAGES[result.status],
      member: result.member,
      meeting: result.meeting,
      check_in_time: result.check_in_time ?? null,
    },
    { status: 200 }
  );
}