/**
 * "استيراد أعضاء من Excel" — the import flow as one card:
 *
 *   رفع ملف Excel → معاينة البيانات (counts + detected columns + row preview +
 *   validation errors with Excel row numbers) → تأكيد الاستيراد → النتائج.
 *
 * Reuses the attendance dashboard's atoms (Card/Banner/buttons) so it feels
 * native to the E3dady design, and talks only to the existing API client
 * (useAttendanceApi → x-admin-password header — same permission as manual
 * member management; nothing here is reachable by normal attendees).
 */
"use client";
import { useCallback, useRef, useState } from "react";
import type { ImportPreview, ImportResult, ImportPreviewRow } from "@/lib/excel-import";
import { useAttendanceApi } from "./AdminAuthProvider";
import {
  Banner,
  Card,
  Spinner,
  primaryBtn,
  subtleBtn,
  successBtn,
} from "./ui";

type Step = "idle" | "preview" | "result";

const STATUS_LABEL: Record<ImportPreviewRow["status"], string> = {
  new: "جديد — سيُضاف",
  existing: "موجود — سيُتخطى",
  possible_duplicate: "تكرار محتمل — سيُتخطى",
  duplicate_in_file: "مكرر في الملف — سيُتخطى",
};

const STATUS_CLASS: Record<ImportPreviewRow["status"], string> = {
  new: "text-green-300",
  existing: "text-blue-light",
  possible_duplicate: "text-amber-200",
  duplicate_in_file: "text-amber-200",
};

/** File → base64 (without the data: prefix) for the JSON API. */
function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result).replace(/^data:[^,]*,/, ""));
    reader.onerror = () => reject(new Error("تعذّر قراءة الملف"));
    reader.readAsDataURL(file);
  });
}

