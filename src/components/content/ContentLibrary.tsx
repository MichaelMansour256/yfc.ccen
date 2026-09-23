"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { BIBLE_BOOKS } from "@/lib/bibleBooks";
import {
  RESOURCE_TYPES,
  bibleBookLabel,
  categoriesFor,
  categoryDisplay,
  hasReference,
  matchesReference,
  referenceLabel,
  type BibleReference,
  type ContentItem,
  type ContentKind,
} from "@/lib/content-library";
import ContentCard from "./ContentCard";
import RelatedContent from "./RelatedContent";

type LoadStatus = "loading" | "ready" | "error";

const CHIP = "shrink-0 rounded-full px-3 py-1.5 text-xs font-semibold transition";
const INPUT =
  "rounded-xl bg-blue-dark/60 px-3 py-2 text-sm text-white placeholder-blue-light/40 outline-none ring-1 ring-blue-mid/40 focus:ring-blue-accent";


/**
 * The Studies / Resources listing.
 *
 * One component serves both sections (`kind` decides which rows are listed and
 * which filter rows are offered: categories for both, resource formats for
 * Resources only), so the two pages can never drift apart visually.
 *
 * Data flow: one GET /api/content request (published rows only) → filtered in
 * memory by search text, category, format and — when a Bible reference is
 * active — by the reference. In-memory filtering keeps tapping a filter chip
 * instant on a phone; the same rules exist server-side
 * (GET /api/content?book=..&chapter=..) for other consumers.
 *
 * Deep links: /bible/studies?book=19&chapter=23 and
 * /bible/resources?book=19&chapter=23 open the section already scoped to
 * Psalms 23 — `initialReference` comes from the URL (see the page components).
 * The card chips link to exactly those URLs.
 */
