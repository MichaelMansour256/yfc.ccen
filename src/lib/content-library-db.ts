/**
 * Studies & Resources — database operations.
 *
 * SERVER-ONLY. Reuses the single shared `supabase` client from `@/lib/supabase`
 * (the same client every other API route uses) and the project's existing
 * schema-error detector from `@/lib/attendance`, so there is no second Supabase
 * setup and no duplicated error handling.
 *
 * Table: content_library  (see supabase-content-library.sql)
 *
 * Conventions (same as src/lib/attendance.ts):
 *   • read helpers catch their own errors, log them server-side and return a
 *     safe value — a raw Postgres message never reaches the browser
 *   • write helpers throw, and the route maps the error onto a safe response
 *   • input is validated here, not in the UI, so the admin dashboard and any
 *     future client share exactly the same rules
 *
 * Security: this module is only ever imported by API routes. Public reads go
 * through GET /api/content (published + non-archived only) and admin writes
 * through /api/admin/content (x-admin-password). RLS on the table enforces the
 * same "published only" rule for the publishable key (see the migration).
 */
import { supabase } from "./supabase";
import { isMissingSchemaError } from "./attendance";
import {
  RESOURCE_TYPES,
  isContentKind,
  type ContentKind,
  type ContentItem,
} from "./content-library";

export const CONTENT_TABLE = "content_library";

/** Shown to admins when the migration has not been applied yet. */
export const MISSING_SCHEMA_CODE = "missing_schema";
export const MISSING_SCHEMA_MESSAGE =
  "The content library table is missing. Run supabase-content-library.sql in the Supabase SQL editor, then retry.";

export { isMissingSchemaError };

/* ══════════════════════════════════════════════════════════════════════════
 * ERRORS
 * ══════════════════════════════════════════════════════════════════════════ */

/** Invalid input from the admin dashboard — message is safe to show (→ 400). */
export class ContentInputError extends Error {}
/** Unknown id (→ 404). */
export class ContentNotFoundError extends Error {}

/* ══════════════════════════════════════════════════════════════════════════
 * READS
 * ══════════════════════════════════════════════════════════════════════════ */

export interface ContentFilters {
  /** Only this type (`undefined` = both studies and resources). */
  kind?: ContentKind | null;
  /** Bible relationship filters (book 1..66, chapter/verse ≥ 1). */
  book?: number | null;
  chapter?: number | null;
  /** Public callers get published rows only; the admin dashboard sees drafts. */
  publishedOnly?: boolean;
  /** Archived items are hidden everywhere except the admin dashboard. */
  includeArchived?: boolean;
  limit?: number;
}

/**
 * List content items. Filters are applied in the query (not in memory) so the
 * public route stays cheap, and the same function serves the admin dashboard
 * (publishedOnly: false, includeArchived: true).
 */
export async function listContent(filters: ContentFilters = {}): Promise<ContentItem[]> {
  const { items, error } = await fetchContent(filters);
  if (error) {
    console.error("[content] listContent:", error);
    return [];
  }
  return items;
}

/**
 * Same query, but a database failure is thrown instead of silently returning
 * an empty list — used by the admin routes, which must tell the servant that
 * the migration has not been applied yet instead of showing "no items".
 */
export async function listContentStrict(filters: ContentFilters = {}): Promise<ContentItem[]> {
  const { items, error } = await fetchContent(filters);
  if (error) throw error;
  return items;
}

async function fetchContent(
  filters: ContentFilters = {}
): Promise<{ items: ContentItem[]; error: unknown }> {
  const {
    kind = null,
    book = null,
    chapter = null,
    publishedOnly = false,
    includeArchived = false,
    limit,
  } = filters;

  let query = supabase.from(CONTENT_TABLE).select("*");

  if (kind) query = query.eq("type", kind);
  if (publishedOnly) query = query.eq("published", true);
  if (!includeArchived) query = query.eq("archived", false);

  if (book) {
    query = query.eq("book", book);
    if (chapter) {
      // A book-level item (chapter is null) belongs to every chapter of that
      // book — the same rule the client applies in `matchesReference`.
      query = query.or(`chapter.is.null,chapter.eq.${chapter}`);
    }
  }

  query = query.order("created_at", { ascending: false });
  if (limit) query = query.limit(limit);

  const { data, error } = await query;
  return { items: (data ?? []) as ContentItem[], error: error ?? null };
}

