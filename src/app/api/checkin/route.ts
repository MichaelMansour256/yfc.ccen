/**
 * POST /api/checkin — public QR IDENTIFICATION endpoint (read-only).
 *
 * Called once by /checkin/[token] (the URL a member's QR code points at) to
 * show the member their own identity card and current status. It NEVER
 * creates attendance: the QR identifies, it does not authorize. Recording is
 * staff-only — POST /api/attendance/checkin re-validates the admin/servant
 * password server-side before writing anything to Supabase.
 *
 * Responses (always HTTP 200 for business outcomes):
 *   { ok: true,  status: "found" | "inactive_member", member, meeting|null,
 *     checked_in, check_in_time, message }
 *   { ok: false, status: "invalid_token", message, error }
 *   HTTP 400 malformed request • HTTP 503 database unavailable (no detail)
 */
import { NextResponse } from "next/server";
import { identifyByQrToken, isPlausibleQrToken } from "@/lib/attendance";
import { readJson } from "@/lib/attendance-api";

const MESSAGES = {
  found: "تم التعرف على العضو",
  inactive_member: "هذا العضو غير نشط",
  invalid_token: "QR Code غير صالح",
} as const;

export async function POST(req: Request) {
  const body = await readJson<{ token?: unknown }>(req);
  const fromQuery = new URL(req.url).searchParams.get("token");
  const token =
    typeof body.token === "string" ? body.token : typeof fromQuery === "string" ? fromQuery : "";

  if (!isPlausibleQrToken(token)) {
    return NextResponse.json(
      {
        ok: false,
        status: "invalid_token",
        message: MESSAGES.invalid_token,
        error: MESSAGES.invalid_token,
      },
      { status: 400 }
    );
  }

  const result = await identifyByQrToken(token);

  if (result.infrastructureError) {
    // Technical cause is logged in src/lib/attendance.ts — never sent here.
    return NextResponse.json(
      {
        ok: false,
        status: "error",
        message: "تعذّر الاتصال بنظام الحضور. حاول مرة أخرى بعد قليل.",
        error: "تعذّر الاتصال بنظام الحضور. حاول مرة أخرى بعد قليل.",
      },
      { status: 503 }
    );
  }

  return NextResponse.json(
    {
      ok: result.status === "found",
      status: result.status,
      message: MESSAGES[result.status],
      member: result.member ?? null,
      meeting: result.meeting,
      checked_in: result.checked_in,
      check_in_time: result.check_in_time,
    },
    { status: 200 }
  );
}
