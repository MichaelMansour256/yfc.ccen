"use client";

import Script from "next/script";

declare global {
  interface Window {
    OneSignalDeferred?: Array<(OneSignal: any) => void | Promise<void>>;
    __oneSignalInitialized?: boolean;
    __oneSignalPromptPush?: () => Promise<"blocked" | "prompted" | "failed">;
  }
}

/**
 * Loads the OneSignal Web SDK (v16) and initializes it exactly once.
 * Rendered from the locale layout. Uses next/script so the SDK file is
 * guaranteed loaded before init runs (the old inline <head> snippet could
 * race the deferred SDK and silently never initialize).
 *
 * Persistence strategy (why subs were dying):
 * - NO auto slidedown prompt. Auto-prompting trains users to tap Block and
 *   burns the one native prompt. Instead the user taps an explicit bell
 *   (PushBell component) which calls window.__oneSignalPromptPush().
 * - On every visit, if browser permission is already "granted" but OneSignal
 *   has no subscription id (e.g. token invalidated by our SW migration),
 *   we silently opt back in — no prompt needed, permission already granted.
 */
export default function OneSignalInit() {
  const appId = process.env.NEXT_PUBLIC_ONESIGNAL_APP_ID;

  if (!appId) {
    if (process.env.NODE_ENV === "development") {
      console.warn("[OneSignal] NEXT_PUBLIC_ONESIGNAL_APP_ID is missing — push init skipped.");
    }
    return null;
  }

  return (
    <Script
      src="https://cdn.onesignal.com/sdks/web/v16/OneSignalSDK.page.js"
      strategy="lazyOnload"
      onLoad={() => {
        window.OneSignalDeferred = window.OneSignalDeferred || [];
        window.OneSignalDeferred.push(async function (OneSignal) {
          // Guard against double-init when navigating between /ar and /en
          // (each locale layout mounts this component).
          if (window.__oneSignalInitialized) return;
          window.__oneSignalInitialized = true;
          try {
            await OneSignal.init({
              appId,
              notifyButton: { enable: false },
              // Must match the v16 stub files in /public (root scope).
              serviceWorkerPath: "/OneSignalSDKWorker.js",
              serviceWorkerUpdaterPath: "/OneSignalSDKUpdaterWorker.js",
              allowLocalhost: process.env.NODE_ENV !== "production",
              autoResubscribe: true,
              // Deliberately NO auto slidedown: the bell handles opt-in.
              // Auto-prompting dismissed users pushes them toward Block,
              // which is permanent until they dig through browser settings.
            });
            console.log("OneSignal initialized successfully");

            // Silent repair: permission granted but no subscription?
            // (happens after SW replacement / token expiry). optIn() without
            // a prompt reuses the granted permission and mints a fresh token.
            try {
              const permission =
                typeof Notification !== "undefined" ? Notification.permission : "default";
              const sub = OneSignal.User?.PushSubscription;
              if (permission === "granted" && sub && !sub.id) {
                await sub.optIn();
                console.log("OneSignal subscription silently repaired");
              }
            } catch (repairErr) {
              console.warn("OneSignal repair skipped:", repairErr);
            }

            // Manual prompt entry-point for the PushBell component.
            window.__oneSignalPromptPush = async () => {
              try {
                if (typeof Notification !== "undefined" && Notification.permission === "denied") {
                  return "blocked" as const;
                }
                await OneSignal.Slidedown.promptPush({ force: true });
                return "prompted" as const;
              } catch {
                return "failed" as const;
              }
            };
          } catch (error) {
            window.__oneSignalInitialized = false;
            console.error("OneSignal initialization error:", error);
          }
        });
      }}
    />
  );
}

