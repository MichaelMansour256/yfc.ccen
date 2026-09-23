"use client";
import { useCallback, useEffect, useMemo, useState } from "react";
import { BIBLE_BOOKS } from "@/lib/bibleBooks";
import { siteConfig } from "@/config";
import {
  RESOURCE_TYPES,
  categoriesFor,
  referenceFromItem,
  referenceLabel,
  type ContentItem,
  type ContentKind,
} from "@/lib/content-library";

/**
 * 📚 Content manager — the admin half of Studies & Resources.
 *
 * Rendered inside the existing /admin dashboard as one more tab, so it reuses
 * the dashboard's login, its `x-admin-password` header and its visual language.
 * Everything it does goes through /api/admin/content (admin-only); the public
 * site only ever sees published rows.
 *
 * Field notes
 *   • Type decides which optional fields are offered: a study can have a
 *     category, Bible reference and cover; a resource can additionally have a
 *     format (PDF/video/…) and a "related study".
 *   • Every relationship is optional — "Bible Reading Guide.pdf" is a valid
 *     resource with no book, no chapter and no study.
 *   • The actual file is never uploaded here: the Content URL field points at
 *     Google Drive / any external host. Only the *cover image* is uploaded (to
 *     the meeting's own Cloudinary namespace) because a broken cover makes the
 *     public card look empty; a URL can be pasted instead.
 */
type Draft = {
  type: ContentKind;
  title: string;
  title_en: string;
  description: string;
  description_en: string;
  url: string;
  image: string;
  category: string;
  customCategory: string;
  resource_type: string;
  book: string;
  chapter: string;
  verse: string;
  related_study_id: string;
  published: boolean;
};

const CUSTOM_CATEGORY = "__custom";

const EMPTY_DRAFT: Draft = {
  type: "study",
  title: "",
  title_en: "",
  description: "",
  description_en: "",
  url: "",
  image: "",
  category: "",
  customCategory: "",
  resource_type: "",
  book: "",
  chapter: "",
  verse: "",
  related_study_id: "",
  published: false,
};

type Scope = "all" | "study" | "resource" | "archived";

/**
 * Loads the whole library (drafts + archived included) for the dashboard.
 * A plain module-level function: it never touches React state, so the effect
 * below only has to feed the result into state inside a promise callback —
 * the pattern every page in this project uses to load data.
 */
async function fetchLibrary(
  headers: Record<string, string>
): Promise<{ items: ContentItem[]; error: string }> {
  try {
    const res = await fetch("/api/admin/content", { headers, cache: "no-store" });
    const data = await res.json();
    if (!res.ok) {
      return {
        items: [],
        error: typeof data?.error === "string" ? data.error : "Could not load the content library",
      };
    }
    return { items: Array.isArray(data) ? (data as ContentItem[]) : [], error: "" };
  } catch {
    return { items: [], error: "Could not reach the server" };
  }
}


const INPUT =
  "w-full rounded-xl bg-blue-dark/60 px-4 py-2 text-sm text-white placeholder-blue-light/40 outline-none ring-1 ring-blue-mid/40 focus:ring-blue-accent";
const LABEL = "text-xs font-semibold text-blue-light/70";
const CHIP = "rounded-full px-3 py-1.5 text-xs font-semibold transition";

