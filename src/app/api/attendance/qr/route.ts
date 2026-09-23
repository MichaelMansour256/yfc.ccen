/**
 * GET /api/attendance/qr — QR code for one member.
 *
 *   ?id=<memberId>   or   ?token=<qr_token>
 *   &format=svg | png (default png → JSON so the admin UI can preview,
 *                            download and print it as an <img>)
 *
 * The QR contains only the public check-in URL of that member's random token.
 * Auth: x-admin-password (so QR codes cannot be harvested from the internet).
 */
import { NextResponse } from "next/server";
import { getMemberById, getMemberByQrToken } from "@/lib/attendance";
import { badRequest, databaseError, notFound, requireAdmin } from "@/lib/attendance-api";
import { generateQrPngDataUrl, generateQrSvg, getCheckInUrl } from "@/lib/qrcode";

export async function GET(req: Request) {
  const denied = requireAdmin(req);
  if (denied) return denied;

  const { searchParams } = new URL(req.url);
  const id = searchParams.get("id");
  const token = searchParams.get("token");
  const format = searchParams.get("format") === "svg" ? "svg" : "png";

  if (!id && !token) return badRequest("id or token query param is required");

  try {
    const member = id
      ? await getMemberById(id)
      : await getMemberByQrToken(token as string);

    if (!member) return notFound("Member not found");

    if (format === "svg") {
      const svg = await generateQrSvg(member.qr_token);
      return new NextResponse(svg, {
        status: 200,
        headers: {
          "Content-Type": "image/svg+xml; charset=utf-8",
          "Cache-Control": "no-store",
        },
      });
    }

    const dataUrl = await generateQrPngDataUrl(member.qr_token);
    return NextResponse.json(
      {
        dataUrl,
        checkInUrl: getCheckInUrl(member.qr_token),
        member: {
          id: member.id,
          name: member.name,
          member_code: member.member_code,
          active: member.active,
        },
      },
      { headers: { "Cache-Control": "no-store" } }
    );
  } catch (err) {
    return databaseError("qr", err);
  }
}
