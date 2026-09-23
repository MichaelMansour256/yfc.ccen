/**
 * Attendance system — database operations.
 *
 * SERVER-ONLY. Reuses the single shared `supabase` client from `@/lib/supabase`
 * (the same client every other API route uses). No second Supabase setup, no
 * new environment variables.
 *
 * Tables: members, meetings, attendance  (see supabase-attendance-migration.sql)
 *
 * Conventions used here:
 *   • every function catches its own errors, logs them server-side and returns
 *     a safe value — raw Postgres errors never reach the browser
 *   • types are exported so client components can `import type` them without
 *     pulling this module (and the Supabase key) into the browser bundle
 */
import { randomBytes } from "crypto";
import { supabase } from "./supabase";

/* ══════════════════════════════════════════════════════════════════════════
 * TYPES
 * ══════════════════════════════════════════════════════════════════════════ */

export type MeetingStatus = "scheduled" | "active" | "closed";

export interface Member {
  id: string;
  member_code: string;
  name: string;
  /** Random secret inside the QR code — stripped before any API response. */
  qr_token: string;
  active: boolean;
  created_at: string;
  updated_at: string;
}

/**
 * A member as the admin UI receives it: the QR token stays on the server and is
 * only ever rendered through /api/attendance/qr.
 */
export type PublicMember = Omit<Member, "qr_token">;

/** Drop the secret token before sending a member to the browser. */
export function toPublicMember(member: Member): PublicMember {
  const { qr_token: _token, ...rest } = member;
  return rest;
}

export interface Meeting {
  id: string;
  title: string;
  /** ISO date, e.g. "2026-09-20" (Postgres `date`). */
  meeting_date: string;
  start_time: string | null;
  end_time: string | null;
  status: MeetingStatus;
  created_at: string;
}

export interface AttendanceRecord {
  id: string;
  meeting_id: string;
  member_id: string;
  check_in_time: string;
  created_at: string;
}

/** One of the five states the check-in UI knows how to render. */
export type CheckInStatus =
  | "success"
  | "already_recorded"
  | "invalid_token"
  | "inactive_member"
  | "no_active_meeting";

export interface CheckInOutcome {
  status: CheckInStatus;
  member?: { name: string; member_code: string };
  meeting?: { id?: string; title: string; meeting_date: string };
  check_in_time?: string | null;
}

/** A member with their attendance state for one meeting. */
export interface MeetingMemberRow {
  member_id: string;
  name: string;
  member_code: string;
  active: boolean;
  check_in_time: string | null;
  present: boolean;
}

export interface MeetingStats {
  totalMembers: number;
  present: number;
  absent: number;
  attendanceRate: number;
}

/** One line of a member's attendance history. */
export interface MemberHistoryRow {
  meeting_id: string;
  title: string;
  meeting_date: string;
  status: MeetingStatus;
  check_in_time: string | null;
  present: boolean;
}

export interface MemberHistory {
  member: Member | null;
  rows: MemberHistoryRow[];
  attended: number;
  missed: number;
  expected: number;
  rate: number;
}

export interface MeetingSummary extends Meeting {
  present: number;
  absent: number;
  rate: number;
}

/* ══════════════════════════════════════════════════════════════════════════
 * ERROR HELPERS
 * ══════════════════════════════════════════════════════════════════════════ */

interface SupabaseErrorLike {
  code?: string;
  message?: string;
}

/**
 * True when the attendance migration has not been applied yet.
 * PostgREST reports a missing table as PGRST205 ("Could not find the table …
 * in the schema cache") and a missing function as PGRST202; raw Postgres is 42P01.
 */
export function isMissingSchemaError(error: SupabaseErrorLike | null): boolean {
  if (!error) return false;
  if (error.code === "PGRST205" || error.code === "PGRST202" || error.code === "42P01") {
    return true;
  }
  const msg = error.message ?? "";
  return (
    msg.includes("Could not find the table") ||
    msg.includes("Could not find the function") ||
    msg.includes("schema cache")
  );
}

