import { defineRouting } from "next-intl/routing";
import { APP_LOCALES, DEFAULT_LOCALE } from "./locales";

export const routing = defineRouting({
  locales: APP_LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  /**
   * `always` is what makes "if the URL says /en, the page MUST be English"
   * a structural guarantee: the prefix is part of the path, so no redirect,
   * cookie or Accept-Language header can silently turn `/en/x` into Arabic.
   *
   * A locale is only negotiated (cookie → Accept-Language → default) for
   * URLs that arrive WITHOUT a prefix, which the middleware then redirects.
   */
  localePrefix: "always",
});

export type Routing = typeof routing;