export async function getContentById(id: string): Promise<ContentItem | null> {
  const { data, error } = await supabase
    .from(CONTENT_TABLE)
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    console.error("[content] getContentById:", error);
    return null;
  }
  return (data as ContentItem) ?? null;
}

/* ══════════════════════════════════════════════════════════════════════════
 * VALIDATION — one place, so the dashboard and any future client agree
 * ══════════════════════════════════════════════════════════════════════════ */

const MAX_TITLE = 200;
const MAX_DESCRIPTION = 4000;
const MAX_URL = 2000;
const MAX_CATEGORY = 80;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export type ContentBody = Record<string, unknown>;

/** Trimmed text, or null when empty. Throws when it is not text / too long. */
function text(value: unknown, max: number, label: string): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value !== "string") throw new ContentInputError(`${label} must be text`);
  const trimmed = value.trim();
  if (!trimmed) return null;
  if (trimmed.length > max) throw new ContentInputError(`${label} is too long (max ${max} characters)`);
  return trimmed;
}

/** Optional positive integer (Bible book/chapter/verse), or null. */
function intOrNull(value: unknown, label: string, max: number): number | null {
  if (value === null || value === undefined || value === "") return null;
  const parsed = typeof value === "number" ? value : Number.parseInt(String(value), 10);
  if (!Number.isFinite(parsed)) throw new ContentInputError(`${label} must be a number`);
  if (parsed <= 0) return null;
  if (parsed > max) throw new ContentInputError(`${label} must be ${max} or less`);
  return Math.trunc(parsed);
}

function boolOr(value: unknown, fallback: boolean): boolean {
  if (value === undefined || value === null) return fallback;
  if (typeof value === "boolean") return value;
  if (value === "true") return true;
  if (value === "false") return false;
  throw new ContentInputError("Published/Archived flags must be true or false");
}

/** A link must be absolute (https://…) or a page on this site (/…). */
function assertLink(value: string, label: string): void {
  if (!/^https?:\/\//i.test(value) && !value.startsWith("/")) {
    throw new ContentInputError(`${label} must start with https:// (or / for a page on this site)`);
  }
}

/**
 * Turn an untrusted JSON body into a row-shaped object.
 *
 * `create` requires type/title/url and fills the remaining columns with null;
 * `update` only touches the keys that were actually sent, so an
 * "unpublish"/"archive" toggle can never wipe a description.
 */