export default function MemberImportCard({ onImported }: { onImported: () => void }) {
  const { request, headers } = useAttendanceApi();
  const [step, setStep] = useState<Step>("idle");
  const [file, setFile] = useState<{ name: string; base64: string } | null>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const reset = useCallback(() => {
    setStep("idle");
    setFile(null);
    setPreview(null);
    setResult(null);
    setError(null);
    setBusy(false);
    if (inputRef.current) inputRef.current.value = "";
  }, []);

  const send = useCallback(
    async (action: "preview" | "confirm", chosen: { name: string; base64: string }) => {
      setBusy(true);
      setError(null);
      const res = await request<ImportPreview | ImportResult>("/api/attendance/members/import", {
        json: { action, fileName: chosen.name, file: chosen.base64 },
      });
      setBusy(false);
      if (!res.ok || !res.data) {
        setError(res.error ?? "تعذّر معالجة الملف");
        return null;
      }
      return res.data;
    },
    [request]
  );

  const onFileChosen = useCallback(
    async (chosen: File | undefined) => {
      if (!chosen) return;
      let base64: string;
      try {
        base64 = await fileToBase64(chosen);
      } catch {
        setError("تعذّر قراءة الملف");
        return;
      }
      const payload = { name: chosen.name, base64 };
      setFile(payload);
      const data = await send("preview", payload);
      if (data && "totalRows" in data) {
        setPreview(data);
        setStep("preview");
      }
    },
    [send]
  );

  const confirmImport = useCallback(async () => {
    if (!file) return;
    const data = await send("confirm", file);
    if (data && "imported" in data) {
      setResult(data);
      setStep("result");
      onImported(); // refresh the member list behind this card immediately
    }
  }, [file, send, onImported]);

  const downloadTemplate = useCallback(async () => {
    setError(null);
    try {
      const res = await fetch("/api/attendance/members/import", { headers });
      if (!res.ok) {
        const payload = await res.json().catch(() => null);
        setError(payload?.error ?? "تعذّر تحميل الملف النموذجي");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = "members-import-template.xlsx";
      link.click();
      URL.revokeObjectURL(url);
    } catch {
      setError("تعذّر تحميل الملف النموذجي");
    }
  }, [headers]);

  return (
    <Card
      title="📥 استيراد أعضاء من Excel"
      actions={
        <button type="button" onClick={reset} className={subtleBtn}>
          ✕ إغلاق
        </button>
      }
    >
      {error && (
        <div className="mb-3">
          <Banner tone="error">{error}</Banner>
        </div>
      )}

      {step === "idle" && (
        <div className="space-y-3 text-sm text-blue-light/70">
          <p>
            ارفع ملف <b className="text-white">.xlsx</b> أو{" "}
            <b className="text-white">.xls</b> يحتوي على قائمة الأعضاء. العمود المطلوب
            الوحيد هو الاسم — رقم التليفون وتاريخ الميلاد اختياريان تمامًا.
          </p>
          <div className="flex flex-wrap items-center gap-2">
            <input
              ref={inputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={(e) => void onFileChosen(e.target.files?.[0])}
            />
            <button
              type="button"
              disabled={busy}
              onClick={() => inputRef.current?.click()}
              className={primaryBtn}
            >
              📤 رفع ملف Excel
            </button>
            <button type="button" onClick={() => void downloadTemplate()} className={subtleBtn}>
              ⬇️ تحميل ملف نموذجي
            </button>
          </div>
          <p className="text-xs text-blue-light/50">
            تُسمى الأعمدة بالإنجليزية أو العربية (Name / الاسم، Phone / رقم التليفون،
            Date of Birth / تاريخ الميلاد) بأي أحرف.
          </p>
          {busy && <Spinner label="جارٍ تحليل الملف…" />}
        </div>
      )}

      {step === "preview" && preview && (
        <div className="space-y-4">
          {/* ── Step 3: معاينة البيانات ── */}
          <div>
            <h3 className="mb-2 font-semibold text-white">معاينة البيانات</h3>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-5">
              <Stat label="إجمالي الصفوف" value={preview.totalRows} tone="text-white" />
              <Stat label="أعضاء صالحين" value={preview.validRows} tone="text-green-300" />
              <Stat label="سيتم إضافتهم" value={preview.counts.new} tone="text-green-300" />
              <Stat
                label="سيتم تخطيهم"
                value={
                  preview.counts.existing +
                  preview.counts.possible_duplicate +
                  preview.counts.duplicate_in_file
                }
                tone="text-blue-light"
              />
              <Stat label="صفوف بها أخطاء" value={preview.invalidRows} tone="text-red-300" />
            </div>
          </div>

          <div className="text-xs text-blue-light/60">
            الأعمدة المكتشفة:{" "}
            <span className="text-white">{preview.columns.name ?? "— (غير موجود!)"}</span>
            {" — التليفون: "}
            <span className="text-white">{preview.columns.phone ?? "غير موجود (اختياري)"}</span>
            {" — تاريخ الميلاد: "}
            <span className="text-white">
              {preview.columns.date_of_birth ?? "غير موجود (اختياري)"}
            </span>
            {" — كود العضو: "}
            <span className="text-white">{preview.columns.member_code ?? "غير موجود"}</span>
          </div>

          {preview.warnings.map((warning) => (
            <Banner key={warning} tone="warning">
              ⚠️ {warning}
            </Banner>
          ))}

          {/* First rows of the sheet with their resolution */}
          <div className="overflow-x-auto rounded-xl ring-1 ring-blue-mid/30">
            <table className="w-full min-w-[34rem] text-right text-xs">
              <thead>
                <tr className="bg-blue-dark/70 text-blue-light/80">
                  <th className="px-2 py-2">الصف</th>
                  <th className="px-2 py-2">الاسم</th>
                  <th className="px-2 py-2">التليفون</th>
                  <th className="px-2 py-2">تاريخ الميلاد</th>
                  <th className="px-2 py-2">الحالة</th>
                </tr>
              </thead>
              <tbody>
                {preview.preview.map((row) => (
                  <tr key={row.row} className="border-b border-blue-mid/20 last:border-0">
                    <td className="px-2 py-2 text-blue-light/60">{row.row}</td>
                    <td className="px-2 py-2 text-white">{row.name}</td>
                    <td className="px-2 py-2 text-blue-light/70">{row.phone ?? "—"}</td>
                    <td className="px-2 py-2 text-blue-light/70">{row.date_of_birth ?? "—"}</td>
                    <td
                      className={`px-2 py-2 font-semibold ${STATUS_CLASS[row.status]}`}
                      title={row.reason ?? undefined}
                    >
                      {STATUS_LABEL[row.status]}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {preview.preview.length < preview.validRows && (
            <p className="text-xs text-blue-light/50">
              … معاينة أول {preview.preview.length} صف من {preview.validRows} صلاحية.
            </p>
          )}

          {/* Step 5: validation errors, each with its Excel row number */}
          {preview.invalid.length > 0 && (
            <div>
              <h4 className="mb-1 font-semibold text-red-300">
                صفوف بها أخطاء ({preview.invalid.length})
              </h4>
              <ul className="max-h-48 space-y-1 overflow-y-auto text-xs">
                {preview.invalid.slice(0, 100).map((row) => (
                  <li key={row.row} className="text-red-200">
                    • الصف {row.row}: {row.reason}
                    {row.name ? ` (${row.name})` : ""}
                  </li>
                ))}
                {preview.invalid.length > 100 && (
                  <li className="text-red-200">… و{preview.invalid.length - 100} صف آخر</li>
                )}
              </ul>
            </div>
          )}

          {/* Step 6: تأكيد الاستيراد */}
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={busy || preview.counts.new === 0}
              onClick={() => void confirmImport()}
              className={primaryBtn}
            >
              ✅ تأكيد الاستيراد{preview.counts.new > 0 ? ` (${preview.counts.new})` : ""}
            </button>
            <button type="button" disabled={busy} onClick={reset} className={subtleBtn}>
              ملف آخر
            </button>
          </div>
          {busy && <Spinner label="جارٍ الاستيراد…" />}
        </div>
      )}

      {step === "result" && result && (
        <div className="space-y-4">
          {/* ── Step 7: Import results ── */}
          <Banner tone="success">
            🎉 تم استيراد الأعضاء بنجاح — {result.imported} عضو جديد
          </Banner>

          <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
            <Stat label="إجمالي المعالج" value={result.total} tone="text-white" />
            <Stat label="تم استيرادهم" value={result.imported} tone="text-green-300" />
            <Stat
              label="أعضاء موجودون بالفعل (تخطّي)"
              value={result.skipped}
              tone="text-blue-light"
            />
            <Stat label="صفوف بها أخطاء" value={result.failed} tone="text-red-300" />
          </div>

          {result.skippedRows.length > 0 && (
            <div>
              <h4 className="mb-1 font-semibold text-blue-light">أعضاء موجودون بالفعل</h4>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-blue-light/70">
                {result.skippedRows.slice(0, 100).map((row) => (
                  <li key={`${row.row}-${row.name}`}>
                    • الصف {row.row}: {row.name} — {row.reason}
                  </li>
                ))}
                {result.skippedRows.length > 100 && (
                  <li>… و{result.skippedRows.length - 100} صف آخر</li>
                )}
              </ul>
            </div>
          )}

          {result.failures.length > 0 && (
            <div>
              <h4 className="mb-1 font-semibold text-red-300">
                صفوف بها أخطاء ({result.failures.length})
              </h4>
              <ul className="max-h-40 space-y-1 overflow-y-auto text-xs text-red-200">
                {result.failures.slice(0, 100).map((row) => (
                  <li key={row.row}>
                    • الصف {row.row}: {row.reason}
                    {row.name ? ` (${row.name})` : ""}
                  </li>
                ))}
                {result.failures.length > 100 && (
                  <li>… و{result.failures.length - 100} صف آخر</li>
                )}
              </ul>
            </div>
          )}

          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => {
                onImported();
                reset();
              }}
              className={successBtn}
            >
              👥 عرض الأعضاء
            </button>
            <button type="button" onClick={reset} className={subtleBtn}>
              📥 استيراد ملف آخر
            </button>
          </div>
        </div>
      )}
    </Card>
  );
}

function Stat({ label, value, tone }: { label: string; value: number; tone: string }) {
  return (
    <div className="rounded-xl bg-blue-dark/60 p-3 text-center">
      <div className={`text-lg font-bold ${tone}`}>{value}</div>
      <div className="text-[11px] leading-tight text-blue-light/60">{label}</div>
    </div>
  );
}




