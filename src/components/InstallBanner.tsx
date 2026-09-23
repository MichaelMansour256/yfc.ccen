"use client";

import Image from "next/image";
import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { siteConfig } from "@/config";

/**
 * PWA install banner (fixed above the bottom nav, RTL-native).
 *
 * Flow (matches the browser's custom-install UX):
 * 1. `beforeinstallprompt` is captured at module scope (before hydration, so a
 *    prompt firing on a slow device is never missed), `preventDefault()`-ed to
 *    suppress Chrome's default mini-infobar, and stored in `deferredPrompt`.
 * 2. The banner slides up only when: a prompt event exists, the site is NOT
 *    already running as an installed app (standalone display modes + iOS
 *    `navigator.standalone`), and the user's last dismissal is older than
 *    `RESHOW_AFTER_DAYS` days.
 * 3. "تثبيت" triggers the saved prompt; the banner hides on the user's answer
 *    and on `appinstalled`. The captured event is single-use and is dropped
 *    after handling.
 * 4. Browsers without `beforeinstallprompt` (Firefox, Safari/iOS) never render
 *    the banner — no broken install button, no empty UI, no console errors.
 *    (iOS "Add to Home Screen" has no in-page fallback by design: the project
 *    has no existing tutorial UX and the spec asks not to invent one.)
 *
 * Dismissal is a snooze, not a ban: the epoch-ms of the last dismissal is
 * stored in localStorage and the banner may re-appear after RESHOW_AFTER_DAYS.
 */

/** The non-standard event Chromium fires when the site becomes installable. */
interface BeforeInstallPromptEvent extends Event {
  /** Shows the native install dialog (single-use per captured event). */
  prompt(): Promise<void>;
  /** Resolves once the user answers the native dialog. */
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

/**
 * Snooze window after "لاحقًا" (or after refusing the native dialog).
 * The single constant to tune — change this to resurface the banner sooner
 * or later. A dismissal is never permanent.
 */
const RESHOW_AFTER_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

/** localStorage key holding the epoch-ms of the last dismissal. */
const DISMISSED_KEY = "e3dady-install-dismissed";

/** Keep in sync with `.install-banner-exit` duration in `globals.css`. */
const EXIT_ANIMATION_MS = 250;

type Phase = "hidden" | "visible" | "closing";

/* ------------------------------------------------------------------ */
/* Module-scope capture — runs when the client chunk is evaluated,     */
/* i.e. before React hydration attaches any effect. Chromium fires     */
/* beforeinstallprompt at most once per document, so an early event    */
/* must not be lost while the component tree boots.                    */
/* ------------------------------------------------------------------ */
let deferredPrompt: BeforeInstallPromptEvent | null = null;
const promptListeners = new Set<() => void>();

if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (event) => {
    // Prevent the browser's default mini-infobar — we prompt ourselves.
    event.preventDefault();
    deferredPrompt = event as BeforeInstallPromptEvent;
    promptListeners.forEach((notify) => notify());
  });
}

