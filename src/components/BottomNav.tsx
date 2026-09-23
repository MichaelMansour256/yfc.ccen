"use client";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { bottomNavTabs, isFeatureEnabled } from "@/config";

/** Bottom tabs from the central navigation config (feature-gated). */
const tabs = bottomNavTabs.filter((t) => isFeatureEnabled(t.feature));

export default function BottomNav({ locale }: { locale: string }) {
  const t = useTranslations("nav");
  const pathname = usePathname();
  const router = useRouter();

  function toggleLocale() {
    const next = locale === "ar" ? "en" : "ar";
    const newPath = pathname.replace(`/${locale}`, `/${next}`);
    router.push(newPath);
  }

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-50 flex border-t border-blue-mid/40 bg-blue-dark/95 backdrop-blur-sm"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
      {tabs.map(({ key, href, icon }) => {
        const fullHref = `/${locale}${href === "/" ? "" : href}`;
        const isActive = href === "/"
          ? pathname === `/${locale}` || pathname === `/${locale}/`
          : pathname.startsWith(`/${locale}${href}`);
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
        className="flex flex-1 flex-col items-center gap-0.5 py-2 text-xs text-blue-light/60 hover:text-blue-light transition-colors">
        <span className="text-xl">{locale === "ar" ? "🇬🇧" : "🇪🇬"}</span>
        <span>{locale === "ar" ? "EN" : "عر"}</span>
      </button>
    </nav>
  );
}
