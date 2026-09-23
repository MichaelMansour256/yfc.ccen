import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  /**
   * `checkin` is excluded because /checkin/[token] is a standalone public route
   * (its own html/body, no locale prefix) — a scanned QR must not take an extra
   * redirect through the i18n middleware. The QR codes are generated in
   * src/lib/qrcode.ts and point straight at it.
   */
  matcher: ["/((?!_next|api|admin|checkin|.*\\..*).*)"],
};
