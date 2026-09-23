import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";

/**
 * GET /api/admin/notify-status — diagnostic for the Notify tab.
 * Returns:
 *  - appIdConfigured: whether ONESIGNAL_APP_ID / NEXT_PUBLIC_ONESIGNAL_APP_ID exist
 *  - appIdsMatch: the two must be IDENTICAL or browser subs land in another app
 *  - subscribedCount / totalCount from OneSignal (via limit=1 + total_count)
 * Auth: x-admin-password header, like every other /api/admin/* route.
 */
export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const serverAppId = process.env.ONESIGNAL_APP_ID ?? "";
  const clientAppId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID ?? "";
  const apiKey = process.env.ONESIGNAL_API_KEY ?? "";

  if (!serverAppId || !apiKey) {
    return NextResponse.json(
      {
        appIdConfigured: false,
        error: "Missing ONESIGNAL_APP_ID / ONESIGNAL_API_KEY env vars on the server",
      },
      { status: 500 }
    );
  }

  try {
    const headers = { Authorization: `Basic ${apiKey}` };

    // 1) Legacy /players list (stale for v16, but shows raw values).
    const playersRes = await fetch(
      `https://api.onesignal.com/players?app_id=${serverAppId}&limit=300&offset=0`,
      { headers }
    );
    const playersData = await playersRes.json();
    if (!playersRes.ok) {
      return NextResponse.json(
        { appIdConfigured: true, error: `OneSignal players API: ${JSON.stringify(playersData)}` },
        { status: 500 }
      );
    }

    const players: Array<{
      id?: string;
      notification_types?: number;
      invalid_identifier?: boolean;
      device_type?: number;
      last_active?: number;
    }> = Array.isArray(playersData.players) ? playersData.players : [];

    const optedIn = players.filter((p) => p.notification_types === 1);
    const validToken = players.filter((p) => p.invalid_identifier !== true);

    // 2) Modern Subscriptions API — the real v16 source of truth.
    // GET /apps/{app_id}/subscriptions?limit=.. (org API key style auth varies;
    // try legacy Basic first, fall back to reporting players-only on failure).
    let subsSummary: unknown = null;
    try {
      const subsRes = await fetch(
        `https://api.onesignal.com/apps/${serverAppId}/subscriptions?limit=50`,
        { headers }
      );
      const subsData = await subsRes.json();
      if (subsRes.ok && Array.isArray((subsData as { subscriptions?: unknown }).subscriptions)) {
        const subs = (subsData as { subscriptions: Array<{ status?: string; type?: string }> }).subscriptions;
        const counts: Record<string, number> = {};
        for (const s of subs) {
          const k = `${s.type ?? "?"}:${s.status ?? "?"}`;
          counts[k] = (counts[k] ?? 0) + 1;
        }
        subsSummary = { sampleSize: subs.length, counts };
      } else {
        subsSummary = { error: JSON.stringify(subsData).slice(0, 300) };
      }
    } catch (e) {
      subsSummary = { error: String(e).slice(0, 300) };
    }

    // Raw sample for debugging (ids truncated, no tokens).
    const sample = players.slice(0, 10).map((p) => ({
      idPrefix: (p.id ?? "?").slice(0, 8),
      notification_types: p.notification_types,
      invalid_identifier: p.invalid_identifier,
      device_type: p.device_type,
      last_active: p.last_active,
    }));

    return NextResponse.json({
      appIdConfigured: true,
      appIdsMatch: clientAppId !== "" && clientAppId === serverAppId,
      // Never leak the full IDs — just prefixes for visual comparison.
      serverAppIdPrefix: serverAppId.slice(0, 8),
      clientAppIdPrefix: clientAppId ? clientAppId.slice(0, 8) : "(missing)",
      totalCount: playersData.total_count ?? players.length,
      legacyOptedIn: optedIn.length,
      validTokens: validToken.length,
      subsSummary,
      note: "Send uses `session_count exists` filter — legacy 'opted-in: 0' can be misleading for v16 web. Hit Send Now to test real targeting.",
      sample,
    });
  } catch (error) {
    return NextResponse.json(
      { appIdConfigured: true, error: String(error) },
      { status: 500 }
    );
  }
}
