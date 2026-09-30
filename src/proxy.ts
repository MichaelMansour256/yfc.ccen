/**
 * next-intl middleware.
 *
 * Responsibilities:
 *   • redirect an unprefixed URL to the negotiated locale (cookie →
 *     Accept-Language → `routing.defaultLocale`);
 *   • rewrite a prefixed URL so the locale is available to the app router.
 *
 * It deliberately does NOT touch a URL that already carries an explicit
 * locale: `routing.localePrefix` is `"always"`, so `/en/...` is served as
 * English and `/ar/...` as Arabic, and neither the locale cookie nor the
 * browser's Accept-Language header can override that.
 */
import createMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

export default createMiddleware(routing);

export const config = {
  /**
   * `checkin` is excluded because /checkin/[token] is a standalone public route
   * (its own html/body, no locale prefix) — a scanned QR must not take an extra
   * redirect through the i18n middleware. The QR codes are generated in
   * src/lib/qrcode.ts and point straight at it.
   *
   * `admin` is excluded for the same reason: it is an English-only internal
   * tool with its own <html lang="en">.
   */
  matcher: ["/((?!_next|api|admin|checkin|.*\\..*).*)"],
};

