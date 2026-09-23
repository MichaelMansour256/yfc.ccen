import { NextResponse } from "next/server";
import { listContent } from "@/lib/content-library-db";
import { isContentKind, type ContentKind } from "@/lib/content-library";

/**
 * Public content library — Studies (type=study) and Resources (type=resource).
 *
 *   GET /api/content                          → everything published
 *   GET /api/content?type=study               → studies only
 *   GET /api/content?type=resource            → resources only
 *   GET /api/content?book=19&chapter=23       → related content for Psalms 23
 *
 * Only published, non-archived rows are ever returned (enforced here AND by the
 * RLS policy in supabase-content-library.sql). No authentication is required,
 * exactly like the other public reads (/api/events, /api/prayer).
 *
 * Related-content rule: a book-level item (chapter is null) also counts as
 * related to any chapter of its book. `verse` is intentionally not a filter —
 * see matchesReference() in src/lib/content-library.ts for why.
 */
export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);

  const typeParam = searchParams.get("type");
  const kind: ContentKind | null =
    typeParam && isContentKind(typeParam)
      ? typeParam
      : null; // unknown/absent → both kinds (never a 400 for a public read)

  const toPositiveInt = (raw: string | null, max: number): number | null => {
    if (!raw) return null;
    const parsed = Number.parseInt(raw, 10);
    if (!Number.isFinite(parsed) || parsed <= 0 || parsed > max) return null;
    return parsed;
  };

  const items = await listContent({
    kind,
    book: toPositiveInt(searchParams.get("book"), 66),
    chapter: toPositiveInt(searchParams.get("chapter"), 150),
    publishedOnly: true,
  });

  return NextResponse.json(items);
}
