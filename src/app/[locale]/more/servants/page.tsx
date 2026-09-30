import type { Metadata } from "next";
import Image from "next/image";
import { getLocale, getTranslations } from "next-intl/server";
import PageHeader from "@/components/PageHeader";
import { SERVANTS_DIR, servants } from "@/config";
import { localizedValue } from "@/lib/localized";
import { toAppLocale } from "@/i18n/locales";
import { buildMetadata } from "@/i18n/metadata";

/**
 * Servants directory.
 *
 * The locale is read from the request (which next-intl derives from the
 * `[locale]` URL segment) and used for BOTH the heading and every name.
 *
 * This page used to be a server component that never looked at the locale at
 * all: it imported a hard-coded `servantsTitleAr` and always read `nameAr`, so
 * /en/more/servants rendered an Arabic heading and Arabic names. Reading the
 * locale here — and reading `name` as a `{ ar, en }` value — removes the only
 * place that could decide to show Arabic on an English URL.
 */
export function generateMetadata(): Promise<Metadata> {
  return buildMetadata("servants", { path: "/more/servants" });
}

export default async function ServantsPage() {
  const locale = toAppLocale(await getLocale());
  const t = await getTranslations("servants");

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={t("title")} icon="🙏" />

      <div className="grid grid-cols-2 gap-4 p-4">
        {servants.map(({ file, name }) => {
          const displayName = localizedValue(name, locale);
          return (
            <div key={file}
              className="flex flex-col items-center gap-3 rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-4 backdrop-blur-sm">
              <div className="relative h-24 w-24 overflow-hidden rounded-full ring-2 ring-blue-accent/40 shadow-lg shadow-blue-accent/20">
                <Image
                  src={`${SERVANTS_DIR}/${file}`}
                  alt={t("photoAlt", { name: displayName })}
                  fill
                  className="object-cover"
                  sizes="96px"
                />
              </div>
              <p className="text-sm font-semibold text-white text-center">{displayName}</p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
