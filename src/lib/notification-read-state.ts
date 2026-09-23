/**
 * Notification read-state for the user inbox — two cooperating layers:
 *
 * 1. SERVER (preferred): `notification_reads` rows keyed by the device's
 *    OneSignal Push Subscription id — the only stable anonymous identity this
 *    app has (E3dady has no end-user accounts; src/lib/auth.ts only knows the
 *    admin password). Writes go through POST /api/notifications/read, which
 *    uses the service-role Supabase client; RLS on notification_reads has no
 *    policies, so the browser can never touch the table directly and no
 *    subscriber can read or modify another subscriber's rows.
 *
 * 2. DEVICE-LOCAL fallback (localStorage): used when the visitor has no push
 *    subscription yet, when the OneSignal SDK is unavailable, or until
 *    supabase-notification-reads.sql is applied (the API then reports
 *    readsSupported:false and everything keeps working locally). Same pattern
 *    the prayer wall already uses for per-visitor state (prayedIds).
 *
 * Server mode also unions this device's local reads, so state accumulated in
 * fallback mode is never lost; syncLocalReadsRemote() pushes those reads up.
 * If a real identity system is ever added, swap the id resolution in
 * src/lib/onesignal-subscriber.ts — this module stays the single API.
 */

const STORAGE_KEY = "e3dady_notification_reads_v1";

/** Cap the stored ID list so localStorage can never grow without bound. */
const MAX_STORED_IDS = 500;

/** Fired on `window` whenever read-state changes in this tab (see subscribe). */
export const NOTIFICATION_READS_CHANGED = "e3dady:notification-reads-changed";

/** All notification IDs this device has marked as read. */
export function getReadNotificationIds(): string[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed)
      ? parsed.filter((id): id is string => typeof id === "string")
      : [];
  } catch {
    return [];
  }
}

/** Persist + broadcast. Keeps insertion order; trims from the front (oldest). */
function saveReadIds(ids: string[]): void {
  window.localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(ids.slice(-MAX_STORED_IDS))
  );
  window.dispatchEvent(new CustomEvent(NOTIFICATION_READS_CHANGED));
}

/** Mark one notification read for this device. Idempotent (unique per id). */
export function markNotificationRead(id: string): void {
  if (typeof window === "undefined" || !id) return;
  const ids = getReadNotificationIds();
  if (ids.includes(id)) return; // already read — no duplicate records, no event
  ids.push(id);
  saveReadIds(ids);
}

/** Mark every given notification read for this device only. */
export function markAllNotificationsRead(ids: string[]): void {
  if (typeof window === "undefined" || ids.length === 0) return;
  const existing = new Set(getReadNotificationIds());
  for (const id of ids) existing.add(id);
  saveReadIds([...existing]);
}

/**
 * Subscribe to read-state changes: same-tab updates (custom event) and
 * cross-tab updates (the `storage` event). Returns an unsubscribe function.
 */
export function subscribeToReadChanges(cb: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (e: StorageEvent) => {
    if (e.key === STORAGE_KEY) cb();
  };
  window.addEventListener(NOTIFICATION_READS_CHANGED, cb);
  window.addEventListener("storage", onStorage);
  return () => {
    window.removeEventListener(NOTIFICATION_READS_CHANGED, cb);
    window.removeEventListener("storage", onStorage);
  };
}

/* ══════════════════════════════════════════════════════════════════════════
 * Server-backed read-state (notification_reads via /api/notifications/read).
 * Every server helper ALSO writes the device-local copy first, so the UI
 * updates instantly and keeps working if the server call fails or the
 * migration is not applied yet. Success dispatches NOTIFICATION_READS_CHANGED
 * so the inbox page and the More-page badge recompute (even when the local
 * copy was already up to date and produced no event of its own).
 * ═════════════════════════════════════════════════════════════════════════ */

export type ServerMarkResult = {
  ok: boolean;
  /** false = supabase-notification-reads.sql not applied yet. */
  readsSupported?: boolean;
};

function dispatchReadsChanged(): void {
  window.dispatchEvent(new CustomEvent(NOTIFICATION_READS_CHANGED));
}

async function postRead(payload: Record<string, unknown>): Promise<ServerMarkResult> {
  try {
    const res = await fetch("/api/notifications/read", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(payload),
    });
    if (!res.ok) return { ok: false };
    const data = (await res.json()) as { ok?: boolean; readsSupported?: boolean };
    const ok = data.ok === true;
    if (ok) dispatchReadsChanged();
    return { ok, readsSupported: data.readsSupported !== false };
  } catch {
    // Network failure — device-local copy (written by the caller/helper)
    // already covers this device; never block the user on read-state.
    return { ok: false };
  }
}

/**
 * Mark ONE notification read for this subscriber: device-local first, then
 * the server row (idempotent — the unique constraint collapses repeats).
 * Callers in server mode await this BEFORE navigating (spec §5).
 */
export async function markNotificationReadRemote(
  subscriberId: string,
  notificationId: string
): Promise<ServerMarkResult> {
  markNotificationRead(notificationId);
  return postRead({ subscriber: subscriberId, notificationId });
}

/**
 * Mark ALL sent notifications read for this subscriber only (server-side it
 * covers notifications beyond the loaded page; other subscribers are
 * untouched because every row carries this subscriberId).
 */
export async function markAllNotificationsReadRemote(
  subscriberId: string
): Promise<ServerMarkResult> {
  return postRead({ subscriber: subscriberId, all: true });
}

/**
 * Push device-local reads up to the server (idempotent, batched). Used once
 * per inbox load so reads accumulated in fallback mode survive across
 * devices after the migration. Invalid/failed ids are filtered server-side.
 */
export async function syncLocalReadsRemote(
  subscriberId: string,
  ids?: string[]
): Promise<boolean> {
  const list = (ids ?? getReadNotificationIds()).slice(-MAX_STORED_IDS);
  if (list.length === 0) return true;
  const BATCH = 100;
  for (let i = 0; i < list.length; i += BATCH) {
    const result = await postRead({
      subscriber: subscriberId,
      notificationIds: list.slice(i, i + BATCH),
    });
    if (!result.ok) return false;
  }
  return true;
}