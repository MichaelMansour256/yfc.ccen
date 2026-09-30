import { NextResponse } from "next/server";
import { sendNotification } from "@/lib/onesignal";
import { putNotificationRecord } from "@/lib/notifications-history";
import {
  getInvitations,
  nextFridayCairoISO,
} from "@/lib/invitations";
import { meetingConfig, siteConfig } from "@/config";
import { localizedValue } from "@/lib/localized";
import { routing } from "@/i18n/routing";

export async function GET(req: Request) {
  // Verify this is called by Vercel Cron
  const authHeader = req.headers.get("authorization");
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  try {
    // Smart meeting-eve reminder: look up the actual invitation image
    // uploaded for the next meeting day (Cairo). Falls back to generic text
    // when nothing was uploaded that week — never skips silently.
    const nextFriday = nextFridayCairoISO();
    const invitations = await getInvitations();
    const match = invitations.find((i) => i.date === nextFriday);

    const { schedule } = meetingConfig;
    // OneSignal sends `headings`/`contents` per device language, so both the
    // Arabic and the English text are built here from the same config values.
    const dayNameAr = localizedValue(schedule.dayName, "ar");
    const dayNameEn = localizedValue(schedule.dayName, "en");
    const timeLabelAr = localizedValue(schedule.timeLabel, "ar");
    const timeLabelEn = localizedValue(schedule.timeLabel, "en");
    const churchAr = localizedValue(siteConfig.church.name, "ar");
    const churchEn = localizedValue(siteConfig.church.name, "en");

    const headingAr = `دعوة اجتماع ${dayNameAr} ✝️`;
    const headingEn = `${dayNameEn} Meeting Invitation ✝️`;
    const messageAr = match
      ? `دعوة اجتماع ${dayNameAr} ${match.date} — الساعة ${timeLabelAr} — ${churchAr} 🙏`
      : `اجتماع ${dayNameAr} غداً — الساعة ${timeLabelAr} — ${churchAr} 🙏`;
    const messageEn = match
      ? `${dayNameEn} meeting invitation ${match.date} — ${timeLabelEn} — ${churchEn} 🙏`
      : `${dayNameEn} meeting is tomorrow at ${timeLabelEn} — ${churchEn} 🙏`;
    const url = `/${routing.defaultLocale}/events`;

    const result = await sendNotification({
      headingAr,
      headingEn,
      messageAr,
      messageEn,
      url,
      image: match?.url,
    });

    // Record the send in notifications_history — the same single table the
    // Admin History tab and the user notification inbox read (the admin
    // /api/admin/notify route already writes here; cron sends previously did
    // not, which left the History tab and Inbox without the recurring pushes).
    // A history failure must never mask a successful push — log and continue.
    try {
      await putNotificationRecord({
        id: crypto.randomUUID(),
        sentAt: new Date().toISOString(),
        headingAr,
        headingEn,
        messageAr,
        messageEn,
        url,
        image: match?.url ?? null,
        onesignalId: result.id || null,
        status: "sent",
        recipients: null,
      });
    } catch (historyErr) {
      console.warn("[cron:meeting-reminder] history save failed:", historyErr);
    }

    return NextResponse.json({
      success: true,
      nextFriday,
      usedImage: Boolean(match),
      result,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
