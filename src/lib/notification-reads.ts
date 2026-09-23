/**
 * Server-only read-state operations for the user Notification Inbox.
 *
 * Backing table: `notification_reads` (supabase-notification-reads.sql) —
 * one row per (notification, subscriber), where `subscriber_id` is the
 * device's OneSignal Push Subscription id. Uses the single shared server
 * Supabase client from @/lib/supabase (service-role key → RLS bypass; the
 * table itself has NO RLS policies, so it is unreachable from the browser).
 *
 * All functions degrade to the sentinel `READS_UNSUPPORTED` when the
 * migration has not been applied yet (or read-state is otherwise
 * unreachable) so the inbox falls back to device-local reads instead of
 * breaking — never throws for read-state problems.
 *
 * INVARIANT maintained here: read-state is only ever written for
 * notifications with status="sent" — failed attempts never appear in the
 * inbox and must not be markable as read.
 */
import { supabase } from "./supabase";

/** OneSignal subscription ids are UUID-ish tokens (36 chars in practice). */
const SUBSCRIBER_ID_RE = /^[A-Za-z0-9_-]{16,64}$/;
/** notifications_history.id is a uuid_generate_v4() UUID. */
const UUID_RE =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidSubscriberId(value: unknown): value is string {
  return typeof value === "string" && SUBSCRIBER_ID_RE.test(value);
}

export function isValidNotificationId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

/** Sentinel: notification_reads does not exist yet / is unreachable. */
export const READS_UNSUPPORTED = "unsupported" as const;
export type ReadsUnsupported = typeof READS_UNSUPPORTED;

/**
 * Cap on read ids returned to one client. Unrealistic for this app's scale;
 * bounds the API payload if a subscriber ever reads thousands of items.
 */
const READ_IDS_LIMIT = 1000;
/** Max rows touched by a single mark request (matches the local-store cap). */
const MARK_BATCH_LIMIT = 500;
/** Max notifications marked by "mark all" in one request. */
const MARK_ALL_LIMIT = 2000;

type SupabaseErrorLike = { code?: string; message?: string } | null | undefined;

/** True when `notification_reads` does not exist (yet). */
function isMissingRelation(error: SupabaseErrorLike): boolean {
  // PGRST205: PostgREST "Could not find the table … in the schema cache" —
  // what Supabase returns for a table that has not been created (or whose
  // schema cache has not reloaded since CREATE TABLE).
  if (error?.code === "PGRST205") return true;
  // 42P01: SQL-level "relation does not exist" (if it reaches us directly).
  return (
    error?.code === "42P01" ||
    /relation .* does not exist/i.test(error?.message ?? "")
  );
}

/**
 * All notification ids this subscriber has read (newest first, capped).
 * Returns READS_UNSUPPORTED instead of throwing when read-state is
 * unavailable — the caller then uses device-local fallback mode.
 */
export async function getReadIds(
  subscriberId: string
): Promise<string[] | ReadsUnsupported> {
  const { data, error } = await supabase
    .from("notification_reads")
    .select("notification_id")
    .eq("subscriber_id", subscriberId)
    .order("read_at", { ascending: false })
    .limit(READ_IDS_LIMIT);

  if (error) {
    if (isMissingRelation(error)) return READS_UNSUPPORTED;
    // Includes "permission denied" when the service-role key is missing —
    // degrade rather than break the inbox; the real cause is logged here.
    console.error("[notification-reads] getReadIds failed:", error);
    return READS_UNSUPPORTED;
  }

  return (data ?? []).map(
    (row: { notification_id: string }) => row.notification_id
  );
}

/**
 * Exact unread count for one subscriber using two head-count queries —
 * neither downloads a single row (spec: do not fetch the whole history to
 * compute the badge).
 *
 * unread = (# status="sent" notifications) − (# this subscriber's reads).
 * Exact because markNotificationsRead/markAllRead only ever insert reads for
 * status="sent" rows, and reads cascade-delete with their notification.
 */
