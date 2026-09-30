/**
 * Localized content values.
 *
 * UI copy (buttons, labels, headings, empty states…) belongs in
 * `messages/{locale}.json` and is read with `useTranslations` / `getTranslations`.
 * This module is for the OTHER kind of string: *content* that ships with the
 * meeting itself — a servant's name, a meeting tagline, a pillar description.
 *
 * That content lives in `src/config/*.ts` as an explicit pair per language:
 *
 *     { ar: "ريهام عدلي", en: "Reham Adly" }
 *
 * and is read through `localized()`. The pair is mandatory: both languages are
 * written next to each other, so a missing translation is a visible gap in the
 * data at review time rather than a silent Arabic fallback at runtime.
 */
import type { AppLocale } from "@/i18n/locales";

/**
 * A piece of meeting content that exists in every shipped language.
 *
 * Both keys are required on purpose. Making `en` optional is what allowed
 * English pages to quietly fall back to Arabic in the first place.
 */
export type LocalizedText = Readonly<Record<AppLocale, string>>;

/** Build a `LocalizedText` with both languages required at the call site. */
export function localized(ar: string, en: string): LocalizedText {
  return { ar, en };
}

/**
 * Read the value for `locale`.
 *
 * There is deliberately NO cross-language fallback: if a caller reaches this
 * function, the value exists in every language, so a missing key is a data bug
 * that should be visible in development rather than papered over at runtime.
 */
export function localizedValue(value: LocalizedText, locale: AppLocale): string {
  return value[locale];
}

/** Same as `localizedValue`, for content stored as two loose columns. */
export function pickLocalized(
  ar: string | null | undefined,
  en: string | null | undefined,
  locale: AppLocale
): string {
  const value = locale === "ar" ? ar : en;
  return (value ?? "").trim();
}

/**
 * Same as `pickLocalized`, but returns `null` instead of an empty string so
 * callers can hide a line entirely instead of rendering a blank one.
 *
 * `fallback` is opt-in and explicit. It is only appropriate for content that
 * is genuinely language-neutral (a URL, a date, an emoji) — never to paper
 * over a missing translation, which is how the Arabic-on-English bug stayed
 * invisible for so long.
 */
export function pickLocalizedOrNull(
  ar: string | null | undefined,
  en: string | null | undefined,
  locale: AppLocale,
  fallback: string | null = null
): string | null {
  const value = (locale === "ar" ? ar : en)?.trim();
  if (value) return value;
  return fallback;
}

/** `Intl` tag for a locale — single source of truth for date formatting. */
export { getIntlLocale, getDirection } from "@/i18n/locales";
