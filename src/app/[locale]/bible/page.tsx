import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import { bibleSections, isFeatureEnabled } from "@/config";

export default function BiblePage() {
  const t = useTranslations("bible");
  const locale = useLocale();

  const sections = bibleSections.filter((s) => isFeatureEnabled(s.feature));

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={t("title")} icon="📖" />
      <div className="flex flex-col gap-3 p-4">
        {sections.map(({ key, href, icon }) => (
          <Link key={key} href={`/${locale}${href}`}
            className="flex items-center gap-4 rounded-2xl border border-blue-mid/40 bg-blue-primary/40 p-5 backdrop-blur-sm transition hover:bg-blue-mid/50 active:scale-95">
            <span className="text-3xl">{icon}</span>
            <span className="text-base font-semibold text-white">{t(key)}</span>
            <span className="ms-auto text-blue-light/50">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
