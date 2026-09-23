/**
 * /admin/attendance/members
 *
 * Member registry + QR management:
 *   • list, search, filter (all / active / inactive)
 *   • create (member code suggested automatically, QR token generated server-side)
 *   • inline edit of name / code
 *   • activate / deactivate (history is preserved)
 *   • regenerate the QR token (old QR stops working — asks for confirmation)
 *   • view / download / print a QR, and the printable sheet for everyone
 *   • attendance history per member
 */
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import type { PublicMember } from "@/lib/attendance";
import { useAttendanceApi } from "@/components/attendance/AdminAuthProvider";
import QrDialog from "@/components/attendance/QrDialog";
import {
  Banner,
  Card,
  EmptyState,
  Spinner,
  dangerBtn,
  inputClass,
  primaryBtn,
  subtleBtn,
  successBtn,
} from "@/components/attendance/ui";

type Filter = "all" | "active" | "inactive";

export default function AttendanceMembersPage() {
  const { request } = useAttendanceApi();
  const [members, setMembers] = useState<PublicMember[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingSchema, setMissingSchema] = useState(false);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");

  const [showCreate, setShowCreate] = useState(false);
  const [newName, setNewName] = useState("");
  const [newCode, setNewCode] = useState("");
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [qrMember, setQrMember] = useState<PublicMember | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await request<PublicMember[]>("/api/attendance/members");
    if (res.ok && res.data) {
      setMembers(res.data);
      setError(null);
      setMissingSchema(false);
    } else {
      setError(res.error ?? "تعذّر تحميل الأعضاء");
      setMissingSchema(Boolean(res.missingSchema));
    }
    setLoading(false);
  }, [request]);

  useEffect(() => {
    void load();
  }, [load]);

  const openCreate = useCallback(async () => {
    setShowCreate(true);
    setNotice(null);
    const res = await request<{ nextCode: string }>("/api/attendance/members?nextCode=1");
    setNewCode(res.data?.nextCode ?? "M001");
  }, [request]);

  const create = useCallback(async () => {
    if (!newName.trim() || !newCode.trim()) {
      setNotice("⚠️ أدخل اسم العضو وكود العضو");
      return;
    }
    setSaving(true);
    const res = await request<PublicMember>("/api/attendance/members", {
      json: { name: newName, member_code: newCode },
    });
    setSaving(false);
    if (!res.ok) {
      setNotice(`⚠️ ${res.error ?? "فشل إنشاء العضو"}`);
      return;
    }
    setNewName("");
    setShowCreate(false);
    setNotice("✅ تم إنشاء العضو ورمز QR الخاص به");
    void load();
  }, [request, newName, newCode, load]);

  const toggleActive = useCallback(
    async (member: PublicMember) => {
      const res = await request<PublicMember>("/api/attendance/members", {
        method: "PATCH",
        json: { id: member.id, action: "setActive", active: !member.active },
      });
      if (!res.ok) {
        setNotice(`⚠️ ${res.error ?? "فشل تحديث حالة العضو"}`);
        return;
      }
      setNotice(
        member.active
          ? `⏸️ تم إيقاف ${member.name} — رمز QR لن يُسجّل حضورًا`
          : `▶️ تم تنشيط ${member.name}`
      );
      void load();
    },
    [request, load]
  );

  const regenerate = useCallback(
    async (member: PublicMember) => {
      const confirmed = window.confirm(
        `إعادة توليد رمز QR لـ ${member.name}؟\n\nالرمز القديم سيصبح غير صالح فورًا، وكل نسخة مطبوعة منه لن تعمل بعد الآن.`
      );
      if (!confirmed) return;
      const res = await request<PublicMember>("/api/attendance/members", {
        method: "PATCH",
        json: { id: member.id, action: "regenerate" },
      });
      if (!res.ok) {
        setNotice(`⚠️ ${res.error ?? "فشل إعادة توليد الرمز"}`);
        return;
      }
      setNotice(`♻️ تم توليد رمز QR جديد لـ ${member.name} — اطبع البطاقة من جديد`);
      void load();
    },
    [request, load]
  );

  const remove = useCallback(
    async (member: PublicMember) => {
      const confirmed = window.confirm(
        `حذف ${member.name} نهائيًا؟\n\nإذا كان لديه سجل حضور لا يمكن حذفه — أوقفه بدلًا من ذلك.`
      );
      if (!confirmed) return;
      const res = await request<{ ok: boolean }>("/api/attendance/members", {
        method: "DELETE",
        json: { id: member.id },
      });
      setNotice(
        res.ok
          ? `🗑️ تم حذف ${member.name}`
          : `⚠️ ${res.error ?? "فشل الحذف — أوقف العضو بدلًا من حذفه"}`
      );
      void load();
    },
    [request, load]
  );

  const saveEdit = useCallback(
    async (id: string, name: string, member_code: string) => {
      const res = await request<PublicMember>("/api/attendance/members", {
        method: "PATCH",
        json: { id, name, member_code },
      });
      if (!res.ok) {
        setNotice(`⚠️ ${res.error ?? "فشل الحفظ"}`);
        return false;
      }
      setNotice("✅ تم حفظ التعديلات");
      void load();
      return true;
    },
    [request, load]
  );

  const visible = useMemo(() => {
    const term = search.trim().toLowerCase();
    return members.filter((m) => {
      if (filter === "active" && !m.active) return false;
      if (filter === "inactive" && m.active) return false;
      if (!term) return true;
      return (
        m.name.toLowerCase().includes(term) || m.member_code.toLowerCase().includes(term)
      );
    });
  }, [members, search, filter]);

  const activeCount = members.filter((m) => m.active).length;

  if (missingSchema) {
    return (
      <EmptyState
        icon="🗄️"
        title="جداول الحضور غير موجودة بعد"
        hint="شغّل ملف supabase-attendance-migration.sql في Supabase SQL Editor ثم أعد تحميل الصفحة."
      />
    );
  }

  return (
    <>
      {qrMember && <QrDialog member={qrMember} onClose={() => setQrMember(null)} />}

      {notice && (
        <div className="mb-4">
          <Banner tone={notice.startsWith("⚠️") ? "warning" : "success"}>{notice}</Banner>
        </div>
      )}

      <Card
        title={`👥 الأعضاء (${members.length} — نشط ${activeCount})`}
        actions={
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={() => void openCreate()} className={primaryBtn}>
              ➕ إضافة عضو
            </button>
            <Link
              href="/admin/attendance/members/qr-sheet"
              className={successBtn}
              title="ورقة قابلة للطباعة تحتوي رمز QR لكل الأعضاء النشطين"
            >
              🖨️ ورقة QR للجميع
            </Link>
          </div>
        }
      >
        {showCreate && (
          <div className="mb-4 rounded-xl bg-blue-dark/40 p-3">
            <div className="mb-2 flex flex-col gap-2 sm:flex-row">
              <input
                value={newCode}
                onChange={(e) => setNewCode(e.target.value)}
                placeholder="كود العضو (M001)"
                className={`${inputClass} sm:max-w-[10rem]`}
              />
              <input
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                placeholder="اسم العضو"
                className={inputClass}
                onKeyDown={(e) => {
                  if (e.key === "Enter") void create();
                }}
              />
            </div>
            <div className="flex gap-2">
              <button type="button" onClick={() => void create()} disabled={saving} className={primaryBtn}>
                {saving ? "جارٍ الإنشاء…" : "إنشاء"}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className={subtleBtn}>
                إلغاء
              </button>
            </div>
            <p className="mt-2 text-xs text-blue-light/50">
              يتم توليد رمز QR عشوائي آمن على الخادم عند الإنشاء.
            </p>
          </div>
        )}

        <div className="mb-3 flex flex-col gap-2 sm:flex-row">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="🔍 بحث بالاسم أو الكود…"
            className={inputClass}
          />
          <div className="flex gap-2">
            {(
              [
                ["all", `الكل (${members.length})`],
                ["active", `نشط (${activeCount})`],
                ["inactive", `موقوف (${members.length - activeCount})`],
              ] as [Filter, string][]
            ).map(([key, label]) => (
              <button
                key={key}
                type="button"
                onClick={() => setFilter(key)}
                className={filter === key ? primaryBtn : subtleBtn}
              >
                {label}
              </button>
            ))}
          </div>
        </div>

        {error && <Banner tone="error">{error}</Banner>}
        {loading && members.length === 0 && <Spinner />}

        {!loading && members.length === 0 && !error && (
          <EmptyState
            icon="👥"
            title="لا يوجد أعضاء بعد"
            hint="أضف أول عضو ثم اطبع رمز QR الخاص به."
            action={
              <button type="button" onClick={() => void openCreate()} className={primaryBtn}>
                ➕ إضافة عضو
              </button>
            }
          />
        )}

        {members.length > 0 && (
          <div className="-mx-1 overflow-x-auto">
            <table className="w-full min-w-[38rem] text-sm">
              <thead>
                <tr className="border-b border-blue-mid/30 text-right text-xs text-blue-light/60">
                  <th className="px-2 py-2 font-semibold">العضو</th>
                  <th className="px-2 py-2 font-semibold">الكود</th>
                  <th className="px-2 py-2 text-center font-semibold">الحالة</th>
                  <th className="px-2 py-2 text-center font-semibold">QR</th>
                  <th className="px-2 py-2 text-center font-semibold">إجراءات</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((member) => (
                  <MemberRow
                    key={member.id}
                    member={member}
                    onShowQr={() => setQrMember(member)}
                    onToggleActive={() => void toggleActive(member)}
                    onRegenerate={() => void regenerate(member)}
                    onDelete={() => void remove(member)}
                    onSave={saveEdit}
                  />
                ))}
                {visible.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-2 py-6 text-center text-blue-light/50">
                      لا نتائج مطابقة
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  );
}


/* ── One member row ───────────────────────────────────────────────────────── */

function MemberRow({
  member,
  onShowQr,
  onToggleActive,
  onRegenerate,
  onDelete,
  onSave,
}: {
  member: PublicMember;
  onShowQr: () => void;
  onToggleActive: () => void;
  onRegenerate: () => void;
  onDelete: () => void;
  onSave: (id: string, name: string, code: string) => Promise<boolean>;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(member.name);
  const [code, setCode] = useState(member.member_code);
  const [busy, setBusy] = useState(false);

  return (
    <tr className="border-b border-blue-mid/20 last:border-0">
      <td className="px-2 py-2">
        {editing ? (
          <input value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
        ) : (
          <Link
            href={`/admin/attendance/members/${member.id}`}
            className="text-white hover:text-blue-accent hover:underline"
            title="سجل الحضور"
          >
            {member.name}
          </Link>
        )}
      </td>
      <td className="px-2 py-2 text-blue-light/70">
        {editing ? (
          <input
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className={`${inputClass} max-w-[7rem]`}
          />
        ) : (
          member.member_code
        )}
      </td>
      <td className="px-2 py-2 text-center">
        {member.active ? (
          <span className="text-green-400">✅ نشط</span>
        ) : (
          <span className="text-amber-300">⏸️ موقوف</span>
        )}
      </td>
      <td className="px-2 py-2 text-center">
        <button type="button" onClick={onShowQr} className={subtleBtn}>
          🔍 عرض
        </button>
      </td>
      <td className="px-2 py-2">
        <div className="flex flex-wrap justify-center gap-1">
          {editing ? (
            <>
              <button
                type="button"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  const ok = await onSave(member.id, name, code);
                  setBusy(false);
                  if (ok) setEditing(false);
                }}
                className={successBtn}
              >
                💾 حفظ
              </button>
              <button
                type="button"
                onClick={() => {
                  setName(member.name);
                  setCode(member.member_code);
                  setEditing(false);
                }}
                className={subtleBtn}
              >
                إلغاء
              </button>
            </>
          ) : (
            <>
              <button type="button" onClick={() => setEditing(true)} className={subtleBtn}>
                ✏️ تعديل
              </button>
              <button type="button" onClick={onToggleActive} className={subtleBtn}>
                {member.active ? "⏸️ إيقاف" : "▶️ تنشيط"}
              </button>
              <button type="button" onClick={onRegenerate} className={subtleBtn}>
                ♻️ رمز جديد
              </button>
              <button type="button" onClick={onDelete} className={dangerBtn}>
                🗑️
              </button>
            </>
          )}
        </div>
      </td>
    </tr>
  );
}

