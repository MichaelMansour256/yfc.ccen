import { useTranslations, useLocale } from "next-intl";
import Link from "next/link";
import PageHeader from "@/components/PageHeader";
import PushBell from "@/components/PushBell";
import NotificationInboxLink from "@/components/NotificationInboxLink";
import { moreMenuItems, isFeatureEnabled, features } from "@/config";

export default function MorePage() {
  const t = useTranslations("more");
  const locale = useLocale();

  const items = moreMenuItems.filter((item) => isFeatureEnabled(item.feature));

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={t("title")} icon="☰" />
      <div className="flex flex-col gap-2 p-4">
        {features.notifications && <NotificationInboxLink />}
        {features.notifications && <PushBell locale={locale} />}
        {items.map(({ key, href, icon }) => (
          <Link key={key} href={`/${locale}${href}`}
            className="flex items-center gap-4 rounded-2xl border border-blue-mid/40 bg-blue-primary/40 p-4 backdrop-blur-sm transition hover:bg-blue-mid/50 active:scale-95">
            <span className="text-2xl">{icon}</span>
            <span className="text-base font-semibold text-white">{t(key)}</span>
            <span className="ms-auto text-blue-light/50">›</span>
          </Link>
        ))}
      </div>
    </div>
  );
}
