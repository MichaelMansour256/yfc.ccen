/**
 * /admin/attendance/dashboard — live attendance board.
 *
 * Shows the open meeting (or any meeting picked from the list) with totals,
 * search, present/absent filters and sorting, and keeps itself up to date.
 *
 * Live updates: the board polls the dashboard API — every 5s while the meeting is
 * open, every 20s otherwise — and refreshes immediately when the tab becomes
 * visible again or when the servant taps تحديث. Polling is deliberate: this
 * project's Supabase key is a server-side secret, so a browser Realtime
 * subscription would mean shipping that key to every phone (forbidden by the
 * security requirements). The poll pauses while the tab is hidden.
 */
"use client";
import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { Meeting, MeetingMemberRow, MeetingStats } from "@/lib/attendance";
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
  inputClass,
  primaryBtn,
  subtleBtn,
  successBtn,
} from "@/components/attendance/ui";

interface DashboardPayload {
  meeting: Meeting | null;
  activeMeeting: Meeting | null;
  isActive?: boolean;
  stats: MeetingStats;
  members: MeetingMemberRow[];
}

interface MeetingOption extends Meeting {
  present: number;
  absent: number;
  rate: number;
}

type Filter = "all" | "present" | "absent";
type SortKey = "check_in_time" | "name" | "member_code";

const OPEN_POLL_MS = 5000;
const CLOSED_POLL_MS = 20000;

