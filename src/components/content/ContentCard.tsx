"use client";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import {
  categoryDisplay,
  contentActionLabel,
  contentDescription,
  contentTitle,
  referenceFromItem,
  referenceHref,
  referenceLabel,
  resourceTypeDisplay,
  type ContentItem,
} from "@/lib/content-library";

/**
 * One card in the Studies / Resources listing.
 *
 * Everything that makes the card useful on a phone is deliberate:
 *   • the whole call-to-action is a full-width button, so external links
 *     (Google Drive, PDF, video…) are obvious and easy to hit with a thumb;
 *   • links always open in a new tab with `rel="noopener noreferrer"`, so a
 *     PDF or Drive folder never replaces the app that hosts it;
 *   • the Bible reference chip is a LINK to the sibling section filtered by
 *     that reference — from a study it opens "the resources for Psalms 23",
 *     from a resource "the studies for Psalms 23". Pass
 *     `showReferenceLink={false}` when the surrounding block is already
 *     scoped to one reference (see RelatedContent).
 *
 * Cover images use a plain <img>: a servant may paste a Drive/host URL that is
 * not in next.config.ts `images.remotePatterns`, and next/image would refuse to
 * render it. Loading is lazy, so the list stays light on mobile data.
 */
export default function ContentCard({
  item,
  allItems,
  showReferenceLink = true,
}: {
  item: ContentItem;
  /** All loaded items — used to resolve an optional related study's title. */
  allItems: ContentItem[];
  showReferenceLink?: boolean;
}) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const t = useTranslations("content");

  const title = contentTitle(item, isAr);
  const description = contentDescription(item, isAr);
  const action = contentActionLabel(item, isAr);
  const category = categoryDisplay(item.category, item.type, isAr);
  const format = item.type === "resource" ? resourceTypeDisplay(item, isAr) : null;
  const reference = referenceFromItem(item);
  const refLabel = referenceLabel(reference, isAr);
  const siblingSection = item.type === "study" ? "resources" : "studies";

  const relatedStudy = item.related_study_id
    ? allItems.find((candidate) => candidate.id === item.related_study_id && candidate.type === "study")
    : undefined;

  return (
    <article className="overflow-hidden rounded-2xl border border-blue-mid/40 bg-blue-primary/30 backdrop-blur-sm">
      {item.image && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={item.image} alt="" loading="lazy" className="h-36 w-full object-cover" />
      )}

      <div className="flex flex-col gap-3 p-4">
        <div className="flex items-start gap-3">
          <span className="text-2xl leading-none">{format?.icon ?? category?.icon ?? (item.type === "study" ? "📚" : "🗂️")}</span>
          <div className="min-w-0 flex-1">
            <h2 className="text-base font-semibold leading-snug text-white">{title}</h2>
            {description && (
              <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-blue-light/75">{description}</p>
            )}
          </div>
        </div>

        {(category || format || refLabel || relatedStudy) && (
          <div className="flex flex-wrap items-center gap-1.5">
            {category && (
              <span className="rounded-full bg-blue-dark/40 px-2.5 py-1 text-xs text-blue-light/70">
                {category.icon} {category.label}
              </span>
            )}
            {format && (
              <span className="rounded-full bg-blue-dark/40 px-2.5 py-1 text-xs text-blue-light/70">
                {format.icon} {format.label}
              </span>
            )}
            {refLabel && showReferenceLink && reference && (
              <Link
                href={referenceHref(locale, siblingSection, reference)}
                title={isAr ? `شاهد ${siblingSection === "studies" ? "الدراسات" : "الموارد"} المتعلقة بـ ${refLabel}` : `Show ${siblingSection === "studies" ? "studies" : "resources"} for ${refLabel}`}
                className="rounded-full bg-blue-accent/15 px-2.5 py-1 text-xs font-semibold text-blue-accent transition hover:bg-blue-accent/25"
              >
                📖 {refLabel} ›
              </Link>
            )}
            {refLabel && !showReferenceLink && (
              <span className="rounded-full bg-blue-accent/15 px-2.5 py-1 text-xs font-semibold text-blue-accent">
                📖 {refLabel}
              </span>
            )}
            {relatedStudy && (
              <a
                href={relatedStudy.url}
                target="_blank"
                rel="noopener noreferrer"
                title={isAr ? "افتح الدراسة المرتبطة" : "Open the related study"}
                className="rounded-full bg-yellow-400/10 px-2.5 py-1 text-xs text-yellow-300/90 transition hover:bg-yellow-400/20"
              >
                📚 {t("relatedStudy")}: {contentTitle(relatedStudy, isAr)}
              </a>
            )}
          </div>
        )}

        <a
          href={item.url}
          target="_blank"
          rel="noopener noreferrer"
          title={t("openInNewTab")}
          className="flex items-center justify-center gap-2 rounded-xl bg-blue-accent py-2.5 text-sm font-semibold text-white transition hover:bg-blue-mid active:scale-[0.98]"
        >
          <span aria-hidden>{format?.icon ?? "↗"}</span>
          {action}
          <span aria-hidden className="text-xs opacity-80">↗</span>
        </a>
      </div>
    </article>
  );
}
