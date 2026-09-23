/**
 * Camera QR scanner for /admin/attendance/scan.
 *
 * • Uses the native BarcodeDetector API where it exists (Android Chrome) and
 *   falls back to jsQR + a canvas so iPhone Safari works too.
 * • Camera permission is requested only after the servant taps "تشغيل الكاميرا".
 * • `onToken` receives a validated token; the page decides what to do with it
 *   (record attendance). This component never talks to the API itself.
 * • When the camera is unavailable or denied, the page's manual-entry field keeps
 *   the flow usable.
 */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { extractCheckinToken } from "@/lib/checkin-token";
import { Banner, primaryBtn, subtleBtn } from "./ui";

type CameraState = "idle" | "starting" | "running" | "denied" | "unavailable" | "error";

interface DetectedBarcode {
  rawValue?: string;
}
interface BarcodeDetectorLike {
  detect(source: CanvasImageSource): Promise<DetectedBarcode[]>;
}
type BarcodeDetectorCtor = new (options?: { formats?: string[] }) => BarcodeDetectorLike;

type JsQrFn = (
  data: Uint8ClampedArray,
  width: number,
  height: number,
  options?: { inversionAttempts?: "dontInvert" | "onlyInvert" | "attemptBoth" | "invertFirst" }
) => { data: string } | null;

/** jsQR is ~250KB: load it only when the camera is actually used. */
let jsQrPromise: Promise<JsQrFn | null> | null = null;

/**
 * Resolve the jsQR function across every interop shape a bundler might hand
 * back. jsqr@1.4.0 is CommonJS ("exports.default = jsQR" with __esModule), so
 * depending on the bundler ANY of these can be the callable decoder:
 *   mod (function) • mod.default (function) • mod.default.default (function)
 * The old code only handled the first two — if the browser bundle handed back
 * the exports object, it called a non-callable object, the frame threw, and
 * the silent catch looked exactly like "camera opens, nothing is detected".
 */
function resolveJsQr(mod: unknown): JsQrFn | null {
  const m = mod as JsQrFn | { default?: JsQrFn | { default?: JsQrFn } } | null | undefined;
  if (typeof m === "function") return m;
  const d = m?.default;
  if (typeof d === "function") return d;
  const dd = (d as { default?: JsQrFn } | undefined)?.default;
  if (typeof dd === "function") return dd;
  return null;
}

function loadJsQr(): Promise<JsQrFn | null> {
  if (!jsQrPromise) {
    console.log("[QR] Loading jsQR...");
    jsQrPromise = import("jsqr")
      .then((mod) => {
        const fn = resolveJsQr(mod);
        if (!fn) {
          // Unrecognised interop shape — surface it, never swallow it.
          console.error(
            "[QR] ERROR: jsQR loaded but no callable decoder was found",
            typeof mod,
            typeof (mod as { default?: unknown })?.default
          );
          return null;
        }
        console.log("[QR] jsQR loaded successfully");
        return fn;
      })
      .catch((err) => {
        console.error("[QR] ERROR: jsQR failed to load", err);
        return null;
      });
  }
  return jsQrPromise;
}

