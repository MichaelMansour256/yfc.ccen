"use client";
import { use } from "react";
import { useTranslations } from "next-intl";
import PageHeader from "@/components/PageHeader";
import ContentLibrary from "@/components/content/ContentLibrary";
import { parseBibleReference } from "@/lib/content-library";

/**
 * 🗂️ Resources — general useful material (PDFs, videos, audio, books, links…).
 *
 * Resources do NOT have to belong to a study or a Bible passage: the library
 * happily shows stand-alone items. Both relationships are optional and only
 * refine the list (format/type chips, category chips, search, and the deep
 * links /ar/bible/resources?book=19&chapter=23 for a Bible reference).
 */
export default function ResourcesPage({
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
      <PageHeader title={t("resources")} icon="🗂️" />
      <ContentLibrary
        key={reference ? `ref-${reference.book}-${reference.chapter ?? 0}` : "all"}
        kind="resource"
        initialReference={reference}
      />
    </div>
  );
}

