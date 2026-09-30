/**
 * Localized `<head>` metadata.
 *
 * Every page under `[locale]/...` must export `generateMetadata` built from
 * `buildMetadata()` so the document title, description and `alternates`
 * (canonical + hreflang for the other language) follow the route locale.
 *
 * Before this existed, metadata came from the ROOT layout only, so
 * /en/more/servants and /ar/more/servants shared one title and one
 * description — the language bug was visible in the tab and in search
 * results, not just in the body.
 */
import type { Metadata } from "next";
import { getLocale, getTranslations } from "next-intl/server";
import { routing } from "./routing";
import { toAppLocale } from "./locales";

/**
 * Build page metadata for the active locale.
 *
 * @param namespace message namespace holding `title` (+ optional `description`)
 * @param options.path route path relative to the locale root, e.g. "/more/servants"
 */
export async function buildMetadata(
  namespace: string,
  options: { path?: string } = {}
): Promise<Metadata> {
  const t = await getTranslations(namespace);
  const locale = toAppLocale(await getLocale());

  const title = t("title");
  const description = t.has("description") ? t("description") : undefined;

  /**
   * Canonical + hreflang for every shipped locale, so a search engine knows
   * these are the same page in two languages rather than duplicates.
   */
  const languages = Object.fromEntries(
    routing.locales.map((candidate) => [
      candidate,
      `/${candidate}${options.path ?? ""}`,
    ])
  );

  return {
    title,
    ...(description ? { description } : {}),
    alternates: {
      canonical: `/${locale}${options.path ?? ""}`,
      languages: { ...languages, "x-default": `/${routing.defaultLocale}${options.path ?? ""}` },
    },
    openGraph: {
      title,
      ...(description ? { description } : {}),
      locale,
      url: `/${locale}${options.path ?? ""}`,
    },
  };
}
