/**
 * Resolves the device's OneSignal Push Subscription id — the stable anonymous
 * identity used as `notification_reads.subscriber_id` (the Notification Inbox's
 * per-user read-state key). Client-only.
 *
 * Follows the same v16 pattern as PushBell.tsx: `window.OneSignal` is never
 * defined — the SDK object is only reachable through
 * `window.OneSignalDeferred.push(cb)`, and the callback never fires if the SDK
 * fails to load (ad-block, offline), so every probe is bounded by a timeout.
 *
 * Resolution is memoized for the session and persisted in localStorage
 * (same per-visitor pattern as the prayer wall's prayedIds):
 *   • stored id  → instant first render, revalidated in the background;
 *   • stored ""  → known non-subscriber → instant local-mode, still revalidated;
 *   • nothing    → caller awaits the (bounded) first probe.
 * When a probe times out but a stored id exists, the stored id wins — an
 * unreachable SDK must not wipe a valid identity.
 */

const STORAGE_KEY = "e3dady_onesignal_sub_v1";
const DEFAULT_TIMEOUT_MS = 2500;

/** In-flight probe shared by concurrent callers (badge + page on mount). */
let inflight: Promise<string | null> | null = null;
/** Session memo: undefined = not resolved yet. */
let resolved: string | null | undefined;

function readStored(): string | null | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (raw === null) return undefined;
    return raw || null; // "" was stored as "resolved: no subscription"
  } catch {
    return undefined;
  }
}

function writeStored(id: string | null): void {
  try {
    window.localStorage.setItem(STORAGE_KEY, id ?? "");
  } catch {
    /* private browsing — session memo still covers this visit */
  }
}

/**
 * Last known subscriber id without waiting on OneSignal.
 * `undefined` = never resolved this session (caller should await
 * `resolveSubscriberId()`), `null` = resolved with no push subscription.
 */
export function peekSubscriberId(): string | null | undefined {
  if (resolved !== undefined) return resolved;
  resolved = readStored();
  return resolved;
}

/**
 * Probe OneSignal for the current Push Subscription id (bounded by
 * `timeoutMs`; null when push is not enabled or the SDK never loads).
 *
 * `force: true` bypasses the memo/in-flight probe — used for background
 * revalidation after the cached value was used for an immediate render.
 */
export function resolveSubscriberId(opts?: {
  timeoutMs?: number;
  force?: boolean;
}): Promise<string | null> {
  if (typeof window === "undefined") return Promise.resolve(null);
  if (inflight && !opts?.force) return inflight;
  if (resolved !== undefined && !opts?.force) return Promise.resolve(resolved);

  const timeoutMs = opts?.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const probe = new Promise<string | null>((resolve) => {
    const timer = setTimeout(() => resolve(null), timeoutMs);
    window.OneSignalDeferred = window.OneSignalDeferred || [];
    window.OneSignalDeferred.push(async function (OneSignal) {
      clearTimeout(timer);
      try {
        resolve(OneSignal?.User?.PushSubscription?.id ?? null);
      } catch {
        resolve(null);
      }
    });
  }).then((fresh) => {
    // Probe failed (null) but we know a stored id → keep it; a fresh id
    // always wins (re-subscribe / token rotation).
    const id = fresh ?? readStored() ?? null;
    resolved = id;
    writeStored(id);
    if (inflight === probe) inflight = null;
    return id;
  });

  inflight = probe;
  return probe;
}