function logError(scope: string, error: unknown): void {
  console.error(`[attendance] ${scope}:`, error);
}

/* ══════════════════════════════════════════════════════════════════════════
 * TOKENS
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Cryptographically random QR token: 32 random bytes → 64 hex chars (~256 bits).
 * URL-safe by construction, unguessable, and never derived from the member's
 * name or code. Regenerating one immediately invalidates the previous QR.
 */
export function generateQrToken(): string {
  return randomBytes(32).toString("hex");
}

/** Shape check used by the public check-in route before touching the database. */
export function isPlausibleQrToken(token: unknown): token is string {
  return typeof token === "string" && /^[a-f0-9]{16,128}$/i.test(token.trim());
}

/* ══════════════════════════════════════════════════════════════════════════
 * MEMBERS
 * ══════════════════════════════════════════════════════════════════════════ */

/** Natural order for member codes: "M2" < "M10" (numeric tail when present). */
export function compareMemberCodes(a: string, b: string): number {
  const na = parseInt(a.replace(/\D+/g, ""), 10);
  const nb = parseInt(b.replace(/\D+/g, ""), 10);
  if (!Number.isNaN(na) && !Number.isNaN(nb) && na !== nb) return na - nb;
  return a.localeCompare(b);
}

export async function listMembers(): Promise<Member[]> {
  const { data, error } = await supabase.from("members").select("*");
  if (error) {
    logError("listMembers", error);
    return [];
  }
  return ((data ?? []) as Member[]).sort((a, b) =>
    compareMemberCodes(a.member_code, b.member_code)
  );
}

export async function getMemberById(id: string): Promise<Member | null> {
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("id", id)
    .maybeSingle();
  if (error) {
    logError("getMemberById", error);
    return null;
  }
  return (data as Member) ?? null;
}

export async function getMemberByQrToken(token: string): Promise<Member | null> {
  const { data, error } = await supabase
    .from("members")
    .select("*")
    .eq("qr_token", token.trim())
    .maybeSingle();
  if (error) {
    logError("getMemberByQrToken", error);
    return null;
  }
  return (data as Member) ?? null;
}

/** Next sequential member code (M001, M002, …); falls back to M001. */
export async function nextMemberCode(): Promise<string> {
  const members = await listMembers();
  if (members.length === 0) return "M001";

  const last = members[members.length - 1].member_code;
  const num = parseInt(last.replace(/\D+/g, ""), 10);
  const prefix = last.replace(/\d+$/, "") || "M";
  const width = Math.max(3, String(Number.isNaN(num) ? 1 : num).length);
  return `${prefix}${String((Number.isNaN(num) ? 0 : num) + 1).padStart(width, "0")}`;
}

export interface MemberInput {
  member_code: string;
  name: string;
}

/**
 * Create a member with a fresh random QR token.
 * Throws (with a Postgres code) so the route can map 23505 → "duplicate code".
 */
export async function createMember(input: MemberInput): Promise<Member> {
  const { data, error } = await supabase
    .from("members")
    .insert({
      member_code: input.member_code.trim(),
      name: input.name.trim(),
      qr_token: generateQrToken(),
      active: true,
    })
    .select()
    .single();

  if (error) throw error;
  return data as Member;
}

export interface MemberPatch {
  name?: string;
  member_code?: string;
  active?: boolean;
}

export async function updateMember(id: string, patch: MemberPatch): Promise<Member> {
  const clean: Record<string, unknown> = {};
  if (patch.name !== undefined) clean.name = patch.name.trim();
  if (patch.member_code !== undefined) clean.member_code = patch.member_code.trim();
  if (patch.active !== undefined) clean.active = patch.active;

  const { data, error } = await supabase
    .from("members")
    .update(clean)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Member;
}

/** New random token — the previous QR stops working immediately. */
export async function regenerateMemberToken(id: string): Promise<Member> {
  const { data, error } = await supabase
    .from("members")
    .update({ qr_token: generateQrToken() })
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Member;
}