export default function ContentLibrary({
  kind,
  initialReference = null,
}: {
  kind: ContentKind;
  initialReference?: BibleReference | null;
}) {
  const locale = useLocale();
  const isAr = locale === "ar";
  const t = useTranslations("content");

  const [items, setItems] = useState<ContentItem[]>([]);
  const [status, setStatus] = useState<LoadStatus>("loading");
  const [attempt, setAttempt] = useState(0);
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [format, setFormat] = useState<string | null>(null);
  const [reference, setReference] = useState<BibleReference | null>(initialReference);
  const [draftBook, setDraftBook] = useState(initialReference?.book ? String(initialReference.book) : "");
  const [draftChapter, setDraftChapter] = useState(
    initialReference?.chapter ? String(initialReference.chapter) : ""
  );
  const [referenceOpen, setReferenceOpen] = useState(Boolean(initialReference));

  /**
   * One request for the whole page: the list and the related-content block of
   * the other kind share it. The library stores metadata + links only (the
   * files stay on Drive / Cloudinary), so this stays a small payload and a
   * reference-filtered page is still a single round trip.
   */
  useEffect(() => {
    let cancelled = false;
    fetch("/api/content", { cache: "no-store" })
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: unknown) => {
        if (cancelled) return;
        setItems(Array.isArray(data) ? (data as ContentItem[]) : []);
        setStatus("ready");
      })
      .catch(() => {
        if (!cancelled) setStatus("error");
      });
    return () => {
      cancelled = true;
    };
  }, [attempt]);

  const kindItems = useMemo(() => items.filter((item) => item.type === kind), [items, kind]);

  /** Category chips — only the categories that actually have content. */
  const categoryOptions = useMemo(() => {
    const presets = categoriesFor(kind);
    const present = kindItems
      .map((item) => item.category)
      .filter((value): value is string => Boolean(value));
    const ordered = [
      ...presets.map((preset) => preset.id).filter((id) => present.includes(id)),
      ...[...new Set(present)].filter((value) => !presets.some((preset) => preset.id === value)),
    ];
    return [...new Set(ordered)]
      .map((value) => {
        const display = categoryDisplay(value, kind, isAr);
        return display ? { value, ...display } : null;
      })
      .filter((option): option is { value: string; label: string; icon: string } => option !== null);
  }, [kindItems, kind, isAr]);

  /** Format chips (Resources only) — again only the formats in use. */
  const formatOptions = useMemo(() => {
    if (kind !== "resource") return [];
    const present = new Set(kindItems.map((item) => item.resource_type ?? "other"));
    return RESOURCE_TYPES.filter((preset) => present.has(preset.id)).map((preset) => ({
      value: preset.id,
      label: isAr ? preset.ar : preset.en,
      icon: preset.icon,
    }));
  }, [kindItems, kind, isAr]);

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return kindItems.filter((item) => {
      if (reference && !matchesReference(item, reference)) return false;
      if (category && item.category !== category) return false;
      if (format && (item.resource_type ?? "other") !== format) return false;
      if (needle) {
        const haystack = `${item.title} ${item.title_en ?? ""}`.toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [kindItems, reference, category, format, query]);

  const filtersActive = Boolean(query.trim() || category || format || hasReference(reference));
  const referenceText = referenceLabel(reference, isAr);

  const applyReference = useCallback((book: string, chapter: string) => {
    setDraftBook(book);
    setDraftChapter(chapter);
    const bookNr = Number.parseInt(book, 10);
    if (!bookNr) {
      setReference(null);
      return;
    }
    const chapterNr = Number.parseInt(chapter, 10);
    setReference({
      book: bookNr,
      chapter: Number.isFinite(chapterNr) && chapterNr > 0 ? chapterNr : null,
      verse: null,
    });
  }, []);

  const clearReference = useCallback(() => {
    setDraftBook("");
    setDraftChapter("");
    setReference(null);
    setReferenceOpen(false);
  }, []);

  const clearAllFilters = useCallback(() => {
    setQuery("");
    setCategory(null);
    setFormat(null);
    clearReference();
  }, [clearReference]);

  const retry = useCallback(() => {
    setStatus("loading");
    setAttempt((value) => value + 1);
  }, []);

  const emptyMessage = filtersActive
    ? t("noResults")
    : kind === "study"
      ? t("emptyStudies")
      : t("emptyResources");

  return (
    <div className="mx-auto flex max-w-lg flex-col gap-3 px-4 py-4">
      {/* ── Search by title ── */}
      <input
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder={t("searchPlaceholder")}
        aria-label={t("searchPlaceholder")}
        className={`${INPUT} w-full`}
      />

      {/* ── Category chips (only when there is more than one category) ── */}
      {categoryOptions.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setCategory(null)}
            className={`${CHIP} ${category === null ? "bg-blue-accent text-white" : "bg-blue-primary/40 text-blue-light/70"}`}
          >
            {t("allCategories")}
          </button>
          {categoryOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setCategory(category === option.value ? null : option.value)}
              className={`${CHIP} ${category === option.value ? "bg-blue-accent text-white" : "bg-blue-primary/40 text-blue-light/70"}`}
            >
              {option.icon} {option.label}
            </button>
          ))}
        </div>
      )}

      {/* ── Format chips — Resources only ── */}
      {formatOptions.length > 1 && (
        <div className="flex gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => setFormat(null)}
            className={`${CHIP} ${format === null ? "bg-blue-accent text-white" : "bg-blue-primary/40 text-blue-light/70"}`}
          >
            {t("allTypes")}
          </button>
          {formatOptions.map((option) => (
            <button
              key={option.value}
              type="button"
              onClick={() => setFormat(format === option.value ? null : option.value)}
              className={`${CHIP} ${format === option.value ? "bg-blue-accent text-white" : "bg-blue-primary/40 text-blue-light/70"}`}
            >
              {option.icon} {option.label}
            </button>
          ))}
        </div>
      )}
      {/* ── Optional Bible reference filter ── */}
      {referenceText ? (
        <div className="flex items-center gap-2 rounded-xl border border-blue-accent/30 bg-blue-accent/10 px-3 py-2">
          <span className="text-sm font-semibold text-blue-accent">📖 {referenceText}</span>
          <button
            type="button"
            onClick={clearReference}
            className="ms-auto rounded-full bg-blue-dark/40 px-2.5 py-1 text-xs text-blue-light/70 transition hover:text-white"
          >
            ✕ {t("clearReference")}
          </button>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          <button
            type="button"
            onClick={() => setReferenceOpen((open) => !open)}
            className="self-start text-xs font-semibold text-blue-light/60 transition hover:text-white"
          >
            📖 {t("reference")} {referenceOpen ? "▲" : "▼"}
          </button>
          {referenceOpen && (
            <div className="flex gap-2">
              <select
                value={draftBook}
                onChange={(event) => applyReference(event.target.value, draftChapter)}
                aria-label={t("reference")}
                className={`${INPUT} flex-1`}
              >
                <option value="">{t("anyBook")}</option>
                {BIBLE_BOOKS.map((book) => (
                  <option key={book.nr} value={book.nr}>
                    {bibleBookLabel(book.nr, isAr) ?? book.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={draftChapter}
                onChange={(event) => applyReference(draftBook, event.target.value)}
                placeholder={t("chapter")}
                aria-label={t("chapter")}
                disabled={!draftBook}
                className={`${INPUT} w-28 disabled:opacity-40`}
              />
            </div>
          )}
        </div>
      )}



      {/* ── Results ── */}
      {status === "loading" && (
        <p className="py-10 text-center text-sm text-blue-light/50">{t("loading")}</p>
      )}

      {status === "error" && (
        <div className="flex flex-col items-center gap-3 py-10 text-blue-light/50">
          <span className="text-3xl">⚠️</span>
          <p className="text-sm">{t("error")}</p>
          <button
            type="button"
            onClick={retry}
            className="rounded-xl bg-blue-accent px-4 py-2 text-sm font-semibold text-white transition hover:bg-blue-mid"
          >
            {t("retry")}
          </button>
        </div>
      )}

      {status === "ready" && visible.length === 0 && (
        <div className="flex flex-col items-center gap-2 py-10 text-center text-blue-light/40">
          <span className="text-4xl">{kind === "study" ? "📚" : "🗂️"}</span>
          <p className="text-sm">{emptyMessage}</p>
          {filtersActive && (
            <button type="button" onClick={clearAllFilters} className="text-sm text-blue-accent underline">
              {t("clearFilters")}
            </button>
          )}
        </div>
      )}

      {status === "ready" && visible.length > 0 && (
        <div className="flex flex-col gap-3">
          {visible.map((item) => (
            <ContentCard key={item.id} item={item} allItems={items} />
          ))}
        </div>
      )}

      {/* ── The other kind, for the active reference (hidden when empty) ── */}
      <RelatedContent
        kind={kind === "study" ? "resource" : "study"}
        allItems={items}
        reference={reference}
      />
    </div>
  );
}
