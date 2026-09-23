import { NextResponse } from "next/server";
import { isAuthorized } from "@/lib/auth";
import { sendNotification } from "@/lib/onesignal";
import { putNotificationRecord } from "@/lib/notifications-history";
import { routing } from "@/i18n/routing";

/**
 * Immediate admin push — same sender the crons use.
 * Auth: x-admin-password header (same as all other /api/admin/* routes).
 * Body: { headingAr, headingEn, messageAr, messageEn, url?, image? }
 *
 * Response on success:
 *   { success: true, message: "Notification sent successfully", notificationId: string }
 * Response when no subscribers:
 *   { success: false, message: "No subscribed devices are currently available." }
 * Response on other errors:
 *   { success: false, error: "...", details?: "..." }
 */
export async function POST(req: Request) {
  if (!isAuthorized(req)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  let parsedBody: {
    headingAr?: string;
    headingEn?: string;
    messageAr?: string;
    messageEn?: string;
    url?: string;
    image?: string;
  } = {};

  try {
    parsedBody = await req.json();
    const { headingAr, headingEn, messageAr, messageEn, url, image } = parsedBody;

    if (!headingAr || !headingEn || !messageAr || !messageEn) {
      return NextResponse.json(
        {
          error:
            "Missing required fields. Need: headingAr, headingEn, messageAr, messageEn (optional: url, image)",
        },
        { status: 400 }
      );
    }

    const sentAt = new Date().toISOString();
    const notifyId = crypto.randomUUID();
    const urlValue = url || `/${routing.defaultLocale}`;
    const imageValue = image || null;

    const result = await sendNotification({
      headingAr,
      headingEn,
      messageAr,
      messageEn,
      ...(url ? { url } : {}),
      ...(image ? { image } : {}),
    });

    // Save to notification history
    await putNotificationRecord({
      id: notifyId,
      sentAt,
      headingAr,
      headingEn,
      messageAr,
      messageEn,
      url: urlValue,
      image: imageValue,
      onesignalId: result.id || null,
      status: "sent",
      recipients: null, // OneSignal create response doesn't include count
    });

    return NextResponse.json({
      success: true,
      message: "Notification sent successfully",
      notificationId: notifyId,
    });
  } catch (error) {
    // Properly stringify the error regardless of type
    const errorMessage = error instanceof Error ? error.message : String(error);
    const errorDetail = error instanceof Error ? error.stack : undefined;

    if (errorMessage.includes("No subscribed devices are currently available")) {
      // Still save a record of the failed attempt
      const sentAt = new Date().toISOString();
      const notifyId = crypto.randomUUID();
      try {
        await putNotificationRecord({
          id: notifyId,
          sentAt,
          headingAr: parsedBody.headingAr ?? "",
          headingEn: parsedBody.headingEn ?? "",
          messageAr: parsedBody.messageAr ?? "",
          messageEn: parsedBody.messageEn ?? "",
          url: parsedBody.url ?? `/${routing.defaultLocale}`,
          image: parsedBody.image ?? null,
          onesignalId: null,
          status: "failed_no_subscribers",
          recipients: null,
        });
      } catch {
        /* Don't let history save failure mask the real error */
      }

      console.warn("OneSignal send: no subscribers:", errorMessage);
      return NextResponse.json(
        {
          success: false,
          message:
            "No subscribed devices are currently available. " +
            "Users may have unsubscribed, blocked push, or not yet subscribed.",
        },
        { status: 200 }
      );
    }

    console.error("OneSignal send failed:", errorMessage, errorDetail);
    return NextResponse.json(
      {
        success: false,
        error: "Failed to send notification",
        details: errorMessage,
      },
      { status: 500 }
    );
  }
}

