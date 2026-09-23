/**
 * QR dialog — view / download / print one member's QR code.
 *
 * The QR image comes from /api/attendance/qr (authenticated), so codes cannot be
 * harvested from the internet; the dialog also shows the plain check-in URL for
 * manual sharing and printing.
 */
"use client";
import { useCallback, useEffect, useState } from "react";
import { useAttendanceApi } from "./AdminAuthProvider";
import { Banner, Spinner, primaryBtn, subtleBtn } from "./ui";

export interface QrDialogMember {
  id: string;
  name: string;
  member_code: string;
  active: boolean;
}

interface QrPayload {
  dataUrl: string;
  checkInUrl: string;
}

export default function QrDialog({
  member,
  onClose,
}: {
  member: QrDialogMember;
  onClose: () => void;
}) {
  const { request } = useAttendanceApi();
  const [payload, setPayload] = useState<QrPayload | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    let alive = true;
    (async () => {
      const res = await request<QrPayload>(`/api/attendance/qr?id=${encodeURIComponent(member.id)}`);
      if (!alive) return;
      if (res.ok && res.data?.dataUrl) setPayload(res.data);
      else setError(res.error ?? "تعذّر توليد رمز QR");
    })();
    return () => {
      alive = false;
    };
  }, [request, member.id]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const printCard = useCallback(() => {
    if (!payload) return;
    // Print in a separate window so the admin UI is untouched; the card is the
    // same one the bulk sheet prints (clean, cut-friendly, 1 QR per card).
    const win = window.open("", "_blank", "width=460,height=680");
    if (!win) return;
    win.document.write(`<!DOCTYPE html>
<html lang="ar" dir="rtl"><head><meta charset="utf-8">
<title>${member.member_code}</title>
<style>
  @page { margin: 12mm; }
  body { font-family: "Cairo", "Segoe UI", sans-serif; text-align: center; margin: 0; padding: 24px; }
  .card { border: 1px solid #999; border-radius: 14px; padding: 20px; max-width: 320px; margin: 0 auto; }
  img { width: 240px; height: 240px; }
  .name { font-size: 22px; font-weight: 700; margin-top: 10px; }
  .code { font-size: 15px; color: #555; margin-top: 4px; letter-spacing: 2px; }
  .hint { font-size: 11px; color: #777; margin-top: 10px; }
</style></head>
<body>
  <div class="card">
    <img src="${payload.dataUrl}" alt="QR" />
    <div class="name">${member.name}</div>
    <div class="code">${member.member_code}</div>
    <div class="hint">امسح الرمز لتسجيل الحضور</div>
  </div>
  <script>window.onload = function () { window.print(); };</script>
</body></html>`);
    win.document.close();
  }, [payload, member.member_code, member.name]);

  const copyLink = useCallback(async () => {
    if (!payload) return;
    try {
      await navigator.clipboard.writeText(payload.checkInUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      setError("تعذّر النسخ — انسخ الرابط يدويًا");
    }
  }, [payload]);

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
      role="dialog"
      aria-modal="true"
      aria-label={`QR ${member.name}`}
      onClick={onClose}
    >
      <div
        className="w-full max-w-sm rounded-2xl border border-blue-mid/40 bg-blue-primary/95 p-5 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 className="text-lg font-bold text-white">{member.name}</h2>
        <p className="mt-1 text-xs tracking-widest text-blue-light/60">{member.member_code}</p>

        {!member.active && (
          <div className="mt-3">
            <Banner tone="warning">⚠️ هذا العضو غير نشط — الرمز لن يُسجّل حضورًا</Banner>
          </div>
        )}

        <div className="mt-4 flex justify-center">
          {payload ? (
            // eslint-disable-next-line @next/next/no-img-element -- data URL, no optimisation needed
            <img
              src={payload.dataUrl}
              alt={`QR ${member.name}`}
              width={220}
              height={220}
              className="rounded-xl bg-white p-2"
            />
          ) : error ? (
            <Banner tone="error">{error}</Banner>
          ) : (
            <Spinner label="جارٍ توليد الرمز…" />
          )}
        </div>

        {payload && (
          <>
            <p className="mt-3 break-all text-[11px] leading-5 text-blue-light/50" dir="ltr">
              {payload.checkInUrl}
            </p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <a
                href={payload.dataUrl}
                download={`${member.member_code}-qr.png`}
                className={primaryBtn}
              >
                ⬇️ تحميل
              </a>
              <button type="button" onClick={printCard} className={subtleBtn}>
                🖨️ طباعة
              </button>
              <button type="button" onClick={copyLink} className={subtleBtn}>
                {copied ? "✅ تم النسخ" : "🔗 نسخ الرابط"}
              </button>
            </div>
          </>
        )}

        <button type="button" onClick={onClose} className={`${subtleBtn} mt-4 w-full`}>
          إغلاق
        </button>
      </div>
    </div>
  );
}