export default function ContentManager({ password }: { password: string }) {
  const [items, setItems] = useState<ContentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);
  const [scope, setScope] = useState<Scope>("all");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY_DRAFT);
  const [imageUploading, setImageUploading] = useState(false);

  const headers = useMemo(() => ({ "x-admin-password": password }), [password]);
  const jsonHeaders = useMemo(
    () => ({ "x-admin-password": password, "content-type": "application/json" }),
    [password]
  );

  /** Applies a fetched library to state (kept out of the effect body itself). */
  const applyLibrary = useCallback((result: { items: ContentItem[]; error: string }) => {
    setItems(result.items);
    setError(result.error);
    setLoading(false);
  }, []);

  // Loading happens inside a promise callback, never synchronously in the
  // effect body — the same pattern the events/gallery pages already use.
  useEffect(() => {
    fetchLibrary(headers).then(applyLibrary);
  }, [headers, applyLibrary]);

  /** Manual refresh (also used after every create / edit / delete). */
  function refreshLibrary() {
    fetchLibrary(headers).then(applyLibrary);
  }

  const studies = useMemo(() => items.filter((item) => item.type === "study"), [items]);

  const visible = useMemo(() => {
    if (scope === "archived") return items.filter((item) => item.archived);
    const active = items.filter((item) => !item.archived);
    return scope === "all" ? active : active.filter((item) => item.type === scope);
  }, [items, scope]);

  const categoryOptions = useMemo(() => categoriesFor(draft.type), [draft.type]);

  function resetForm() {
    setDraft(EMPTY_DRAFT);
    setEditingId(null);
  }

  function startEdit(item: ContentItem) {
    const presets = categoriesFor(item.type);
    const stored = item.category ?? "";
    const isPreset = presets.some((preset) => preset.id === stored);
    setEditingId(item.id);
    setDraft({
      type: item.type,
      title: item.title,
      title_en: item.title_en ?? "",
      description: item.description ?? "",
      description_en: item.description_en ?? "",
      url: item.url,
      image: item.image ?? "",
      category: stored ? (isPreset ? stored : CUSTOM_CATEGORY) : "",
      customCategory: stored && !isPreset ? stored : "",
      resource_type: item.resource_type ?? "",
      book: item.book ? String(item.book) : "",
      chapter: item.chapter ? String(item.chapter) : "",
      verse: item.verse ? String(item.verse) : "",
      related_study_id: item.related_study_id ?? "",
      published: item.published,
    });
    setMessage(null);
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const toNumberOrNull = (value: string): number | null => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
  };

  /** Create (POST) or save changes (PATCH) — one form for both. */
  async function save() {
    const title = draft.title.trim();
    if (!title) {
      setMessage({ tone: "error", text: "Title (Arabic) is required" });
      return;
    }
    const url = draft.url.trim();
    if (!url) {
      setMessage({ tone: "error", text: "Content URL is required (Google Drive / PDF / external link)" });
      return;
    }

    const category = draft.category === CUSTOM_CATEGORY ? draft.customCategory.trim() : draft.category;
    const payload = {
      type: draft.type,
      title,
      title_en: draft.title_en.trim() || null,
      description: draft.description.trim() || null,
      description_en: draft.description_en.trim() || null,
      url,
      image: draft.image.trim() || null,
      category: category || null,
      resource_type: draft.type === "resource" ? draft.resource_type || null : null,
      book: toNumberOrNull(draft.book),
      chapter: toNumberOrNull(draft.chapter),
      verse: toNumberOrNull(draft.verse),
      related_study_id: draft.type === "resource" ? draft.related_study_id || null : null,
      published: draft.published,
    };

    setBusy(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: editingId ? "PATCH" : "POST",
        headers: jsonHeaders,
        body: JSON.stringify(editingId ? { ...payload, id: editingId } : payload),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "error", text: typeof data?.error === "string" ? data.error : "Save failed" });
        return;
      }
      setMessage({
        tone: "ok",
        text: editingId
          ? "Updated ✓"
          : draft.published
            ? "Added and published ✓"
            : "Added as a draft ✓ — tick “Published” when it is ready to appear on the site",
      });
      resetForm();
      refreshLibrary();
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server" });
    } finally {
      setBusy(false);
    }
  }

  /** Publish / unpublish / archive / restore — a one-field PATCH. */
  async function patchItem(id: string, patch: Record<string, unknown>, label: string) {
    setBusy(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: "PATCH",
        headers: jsonHeaders,
        body: JSON.stringify({ id, ...patch }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "error", text: typeof data?.error === "string" ? data.error : `${label} failed` });
        return;
      }
      setMessage({ tone: "ok", text: `${label} ✓` });
      refreshLibrary();
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server" });
    } finally {
      setBusy(false);
    }
  }

  async function removeItem(item: ContentItem) {
    if (!confirm(`Delete "${item.title}" permanently? Resources linked to it stay in the library.`)) return;
    setBusy(true);
    try {
      const res = await fetch("/api/admin/content", {
        method: "DELETE",
        headers: jsonHeaders,
        body: JSON.stringify({ id: item.id }),
      });
      const data = await res.json();
      if (!res.ok) {
        setMessage({ tone: "error", text: typeof data?.error === "string" ? data.error : "Delete failed" });
        return;
      }
      if (editingId === item.id) resetForm();
      setMessage({ tone: "ok", text: "Deleted ✓" });
      refreshLibrary();
    } catch {
      setMessage({ tone: "error", text: "Could not reach the server" });
    } finally {
      setBusy(false);
    }
  }

  /**
   * Cover image → the project's existing Cloudinary upload route, inside the
   * meeting's own folder namespace (`<meetingFolder>/content`), which the public
   * gallery deliberately skips — so covers never leak into the photo gallery.
   */
  async function uploadImage(file: File) {
    setImageUploading(true);
    try {
      const form = new FormData();
      form.append("folder", `${siteConfig.cloudinary.meetingFolder}/content`);
      form.append("files", file);
      const res = await fetch("/api/admin/upload", { method: "POST", headers, body: form });
      const data = await res.json();
      const uploadedUrl = data?.uploaded?.[0]?.secure_url;
      if (!res.ok || typeof uploadedUrl !== "string") {
        setMessage({ tone: "error", text: "Image upload failed" });
        return;
      }
      setDraft((prev) => ({ ...prev, image: uploadedUrl }));
    } catch {
      setMessage({ tone: "error", text: "Image upload failed" });
    } finally {
      setImageUploading(false);
    }
  }

  return (
    <div className="flex flex-col gap-4">
      {/* ── Add / edit form ── */}
      <section className="rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-4">
        <div className="mb-3 flex items-center justify-between gap-2">
          <h2 className="font-semibold text-white">
            {editingId ? "✏️ Edit content" : "➕ Add study or resource"}
          </h2>
          {editingId && (
            <button
              type="button"
              onClick={resetForm}
              className="rounded-xl bg-blue-dark/60 px-3 py-1.5 text-xs font-semibold text-blue-light/80 hover:bg-blue-mid"
            >
              Cancel edit
            </button>
          )}
        </div>

        <div className="flex flex-col gap-3">
          {/* Type — decides which optional fields are offered below */}
          <div className="flex gap-2">
            {(["study", "resource"] as const).map((kind) => (
              <button
                key={kind}
                type="button"
                onClick={() =>
                  setDraft((prev) => ({
                    ...prev,
                    type: kind,
                    category: "",
                    customCategory: "",
                    resource_type: kind === "study" ? "" : prev.resource_type,
                    related_study_id: kind === "study" ? "" : prev.related_study_id,
                  }))
                }
                className={`flex-1 rounded-xl py-2 text-sm font-semibold transition ${
                  draft.type === kind ? "bg-blue-accent text-white" : "bg-blue-primary/40 text-blue-light/70"
                }`}
              >
                {kind === "study" ? "📚 Study" : "🗂️ Resource"}
              </button>
            ))}
          </div>

          <input
            value={draft.title}
            onChange={(event) => setDraft((prev) => ({ ...prev, title: event.target.value }))}
            placeholder="العنوان (عربي) *"
            dir="rtl"
            className={INPUT}
          />
          <input
            value={draft.title_en}
            onChange={(event) => setDraft((prev) => ({ ...prev, title_en: event.target.value }))}
            placeholder="Title (English, optional)"
            className={INPUT}
          />
          <textarea
            value={draft.description}
            onChange={(event) => setDraft((prev) => ({ ...prev, description: event.target.value }))}
            placeholder="الوصف (عربي، اختياري)"
            dir="rtl"
            rows={3}
            className={`${INPUT} resize-none`}
          />
          <textarea
            value={draft.description_en}
            onChange={(event) => setDraft((prev) => ({ ...prev, description_en: event.target.value }))}
            placeholder="Description (English, optional)"
            rows={2}
            className={`${INPUT} resize-none`}
          />

          <div>
            <input
              value={draft.url}
              onChange={(event) => setDraft((prev) => ({ ...prev, url: event.target.value }))}
              placeholder="Content URL * — Google Drive / PDF / external link"
              dir="ltr"
              className={INPUT}
            />
            <p className="mt-1 text-xs text-blue-light/50">
              The file stays where it already is (Drive, YouTube, Cloudinary…). E3dady stores the link and
              presents it — only the cover image below is uploaded here.
            </p>
          </div>

          {/* Category — preset or free text */}
          <div className="flex gap-2">
            <select
              value={draft.category}
              onChange={(event) => setDraft((prev) => ({ ...prev, category: event.target.value }))}
              className={`${INPUT} flex-1`}
            >
              <option value="">Category — none</option>
              {categoryOptions.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.icon} {preset.en}
                </option>
              ))}
              <option value={CUSTOM_CATEGORY}>✏️ Custom category…</option>
            </select>
            {draft.category === CUSTOM_CATEGORY && (
              <input
                value={draft.customCategory}
                onChange={(event) => setDraft((prev) => ({ ...prev, customCategory: event.target.value }))}
                placeholder="Category name"
                className={`${INPUT} flex-1`}
              />
            )}
          </div>

          {/* Format — resources only */}
          {draft.type === "resource" && (
            <select
              value={draft.resource_type}
              onChange={(event) => setDraft((prev) => ({ ...prev, resource_type: event.target.value }))}
              className={INPUT}
            >
              <option value="">Type — not specified</option>
              {RESOURCE_TYPES.map((preset) => (
                <option key={preset.id} value={preset.id}>
                  {preset.icon} {preset.en}
                </option>
              ))}
            </select>
          )}

          {/* Optional Bible relationship — never required */}
          <div className="flex flex-col gap-1 rounded-xl bg-blue-dark/40 p-3">
            <span className={LABEL}>📖 Bible book (optional)</span>
            <div className="flex gap-2">
              <select
                value={draft.book}
                onChange={(event) =>
                  setDraft((prev) => ({
                    ...prev,
                    book: event.target.value,
                    chapter: event.target.value ? prev.chapter : "",
                    verse: event.target.value ? prev.verse : "",
                  }))
                }
                className={`${INPUT} flex-1`}
              >
                <option value="">— none —</option>
                {BIBLE_BOOKS.map((book) => (
                  <option key={book.nr} value={book.nr}>
                    {book.nr}. {book.name}
                  </option>
                ))}
              </select>
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={draft.chapter}
                onChange={(event) => setDraft((prev) => ({ ...prev, chapter: event.target.value, verse: event.target.value ? prev.verse : "" }))}
                placeholder="Ch."
                aria-label="Chapter"
                disabled={!draft.book}
                className={`${INPUT} w-20 disabled:opacity-40`}
              />
              <input
                type="number"
                min={1}
                inputMode="numeric"
                value={draft.verse}
                onChange={(event) => setDraft((prev) => ({ ...prev, verse: event.target.value }))}
                placeholder="Vs."
                aria-label="Verse"
                disabled={!draft.chapter}
                className={`${INPUT} w-20 disabled:opacity-40`}
              />
            </div>
            <p className="text-xs text-blue-light/50">
              Book + chapter is enough to make the item appear as related content for that passage
              (e.g. المزامير ٢٣).
            </p>
          </div>

          {/* Related study — resources only, and only when there is one */}
          {draft.type === "resource" && studies.length > 0 && (
            <select
              value={draft.related_study_id}
              onChange={(event) => setDraft((prev) => ({ ...prev, related_study_id: event.target.value }))}
              className={INPUT}
            >
              <option value="">Related study — none (a resource can stand alone)</option>
              {studies.map((study) => (
                <option key={study.id} value={study.id}>
                  {study.title}
                  {study.title_en ? ` — ${study.title_en}` : ""}
                </option>
              ))}
            </select>
          )}

          {/* Cover image — uploaded to the meeting's Cloudinary namespace */}
          <div className="flex flex-col gap-2 rounded-xl bg-blue-dark/40 p-3">
            <span className={LABEL}>🖼️ Cover image (optional)</span>
            <input
              value={draft.image}
              onChange={(event) => setDraft((prev) => ({ ...prev, image: event.target.value }))}
              placeholder="https://… image URL"
              dir="ltr"
              className={INPUT}
            />
            <input
              type="file"
              accept="image/*"
              disabled={imageUploading}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (file) uploadImage(file);
              }}
              className="text-sm text-blue-light/70 file:mr-3 file:rounded-lg file:border-0 file:bg-blue-accent file:px-3 file:py-1 file:text-sm file:text-white disabled:opacity-50"
            />
            {imageUploading && <p className="text-xs text-blue-light/50">Uploading image…</p>}
            {draft.image && (
              <div className="flex items-center gap-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={draft.image} alt="" className="h-16 rounded-lg object-cover" />
                <button
                  type="button"
                  onClick={() => setDraft((prev) => ({ ...prev, image: "" }))}
                  className="text-xs text-red-400 hover:text-red-300"
                >
                  Remove
                </button>
              </div>
            )}
          </div>

          <label className="flex items-center gap-2 text-sm text-blue-light/80">
            <input
              type="checkbox"
              checked={draft.published}
              onChange={(event) => setDraft((prev) => ({ ...prev, published: event.target.checked }))}
              className="h-4 w-4"
            />
            Published (visible on the public site)
          </label>

          <button
            type="button"
            onClick={save}
            disabled={busy}
            className="rounded-xl bg-blue-accent py-2 text-sm font-semibold text-white hover:bg-blue-mid disabled:opacity-50"
          >
            {busy
              ? "Saving…"
              : editingId
                ? "💾 Save changes"
                : draft.type === "study"
                  ? "➕ Add study"
                  : "➕ Add resource"}
          </button>

          {message && (
            <p className={`text-sm ${message.tone === "ok" ? "text-green-400" : "text-red-400"}`}>
              {message.text}
            </p>
          )}
        </div>
      </section>

      {/* ── Library: everything in the table, drafts and archived included ── */}
      <section className="rounded-2xl border border-blue-mid/40 bg-blue-primary/30 p-4">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <h2 className="font-semibold text-white">📚 Library ({items.length})</h2>
          <button
            type="button"
            onClick={() => {
              setLoading(true);
              refreshLibrary();
            }}
            disabled={loading}
            className="rounded-xl bg-blue-dark/60 px-3 py-1.5 text-xs font-semibold text-blue-light/80 hover:bg-blue-mid disabled:opacity-50"
          >
            {loading ? "Loading…" : "Refresh"}
          </button>
        </div>

        <div className="mb-3 flex flex-wrap gap-2">
          {(
            [
              ["all", "All"],
              ["study", "📚 Studies"],
              ["resource", "🗂️ Resources"],
              ["archived", "🗄️ Archived"],
            ] as const
          ).map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setScope(value)}
              className={`${CHIP} ${scope === value ? "bg-blue-accent text-white" : "bg-blue-primary/40 text-blue-light/70"}`}
            >
              {label}
            </button>
          ))}
        </div>

        {error && <p className="mb-3 rounded-xl bg-red-500/10 p-3 text-sm text-red-400">{error}</p>}

        {visible.length === 0 ? (
          <p className="text-sm text-blue-light/50">
            {loading
              ? "Loading the content library…"
              : "Nothing here yet — add the first study or resource above."}
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {visible.map((item) => {
              const reference = referenceLabel(referenceFromItem(item), false);
              const category = item.category
                ? categoriesFor(item.type).find((preset) => preset.id === item.category)?.en ?? item.category
                : null;
              const format = item.resource_type
                ? RESOURCE_TYPES.find((preset) => preset.id === item.resource_type)?.en ?? item.resource_type
                : null;
              return (
                <div key={item.id} className="rounded-xl bg-blue-dark/40 p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-white">
                        {item.type === "study" ? "📚" : "🗂️"} {item.title}
                      </p>
                      {item.title_en && <p className="text-xs text-blue-light/50">{item.title_en}</p>}
                      <div className="mt-1 flex flex-wrap items-center gap-1.5">
                        {category && (
                          <span className="rounded-full bg-blue-primary/50 px-2 py-0.5 text-xs text-blue-light/70">
                            {category}
                          </span>
                        )}
                        {format && (
                          <span className="rounded-full bg-blue-primary/50 px-2 py-0.5 text-xs text-blue-light/70">
                            {format}
                          </span>
                        )}
                        {reference && (
                          <span className="rounded-full bg-blue-accent/15 px-2 py-0.5 text-xs text-blue-accent">
                            📖 {reference}
                          </span>
                        )}
                        {item.related_study_id && (
                          <span className="rounded-full bg-yellow-400/10 px-2 py-0.5 text-xs text-yellow-300/90">
                            📚 related study
                          </span>
                        )}
                        <span
                          className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                            item.published
                              ? "bg-green-500/15 text-green-400"
                              : "bg-blue-primary/50 text-blue-light/60"
                          }`}
                        >
                          {item.published ? "Published" : "Draft"}
                        </span>
                        {item.archived && (
                          <span className="rounded-full bg-red-500/15 px-2 py-0.5 text-xs text-red-300">
                            Archived
                          </span>
                        )}
                      </div>
                    </div>
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="shrink-0 text-xs text-blue-accent underline"
                    >
                      open ↗
                    </a>
                  </div>

                  <div className="mt-2 flex flex-wrap gap-2">
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        patchItem(
                          item.id,
                          { published: !item.published },
                          item.published ? "Unpublished" : "Published"
                        )
                      }
                      className="rounded-xl bg-blue-dark/60 px-3 py-1.5 text-xs font-semibold text-blue-light/80 hover:bg-blue-mid disabled:opacity-50"
                    >
                      {item.published ? "🚫 Unpublish" : "✅ Publish"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() =>
                        patchItem(item.id, { archived: !item.archived }, item.archived ? "Restored" : "Archived")
                      }
                      className="rounded-xl bg-blue-dark/60 px-3 py-1.5 text-xs font-semibold text-blue-light/80 hover:bg-blue-mid disabled:opacity-50"
                    >
                      {item.archived ? "♻️ Restore" : "🗄️ Archive"}
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => startEdit(item)}
                      className="rounded-xl bg-blue-dark/60 px-3 py-1.5 text-xs font-semibold text-blue-light/80 hover:bg-blue-mid disabled:opacity-50"
                    >
                      ✏️ Edit
                    </button>
                    <button
                      type="button"
                      disabled={busy}
                      onClick={() => removeItem(item)}
                      className="rounded-xl bg-red-500/10 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-500/20 disabled:opacity-50"
                    >
                      🗑 Delete
                    </button>
                  </div>

                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}