export async function countUnread(
  subscriberId: string
): Promise<number | ReadsUnsupported> {
  const [sentRes, readRes] = await Promise.all([
    supabase
      .from("notifications_history")
      .select("id", { count: "exact", head: true })
      .eq("status", "sent"),
    supabase
      .from("notification_reads")
      .select("id", { count: "exact", head: true })
      .eq("subscriber_id", subscriberId),
  ]);

  if (sentRes.error) {
    console.error(
      "[notification-reads] countUnread(history) failed:",
      sentRes.error
    );
    throw sentRes.error;
  }
  if (readRes.error) {
    if (isMissingRelation(readRes.error)) return READS_UNSUPPORTED;
    console.error(
      "[notification-reads] countUnread(reads) failed:",
      readRes.error
    );
    return READS_UNSUPPORTED;
  }

  return Math.max(0, (sentRes.count ?? 0) - (readRes.count ?? 0));
}

/**
 * Insert read rows, ignoring ones that already exist (unique constraint →
 * ON CONFLICT DO NOTHING): re-opening or re-syncing never duplicates rows.
 * Returns the number of NEW rows, or READS_UNSUPPORTED.
 */
async function upsertReadRows(
  subscriberId: string,
  notificationIds: string[]
): Promise<{ marked: number } | ReadsUnsupported> {
  if (notificationIds.length === 0) return { marked: 0 };

  const { data, error } = await supabase
    .from("notification_reads")
    .upsert(
      notificationIds.map((notification_id) => ({
        notification_id,
        subscriber_id: subscriberId,
      })),
      { onConflict: "notification_id,subscriber_id", ignoreDuplicates: true }
    )
    .select("notification_id");

  if (error) {
    if (isMissingRelation(error)) return READS_UNSUPPORTED;
    console.error("[notification-reads] upsert failed:", error);
    throw error;
  }

  return { marked: data?.length ?? 0 };
}

/**
 * Mark the given notifications read for ONE subscriber.
 *
 * Invalid ids are dropped; only rows that exist with status="sent" are
 * written (failed notifications stay un-markable); duplicates collapse via
 * the unique constraint. Attribute-scoped: it can only ever insert rows for
 * the subscriberId passed in — never touches anyone else's read-state.
 */
export async function markNotificationsRead(
  subscriberId: string,
  notificationIds: string[]
): Promise<{ marked: number } | ReadsUnsupported> {
  const ids = [
    ...new Set(notificationIds.filter(isValidNotificationId)),
  ].slice(0, MARK_BATCH_LIMIT);
  if (ids.length === 0) return { marked: 0 };

  const { data: allowed, error } = await supabase
    .from("notifications_history")
    .select("id")
    .in("id", ids)
    .eq("status", "sent");

  if (error) {
    console.error("[notification-reads] allowed-ids lookup failed:", error);
    throw error;
  }

  return upsertReadRows(
    subscriberId,
    (allowed ?? []).map((row: { id: string }) => row.id)
  );
}

/**
 * Mark EVERY user-facing (status="sent") notification read for ONE
 * subscriber — the "mark all as read" action. Other subscribers' read-state
 * is untouched because every inserted row carries this subscriberId.
 *
 * Capped at MARK_ALL_LIMIT: beyond that scale this should become a SQL RPC
 * (INSERT … SELECT); far larger than this meeting site will ever reach.
 */
export async function markAllRead(
  subscriberId: string
): Promise<{ marked: number } | ReadsUnsupported> {
  const { data, error } = await supabase
    .from("notifications_history")
    .select("id")
    .eq("status", "sent")
    .limit(MARK_ALL_LIMIT);

  if (error) {
    console.error("[notification-reads] markAll lookup failed:", error);
    throw error;
  }

  return upsertReadRows(
    subscriberId,
    (data ?? []).map((row: { id: string }) => row.id)
  );
}
