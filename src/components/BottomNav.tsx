"use client";
import { useLocale, useTranslations } from "next-intl";
import { bottomNavTabs, isFeatureEnabled } from "@/config";
import { Link, getPathname, usePathname, useRouter } from "@/i18n/navigation";
import { toAppLocale, otherLocale, localeLabel, localeFlag } from "@/i18n/locales";

/**
 * Bottom tabs from the central navigation config (feature-gated).
 *
 * The locale comes from `useLocale()` (next-intl, i.e. the `[locale]` URL
 * segment) and every href comes from the locale-aware `Link` in
 * `@/i18n/navigation`, which adds the prefix itself. The component no longer
 * takes a `locale` prop: a prop is a second source of truth that can drift
 * from the URL, which is exactly how a link can end up pointing at the other
 * language.
 */
const tabs = bottomNavTabs.filter((t) => isFeatureEnabled(t.feature));

export default function BottomNav() {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();
  const locale = toAppLocale(useLocale());

  /**
   * Switch language while STAYING ON THE SAME PAGE.
   *
   * The old implementation did `pathname.replace(`/${locale}`, `/${next}`)`,
   * which broke on any path that did not start with the expected segment and
   * could replace the wrong occurrence. `getPathname` re-issues the current
   * pathname for the target locale instead, so /ar/more/servants → 
   * /en/more/servants and the user never lands on the home page.
   */
  function toggleLocale() {
    const next = otherLocale(locale);
    // Re-issue the CURRENT pathname for the other locale, so the user stays on
    // the same page (/ar/more/servants → /en/more/servants) instead of being
    // dropped on the home page.
    router.replace(getPathname({ href: pathname, locale: next }));
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-blue-mid/40 bg-blue-dark/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {tabs.map(({ key, href, icon }) => {
        const fullHref = href === "/" ? "/" : href;
        const isActive = href === "/"
          ? pathname === "/"
          : pathname.startsWith(href);
        return (
          <Link key={key} href={fullHref}
            className={`flex flex-1 flex-col items-center gap-0.5 py-2 text-xs transition-colors ${
              isActive ? "text-blue-accent" : "text-blue-light/60 hover:text-blue-light"
            }`}>
            <span className="text-xl">{icon}</span>
            <span>{t(key)}</span>
          </Link>
        );
      })}
      {/* Language toggle */}
      <button onClick={toggleLocale}
        aria-label={localeLabel(otherLocale(locale))}
        className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-blue-light/60 hover:text-blue-light transition-colors">
        <span className="text-xl">{localeFlag(otherLocale(locale))}</span>
        <span>{localeLabel(otherLocale(locale))}</span>
      </button>
    </nav>
  );
}
