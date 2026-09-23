/**
 * /admin/attendance/members/[id] — one member's attendance history.
 *
 * Meetings Attended / Missed / Rate are computed against the meetings the member
 * was *expected* at (meetings actually held on or after they joined), so the
 * percentage is not diluted by meetings that have not happened yet.
 */
"use client";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { MemberHistory } from "@/lib/attendance";
import { useAttendanceApi } from "@/components/attendance/AdminAuthProvider";
import {
  Banner,
  Card,
  EmptyState,
  PresentPill,
  Spinner,
  StatCard,
  formatDateAr,
  formatTimeAr,
  subtleBtn,
} from "@/components/attendance/ui";

export default function MemberHistoryPage() {
  const params = useParams<{ id: string }>();
  const memberId = params?.id ?? "";
  const { request } = useAttendanceApi();

  const [history, setHistory] = useState<MemberHistory | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    const res = await request<MemberHistory>(
      `/api/attendance/members/history?id=${encodeURIComponent(memberId)}`
    );
    if (res.ok && res.data) {
      setHistory(res.data);
      setError(null);
    } else {
      setError(res.error ?? "تعذّر تحميل سجل الحضور");
    }
    setLoading(false);
  }, [request, memberId]);

  useEffect(() => {
    if (memberId) void load();
  }, [load, memberId]);

  if (loading) return <Spinner label="جارٍ تحميل السجل…" />;

  if (error || !history?.member) {
    return (
      <EmptyState
        icon="🔍"
        title={error ?? "العضو غير موجود"}
        hint="تأكد من الرابط أو ارجع لقائمة الأعضاء."
        action={
          <Link href="/admin/attendance/members" className={subtleBtn}>
            ← الأعضاء
          </Link>
        }
      />
    );
  }

  const { member, rows, attended, missed, expected, rate } = history;

  return (
    <>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-white">{member.name}</h2>
          <p className="text-xs tracking-widest text-blue-light/50">{member.member_code}</p>
        </div>
        <div className="flex gap-2">
          <Link href="/admin/attendance/members" className={subtleBtn}>
            ← الأعضاء
          </Link>
          <Link
            href={`/admin/attendance/members?q=${encodeURIComponent(member.member_code)}`}
            className={subtleBtn}
          >
            QR / إدارة
          </Link>
        </div>
      </div>

      {!member.active && (
        <div className="mb-4">
          <Banner tone="warning">⏸️ هذا العضو موقوف حاليًا — لن يُسجّل حضوره عند المسح.</Banner>
        </div>
      )}

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <StatCard label="اجتماعات حضرها" value={attended} icon="✅" className="bg-green-500/15" valueClassName="text-green-300" />
        <StatCard label="اجتماعات غاب عنها" value={missed} icon="❌" className="bg-red-500/15" valueClassName="text-red-300" />
        <StatCard label="نسبة الحضور" value={`${rate}%`} icon="📊" />
        <StatCard label="إجمالي الاجتماعات" value={expected} icon="📅" />
      </div>

      <Card title="🕘 سجل الحضور">
        {rows.length === 0 ? (
          <EmptyState
            icon="📭"
            title="لا يوجد سجل بعد"
            hint="سيظهر السجل بعد أول اجتماع يتم تسجيله بعد انضمام العضو."
          />
        ) : (
          <ul className="divide-y divide-blue-mid/20">
            {rows.map((row) => (
              <li key={row.meeting_id} className="flex items-center justify-between gap-3 py-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-white">{row.title}</p>
                  <p className="text-xs text-blue-light/50">{formatDateAr(row.meeting_date)}</p>
                </div>
                <div className="text-left">
                  <PresentPill present={row.present} />
                  <p className="mt-1 text-xs text-blue-light/50">
                    {formatTimeAr(row.check_in_time)}
                  </p>
                </div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </>
  );
}