/** True when the site is already running as an installed app. */
function isStandalone(): boolean {
  if (typeof window === "undefined") return false;
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    window.matchMedia("(display-mode: minimal-ui)").matches ||
    window.matchMedia("(display-mode: fullscreen)").matches ||
    // iOS Safari home-screen launches (WebKit-only flag).
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

/** True while the snooze from a previous dismissal is still active. */
function isRecentlyDismissed(): boolean {
  try {
    const raw = window.localStorage.getItem(DISMISSED_KEY);
    const dismissedAt = raw ? Number(raw) : NaN;
    return Number.isFinite(dismissedAt) && Date.now() - dismissedAt < RESHOW_AFTER_DAYS * DAY_MS;
  } catch {
    // localStorage can throw (private mode / blocked storage) — fail open.
    return false;
  }
}

export default function InstallBanner() {
  const t = useTranslations("install");
  const [phase, setPhase] = useState<Phase>("hidden");
  const [prompt, setPrompt] = useState<BeforeInstallPromptEvent | null>(null);
  const [busy, setBusy] = useState(false);
  const phaseRef = useRef<Phase>("hidden");
  const exitTimer = useRef<number | null>(null);

  useEffect(() => {
    phaseRef.current = phase;
  }, [phase]);

  /** Hide with the exit animation; optionally snooze future appearances. */
  const close = useCallback((snooze: boolean) => {
    if (phaseRef.current === "hidden") return;
    phaseRef.current = "closing";
    if (snooze) {
      try {
        window.localStorage.setItem(DISMISSED_KEY, String(Date.now()));
      } catch {
        // Storage unavailable — hiding the banner still works.
      }
    }
    setPhase("closing");
    if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    exitTimer.current = window.setTimeout(() => {
      phaseRef.current = "hidden";
      setPhase("hidden");
    }, EXIT_ANIMATION_MS);
  }, []);

  /**
   * Subscribe to prompt events. The callback holds the whole "should the
   * banner show?" decision, so every path into it is event-driven (a browser
   * event, or a macrotask after mount) — never a synchronous setState inside
   * the effect body (react-hooks/set-state-in-effect). The first client
   * render also always matches SSR HTML — no flash before the decision.
   */
  useEffect(() => {
    const evaluate = () => {
      const event = deferredPrompt;
      if (!event) return;
      setPrompt(event);
      if (phaseRef.current !== "hidden") return;
      if (isStandalone() || isRecentlyDismissed()) return;
      setPhase("visible");
    };
    promptListeners.add(evaluate);
    // Boot check: a prompt captured before hydration must not be missed.
    // Deferred to a macrotask so the effect stays side-effect-free.
    const boot = window.setTimeout(evaluate, 0);
    return () => {
      promptListeners.delete(evaluate);
      window.clearTimeout(boot);
      if (exitTimer.current !== null) window.clearTimeout(exitTimer.current);
    };
  }, []);

  // Installed successfully (or the tab turned standalone): hide + drop prompt.
  useEffect(() => {
    const onInstalled = () => {
      deferredPrompt = null;
      setPrompt(null);
      close(false);
    };
    window.addEventListener("appinstalled", onInstalled);
    const standaloneMq = window.matchMedia("(display-mode: standalone)");
    const onModeChange = (event: MediaQueryListEvent) => {
      if (event.matches) onInstalled();
    };
    standaloneMq.addEventListener?.("change", onModeChange);
    return () => {
      window.removeEventListener("appinstalled", onInstalled);
      standaloneMq.removeEventListener?.("change", onModeChange);
    };
  }, [close]);

  // Escape dismisses the non-modal dialog (no focus trap — non-blocking UI).
  useEffect(() => {
    if (phase !== "visible") return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") close(true);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, close]);

  async function install() {
    if (!prompt || busy) return;
    setBusy(true);
    try {
      await prompt.prompt();
      const { outcome } = await prompt.userChoice;
      // Refusing the native dialog is exactly like "لاحقًا" — snooze it,
      // so the banner doesn't reappear on the very next page load.
      close(outcome === "dismissed");
    } catch {
      // prompt() can reject (already shown, unsupported state…) — hide
      // without snoozing so a later visit can retry the real flow.
      close(false);
    } finally {
      // The captured event is single-use; drop it so it can be GC'd and
      // so no stale prompt can ever be re-triggered.
      deferredPrompt = null;
      setPrompt(null);
      setBusy(false);
    }
  }

  if (phase === "hidden") return null;

  return (
    <div className="pointer-events-none fixed inset-x-3 bottom-[calc(4.5rem_+_env(safe-area-inset-bottom))] z-[60] sm:inset-x-4">
      <div
        id="install-banner"
        role="dialog"
        aria-label={t("dialogLabel")}
        className={`pointer-events-auto relative mx-auto w-full max-w-lg overflow-hidden rounded-2xl border border-blue-accent/30 bg-gradient-to-br from-blue-primary/80 to-blue-dark/95 p-3 shadow-2xl shadow-blue-dark/60 backdrop-blur-md sm:p-4 ${
          phase === "closing" ? "install-banner-exit" : "install-banner-enter"
        }`}
      >
        {/* Decorative accents — same glow language as the home hero */}
        <div aria-hidden="true" className="absolute inset-x-8 top-0 h-px bg-gradient-to-r from-transparent via-blue-accent/70 to-transparent" />
        <div aria-hidden="true" className="absolute -bottom-12 -end-12 h-28 w-28 rounded-full bg-blue-accent/15 blur-2xl" />

        <div className="relative grid grid-cols-[auto_1fr] items-center gap-x-3 gap-y-3 sm:grid-cols-[auto_1fr_auto]">
          {/* App icon (decorative — the dialog carries the accessible name) */}
          <div className="relative shrink-0">
            <div aria-hidden="true" className="absolute inset-0 scale-125 rounded-xl bg-blue-accent/25 blur-md" />
            <Image
              src={siteConfig.assets.appIcon}
              alt=""
              width={96}
              height={96}
              className="relative h-11 w-11 rounded-xl object-cover ring-2 ring-blue-accent/50"
            />
          </div>

          {/* Copy */}
          <div className="min-w-0">
            <p className="text-sm font-bold text-white">{t("title")}</p>
            <p className="mt-0.5 text-xs leading-relaxed text-blue-light/80 sm:line-clamp-2">{t("description")}</p>
          </div>

          {/* Actions — full-width comfortable targets on mobile, inline on sm+.
              DOM order [لاحقًا, تثبيت] mirrors the native RTL install dialog. */}
          <div className="col-span-2 flex gap-2 sm:col-span-1 sm:flex-row">
            <button
              type="button"
              onClick={() => close(true)}
              aria-label={t("laterAria")}
              disabled={busy}
              className="h-10 flex-1 rounded-xl border border-blue-mid/40 bg-white/5 px-4 text-xs font-semibold text-blue-light transition hover:bg-white/10 hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-light focus-visible:ring-offset-2 focus-visible:ring-offset-blue-dark active:scale-95 disabled:opacity-60 sm:flex-none sm:text-sm"
            >
              {t("later")}
            </button>
            <button
              type="button"
              onClick={install}
              aria-label={t("installAria")}
              disabled={busy}
              className="h-10 flex-1 rounded-xl bg-gradient-to-l from-blue-accent to-blue-mid px-5 text-sm font-bold text-white shadow-lg shadow-blue-accent/25 transition hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-light focus-visible:ring-offset-2 focus-visible:ring-offset-blue-dark active:scale-95 disabled:opacity-60 sm:flex-none"
            >
              {t("install")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