export default function AttendanceDashboardPage() {
  const { request, headers } = useAttendanceApi();

  const [meetingId, setMeetingId] = useState("");
  const [data, setData] = useState<DashboardPayload | null>(null);
  const [meetings, setMeetings] = useState<MeetingOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [missingSchema, setMissingSchema] = useState(false);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  const [exporting, setExporting] = useState(false);

  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<Filter>("all");
  const [sortKey, setSortKey] = useState<SortKey>("check_in_time");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  const meetingIdRef = useRef("");
  useEffect(() => {
    meetingIdRef.current = meetingId;
  }, [meetingId]);

  const fetchDashboard = useCallback(
    async (id?: string) => {
      const target = id ?? meetingIdRef.current;
      const res = await request<DashboardPayload>(
        `/api/attendance/dashboard${target ? `?meetingId=${encodeURIComponent(target)}` : ""}`
      );
      if (res.ok && res.data) {
        setData(res.data);
        setError(null);
        setMissingSchema(false);
        setUpdatedAt(new Date());
        // First load with no explicit selection: follow the open meeting.
        if (!meetingIdRef.current && res.data.meeting) setMeetingId(res.data.meeting.id);
      } else {
        setError(res.error ?? "تعذّر تحميل لوحة الحضور");
        setMissingSchema(Boolean(res.missingSchema));
      }
      setLoading(false);
    },
    [request]
  );

  const fetchMeetings = useCallback(async () => {
    const res = await request<{ meetings: MeetingOption[] }>(
      "/api/attendance/meetings?withStats=1"
    );
    if (res.ok && res.data) setMeetings(res.data.meetings);
  }, [request]);

  useEffect(() => {
    void fetchMeetings();
  }, [fetchMeetings]);

  useEffect(() => {
    void fetchDashboard(meetingId);
  }, [fetchDashboard, meetingId]);

  // ── Live polling (paused while the tab is hidden) ──
  useEffect(() => {
    const interval = data?.isActive === false ? CLOSED_POLL_MS : OPEN_POLL_MS;
    const tick = () => {
      if (document.visibilityState !== "visible") return;
      void fetchDashboard();
    };
    const timer = window.setInterval(tick, interval);
    const onVisible = () => {
      if (document.visibilityState === "visible") void fetchDashboard();
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [data?.isActive, fetchDashboard]);

  /** Download the Excel sheet for the displayed meeting (existing export API). */
  const exportExcel = useCallback(
    async (meeting: Meeting) => {
      setExporting(true);
      const res = await fetch(
        `/api/attendance/export?meetingId=${encodeURIComponent(meeting.id)}`,
        { headers }
      );
      setExporting(false);
      if (!res.ok) {
        setError("⚠️ تعذّر تصدير الملف");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `attendance-${meeting.meeting_date}.xlsx`;
      document.body.appendChild(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    },
    [headers]
  );

  /** Apply search + present/absent filter + sorting to the member rows. */
  const filteredMembers = useMemo(() => {
    const rows = data?.members ?? [];
    const q = search.trim().toLowerCase();
    const filtered = rows.filter((row) => {
      if (filter === "present" && !row.present) return false;
      if (filter === "absent" && row.present) return false;
      if (!q) return true;
      return (
        row.name.toLowerCase().includes(q) ||
        row.member_code.toLowerCase().includes(q)
      );
    });
    const dir = sortDir === "asc" ? 1 : -1;
    return [...filtered].sort((a, b) => {
      switch (sortKey) {
        case "name":
          return a.name.localeCompare(b.name, "ar") * dir;
        case "member_code":
          return a.member_code.localeCompare(b.member_code, undefined, { numeric: true }) * dir;
        case "check_in_time":
        default: {
          // Members who have not checked in yet always sink to the bottom.
          if (!a.check_in_time && !b.check_in_time) return 0;
          if (!a.check_in_time) return 1;
          if (!b.check_in_time) return -1;
          return (new Date(a.check_in_time).getTime() - new Date(b.check_in_time).getTime()) * dir;
        }
      }
    });
  }, [data?.members, search, filter, sortKey, sortDir]);

  const meeting = data?.meeting ?? null;
  const isActive = data?.isActive ?? false;

  if (loading) return <Spinner label="جارٍ تحميل لوحة الحضور…" />;

  if (missingSchema) {
    return (
      <Banner tone="warning">
        ⚠️ لم يتم تطبيق قاعدة بيانات الحضور بعد — راجع تعليمات الإعداد.
      </Banner>
    );
  }

  if (error && !data) {
    return (
      <Banner tone="error">
        ⚠️ {error}
        <button type="button" className={`${subtleBtn} ms-3`} onClick={() => void fetchDashboard()}>
          🔄 إعادة المحاولة
        </button>
      </Banner>
    );
  }

  return (
    <div className="space-y-4">
      {/* ── Page header ── */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-white">📊 لوحة الحضور</h1>
          <p className="mt-1 text-sm text-blue-light/60">
            تحديث مباشر لحضور الاجتماع المفتوح — كل مسحة جديدة تظهر تلقائيًا خلال ثوانٍ.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Link href="/admin/attendance/scan" className={successBtn}>
            📷 شاشة المسح
          </Link>
          <Link href="/admin/attendance/meetings" className={subtleBtn}>
            📅 الاجتماعات
          </Link>
          <button type="button" className={subtleBtn} onClick={() => void fetchDashboard()}>
            🔄 تحديث
          </button>
        </div>
      </div>

      {error && data && <Banner tone="error">⚠️ {error}</Banner>}
      {/* ── Open / selected meeting ── */}
      {meeting ? (
        <Card
          title="🟢 الاجتماع المفتوح حاليًا"
          className={isActive ? "border-green-500/40" : ""}
          actions={
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                isActive ? "bg-green-500/20 text-green-300" : "bg-red-500/15 text-red-300"
              }`}
            >
              {isActive ? "🟢 مفتوح — المسح يعمل" : "🔴 مغلق"}
            </span>
          }
        >
          <div className="mb-3 flex flex-wrap items-baseline gap-x-3 gap-y-1">
            <span className="text-lg font-bold text-white">{meeting.title}</span>
            <span className="text-sm text-blue-light/70">📅 {formatDateAr(meeting.meeting_date)}</span>
            <span className="text-sm text-blue-light/50">
              ⏰ {meeting.start_time ?? "—"} – {meeting.end_time ?? "—"}
            </span>
            <span className="text-xs text-blue-light/40">
              آخر تحديث: {formatTimeAr(updatedAt ? updatedAt.toISOString() : null)}
            </span>
          </div>
          <div className="mb-3 grid grid-cols-2 gap-3 sm:grid-cols-4">
            <StatCard label="إجمالي الأعضاء" value={data?.stats.totalMembers ?? 0} icon="👥" />
            <StatCard
              label="الحاضرون"
              value={data?.stats.present ?? 0}
              icon="✅"
              valueClassName="text-green-300"
              className="bg-green-500/15"
            />
            <StatCard
              label="الغائبون"
              value={data?.stats.absent ?? 0}
              icon="❌"
              valueClassName="text-red-300"
              className="bg-red-500/15"
            />
            <StatCard label="نسبة الحضور" value={`${data?.stats.attendanceRate ?? 0}%`} icon="📊" />
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/admin/attendance/scan" className={successBtn}>
              📷 فتح شاشة المسح
            </Link>
            <button
              type="button"
              className={subtleBtn}
              disabled={exporting}
              onClick={() => void exportExcel(meeting)}
            >
              {exporting ? "جارٍ التصدير…" : "⬇️ تصدير Excel"}
            </button>
            <Link href="/admin/attendance/meetings" className={subtleBtn}>
              📅 إدارة الاجتماعات
            </Link>
          </div>
        </Card>
      ) : (
        <EmptyState
          icon="📭"
          title="لا يوجد اجتماع مفتوح حاليًا"
          hint="افتح اجتماعًا من صفحة الاجتماعات ليبدأ المسح بتسجيل الحضور هنا مباشرة."
          action={
            <Link href="/admin/attendance/meetings" className={primaryBtn}>
              📅 الذهاب إلى الاجتماعات
            </Link>
          }
        />
      )}
      {/* ── Meeting picker ── */}
      {meetings.length > 0 && (
        <Card title="🗓️ تغيير الاجتماع المعروض">
          <label className="block">
            <span className="mb-1 block text-xs text-blue-light/60">
              افتراضيًا تتبع اللوحة الاجتماع المفتوح — اختر اجتماعًا آخر لعرض سجلّه
            </span>
            <select
              className={inputClass}
              value={meetingId}
              onChange={(e) => setMeetingId(e.target.value)}
            >
              <option value="">🔁 متابعة الاجتماع المفتوح تلقائيًا</option>
              {meetings.map((m) => (
                <option key={m.id} value={m.id}>
                  {formatDateAr(m.meeting_date)} — {m.title}
                  {m.status === "active" ? " (🟢 مفتوح)" : m.status === "closed" ? " (🔴 مغلق)" : ""}
                </option>
              ))}
            </select>
          </label>
        </Card>
      )}

      {/* ── Search / filter / sort + member table ── */}
      <Card title={`👥 سجل الحضور (${filteredMembers.length} من ${data?.members.length ?? 0})`}>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <label className="block">
            <span className="mb-1 block text-xs text-blue-light/60">🔍 بحث</span>
            <input
              className={inputClass}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="اسم العضو أو الكود…"
            />
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-blue-light/60">الحالة</span>
            <select
              className={inputClass}
              value={filter}
              onChange={(e) => setFilter(e.target.value as Filter)}
            >
              <option value="all">الكل</option>
              <option value="present">الحاضرون</option>
              <option value="absent">الغائبون</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-blue-light/60">الترتيب حسب</span>
            <select
              className={inputClass}
              value={sortKey}
              onChange={(e) => setSortKey(e.target.value as SortKey)}
            >
              <option value="check_in_time">وقت الحضور</option>
              <option value="name">الاسم</option>
              <option value="member_code">الكود</option>
            </select>
          </label>
          <label className="block">
            <span className="mb-1 block text-xs text-blue-light/60">الاتجاه</span>
            <select
              className={inputClass}
              value={sortDir}
              onChange={(e) => setSortDir(e.target.value === "asc" ? "asc" : "desc")}
            >
              <option value="desc">تنازلي</option>
              <option value="asc">تصاعدي</option>
            </select>
          </label>
        </div>

        {filteredMembers.length === 0 ? (
          <div className="mt-4">
            <EmptyState
              icon="🔍"
              title={search || filter !== "all" ? "لا توجد نتائج مطابقة" : "لا يوجد أعضاء في هذا الاجتماع"}
              hint={
                search || filter !== "all"
                  ? "جرّب تعديل البحث أو الفلاتر."
                  : "أضف أعضاء من صفحة الأعضاء أولًا."
              }
            />
          </div>
        ) : (
          <div className="mt-4 overflow-auto rounded-xl border border-blue-mid/20">
            <table className="w-full">
              <thead>
                <tr className="bg-blue-dark/40">
                  <th className="px-3 py-2 text-left text-xs font-semibold text-blue-light/70">الاسم</th>
                  <th className="px-3 py-2 text-left text-xs font-semibold text-blue-light/70">الكود</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-blue-light/70">الحالة</th>
                  <th className="px-3 py-2 text-center text-xs font-semibold text-blue-light/70">وقت الحضور</th>
                </tr>
              </thead>
              <tbody>
                {filteredMembers.map((row) => (
                  <tr key={row.member_id} className="border-t border-blue-mid/10">
                    <td className="px-3 py-2 text-sm text-white">{row.name}</td>
                    <td className="px-3 py-2 text-sm text-blue-light/70">{row.member_code}</td>
                    <td className="px-3 py-2 text-center">
                      <PresentPill present={row.present} />
                    </td>
                    <td className="px-3 py-2 text-center text-sm text-white">
                      {formatTimeAr(row.check_in_time)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}