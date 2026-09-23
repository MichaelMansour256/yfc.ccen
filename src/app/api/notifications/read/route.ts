import { NextResponse } from "next/server";
import {
  READS_UNSUPPORTED,
  isValidNotificationId,
  isValidSubscriberId,
  markAllRead,
  markNotificationsRead,
} from "@/lib/notification-reads";

/**
 * POST /api/notifications/read — record inbox read-state for ONE subscriber.
 *
 * The browser NEVER touches `notification_reads` directly (the table has RLS
 * enabled with no policies). This server route writes with the service-role
 * key, scoped to the subscriber id in the body — one device can only ever
 * create rows carrying its own OneSignal subscription id.
 *
 * Identity note (no user auth exists in this app): subscriber ids are
 * unguessable OneSignal UUIDs and read-state is low-sensitivity (which push
 * items a pseudo-anonymous device has opened — content every subscriber
 * already receives via push anyway), so a self-asserted id is acceptable
 * here; nothing privileged is exposed or modifiable beyond that.
 *
 * Body (JSON):
 *   { subscriber, notificationId }    → mark one notification read
 *   { subscriber, notificationIds }   → mark a batch (device→server sync;
 *                                      invalid / failed / duplicate ids are
 *                                      filtered server-side, idempotent)
 *   { subscriber, all: true }         → mark ALL sent notifications read for
 *                                      this subscriber only
 * Responses:
 *   200 { ok: true, marked: number }
 *   200 { ok: false, readsSupported: false }  (migration not applied yet)
 *   400 { error }                             (bad/missing fields)
 *   500 { error }                             (generic; details stay server-side)
 */
export async function POST(req: Request) {
  let body: {
    subscriber?: unknown;
    notificationId?: unknown;
    notificationIds?: unknown;
    all?: unknown;
  };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  if (!isValidSubscriberId(body.subscriber)) {
    return NextResponse.json({ error: "Invalid subscriber" }, { status: 400 });
  }
  const subscriber = body.subscriber;

  try {
    let result: { marked: number } | typeof READS_UNSUPPORTED;

    if (body.all === true) {
      result = await markAllRead(subscriber);
    } else if (Array.isArray(body.notificationIds)) {
      const ids = body.notificationIds.filter(isValidNotificationId);
      result = await markNotificationsRead(subscriber, ids);
    } else if (isValidNotificationId(body.notificationId)) {
      result = await markNotificationsRead(subscriber, [body.notificationId]);
    } else {
      return NextResponse.json(
        { error: "notificationId, notificationIds or all:true required" },
        { status: 400 }
      );
    }

    if (result === READS_UNSUPPORTED) {
      // supabase-notification-reads.sql not applied yet — the client keeps
      // working with its device-local fallback read-state.
      return NextResponse.json({ ok: false, readsSupported: false });
    }
    return NextResponse.json({ ok: true, marked: result.marked });
  } catch (error) {
    // Raw PostgrestError stays server-side; the client degrades to local mode.
    console.error("[api/notifications/read] failed:", error);
    return NextResponse.json(
      { error: "Failed to mark notification as read" },
      { status: 500 }
    );
  }
}
