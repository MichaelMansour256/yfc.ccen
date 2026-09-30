import type { Metadata } from "next";
import PageHeader from "@/components/PageHeader";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import { meetingConfig, siteConfig } from "@/config";
import { localizedValue } from "@/lib/localized";
import { toAppLocale, getDirection } from "@/i18n/locales";
import { buildMetadata } from "@/i18n/metadata";

export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("about", { path: "/more/about" });
}

export default async function AboutPage() {
  const locale = toAppLocale(await getLocale());
  const t = await getTranslations("about");
  const { about } = meetingConfig;
  const paragraphs = about.paragraphs[locale];
  const dir = getDirection(locale);

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={t("title")} icon="ℹ️" />

      <div className="flex flex-col items-center gap-6 px-5 py-6 max-w-lg mx-auto">

        {/* Logo */}
        <div className="h-28 w-28 overflow-hidden rounded-full shadow-2xl shadow-blue-accent/30 ring-4 ring-blue-accent/40">
          <Image src={siteConfig.assets.logo} alt={`${siteConfig.shortName} Logo`} width={112} height={112} className="h-full w-full object-cover" unoptimized />
        </div>

        {/* Main description */}
        <div className="w-full rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-5 backdrop-blur-sm" dir={dir}>
          {paragraphs.map((paragraph, i) => (
            <p key={i} className={`text-base leading-relaxed text-white/90${i > 0 ? " mt-3" : ""}`}>
              {paragraph}
            </p>
          ))}
        </div>

        {/* Three pillars */}
        {about.pillars.map((pillar) => (
          <div key={localizedValue(pillar.title, "en")} dir={dir}
            className="w-full flex items-start gap-4 rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-5 backdrop-blur-sm">
            <span className="text-3xl shrink-0 mt-0.5">{pillar.icon}</span>
            <div>
              <p className="text-base font-bold text-white mb-1">
                {localizedValue(pillar.title, locale)}
              </p>
              <p className="text-sm leading-relaxed text-blue-light/80">
                {localizedValue(pillar.desc, locale)}
              </p>
            </div>
          </div>
        ))}

        {/* Church name footer — in the active language only */}
        <p className="text-xs text-blue-light/40 text-center pb-2">
          {t("churchFooter", { church: localizedValue(siteConfig.church.name, locale) })}
        </p>
      </div>
    </div>
  );
}
