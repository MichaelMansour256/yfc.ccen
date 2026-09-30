/**
 * The ONE place that knows which locales exist and what their
 * language/direction/intl tag is.
 *
 * Everything else imports from here — `routing.ts` included — so adding a
 * locale is a one-line change and there is no second list to drift.
 *
 * RULE: an explicit locale in the URL always wins. `DEFAULT_LOCALE` is only
 * used when NO locale is present in the URL (e.g. `/` before the middleware
 * redirects, API routes, server-only helpers). It is never a fallback for a
 * page that was asked for in another language.
 */

export const APP_LOCALES = ["en", "ar"] as const;

export type AppLocale = (typeof APP_LOCALES)[number];

/**
 * The locale used when the request carries no locale at all. Arabic, because
 * the meeting's primary audience is Arabic-speaking. This is a *default for
 * unprefixed URLs*, NOT a fallback for a missing translation.
 */
export const DEFAULT_LOCALE: AppLocale = "ar";

/** Type guard — the only correct way to narrow a `string` from a URL param. */
export function isAppLocale(value: unknown): value is AppLocale {
  return (
    typeof value === "string" && (APP_LOCALES as readonly string[]).includes(value)
  );
}

/**
 * Narrow an arbitrary string (URL param, header, cookie) to an `AppLocale`,
 * falling back to `DEFAULT_LOCALE` when it is not a locale we ship.
 */
export function toAppLocale(value: unknown): AppLocale {
  return isAppLocale(value) ? value : DEFAULT_LOCALE;
}

/** Writing direction of a locale. */
export function getDirection(locale: AppLocale): "rtl" | "ltr" {
  return locale === "ar" ? "rtl" : "ltr";
}

/**
 * BCP-47 tag used for `Intl` formatters. Arabic gets the Egyptian tag so
 * `toLocaleDateString` renders the same digits/ordering the meeting already
 * used everywhere before the i18n split.
 */
export function getIntlLocale(locale: AppLocale): string {
  return locale === "ar" ? "ar-EG" : "en-US";
}

/** The other shipped locale — used by the language switcher. */
export function otherLocale(locale: AppLocale): AppLocale {
  return locale === "ar" ? "en" : "ar";
}

/**
 * Native name of a language, for the switcher button.
 *
 * Each language is labelled in its OWN script (the standard convention for a
 * language picker): the English site shows "العربية", the Arabic site shows
 * "English". This is the one place a short piece of the other language
 * legitimately appears — it names the target language rather than being UI
 * copy, so it is not "the page rendering in the wrong language".
 */
export function localeLabel(locale: AppLocale): string {
  return locale === "ar" ? "العربية" : "English";
}

/** Flag shown on the switcher button (the *target* language's flag). */
export function localeFlag(locale: AppLocale): string {
  return locale === "ar" ? "🇪🇬" : "🇬🇧";
}
