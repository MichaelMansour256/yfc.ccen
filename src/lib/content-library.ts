/**
 * Studies & Resources — shared content model (CLIENT-SAFE).
 *
 * This module holds everything both the public pages and the admin dashboard
 * need to *describe* a content item: the row shape, the preset categories/
 * types (with Arabic + English labels) and the display helpers (title,
 * reference label, "related content for this passage"). It intentionally has
 * NO database import, so client components can use it without pulling the
 * server-only Supabase client into the browser bundle.
 *
 * The actual database operations live in `src/lib/content-library-db.ts`
 * (server-only), and the schema in `supabase-content-library.sql`.
 *
 * Model in one sentence: a **Study** is structured teaching material and a
 * **Resource** is general useful material; both are just metadata + an
 * external URL (Google Drive / PDF / video / …), and every Bible relationship
 * (book, chapter, verse) and the resource → study link are OPTIONAL.
 */
import { BIBLE_BOOKS } from "./bibleBooks";

/** The two content types stored in `content_library.type`. */
export type ContentKind = "study" | "resource";

export const CONTENT_KINDS: ContentKind[] = ["study", "resource"];

export function isContentKind(value: unknown): value is ContentKind {
  return value === "study" || value === "resource";
}

/**
 * One row of `content_library` (see supabase-content-library.sql).
 * Snake_case field names match the table/Supabase payload exactly, so items
 * travel from Postgres → API → client without any mapping layer.
 */
export interface ContentItem {
  id: string;
  type: ContentKind;
  /** Primary (Arabic) title — always present. */
  title: string;
  /** Optional English title; falls back to `title` in the English UI. */
  title_en: string | null;
  description: string | null;
  description_en: string | null;
  /** The content itself: Drive link, PDF, external URL, website page… */
  url: string;
  /** Optional cover/thumbnail URL. */
  image: string | null;
  /** Preset id (below) or any free text a servant typed. */
  category: string | null;
  /** Resources only: one of RESOURCE_TYPES ids. */
  resource_type: string | null;
  /** Optional Bible relationship: 1..66 (BIBLE_BOOKS `nr`). */
  book: number | null;
  chapter: number | null;
  verse: number | null;
  /** Resources only: the study this resource belongs to. */
  related_study_id: string | null;
  published: boolean;
  archived: boolean;
  created_at: string;
  updated_at: string;
}

/** A preset entry: stable id + bilingual label + icon (+ action verb for types). */
export interface ContentPreset {
  id: string;
  ar: string;
  en: string;
  icon: string;
  /** Only on RESOURCE_TYPES: the label of the card's call-to-action button. */
  actionAr?: string;
  actionEn?: string;
}

/** Studies are grouped by what the study is about. */
export const STUDY_CATEGORIES: ContentPreset[] = [
  { id: "bible-studies", ar: "دراسات كتابية", en: "Bible Studies", icon: "📖" },
  { id: "characters", ar: "شخصيات", en: "Characters", icon: "🧑" },
  { id: "books", ar: "أسفار", en: "Books", icon: "📚" },
  { id: "topics", ar: "موضوعات", en: "Topics", icon: "🗂️" },
  { id: "spiritual-life", ar: "حياة روحية", en: "Spiritual Life", icon: "🕊️" },
];

/**
 * Resources are grouped by *purpose*; the file format is expressed separately
 * by `resource_type` (RESOURCE_TYPES below), so the two filters never
 * duplicate each other.
 */
export const RESOURCE_CATEGORIES: ContentPreset[] = [
  { id: "bible-references", ar: "مراجع كتابية", en: "Bible References", icon: "🔖" },
  { id: "books", ar: "كتب", en: "Books", icon: "📕" },
  { id: "study-guides", ar: "أدلة دراسة", en: "Study Guides", icon: "🧭" },
  { id: "hymns", ar: "ترانيم وتسبيح", en: "Hymns", icon: "🎵" },
  { id: "useful-links", ar: "روابط مفيدة", en: "Useful Links", icon: "🔗" },
  { id: "general", ar: "عام", en: "General", icon: "📦" },
];

/**
 * Resource formats. Extensible by design: add an entry here (plus nothing
 * else — the admin select and the public type filter read this array) and the
 * new type is immediately usable.
 */