export default function QrScanner({
  onToken,
  cooldownMs = 2500,
  paused = false,
}: {
  onToken: (token: string) => void;
  /** Ignore the same code again for this long (prevents instant re-scans). */
  cooldownMs?: number;
  /** Parent sets this while it is displaying a result. */
  paused?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<number | null>(null);
  const runningRef = useRef(false);
  const lastTokenRef = useRef("");
  const lastTokenAtRef = useRef(0);
  const pausedRef = useRef(paused);

  const [state, setState] = useState<CameraState>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [facing, setFacing] = useState<"environment" | "user">("environment");
  /** Which decoder is active — surfaced in the UI while debugging. */
  const [decoder, setDecoder] = useState<"detecting" | "native" | "jsqr" | "failed">("detecting");
  const loggedDimsRef = useRef(false);
  const lastFrameLogRef = useRef(0);

  useEffect(() => {
    pausedRef.current = paused;
  }, [paused]);

  const stop = useCallback(() => {
    runningRef.current = false;
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    streamRef.current?.getTracks().forEach((track) => track.stop());
    streamRef.current = null;
    if (videoRef.current) videoRef.current.srcObject = null;
    setState("idle");
  }, []);

  const handleValue = useCallback(
    (raw: string) => {
      const token = extractCheckinToken(raw);
      if (!token) {
        // Decode SUCCESS but not a member code (e.g. a "TEST-QR-123" or any
        // other QR). Prove the decoder works and separate that from token
        // validation — never stay silent here.
        const preview = raw.length > 40 ? `${raw.slice(0, 40)}…` : raw;
        setMessage(`✅ تم قراءة رمز QR بنجاح — لكنه ليس رمز عضو: ${preview}`);
        return;
      }
      const now = Date.now();
      if (token === lastTokenRef.current && now - lastTokenAtRef.current < cooldownMs) return;
      lastTokenRef.current = token;
      lastTokenAtRef.current = now;
      try {
        navigator.vibrate?.(60); // short "code captured" feedback where supported
      } catch {
        /* not supported */
      }
      onToken(token);
    },
    [cooldownMs, onToken]
  );

  const start = useCallback(async () => {
    if (runningRef.current) return;
    setMessage(null);
    setState("starting");
    console.log("[QR] Camera started");

    if (!navigator.mediaDevices?.getUserMedia) {
      setState("unavailable");
      setMessage("المتصفح لا يدعم تشغيل الكاميرا. استخدم الإدخال اليدوي بالأسفل.");
      return;
    }

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: { ideal: facing },
          // "ideal" (not required) so unsupported values never break mobile.
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
        audio: false,
      });
    } catch (err) {
      const name = (err as DOMException)?.name;
      if (name === "NotAllowedError" || name === "SecurityError") {
        setState("denied");
        setMessage(
          "تم رفض إذن الكاميرا. افتح إعدادات المتصفح وامنح الإذن، أو استخدم الإدخال اليدوي."
        );
      } else if (name === "NotFoundError" || name === "OverconstrainedError") {
        setState("unavailable");
        setMessage("لا توجد كاميرا متاحة على هذا الجهاز. استخدم الإدخال اليدوي بالأسفل.");
      } else {
        setState("error");
        setMessage("تعذّر تشغيل الكاميرا. جرّب مرة أخرى أو استخدم الإدخال اليدوي.");
      }
      return;
    }

    streamRef.current = stream;
    const video = videoRef.current;
    if (!video) {
      stream.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
      setState("error");
      return;
    }

    video.srcObject = stream;
    video.setAttribute("playsinline", "true");
    try {
      await video.play();
    } catch {
      /* iOS autoplay quirks — the loop below waits for readyState anyway */
    }

    runningRef.current = true;
    setState("running");
    loggedDimsRef.current = false;

    const detectorCtor = (window as unknown as { BarcodeDetector?: BarcodeDetectorCtor })
      .BarcodeDetector;
    console.log(`[QR] BarcodeDetector supported: ${Boolean(detectorCtor)}`);

    if (detectorCtor) {
      console.log("[QR] Using native BarcodeDetector");
      setDecoder("native");
    } else {
      console.log("[QR] Using jsQR fallback");
      setDecoder("jsqr");
    }
    let detector = detectorCtor ? new detectorCtor({ formats: ["qr_code"] }) : null;

    const schedule = (delay: number) => {
      if (!runningRef.current) return;
      timerRef.current = window.setTimeout(tick, delay);
    };

    let nativeFails = 0;

    const tick = async () => {
      const v = videoRef.current;
      if (!runningRef.current || !v) return;

      if (pausedRef.current || v.readyState < 2) {
        schedule(200);
        return;
      }

      if (!loggedDimsRef.current && v.videoWidth > 0) {
        loggedDimsRef.current = true;
        console.log(`[QR] video dimensions: ${v.videoWidth}x${v.videoHeight}`);
      }

      try {
        if (detector) {
          try {
            const codes = await detector.detect(v);
            nativeFails = 0;
            const value = codes?.[0]?.rawValue;
            if (value) {
              console.log("[QR] QR DETECTED (native BarcodeDetector)");
              if (process.env.NODE_ENV !== "production") {
                console.log("[QR] raw payload:", value);
              }
              handleValue(value);
            }
            schedule(250);
            return;
          } catch (err) {
            // A repeatedly-throwing detect() used to be swallowed forever —
            // after 5 failures switch to the jsQR fallback instead.
            nativeFails += 1;
            console.warn(`[QR] BarcodeDetector.detect failed (x${nativeFails})`, err);
            if (nativeFails < 5) {
              schedule(250);
              return;
            }
            console.log("[QR] Switching to the jsQR fallback after repeated failures");
            setDecoder("jsqr");
            detector = null;
            // fall through to the jsQR path below
          }
        }

        const canvas = canvasRef.current;
        const ctx = canvas?.getContext("2d", { willReadFrequently: true });
        if (!canvas || !ctx || !v.videoWidth) {
          schedule(250);
          return;
        }

        // Decode at 640px: enough detail for small codes at arm's length while
        // staying fast on old phones.
        const width = 640;
        const height = Math.round((v.videoHeight / v.videoWidth) * width) || 640;
        canvas.width = width;
        canvas.height = height;
        ctx.drawImage(v, 0, 0, width, height);

        const jsQR = await loadJsQr();
        if (!jsQR) {
          // Never keep looping silently with no decoder at all.
          console.error("[QR] ERROR: no QR decoder available — stopping the scan loop");
          setDecoder("failed");
          setMessage("❌ تعذّر تشغيل قارئ QR — استخدم الإدخال اليدوي بالأسفل أو أعد تحميل الصفحة.");
          return;
        }

        const now = Date.now();
        const shouldFrameLog =
          process.env.NODE_ENV !== "production" && now - lastFrameLogRef.current > 2000;
        if (shouldFrameLog) lastFrameLogRef.current = now;

        if (shouldFrameLog) console.log("[QR] decoding frame...");

        const image = ctx.getImageData(0, 0, width, height);
        const result = jsQR(image.data, width, height, { inversionAttempts: "dontInvert" });
        if (result?.data) {
          console.log("[QR] QR DETECTED (jsQR)");
          if (process.env.NODE_ENV !== "production") {
            console.log("[QR] raw payload:", result.data);
          }
          handleValue(result.data);
        } else if (shouldFrameLog) {
          console.log("[QR] jsQR result: none");
        }
      } catch (err) {
        // A frame failed to decode — keep scanning, but never fully silently.
        console.warn("[QR] frame decode error", err);
      }

      schedule(detector ? 250 : 150);
    };

    schedule(150);
  }, [facing, handleValue]);

  useEffect(() => () => stop(), [stop]);

  const shouldRestartRef = useRef(false);

  const switchCamera = useCallback(() => {
    shouldRestartRef.current = runningRef.current;
    if (runningRef.current) stop();
    setFacing((prev) => (prev === "environment" ? "user" : "environment"));
  }, [stop]);

  // Bring the stream back up on the other camera after a switch.
  useEffect(() => {
    if (!shouldRestartRef.current) return;
    shouldRestartRef.current = false;
    const timer = window.setTimeout(() => void start(), 80);
    return () => window.clearTimeout(timer);
  }, [facing, start]);


  return (
    <div className="space-y-3">
      <div className="relative overflow-hidden rounded-2xl border border-blue-mid/40 bg-black/60">
        <video
          ref={videoRef}
          className="h-[46vh] max-h-96 w-full object-cover"
          muted
          playsInline
          autoPlay
        />

        {state === "running" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center" aria-hidden>
            <div className="h-48 w-48 rounded-2xl border-4 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
          </div>
        )}

        {state !== "running" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-center">
            <div className="text-4xl" aria-hidden>
              📷
            </div>
            <p className="px-6 text-sm text-blue-light/70">
              {state === "starting" ? "جارٍ تشغيل الكاميرا…" : "الكاميرا متوقفة"}
            </p>
          </div>
        )}

        {/* Off-screen canvas used by the jsQR fallback */}
        <canvas ref={canvasRef} className="hidden" />
      </div>

      {state === "running" && (
        <p className="text-center text-xs text-blue-light/50" aria-live="polite">
          📷 الكاميرا تعمل ·{" "}
          {decoder === "failed" ? (
            <>❌ القارئ: تعذّر تشغيله — استخدم الإدخال اليدوي أو أعد تحميل الصفحة</>
          ) : (
            <>
              🔍 القارئ: {decoder === "native" ? "BarcodeDetector" : "jsQR"} ·{" "}
              {paused ? "⏸ متوقف مؤقتًا — أكّد التسجيل أو اضغط إلغاء" : "📡 جارٍ البحث عن رمز…"}
            </>
          )}
        </p>
      )}

      {message && <Banner tone="warning">{message}</Banner>}

      <div className="flex flex-wrap gap-2">
        {state === "running" ? (
          <button type="button" onClick={stop} className={subtleBtn}>
            ⏹️ إيقاف الكاميرا
          </button>
        ) : (
          <button
            type="button"
            onClick={() => void start()}
            disabled={state === "starting"}
            className={primaryBtn}
          >
            {state === "starting" ? "جارٍ التشغيل…" : "▶️ تشغيل الكاميرا"}
          </button>
        )}
        <button type="button" onClick={switchCamera} className={subtleBtn}>
          🔄 {facing === "environment" ? "الكاميرا الأمامية" : "الكاميرا الخلفية"}
        </button>
      </div>
    </div>
  );
}

