import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import {
  ContentInputError,
  ContentNotFoundError,
  MISSING_SCHEMA_CODE,
  MISSING_SCHEMA_MESSAGE,
  createContent,
  deleteContent,
  isMissingSchemaError,
  listContentStrict,
  updateContent,
} from "@/lib/content-library-db";

/**
 * Admin content management for Studies & Resources.
 *
 * Every method requires the project's existing admin authentication — the
 * `x-admin-password` header checked against ADMIN_PASSWORD (src/lib/auth.ts),
 * the same mechanism /api/admin/events and /api/admin/verse use. Nothing here
 * is reachable by a normal visitor: the public side only has GET /api/content,
 * which returns published rows.
 *
 *   GET    /api/admin/content          → every row (drafts + archived included)
 *   POST   /api/admin/content          → create a Study or a Resource
 *   PATCH  /api/admin/content { id }   → edit / publish / unpublish / archive
 *   DELETE /api/admin/content { id }   → permanent delete
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const items = await listContentStrict({ publishedOnly: false, includeArchived: true });
    return NextResponse.json(items);
  } catch (error) {
    return databaseError("list", error);
  }
}

export async function POST(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const item = await createContent(await req.json());
    return NextResponse.json(item);
  } catch (error) {
    return databaseError("create", error);
  }
}

export async function PATCH(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const body = await req.json();
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    const item = await updateContent(id, body);
    return NextResponse.json(item);
  } catch (error) {
    return databaseError("update", error);
  }
}

export async function DELETE(req: Request) {
  if (!isAuthorized(req)) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  try {
    const { id } = await req.json();
    if (!id) return NextResponse.json({ error: "id is required" }, { status: 400 });
    await deleteContent(String(id));
    return NextResponse.json({ success: true });
  } catch (error) {
    return databaseError("delete", error);
  }
}

/**
 * Map a failure onto a safe response. Raw Postgres messages never reach the
 * browser; a missing table gets its own code so the dashboard can tell the
 * servant to run supabase-content-library.sql.
 */
function databaseError(scope: string, error: unknown): NextResponse {
  const err = error as { code?: string; message?: string } | null;

  if (error instanceof ContentInputError) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }
  if (error instanceof ContentNotFoundError) {
    return NextResponse.json({ error: "Content item not found" }, { status: 404 });
  }
  if (isMissingSchemaError(err)) {
    console.error(`[content:${scope}] schema missing:`, err?.message);
    return NextResponse.json(
      { error: MISSING_SCHEMA_MESSAGE, code: MISSING_SCHEMA_CODE },
      { status: 503 }
    );
  }

  console.error(`[content:${scope}]`, error);
  return NextResponse.json({ error: `Could not ${scope} the content item` }, { status: 500 });
}