export const RESOURCE_TYPES: ContentPreset[] = [
  { id: "pdf", ar: "PDF", en: "PDF", icon: "📄", actionAr: "فتح الـ PDF", actionEn: "Open PDF" },
  { id: "video", ar: "فيديو", en: "Video", icon: "🎬", actionAr: "شاهد الفيديو", actionEn: "Watch video" },
  { id: "audio", ar: "صوت", en: "Audio", icon: "🎧", actionAr: "استمع", actionEn: "Listen" },
  { id: "presentation", ar: "عرض تقديمي", en: "Presentation", icon: "📊", actionAr: "عرض التقديم", actionEn: "View slides" },
  { id: "book", ar: "كتاب", en: "Book", icon: "📕", actionAr: "فتح الكتاب", actionEn: "Open book" },
  { id: "link", ar: "رابط", en: "Link", icon: "🔗", actionAr: "فتح الرابط", actionEn: "Open link" },
  { id: "document", ar: "مستند", en: "Document", icon: "📝", actionAr: "فتح المستند", actionEn: "Open document" },
  { id: "other", ar: "أخرى", en: "Other", icon: "📎", actionAr: "فتح", actionEn: "Open" },
];

/**
 * The categories offered for a given content type (used by the admin select
 * and by the "custom category" option).
 */
export function categoriesFor(kind: ContentKind): ContentPreset[] {
  return kind === "study" ? STUDY_CATEGORIES : RESOURCE_CATEGORIES;
}

/* ══════════════════════════════════════════════════════════════════════════
 * DISPLAY HELPERS (pure — safe in client components)
 * ══════════════════════════════════════════════════════════════════════════ */

/** English book names, index 0 = book nr 1 (Genesis). */
const BIBLE_BOOK_NAMES_EN = [
  "Genesis", "Exodus", "Leviticus", "Numbers", "Deuteronomy", "Joshua", "Judges", "Ruth",
  "1 Samuel", "2 Samuel", "1 Kings", "2 Kings", "1 Chronicles", "2 Chronicles", "Ezra",
  "Nehemiah", "Esther", "Job", "Psalms", "Proverbs", "Ecclesiastes", "Song of Solomon",
  "Isaiah", "Jeremiah", "Lamentations", "Ezekiel", "Daniel", "Hosea", "Joel", "Amos",
  "Obadiah", "Jonah", "Micah", "Nahum", "Habakkuk", "Zephaniah", "Haggai", "Zechariah",
  "Malachi", "Matthew", "Mark", "Luke", "John", "Acts", "Romans", "1 Corinthians",
  "2 Corinthians", "Galatians", "Ephesians", "Philippians", "Colossians", "1 Thessalonians",
  "2 Thessalonians", "1 Timothy", "2 Timothy", "Titus", "Philemon", "Hebrews", "James",
  "1 Peter", "2 Peter", "1 John", "2 John", "3 John", "Jude", "Revelation",
];

/** Arabic book name from the project's single book list (src/lib/bibleBooks.ts). */
export function bibleBookNameAr(nr: number): string | null {
  return BIBLE_BOOKS.find((b) => b.nr === nr)?.name ?? null;
}

/** Localized book name for a BIBLE_BOOKS `nr` (1..66). */
export function bibleBookLabel(nr: number | null | undefined, isAr: boolean): string | null {
  if (!nr || nr < 1 || nr > 66) return null;
  if (isAr) return bibleBookNameAr(nr);
  return BIBLE_BOOK_NAMES_EN[nr - 1] ?? null;
}

/** "Study" / "Resource" in the active language. */
export function contentTypeLabel(kind: ContentKind, isAr: boolean): string {
  if (kind === "study") return isAr ? "دراسة" : "Study";
  return isAr ? "مورد" : "Resource";
}

/** Arabic title is primary; the English one is shown only when it was filled in. */
export function contentTitle(item: ContentItem, isAr: boolean): string {
  if (!isAr) return item.title_en?.trim() || item.title;
  return item.title;
}

export function contentDescription(item: ContentItem, isAr: boolean): string | null {
  const value = isAr ? item.description : item.description_en?.trim() || item.description;
  return value?.trim() ? value : null;
}

function presetLabel(preset: ContentPreset | undefined, isAr: boolean): string | null {
  if (!preset) return null;
  return isAr ? preset.ar : preset.en;
}

/**
 * Category chip for an item. Preset ids resolve to a bilingual label; anything
 * a servant typed by hand is shown exactly as stored, so the field stays
 * flexible without ever going blank.
 */
export function categoryDisplay(
  value: string | null | undefined,
  kind: ContentKind,
  isAr: boolean
): { label: string; icon: string } | null {
  const raw = value?.trim();
  if (!raw) return null;
  const list = kind === "study" ? STUDY_CATEGORIES : RESOURCE_CATEGORIES;
  const preset = list.find((p) => p.id === raw);
  return { label: presetLabel(preset, isAr) ?? raw, icon: preset?.icon ?? "🏷️" };
}

