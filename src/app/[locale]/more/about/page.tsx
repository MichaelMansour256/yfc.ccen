import PageHeader from "@/components/PageHeader";
import Image from "next/image";
import { getLocale } from "next-intl/server";
import { meetingConfig, siteConfig } from "@/config";

export default async function AboutPage() {
  const locale = await getLocale();
  const isAr = locale === "ar";
  const { about } = meetingConfig;
  const paragraphs = isAr ? about.paragraphs.ar : about.paragraphs.en;

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={isAr ? about.title.ar : about.title.en} icon="ℹ️" />

      <div className="flex flex-col items-center gap-6 px-5 py-6 max-w-lg mx-auto">

        {/* Logo */}
        <div className="h-28 w-28 overflow-hidden rounded-full shadow-2xl shadow-blue-accent/30 ring-4 ring-blue-accent/40">
          <Image src={siteConfig.assets.logo} alt={`${siteConfig.shortName} Logo`} width={112} height={112} className="h-full w-full object-cover" />
        </div>

        {/* Main description */}
        <div className={`w-full rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-5 backdrop-blur-sm ${isAr ? "text-right" : "text-left"}`}
          dir={isAr ? "rtl" : "ltr"}>
          {paragraphs.map((paragraph, i) => (
            <p key={i} className={`text-base leading-relaxed text-white/90${i > 0 ? " mt-3" : ""}`}>
              {paragraph}
            </p>
          ))}
        </div>

        {/* Three pillars */}
        {about.pillars.map((pillar) => (
          <div key={pillar.title.en} dir={isAr ? "rtl" : "ltr"}
            className="w-full flex items-start gap-4 rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-5 backdrop-blur-sm">
            <span className="text-3xl shrink-0 mt-0.5">{pillar.icon}</span>
            <div>
              <p className="text-base font-bold text-white mb-1">{isAr ? pillar.title.ar : pillar.title.en}</p>
              <p className="text-sm leading-relaxed text-blue-light/80">{isAr ? pillar.desc.ar : pillar.desc.en}</p>
            </div>
          </div>
        ))}

        {/* Church name footer */}
        <p className="text-xs text-blue-light/40 text-center pb-2">
          {siteConfig.church.nameAr} · {siteConfig.church.name}
        </p>
      </div>
    </div>
  );
}
