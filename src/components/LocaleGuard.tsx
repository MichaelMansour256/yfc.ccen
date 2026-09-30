"use client";
import { useEffect } from "react";
import { useLocale } from "next-intl";
import { usePathname } from "@/i18n/navigation";
import { isAppLocale } from "@/i18n/locales";

/**
 * Development-only i18n guard.
 *
 * THE bug this exists to prevent: a page under `/en/...` rendering Arabic.
 * That happens whenever a component stops consulting the locale and reaches
 * for a hard-coded string or a `*Ar` config field instead.
 *
 * This component compares the locale segment in the URL with the locale
 * next-intl actually resolved, and warns loudly when they disagree — the
 * signal that something in the tree is rendering the wrong language.
 *
 * It renders `null` and does no work in production: no logging, no DOM, no
 * measurable cost. The real protection is structural (the messages catalog +
 * `LocalizedText` config), this is just the early-warning system.
 */
export default function LocaleGuard() {
  const activeLocale = useLocale();
  const pathname = usePathname();

  useEffect(() => {
    if (process.env.NODE_ENV === "production") return;

    const routeLocale = pathname.split("/")[1];
    if (!isAppLocale(routeLocale)) return;

    if (routeLocale !== activeLocale) {
      console.error(
        `[i18n] Locale mismatch: the URL is /${routeLocale}… but the app resolved ` +
          `"${activeLocale}". This page is rendering the wrong language. ` +
          `Check that every component reads its locale from useLocale()/getLocale() ` +
          `and that no string is hard-coded.`
      );
    }
  }, [pathname, activeLocale]);

  return null;
}