export function normalizeContentInput(
  body: ContentBody,
  mode: "create" | "update",
  existing?: ContentItem
): ContentBody {
  const create = mode === "create";
  const has = (key: string) => Object.prototype.hasOwnProperty.call(body, key);
  const sends = (key: keyof ContentItem) => create || has(key);
  const pick = (key: keyof ContentItem): unknown => (has(key) ? body[key] : existing?.[key]);

  const patch: ContentBody = {};

  // 1. type — decides which optional fields are allowed at all
  let type: ContentKind;
  if (create || has("type")) {
    if (!isContentKind(body.type)) {
      throw new ContentInputError("Type must be 'study' or 'resource'");
    }
    type = body.type;
    patch.type = type;
  } else {
    type = existing?.type ?? "study";
  }

  // 2. required fields
  if (sends("title")) {
    const title = text(body.title ?? existing?.title, MAX_TITLE, "Title");
    if (!title) throw new ContentInputError("Title is required");
    patch.title = title;
  }
  if (sends("url")) {
    const url = text(body.url ?? existing?.url, MAX_URL, "Link");
    if (!url) throw new ContentInputError("A link is required (Google Drive, PDF, external URL…)");
    assertLink(url, "The link");
    patch.url = url;
  }

  // 3. optional text
  if (has("title_en")) patch.title_en = text(body.title_en, MAX_TITLE, "English title");
  if (has("description")) patch.description = text(body.description, MAX_DESCRIPTION, "Description");
  if (has("description_en")) {
    patch.description_en = text(body.description_en, MAX_DESCRIPTION, "English description");
  }
  if (has("category")) patch.category = text(body.category, MAX_CATEGORY, "Category");
  if (has("image")) {
    const image = text(body.image, MAX_URL, "Cover image");
    if (image) assertLink(image, "The cover image");
    patch.image = image;
  }

  // 4. resource-only fields — explicitly cleared for studies, so switching a
  //    row's type never leaves a stale format or study link behind
  if (type === "study") {
    if (create || has("resource_type") || existing?.resource_type) patch.resource_type = null;
    if (create || has("related_study_id") || existing?.related_study_id) patch.related_study_id = null;
  } else {
    if (create || has("resource_type")) {
      const resourceType = text(body.resource_type, 40, "Resource type");
      if (resourceType && !RESOURCE_TYPES.some((p) => p.id === resourceType)) {
        throw new ContentInputError(`Unknown resource type "${resourceType}"`);
      }
      patch.resource_type = resourceType;
    }
    if (create || has("related_study_id")) {
      const related = text(body.related_study_id, 64, "Related study");
      if (related && !UUID_RE.test(related)) throw new ContentInputError("Related study id is not valid");
      patch.related_study_id = related;
    }
  }

  // 5. optional Bible relationship (book 1..66, chapter/verse ≥ 1)
  if (create || has("book") || has("chapter") || has("verse")) {
    const book = intOrNull(pick("book"), "Book", 66);
    let chapter = intOrNull(pick("chapter"), "Chapter", 150);
    let verse = intOrNull(pick("verse"), "Verse", 200);
    if (!book) {
      chapter = null;
      verse = null;
    }
    if (verse && !chapter) throw new ContentInputError("A verse needs a book and a chapter");
    patch.book = book;
    patch.chapter = chapter;
    patch.verse = verse;
  }

  // 6. flags
  if (create || has("published")) patch.published = boolOr(body.published, false);
  if (create || has("archived")) patch.archived = boolOr(body.archived, false);

  return patch;
}

/* ══════════════════════════════════════════════════════════════════════════
 * WRITES — throw so the route can map the failure (400/404/503)
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * A resource may point at a study; anything else (missing row, another
 * resource, itself) is rejected before the insert, so the dashboard shows a
 * readable message instead of a foreign-key error.
 */
async function assertRelatedStudy(relatedStudyId: unknown, selfId: string | null): Promise<void> {
  if (typeof relatedStudyId !== "string" || !relatedStudyId) return;
  if (selfId && relatedStudyId === selfId) {
    throw new ContentInputError("A content item cannot be related to itself");
  }
  const target = await getContentById(relatedStudyId);
  if (!target) throw new ContentInputError("The related study was not found");
  if (target.type !== "study") throw new ContentInputError("Only a study can be selected as the related study");
}

export async function createContent(body: ContentBody): Promise<ContentItem> {
  const values = normalizeContentInput(body, "create");
  await assertRelatedStudy(values.related_study_id, null);

  const { data, error } = await supabase.from(CONTENT_TABLE).insert(values).select().single();
  if (error) throw error;
  return data as ContentItem;
}

export async function updateContent(id: string, body: ContentBody): Promise<ContentItem> {
  const existing = await getContentById(id);
  if (!existing) throw new ContentNotFoundError("Content item not found");

  const patch = normalizeContentInput(body, "update", existing);
  await assertRelatedStudy(patch.related_study_id, id);

  const { data, error } = await supabase
    .from(CONTENT_TABLE)
    .update(patch)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as ContentItem;
}

/**
 * Permanently delete an item. Resources pointing at a deleted study stay in
 * the library — the FK is ON DELETE SET NULL (see the migration).
 */
export async function deleteContent(id: string): Promise<void> {
  const { error } = await supabase.from(CONTENT_TABLE).delete().eq("id", id);
  if (error) throw error;
}