/**
 * Delete a member. The FK is ON DELETE RESTRICT, so a member with attendance
 * history cannot be removed (callers should suggest deactivating instead).
 */
export async function deleteMember(id: string): Promise<void> {
  const { error } = await supabase.from("members").delete().eq("id", id);
  if (error) throw error;
}


/* ══════════════════════════════════════════════════════════════════════════
 * MEETINGS
 * ══════════════════════════════════════════════════════════════════════════ */

export async function listMeetings(): Promise<Meeting[]> {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .order("meeting_date", { ascending: false })
    .order("created_at", { ascending: false });

  if (error) {
    logError("listMeetings", error);
    return [];
  }
  return (data ?? []) as Meeting[];
}

/**
 * The current meeting: the most recently dated row with status 'active'.
 * Uses limit(1) (not maybeSingle) so several stale 'active' rows can never
 * break the check-in flow.
 */
export async function getActiveMeeting(): Promise<Meeting | null> {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("status", "active")
    .order("meeting_date", { ascending: false })
    .order("created_at", { ascending: false })
    .limit(1);

  if (error) {
    logError("getActiveMeeting", error);
    return null;
  }
  return ((data ?? [])[0] as Meeting) ?? null;
}

export async function getMeetingById(id: string): Promise<Meeting | null> {
  const { data, error } = await supabase
    .from("meetings")
    .select("*")
    .eq("id", id)
    .maybeSingle();

  if (error) {
    logError("getMeetingById", error);
    return null;
  }
  return (data as Meeting) ?? null;
}

export interface MeetingInput {
  title: string;
  meeting_date: string;
  start_time?: string | null;
  end_time?: string | null;
  status?: MeetingStatus;
}

export async function createMeeting(input: MeetingInput): Promise<Meeting> {
  const { data, error } = await supabase
    .from("meetings")
    .insert({
      title: input.title.trim(),
      meeting_date: input.meeting_date,
      start_time: input.start_time || null,
      end_time: input.end_time || null,
      status: input.status ?? "scheduled",
    })
    .select()
    .single();

  if (error) throw error;
  return data as Meeting;
}

export async function updateMeeting(
  id: string,
  patch: Partial<MeetingInput>
): Promise<Meeting> {
  const clean: Record<string, unknown> = {};
  if (patch.title !== undefined) clean.title = patch.title.trim();
  if (patch.meeting_date !== undefined) clean.meeting_date = patch.meeting_date;
  if (patch.start_time !== undefined) clean.start_time = patch.start_time || null;
  if (patch.end_time !== undefined) clean.end_time = patch.end_time || null;
  if (patch.status !== undefined) clean.status = patch.status;

  const { data, error } = await supabase
    .from("meetings")
    .update(clean)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as Meeting;
}

/**
 * Open attendance for one meeting: closes every other 'active' meeting first so
 * there is only ever one open session at a time.
 */
export async function openMeeting(id: string): Promise<Meeting> {
  const { error: closeError } = await supabase
    .from("meetings")
    .update({ status: "closed" })
    .eq("status", "active")
    .neq("id", id);

  if (closeError) throw closeError;
  return updateMeeting(id, { status: "active" });
}

export async function closeMeeting(id: string): Promise<Meeting> {
  return updateMeeting(id, { status: "closed" });
}

export async function deleteMeeting(id: string): Promise<void> {
  // attendance rows cascade with the meeting.
  const { error } = await supabase.from("meetings").delete().eq("id", id);
  if (error) throw error;
}


/* ══════════════════════════════════════════════════════════════════════════
 * ATTENDANCE — the check-in flow
 * ══════════════════════════════════════════════════════════════════════════ */

export interface CheckInResult extends CheckInOutcome {
  /**
   * true when the database could not answer (migration not applied, transient
   * failure). The route maps this to 503 + a generic Arabic message.
   */
  infrastructureError?: boolean;
}

const CHECK_IN_STATUSES: CheckInStatus[] = [
  "success",
  "already_recorded",
  "invalid_token",
  "inactive_member",
  "no_active_meeting",
];

