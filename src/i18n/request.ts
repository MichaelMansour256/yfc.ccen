import { getRequestConfig } from "next-intl/server";
import { routing } from "./routing";
import { isAppLocale } from "./locales";

export default getRequestConfig(async ({ requestLocale }) => {
  // `requestLocale` is derived from the [locale] route segment by next-intl, so
  // on /en/... it is exactly "en". It is NEVER re-negotiated from cookies or
  // Accept-Language here — a locale present in the URL must win.
  const requested = await requestLocale;

  // Only an ABSENT or unsupported locale falls back to the default. This branch
  // runs for unprefixed URLs (e.g. server components rendered outside the
  // middleware, or an API helper) — never to "fix" a page that asked for a
  // language and did not get it.
  const locale = isAppLocale(requested) ? requested : routing.defaultLocale;

  return {
    locale,
    messages: (await import(`../../messages/${locale}.json`)).default,
  };
});
