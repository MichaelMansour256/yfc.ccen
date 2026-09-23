/**
 * GET /api/attendance/qr-sheet — QR data for the printable sheet.
 *
 * Returns every member (active first) with a PNG data URL of their QR code.
 * The sheet page (/admin/attendance/members/qr-sheet) renders the cards and
 * calls window.print(), so scanning "Generate all QR codes" in the admin UI
 * costs exactly one request.
 *
 * JSON, not HTML, because the route is behind the admin password header and a
 * plain `window.open()` could never send that header.
 *
 * Auth: x-admin-password.
 */
import { NextResponse } from "next/server";
import { listMembers } from "@/lib/attendance";
import { databaseError, requireAdmin } from "@/lib/attendance-api";
import { generateQrPngDataUrl, getCheckInUrl } from "@/lib/qrcode";

/** Safety valve: a single print run never needs more than this many QR codes. */
const MAX_CARDS = 300;

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const onlyActive = searchParams.get("onlyActive") !== "0";

  try {
    const members = (await listMembers()).filter((m) => !onlyActive || m.active);
    const capped = members.slice(0, MAX_CARDS);

    const cards = await Promise.all(
      capped.map(async (m) => ({
        id: m.id,
        name: m.name,
        member_code: m.member_code,
        active: m.active,
        checkInUrl: getCheckInUrl(m.qr_token),
        dataUrl: await generateQrPngDataUrl(m.qr_token),
      }))
    );

    return NextResponse.json(
      { count: cards.length, truncated: members.length > MAX_CARDS, members: cards },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return databaseError("qr-sheet", err);
  }
}