/** Map the jsonb returned by check_in_with_token() onto CheckInOutcome. */
function normaliseRpcOutcome(raw: unknown): CheckInOutcome | null {
  if (!raw || typeof raw !== "object") return null;
  const obj = raw as Record<string, any>;
  const status = obj.status as CheckInStatus;
  if (!CHECK_IN_STATUSES.includes(status)) return null;

  return {
    status,
    member: obj.member ?? undefined,
    meeting: obj.meeting ?? undefined,
    check_in_time: obj.check_in_time ?? null,
  };
}

/**
 * Fallback used only when the migration's function is missing but the tables
 * exist (e.g. the tables were created by hand). Same guarantees: the
 * UNIQUE(meeting_id, member_id) constraint decides, never the frontend.
 */
async function checkInViaTables(token: string): Promise<CheckInResult> {
  const member = await getMemberByQrToken(token);
  if (!member) return { status: "invalid_token" };

  const who = { name: member.name, member_code: member.member_code };
  if (!member.active) return { status: "inactive_member", member: who };

  const meeting = await getActiveMeeting();
  if (!meeting) return { status: "no_active_meeting", member: who };

  const meetingInfo = {
    id: meeting.id,
    title: meeting.title,
    meeting_date: meeting.meeting_date,
  };

  const { data, error } = await supabase
    .from("attendance")
    .insert({ meeting_id: meeting.id, member_id: member.id })
    .select()
    .single();

  if (!error) {
    return {
      status: "success",
      member: who,
      meeting: meetingInfo,
      check_in_time: (data as AttendanceRecord).check_in_time,
    };
  }

  // 23505 = unique violation → someone scanned the same QR first.
  if (error.code === "23505" || /duplicate key|unique/i.test(error.message)) {
    const { data: existing } = await supabase
      .from("attendance")
      .select("check_in_time")
      .eq("meeting_id", meeting.id)
      .eq("member_id", member.id)
      .maybeSingle();

    return {
      status: "already_recorded",
      member: who,
      meeting: meetingInfo,
      check_in_time: existing?.check_in_time ?? null,
    };
  }

  logError("checkInViaTables", error);
  return { status: "invalid_token", infrastructureError: true };
}

/**
 * Record attendance from a scanned QR token — the whole flow in one call:
 * identify member → validate → find current meeting → insert (once) → report.
 *
 * Safe to call twice: the second call returns "already_recorded" and creates
 * nothing, even if two phones scan the same QR at the same instant.
 */
export async function checkIn(rawToken: string): Promise<CheckInResult> {
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!isPlausibleQrToken(token)) return { status: "invalid_token" };

  const { data, error } = await supabase.rpc("check_in_with_token", {
    p_token: token,
  });

  if (!error) {
    const outcome = normaliseRpcOutcome(data);
    if (outcome) return outcome;
    logError("checkIn/unexpected-payload", data);
    return { status: "invalid_token", infrastructureError: true };
  }

  // Function missing → tables-only deployment: use the fallback path.
  if (error.code === "PGRST202") {
    return checkInViaTables(token);
  }

  if (isMissingSchemaError(error)) {
    logError("checkIn/missing-schema", error);
    return { status: "invalid_token", infrastructureError: true };
  }

  logError("checkIn", error);
  return { status: "invalid_token", infrastructureError: true };
}

/* ══════════════════════════════════════════════════════════════════════════
 * IDENTIFICATION (read-only)
 * ══════════════════════════════════════════════════════════════════════════ */

export interface MemberIdentification {
  status: "found" | "invalid_token" | "inactive_member";
  member?: { name: string; member_code: string };
  /** The currently open meeting, or null when none is open. */
  meeting: { id: string; title: string; meeting_date: string } | null;
  /** Whether the member is already checked in to the open meeting. */
  checked_in: boolean;
  check_in_time: string | null;
  infrastructureError?: boolean;
}