/** Format chip + call-to-action for a resource ("PDF", "🎬 Watch video"). */
export function resourceTypeDisplay(
  item: ContentItem,
  isAr: boolean
): { id: string; label: string; icon: string; action: string } {
  const preset = RESOURCE_TYPES.find((p) => p.id === item.resource_type);
  if (!preset) {
    return { id: "other", label: isAr ? "مادة" : "Material", icon: "📎", action: isAr ? "فتح" : "Open" };
  }
  return {
    id: preset.id,
    label: presetLabel(preset, isAr) ?? preset.id,
    icon: preset.icon,
    action: (isAr ? preset.actionAr : preset.actionEn) ?? (isAr ? "فتح" : "Open"),
  };
}

/** Label of the card's main button ("فتح الدراسة" for studies, type-aware for resources). */
export function contentActionLabel(item: ContentItem, isAr: boolean): string {
  if (item.type === "study") return isAr ? "فتح الدراسة" : "Open study";
  return resourceTypeDisplay(item, isAr).action;
}

/* ══════════════════════════════════════════════════════════════════════════
 * OPTIONAL BIBLE RELATIONSHIPS
 * ══════════════════════════════════════════════════════════════════════════ */

/** A Bible reference coming from a form, a URL or a content row. */
export interface BibleReference {
  book: number;
  chapter: number | null;
  verse: number | null;
}

/** True when at least a book is set. */
export function hasReference(
  ref: Partial<BibleReference> | null | undefined
): ref is BibleReference {
  return Boolean(ref && ref.book);
}

/**
 * Parse a Bible reference out of untrusted input (URL search params, JSON
 * body). Returns null when there is no usable book, so callers can treat
 * "no relationship" and "invalid relationship" the same way.
 */
export function parseBibleReference(input: {
  book?: string | number | string[] | null;
  chapter?: string | number | string[] | null;
  verse?: string | number | string[] | null;
}): BibleReference | null {
  const num = (value: string | number | string[] | null | undefined): number | null => {
    const raw = Array.isArray(value) ? value[0] : value;
    if (raw === null || raw === undefined || raw === "") return null;
    const parsed = Number.parseInt(String(raw), 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  const book = num(input.book);
  if (!book || book > 66) return null;

  return { book, chapter: num(input.chapter), verse: num(input.verse) };
}

/** The reference an item declares, or null when it is not tied to a passage. */
export function referenceFromItem(item: ContentItem): BibleReference | null {
  if (!item.book) return null;
  return { book: item.book, chapter: item.chapter, verse: item.verse };
}

/**
 * "المزامير ٢٣:١" / "Psalms 23:1" — null when the item has no reference.
 * `includeVerse` keeps the label short in chips.
 */
export function referenceLabel(
  ref: BibleReference | null | undefined,
  isAr: boolean,
  includeVerse = true
): string | null {
  if (!hasReference(ref)) return null;
  const name = bibleBookLabel(ref.book, isAr);
  if (!name) return null;
  let label = name;
  if (ref.chapter) {
    label += ` ${ref.chapter}`;
    if (includeVerse && ref.verse) label += `:${ref.verse}`;
  }
  return label;
}

/**
 * Related-content matching: an item belongs to a reference when the BOOK
 * matches and the chapters do not contradict each other.
 *
 *   • an item without a chapter (e.g. "دراسة شخصية داود" filed under 1 Samuel)
 *     is related to every chapter of that book — a book-level item is
 *     intentionally broader, that is how servants file them;
 *   • the verse is display metadata only: matching at verse level would hide
 *     "Psalm 23 study guide" from someone reading Psalm 23:4, which is exactly
 *     the material they are looking for.
 */
export function matchesReference(
  item: ContentItem,
  ref: BibleReference | null | undefined
): boolean {
  if (!hasReference(ref)) return false;
  if (item.book !== ref.book) return false;
  if (ref.chapter && item.chapter && item.chapter !== ref.chapter) return false;
  return true;
}

/** Published items of one kind related to a reference, newest first. */
export function relatedItems(
  items: ContentItem[],
  kind: ContentKind,
  ref: BibleReference | null | undefined
): ContentItem[] {
  if (!hasReference(ref)) return [];
  return items.filter((item) => item.type === kind && matchesReference(item, ref));
}

/** URL of a section filtered by a Bible reference (deep link, shareable). */
export function referenceHref(
  locale: string,
  section: "studies" | "resources",
  ref: BibleReference | null | undefined
): string {
  const base = `/${locale}/bible/${section}`;
  if (!hasReference(ref)) return base;
  const params = new URLSearchParams({ book: String(ref.book) });
  if (ref.chapter) params.set("chapter", String(ref.chapter));
  if (ref.verse) params.set("verse", String(ref.verse));
  return `${base}?${params.toString()}`;
}
