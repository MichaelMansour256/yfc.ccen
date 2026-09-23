/**
 * Public QR identity card.
 *
 * Rendered by /checkin/[token] — the URL a member's QR code points at. The
 * token IDENTIFIES the member; it never GRANTS permission to record. This
 * runner resolves the token once (read-only POST /api/checkin) and shows the
 * member their name, ID and current status. Recording attendance is
 * staff-only: an authenticated admin/servant confirms it from the scanner
 * screen, and POST /api/attendance/checkin re-validates the credentials
 * server-side before anything is written to Supabase.
 *
 * GET stays safe: prefetching, sharing and refreshing create nothing.
 */
"use client";
import { useCallback, useEffect, useRef, useState } from "react";
import { formatDateAr, formatTimeAr } from "./ui";

interface IdentifyResponse {
  ok: boolean;
  status: "found" | "inactive_member" | "invalid_token" | "error";
  message?: string;
  member?: { name: string; member_code: string } | null;
  meeting?: { id?: string; title: string; meeting_date: string } | null;
  checked_in?: boolean;
  check_in_time?: string | null;
}

type State =
  | { kind: "loading" }
  | { kind: "result"; data: IdentifyResponse }
  | { kind: "network" };

/** Header line (emoji + title) for each outcome. */
const HEADLINES: Record<IdentifyResponse["status"], string> = {
  found: "🪪 بيانات العضو",
  inactive_member: "⚠️ هذا العضو غير نشط",
  invalid_token: "❌ QR Code غير صالح",
  error: "❌ تعذّر الاتصال",
};

const SUBTITLES: Partial<Record<IdentifyResponse["status"], string>> = {
  invalid_token: "الرمز المستخدم غير صالح أو غير مسجل. من فضلك تواصل مع الخادم.",
  inactive_member: "تواصل مع الإدارة إذا كنت تعتقد أن هذه رسالة بالخطأ.",
  error: "تحقّق من اتصالك بالإنترنت وحاول مرة أخرى.",
};

export default function CheckinRunner({ token }: { token: string }) {
  const [state, setState] = useState<State>({ kind: "loading" });
  const submitted = useRef(false);

  const submit = useCallback(async () => {
    setState({ kind: "loading" });
    try {
      const res = await fetch("/api/checkin", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ token }),
        cache: "no-store",
      });
      const data = (await res.json()) as IdentifyResponse;

      // A failed request with no structured body (e.g. 503 without JSON) is
      // treated as a connection problem, never as a raw error dump.
      if (!data || typeof data.status !== "string") {
        setState({ kind: "network" });
        return;
      }
      setState({ kind: "result", data });
    } catch {
      setState({ kind: "network" });
    }
  }, [token]);

  // Fire exactly once per mount. StrictMode remounts in dev are harmless:
  // this is a read-only identification — nothing is ever recorded here.
  useEffect(() => {
    if (submitted.current) return;
    submitted.current = true;
    void submit();
  }, [submit]);

  return (
    <main className="flex min-h-dvh flex-col items-center justify-center px-5 py-8">
      <div className="w-full max-w-sm rounded-3xl border border-blue-mid/40 bg-blue-primary/30 p-7 text-center shadow-xl backdrop-blur-sm">
        {state.kind === "loading" && (
          <>
            <div className="mb-4 text-5xl" aria-hidden>
              ⏳
            </div>
            <h1 className="text-xl font-bold text-white">جارٍ تسجيل الحضور…</h1>
            <p className="mt-2 text-sm text-blue-light/60">لا تغلق الصفحة</p>
          </>
        )}

        {state.kind === "network" && (
          <>
            <div className="mb-4 text-5xl" aria-hidden>
              📶
            </div>
            <h1 className="text-xl font-bold text-white">❌ تعذّر الاتصال</h1>
            <p className="mt-2 text-sm text-blue-light/60">
              تحقّق من اتصالك بالإنترنت وحاول مرة أخرى.
            </p>
            <button
              type="button"
              onClick={() => void submit()}
              className="mt-6 w-full rounded-2xl bg-blue-accent px-4 py-3 font-semibold text-white transition hover:bg-blue-mid"
            >
              إعادة المحاولة
            </button>
          </>
        )}

        {state.kind === "result" && (
          <>
            <h1 className="text-xl font-bold leading-relaxed text-white">
              {HEADLINES[state.data.status] ?? "ℹ️" }
            </h1>

            {state.data.member && (
              <>
                <p className="mt-5 text-2xl font-bold text-white">{state.data.member.name}</p>
                <p className="mt-1 text-xs tracking-widest text-blue-light/50">
                  Attendance ID: {state.data.member.member_code}
                </p>
              </>
            )}

            {state.data.status === "found" && (
              <div className="mt-5 border-t border-blue-mid/25 pt-4">
                {state.data.checked_in ? (
                  <>
                    <p className="text-lg font-semibold text-green-300">
                      ✓ تم تسجيل الحضور بالفعل
                    </p>
                    <p className="mt-2 text-sm text-blue-light/60">
                      وقت التسجيل:{" "}
                      <span className="font-semibold text-blue-light">
                        {formatTimeAr(state.data.check_in_time)}
                      </span>
                    </p>
                  </>
                ) : (
                  <p className="text-lg font-semibold text-white">
                    ❌ لم يتم تسجيل الحضور بعد
                  </p>
                )}

                {state.data.meeting ? (
                  <p className="mt-3 text-sm text-blue-light/70">
                    الاجتماع الحالي: {state.data.meeting.title} ·{" "}
                    {formatDateAr(state.data.meeting.meeting_date)}
                  </p>
                ) : (
                  <p className="mt-3 text-sm text-blue-light/60">
                    لا يوجد اجتماع مفتوح حاليًا
                  </p>
                )}
              </div>
            )}

            {SUBTITLES[state.data.status] && (
              <p className="mt-4 text-sm text-blue-light/60">{SUBTITLES[state.data.status]}</p>
            )}

            {state.data.status === "found" && (
              <p className="mt-5 border-t border-blue-mid/25 pt-4 text-xs leading-relaxed text-blue-light/50">
                🔒 لا يمكن تسجيل الحضور من هذه الصفحة — التسجيل يتم فقط بواسطة خادم/مسؤول
                مصرّح له من شاشة المسح الخاصة بالإدارة.
              </p>
            )}
          </>
        )}
      </div>
    </main>
  );
}