/**
 * Resolve a QR token to a member WITHOUT recording anything.
 *
 * This is the only operation an unauthenticated scan may perform: identify.
 * The QR is identity, never permission — recording attendance lives
 * exclusively in the staff-only route (POST /api/attendance/checkin →
 * requireStaff → checkIn()).
 */
export async function identifyByQrToken(rawToken: string): Promise<MemberIdentification> {
  const token = typeof rawToken === "string" ? rawToken.trim() : "";
  if (!isPlausibleQrToken(token)) {
    return { status: "invalid_token", meeting: null, checked_in: false, check_in_time: null };
  }

  const member = await getMemberByQrToken(token);
  if (!member) {
    return { status: "invalid_token", meeting: null, checked_in: false, check_in_time: null };
  }

  const who = { name: member.name, member_code: member.member_code };
  if (!member.active) {
    return {
      status: "inactive_member",
      member: who,
      meeting: null,
      checked_in: false,
      check_in_time: null,
    };
  }

  const meeting = await getActiveMeeting();
  if (!meeting) {
    return { status: "found", member: who, meeting: null, checked_in: false, check_in_time: null };
  }

  const { data, error } = await supabase
    .from("attendance")
    .select("check_in_time")
    .eq("meeting_id", meeting.id)
    .eq("member_id", member.id)
    .maybeSingle();

  if (error) {
    logError("identifyByQrToken", error);
    return {
      status: "found",
      member: who,
      meeting: { id: meeting.id, title: meeting.title, meeting_date: meeting.meeting_date },
      checked_in: false,
      check_in_time: null,
      infrastructureError: true,
    };
  }

  return {
    status: "found",
    member: who,
    meeting: { id: meeting.id, title: meeting.title, meeting_date: meeting.meeting_date },
    checked_in: Boolean(data?.check_in_time),
    check_in_time: data?.check_in_time ?? null,
  };
}

/** Raw attendance rows for a meeting (who checked in, newest first). */
export async function attendanceForMeeting(
  meetingId: string
): Promise<AttendanceRecord[]> {
  const { data, error } = await supabase
    .from("attendance")
    .select("*")
    .eq("meeting_id", meetingId)
    .order("check_in_time", { ascending: false });

  if (error) {
    logError("attendanceForMeeting", error);
    return [];
  }
  return (data ?? []) as AttendanceRecord[];
}


/* ══════════════════════════════════════════════════════════════════════════
 * REPORTS
 * ══════════════════════════════════════════════════════════════════════════ */

/**
 * Full report for one meeting: every member with their check-in time.
 *
 * "Expected" members are the active ones. An inactive member who already has a
 * record for this meeting is still listed (flagged `active: false`) so the
 * numbers always match what the database holds.
 */
export async function meetingReport(meetingId: string): Promise<MeetingMemberRow[]> {
  const [members, attendance] = await Promise.all([
    listMembers(),
    attendanceForMeeting(meetingId),
  ]);

  const checkIn = new Map<string, string>();
  attendance.forEach((a) => checkIn.set(a.member_id, a.check_in_time));

  return members
    .filter((m) => m.active || checkIn.has(m.id))
    .map((m) => {
      const time = checkIn.get(m.id) ?? null;
      return {
        member_id: m.id,
        name: m.name,
        member_code: m.member_code,
        active: m.active,
        check_in_time: time,
        present: time !== null,
      };
    });
}

export function statsFromReport(report: MeetingMemberRow[]): MeetingStats {
  const expected = report.filter((r) => r.active);
  const totalMembers = expected.length;
  const present = expected.filter((r) => r.present).length;
  const absent = totalMembers - present;
  const attendanceRate =
    totalMembers > 0 ? Math.round((present / totalMembers) * 1000) / 10 : 0;
  return { totalMembers, present, absent, attendanceRate };
}

export async function meetingStats(meetingId: string): Promise<MeetingStats> {
  return statsFromReport(await meetingReport(meetingId));
}

