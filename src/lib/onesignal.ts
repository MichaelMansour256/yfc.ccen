import { siteConfig } from "@/config";
import { routing } from "@/i18n/routing";

export async function sendNotification({
  headingAr,
  headingEn,
  messageAr,
  messageEn,
  url = `/${routing.defaultLocale}`,
  image,
}: {
  headingAr: string;
  headingEn: string;
  messageAr: string;
  messageEn: string;
  url?: string;
  image?: string;
}) {
  const appId = process.env.ONESIGNAL_APP_ID;
  const apiKey = process.env.ONESIGNAL_API_KEY;
  if (!appId || !apiKey) {
    throw new Error(
      `Missing OneSignal env vars. Have: APP_ID=${!!appId}, API_KEY=${!!apiKey}`
    );
  }

  const siteUrl = siteConfig.url;
  const fullUrl = /^https?:\/\//i.test(url) ? url : `${siteUrl}${url}`;

  const body = {
    app_id: appId,
    target_channel: "push",
    // Modern v16 REST API: "Subscribed Users" segment no longer resolves
    // against Web SDK v16 push subscriptions in some accounts (returns
    // "All included players are not subscribed"). Use the filters API
    // instead: session_count exists = every player record OneSignal knows
    // about (all active push subscribers). This is the current supported
    // way to "send to all subscribed users" without stale player IDs.
    filters: [{ field: "session_count", relation: "exists" }],
    headings: { en: headingEn, ar: headingAr },
    contents: { en: messageEn, ar: messageAr },
    // `web_url` is the field the Web SDK service worker uses for click-through.
    // Do NOT send `url` alongside `web_url`; OneSignal rejects: "Remove url
    // field when setting app_url or web_url".
    web_url: fullUrl,
    chrome_web_icon: `${siteUrl}/app-icon.png`,
    chrome_icon: `${siteUrl}/app-icon.png`,
    firefox_icon: `${siteUrl}/app-icon.png`,
    // Large invitation image (Android big picture + Chrome/Firefox large icon).
    // Only included when the caller passes one (Thursday invitation cron).
    ...(image
      ? {
          big_picture: image,
          chrome_big_picture: image,
          ios_attachments: { id: image },
        }
      : {}),
  };

  console.log("OneSignal request:", {
    appId: appId.substring(0, 8) + "...",
    url: fullUrl,
  });

  const res = await fetch("https://api.onesignal.com/notifications", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      // NOTE: keep the `Basic` scheme because your key is the legacy REST API
      // key (dashboard shows "Delivered", so auth already works).
      // If you generate a *new* REST API key, OneSignal docs use `Key <key>`.
      Authorization: `Basic ${apiKey}`,
    },
    body: JSON.stringify(body),
  });

  let data: any;
  try {
    data = await res.json();
  } catch {
    data = { rawResponse: await res.text() };
  }

  console.log("OneSignal response status:", res.status, "body:", JSON.stringify(data).substring(0, 500));

  // OneSignal returns 200 even when the target resolves to 0 recipients.
  // Surface that as a clear "no subscribers" case rather than a generic 500.
  if (!res.ok) {
    // HTTP error (not 200)
    const errors = (data as { errors?: string[] }).errors ?? [];
    if (
      errors.some(
        (e) =>
          e.includes("not subscribed") ||
          e.includes("no subscribers") ||
          e.includes("No players")
      )
    ) {
      throw new Error(
        "No subscribed devices are currently available. " +
          "Users may have unsubscribed, blocked push, or not yet subscribed. " +
          "Have them open the site and accept the notification prompt."
      );
    }
    throw new Error(
      `OneSignal API error (HTTP ${res.status}): ${JSON.stringify(data)}`
    );
  }

  // Check if OneSignal returned errors in the response body (even with 200)
  // This happens when the notification was "created" but couldn't be delivered
  const responseErrors = data?.errors;
  if (Array.isArray(responseErrors) && responseErrors.length > 0) {
    const errors = responseErrors as string[];
    if (
      errors.some(
        (e) =>
          e.includes("not subscribed") ||
          e.includes("no subscribers") ||
          e.includes("No players")
      )
    ) {
      throw new Error(
        "No subscribed devices are currently available. " +
          "Users may have unsubscribed, blocked push, or not yet subscribed. " +
          "Have them open the site and accept the notification prompt."
      );
    }
    // Other errors - still throw but with the actual error message
    throw new Error(`OneSignal notification errors: ${JSON.stringify(errors)}`);
  }

  // Success - notification was created and delivered
  // OneSignal response includes: id, recipients, etc.
  console.log("OneSignal notification sent successfully, id:", data?.id);
  return data;
}

