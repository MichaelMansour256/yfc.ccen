import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { getNotificationHistory, getNotificationById } from "@/lib/notifications-history";

export async function GET(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Try to get history from Supabase first
  let history = await getNotificationHistory();
  
  if (history.length > 0) {
    return NextResponse.json({
      notifications: history.map((n) => ({
        id: n.id,
        headingEn: n.headingEn ?? "",
        headingAr: n.headingAr ?? "",
        messageEn: n.messageEn ?? "",
        messageAr: n.messageAr ?? "",
        url: n.url ?? "/ar",
        image: n.image ?? null,
        onesignalId: n.onesignalId ?? null,
        status: n.status ?? "sent",
        recipients: n.recipients ?? null,
        createdAt: n.createdAt,
        sentAt: n.sentAt,
      })),
      source: "supabase",
    });
  }

  // Fallback: OneSignal notifications list API.
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    return NextResponse.json({ error: "No notification source available" }, { status: 500 });
  }

  const { searchParams } = new URL(req.url);
  const limit = Math.min(parseInt(searchParams.get("limit") ?? "20", 10) || 20, 100);

  try {
    const listUrl = new URL("https://api.onesignal.com/notifications");
    listUrl.searchParams.set("app_id", appId);
    listUrl.searchParams.set("limit", String(limit));
    listUrl.searchParams.set("sort", "-created_at");

    const res = await fetch(listUrl.toString(), {
      headers: {
        Authorization: `Basic ${apiKey}`,
        "Content-Type": "application/json",
      },
    });

    if (!res.ok) {
      console.error("OneSignal notifications list error:", res.status);
      return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
    }

    const data = await res.json();
    const cleaned = (data.notifications ?? []).map(
      ({
        id,
        headings,
        contents,
        web_url,
        queued_at,
        completed_at,
        successful,
        failed,
        errored,
        canceled,
        sent_at,
      }: {
        id: string;
        headings: { en?: string; ar?: string };
        contents: { en?: string; ar?: string };
        web_url: string | null;
        queued_at: number;
        completed_at: number | null;
        successful: number;
        failed: number;
        errored: number;
        canceled: boolean;
        sent_at?: number;
      }) => ({
        id,
        headingEn: headings?.en ?? "",
        headingAr: headings?.ar ?? "",
        messageEn: contents?.en ?? "",
        messageAr: contents?.ar ?? "",
        url: web_url ?? "",
        image: null,
        onesignalId: id,
        status: canceled ? "canceled" : successful > 0 ? "sent" : "failed_error",
        recipients: successful,
        createdAt: new Date(queued_at).toISOString(),
        sentAt: sent_at ? new Date(sent_at).toISOString() : null,
      })
    );

    return NextResponse.json({
      totalCount: data.total_count ?? 0,
      notifications: cleaned,
      source: "onesignal-api",
    });
  } catch (error) {
    console.error("Error fetching notifications:", error);
    return NextResponse.json({ error: "Failed to fetch notifications" }, { status: 500 });
  }
}
