"use client";
import { useLocale, useTranslations } from "next-intl";
import ContentCard from "./ContentCard";
import {
  referenceLabel,
  relatedItems,
  type BibleReference,
  type ContentItem,
  type ContentKind,
} from "@/lib/content-library";

/**
 * "Related content" block — the Studies/Resources that belong to one Bible
 * reference (e.g. Psalms 23).
 *
 * This is how an optional book/chapter relationship becomes visible: any page
 * that knows its passage can drop this block in and get
 *   📚 دراسات متعلقة بالمزامير ٢٣
 *   📦 موارد متعلقة بالمزامير ٢٣
 * without knowing anything about the content library. It renders NOTHING when
 * there is no reference or no related item, so a passage page never shows an
 * empty section (that is also why the caller does not need a length check).
 *
 * Today it is used by the Studies and Resources listings (each one shows the
 * items of the *other* kind for the active reference); a future Bible reading
 * page can reuse it as-is.
 */
export default function RelatedContent({
  kind,
  allItems,
  reference,
}: {
  /** Which kind to show — usually the sibling of the page you are on. */
  kind: ContentKind;
  /** All published items the page already loaded (no second request). */
  allItems: ContentItem[];
  reference: BibleReference | null;
}) {
  const isAr = useLocale() === "ar";
  const t = useTranslations("content");

  const items = relatedItems(allItems, kind, reference);
  if (items.length === 0) return null;

  const heading = kind === "study" ? t("relatedStudies") : t("relatedResources");
  const icon = kind === "study" ? "📚" : "🗂️";
  const refLabel = referenceLabel(reference, isAr);

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-blue-mid/30 bg-blue-dark/30 p-3">
      <h2 className="flex flex-wrap items-center gap-2 text-sm font-semibold text-blue-light/80">
        <span aria-hidden>{icon}</span>
        {heading}
        {refLabel && <span className="text-xs font-normal text-blue-light/50">· {refLabel}</span>}
      </h2>
      <div className="flex flex-col gap-3">
        {items.map((item) => (
          <ContentCard key={item.id} item={item} allItems={allItems} showReferenceLink={false} />
        ))}
      </div>
    </section>
  );
}
