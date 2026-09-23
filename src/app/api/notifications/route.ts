import { NextResponse } from "next/server";
import { listPublicNotifications } from "@/lib/notifications-history";
import {
  READS_UNSUPPORTED,
  countUnread,
  getReadIds,
  isValidSubscriberId,
} from "@/lib/notification-reads";

/**
 * Public notification inbox feed — the SAME `notifications_history` records
 * the Admin History tab reads, sanitized for end users:
 *
 *   • only status="sent" rows (failed sends are never shown to users)
 *   • internal fields (onesignal_id, error, recipients) never leave the server
 *
 * No auth required: the contents were already delivered to every anonymous
 * subscriber via OneSignal push, so this leaks nothing new. Read-only and
 * server-limited (hard cap on `limit`), so there is nothing to abuse.
 *
 * Optional `subscriber` (the caller's OneSignal Push Subscription id) adds
 * per-subscriber read-state WITHOUT exposing the table to the browser:
 *   readsSupported  — false until supabase-notification-reads.sql is applied
 *                     (client uses device-local fallback read-state)
 *   readIds         — notification ids this subscriber has read (capped)
 *   unreadCount     — exact count via two head-count queries, no rows fetched
 *
 * GET /api/notifications?limit=20&offset=0&subscriber=<onesignal-id>
 *   → { notifications, hasMore, readsSupported, readIds?, unreadCount? }
 */
const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 50;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const parsedLimit = parseInt(searchParams.get("limit") ?? "", 10);
  const parsedOffset = parseInt(searchParams.get("offset") ?? "", 10);
  const limit = Math.min(
    Math.max(Number.isNaN(parsedLimit) ? DEFAULT_LIMIT : parsedLimit, 1),
    MAX_LIMIT
  );
  const offset = Math.max(Number.isNaN(parsedOffset) ? 0 : parsedOffset, 0);

  const subscriber = searchParams.get("subscriber");
  if (subscriber !== null && !isValidSubscriberId(subscriber)) {
    return NextResponse.json({ error: "Invalid subscriber" }, { status: 400 });
  }

  try {
    const { notifications, hasMore } = await listPublicNotifications(
      limit,
      offset
    );

    if (!subscriber) {
      return NextResponse.json({
        notifications,
        hasMore,
        readsSupported: true,
      });
    }

    const [readIds, unreadCount] = await Promise.all([
      getReadIds(subscriber),
      countUnread(subscriber),
    ]);

    if (readIds === READS_UNSUPPORTED || unreadCount === READS_UNSUPPORTED) {
      // Migration not applied (or read-state unreachable): the list itself
      // still works — the client falls back to device-local read-state.
      return NextResponse.json({
        notifications,
        hasMore,
        readsSupported: false,
      });
    }

    return NextResponse.json({
      notifications,
      hasMore,
      readsSupported: true,
      readIds,
      unreadCount,
    });
  } catch (error) {
    // Raw Supabase errors are logged server-side only — the client gets a
    // generic message and the UI shows its friendly retry state.
    console.error("[api/notifications] list failed:", error);
    return NextResponse.json(
      { error: "Failed to load notifications" },
      { status: 500 }
    );
  }
}