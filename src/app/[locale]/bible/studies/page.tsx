"use client";
import { use } from "react";
import { useTranslations } from "next-intl";
import PageHeader from "@/components/PageHeader";
import ContentLibrary from "@/components/content/ContentLibrary";
import { parseBibleReference } from "@/lib/content-library";

/**
 * 📚 Studies — structured educational/church-study content.
 *
 * The list is public: only published studies (GET /api/content, and the RLS
 * policy behind it) are ever returned. A relationship to a Bible passage is
 * optional and arrives as a deep link, e.g.
 * /ar/bible/studies?book=19&chapter=23 (Psalm 23 studies), which the card
 * reference chips and any future passage page link to.
 *
 * `key` remounts the library when the URL reference changes, so the filter
 * state always starts from the URL instead of syncing props into state.
 */
export default function StudiesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const t = useTranslations("bible");
  const params = use(searchParams);
  const reference = parseBibleReference({
    book: params.book,
    chapter: params.chapter,
    verse: params.verse,
  });

  return (
    <div className="min-h-dvh page-gradient">
      <PageHeader title={t("studies")} icon="📚" />
      <ContentLibrary
        key={reference ? `ref-${reference.book}-${reference.chapter ?? 0}` : "all"}
        kind="study"
        initialReference={reference}
      />
    </div>
  );
}

