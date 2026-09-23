/**
 * QR code helpers — check-in URL builder + code rendering.
 *
 * Uses the `qrcode` npm package (added to the project). Server-side only: the
 * rendering happens in API routes so QR codes stay behind the admin password.
 *
 * The check-in URL is the standalone public route:
 *   <siteUrl>/checkin/<qr_token>
 * It contains NOTHING but the opaque random token — no member id, no code, no
 * name, no database detail. See src/app/checkin/[token]/.
 */
import QRCode from "qrcode";
import { siteConfig } from "@/config";

/** Build the public check-in URL embedded in a QR code. */
export function getCheckInUrl(token: string): string {
  const base = siteConfig.url.replace(/\/+$/, "");
  return `${base}/checkin/${token}`;
}

/**
 * High-quality QR code as a self-contained SVG string: crisp at any print size,
 * small enough to inline in a printable sheet (no external assets).
 */
export async function generateQrSvg(token: string): Promise<string> {
  return QRCode.toString(getCheckInUrl(token), {
    type: "svg",
    errorCorrectionLevel: "M",
    margin: 1,
    scale: 8,
    width: 320,
  });
}

/**
 * QR code as a PNG data URL — used for on-screen preview, download and print.
 * 640px is comfortably above the ~250px a card needs, so printing stays sharp.
 */
export async function generateQrPngDataUrl(token: string): Promise<string> {
  return QRCode.toDataURL(getCheckInUrl(token), {
    type: "image/png",
    errorCorrectionLevel: "M",
    margin: 1,
    width: 640,
    scale: 8,
  });
}
