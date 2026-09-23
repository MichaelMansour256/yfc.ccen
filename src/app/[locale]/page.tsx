import { useTranslations, useLocale } from "next-intl";
import Image from "next/image";
import Link from "next/link";
import SocialLinks from "@/components/SocialLinks";
import { meetingConfig, siteConfig, homeQuickLinks, isFeatureEnabled } from "@/config";

export default function HomePage() {
  const tNav = useTranslations("nav");
  const locale = useLocale();
  const isAr = locale === "ar";

  const quickLinks = homeQuickLinks.filter((l) => isFeatureEnabled(l.feature));

  return (
    <div className="relative flex min-h-dvh flex-col items-center overflow-hidden hero-gradient">

      {/* Background glow blobs */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-pulse-glow absolute -top-20 left-1/2 h-80 w-80 -translate-x-1/2 rounded-full bg-blue-accent/20 blur-3xl" />
        <div className="animate-pulse-glow absolute top-40 -left-20 h-60 w-60 rounded-full bg-blue-primary/30 blur-3xl" style={{ animationDelay: "1s" }} />
        <div className="animate-pulse-glow absolute top-40 -right-20 h-60 w-60 rounded-full bg-blue-primary/30 blur-3xl" style={{ animationDelay: "2s" }} />
      </div>

      {/* Hero */}
      <div className="relative z-10 flex flex-col items-center px-6 pt-14 pb-6 text-center">

        {/* Circle logo */}
        <div className="animate-fade-up relative mb-6">
          <div className="absolute inset-0 rounded-full bg-blue-accent/25 blur-2xl scale-125" />
          <div className="relative h-40 w-40 overflow-hidden rounded-full shadow-2xl shadow-blue-accent/40 ring-4 ring-blue-accent/50">
            <Image src={siteConfig.assets.logo} alt={`${siteConfig.shortName} Logo`} width={160} height={160} className="h-full w-full object-cover" priority />
          </div>
        </div>

        {/* Text */}
        <div className="animate-fade-up-delay flex flex-col items-center gap-1">
          <h1 className="text-3xl font-bold text-white drop-shadow-lg">
            {isAr ? meetingConfig.hero.welcome.ar : meetingConfig.hero.welcome.en}
          </h1>
          <p className="text-sm text-blue-light/70 max-w-xs leading-relaxed">
            {isAr ? meetingConfig.hero.subtitle.ar : meetingConfig.hero.subtitle.en}
          </p>
        </div>

        {/* Divider */}
        <div className="animate-fade-up-delay my-4 flex items-center gap-3 w-48">
          <div className="h-px flex-1 bg-blue-accent/30" />
          <span className="text-blue-accent/60 text-xs">✝</span>
          <div className="h-px flex-1 bg-blue-accent/30" />
        </div>

        {/* Social links */}
        <div className="animate-fade-up-delay-2">
          <SocialLinks />
        </div>
      </div>

      {/* Quick nav grid */}
      <div className="animate-fade-up-delay-2 relative z-10 grid w-full max-w-sm grid-cols-2 gap-3 px-5 pb-4">
        {quickLinks.map(({ key, href, icon }) => (
          <Link key={key} href={`/${locale}${href}`}
            className="group flex flex-col items-center gap-2 rounded-2xl border border-white/10 bg-white/5 p-5 text-center backdrop-blur-md transition hover:bg-white/10 hover:border-blue-accent/40 active:scale-95">
            <span className="text-4xl transition group-hover:scale-110">{icon}</span>
            <span className="text-sm font-semibold text-white/90">{tNav(key)}</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