/** Meetings list enriched with present/absent counts (for /meetings & /reports). */
export async function meetingSummaries(): Promise<MeetingSummary[]> {
  const meetings = await listMeetings();
  if (meetings.length === 0) return [];

  const [members, attendance] = await Promise.all([
    listMembers(),
    supabase
      .from("attendance")
      .select("meeting_id, member_id")
      .in(
        "meeting_id",
        meetings.map((m) => m.id)
      )
      .then(({ data, error }) => {
        if (error) {
          logError("meetingSummaries/attendance", error);
          return [] as { meeting_id: string; member_id: string }[];
        }
        return (data ?? []) as { meeting_id: string; member_id: string }[];
      }),
  ]);

  const total = members.filter((m) => m.active).length;
  const perMeeting = new Map<string, number>();
  attendance.forEach((a) =>
    perMeeting.set(a.meeting_id, (perMeeting.get(a.meeting_id) ?? 0) + 1)
  );

  return meetings.map((m) => {
    const present = perMeeting.get(m.id) ?? 0;
    const absent = Math.max(total - present, 0);
    return {
      ...m,
      present,
      absent,
      rate: total > 0 ? Math.round((present / total) * 1000) / 10 : 0,
    };
  });
}

/**
 * A member's attendance history.
 *
 * "Expected" = meetings that were actually held (status 'active' or 'closed')
 * on/after the member was created — i.e. meetings they could have attended.
 * Cancelled/never-started 'scheduled' meetings are excluded, so the rate is not
 * diluted by meetings that have not happened yet.
 */
export async function memberHistory(memberId: string): Promise<MemberHistory> {
  const member = await getMemberById(memberId);
  if (!member) {
    return { member: null, rows: [], attended: 0, missed: 0, expected: 0, rate: 0 };
  }

  const [meetings, attendance] = await Promise.all([
    listMeetings(),
    supabase
      .from("attendance")
      .select("meeting_id, check_in_time")
      .eq("member_id", memberId)
      .then(({ data, error }) => {
        if (error) {
          logError("memberHistory/attendance", error);
          return [] as { meeting_id: string; check_in_time: string }[];
        }
        return (data ?? []) as { meeting_id: string; check_in_time: string }[];
      }),
  ]);

  const checkIn = new Map<string, string>();
  attendance.forEach((a) => checkIn.set(a.meeting_id, a.check_in_time));

  const memberSince = member.created_at.slice(0, 10);
  const rows: MemberHistoryRow[] = meetings
    .filter((m) => m.status !== "scheduled" && m.meeting_date >= memberSince)
    .map((m) => {
      const time = checkIn.get(m.id) ?? null;
      return {
        meeting_id: m.id,
        title: m.title,
        meeting_date: m.meeting_date,
        status: m.status,
        check_in_time: time,
        present: time !== null,
      };
    });

  const expected = rows.length;
  const attended = rows.filter((r) => r.present).length;
  const missed = expected - attended;

  return {
    member,
    rows,
    attended,
    missed,
    expected,
    rate: expected > 0 ? Math.round((attended / expected) * 1000) / 10 : 0,
  };
}

export interface RangeReport {
  meetings: Array<Meeting & { stats: MeetingStats }>;
  totals: MeetingStats;
}

/**
 * Report for a date range (inclusive, ISO "YYYY-MM-DD"). Meetings are matched
 * on meeting_date; every member's attendance is resolved per meeting.
 */
export async function rangeReport(from: string, to: string): Promise<RangeReport> {
  const meetings = (await listMeetings()).filter(
    (m) => m.meeting_date >= from && m.meeting_date <= to
  );

  const withStats: Array<Meeting & { stats: MeetingStats }> = [];
  let present = 0;
  let totalMembers = 0;

  for (const meeting of meetings) {
    const stats = await meetingStats(meeting.id);
    withStats.push({ ...meeting, stats });
    present += stats.present;
    totalMembers += stats.totalMembers;
  }

  const absent = Math.max(totalMembers - present, 0);
  return {
    meetings: withStats,
    totals: {
      totalMembers,
      present,
      absent,
      attendanceRate:
        totalMembers > 0 ? Math.round((present / totalMembers) * 1000) / 10 : 0,
    },
  };
}

