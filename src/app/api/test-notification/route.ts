import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/onesignal";
import { putNotificationRecord } from "@/lib/notifications-history";
import { routing } from "@/i18n/routing";

export async function POST(req: Request) {
  // Authenticate the request - you can remove this for simple testing
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    const body = await req.json();
    const { headingAr, headingEn, messageAr, messageEn, url = `/${routing.defaultLocale}` } = body;

    if (!headingAr || !headingEn || !messageAr || !messageEn) {
      return NextResponse.json(
        {
          error: "Missing required fields. Need: headingAr, headingEn, messageAr, messageEn, and optional url",
          example: {
            headingAr: "اختبار إشعار",
            headingEn: "Test Notification",
            messageAr: "هذه رسالة اختبار",
            messageEn: "This is a test message",
            url: "/events",
          },
        },
        { status: 400 }
      );
    }

    const result = await sendNotification({
      headingAr,
      headingEn,
      messageAr,
      messageEn,
      url,
    });

    // Record the send in notifications_history — invariant: every send writes
    // exactly one history row (Admin History tab + user inbox read the same
    // table; the /api/admin/notify route and both crons already do this).
    // A history failure must never mask a successful push — log and go.
    try {
      await putNotificationRecord({
        id: crypto.randomUUID(),
        sentAt: new Date().toISOString(),
        headingAr,
        headingEn,
        messageAr,
        messageEn,
        url,
        image: null,
        onesignalId: result.id || null,
        status: "sent",
        recipients: null,
      });
    } catch (historyErr) {
      console.warn("[test-notification] history save failed:", historyErr);
    }

    return NextResponse.json({ success: true, result });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to send notification", details: String(error) },
      { status: 500 }
    );
  }
}