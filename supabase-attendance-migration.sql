-- =============================================================================
-- e3dady.ccen — QR Code Attendance System
-- =============================================================================
-- HOW TO APPLY
--   Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--   The file is idempotent: running it twice is safe.
--
-- WHAT IT CREATES
--   Tables      : members, meetings, attendance
--   Constraints : members.member_code UNIQUE, members.qr_token UNIQUE,
--                 attendance UNIQUE(meeting_id, member_id)  ← anti double-scan
--   Foreign keys: attendance.meeting_id → meetings.id  (ON DELETE CASCADE)
--                 attendance.member_id  → members.id   (ON DELETE RESTRICT,
--                 so a member with history cannot be deleted by accident)
--   Indexes     : token lookup, active meeting lookup, date range, attendance
--                 per meeting / per member
--   Trigger     : members.updated_at refreshed on UPDATE
--   Function    : public.check_in_with_token(text) — SECURITY DEFINER, the only
--                 thing a public/publishable key is allowed to execute. It does
--                 the whole check-in in ONE round trip and is race-safe.
--   RLS         : enabled on all three tables. No policies are created for
--                 `anon`, so the public key can read nothing; the app talks to
--                 Supabase through server-side routes with the secret key
--                 (see "SECURITY" below) and bypasses RLS by design.
--
-- SECURITY
--   This project keeps its Supabase key in NEXT_PUBLIC_SUPABASE_ANON_KEY but the
--   value is a *secret* key (sb_secret_…) and it is only ever imported by server
--   code (src/lib/supabase.ts → API routes). It must never be shipped to the
--   browser. If you ever replace it with a publishable key (sb_publishable_…),
--   the admin APIs stop working — move the secret to a server-only env var
--   (e.g. SUPABASE_SECRET_KEY) first and create dedicated policies.
--
-- VERIFY AFTER RUNNING
--   select 'members' as t, count(*) from public.members
--   union all select 'meetings',  count(*) from public.meetings
--   union all select 'attendance',count(*) from public.attendance;
-- =============================================================================

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- members — one row per person who owns a QR code
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.members (
  id          uuid        primary key default gen_random_uuid(),
  -- Human-readable identifier shown on the printed card, e.g. "M001".
  member_code text        not null unique,
  -- Display name (Arabic or Latin).
  name        text        not null,
  -- Cryptographically random token that goes inside the QR code. Never the
  -- name, never the member_code — the token is the only thing the QR carries.
  qr_token    text        not null unique,
  -- Soft delete: deactivating keeps the whole attendance history intact.
  active      boolean     not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint members_member_code_not_blank check (length(btrim(member_code)) > 0),
  constraint members_name_not_blank        check (length(btrim(name)) > 0),
  constraint members_qr_token_length       check (length(qr_token) >= 16)
);

create index if not exists idx_members_qr_token    on public.members (qr_token);
create index if not exists idx_members_active_code on public.members (active, member_code);

-- ─────────────────────────────────────────────────────────────────────────────
-- meetings — one row per meeting session (no table per meeting!)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.meetings (
  id           uuid        primary key default gen_random_uuid(),
  title        text        not null,
  meeting_date date        not null,
  start_time   time,
  end_time     time,
  status       text        not null default 'scheduled'
                           check (status in ('scheduled', 'active', 'closed')),
  created_at   timestamptz not null default now(),
  constraint meetings_title_not_blank check (length(btrim(title)) > 0)
);

create index if not exists idx_meetings_status on public.meetings (status);
create index if not exists idx_meetings_date   on public.meetings (meeting_date desc);
-- Used to pick the single "current" meeting quickly.
create index if not exists idx_meetings_active_pick
  on public.meetings (status, meeting_date desc, created_at desc);


-- ─────────────────────────────────────────────────────────────────────────────
-- attendance — one row per (meeting, member)
-- ─────────────────────────────────────────────────────────────────────────────
create table if not exists public.attendance (
  id            uuid        primary key default gen_random_uuid(),
  meeting_id    uuid        not null references public.meetings (id) on delete cascade,
  member_id     uuid        not null references public.members (id)  on delete restrict,
  check_in_time timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  -- THE anti-duplicate guard: a member can only ever check in once per meeting.
  -- `on conflict (meeting_id, member_id)` in check_in_with_token() infers this
  -- constraint, so it must stay a UNIQUE CONSTRAINT (not a bare index).
  constraint attendance_meeting_member_key unique (meeting_id, member_id)
);

create index if not exists idx_attendance_meeting  on public.attendance (meeting_id);
create index if not exists idx_attendance_member   on public.attendance (member_id);
create index if not exists idx_attendance_check_in on public.attendance (check_in_time desc);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger for members
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists trg_members_updated_at on public.members;
create trigger trg_members_updated_at
  before update on public.members
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- check_in_with_token — the ONLY public entry point of the check-in flow
-- ─────────────────────────────────────────────────────────────────────────────
-- Performs, in a single round trip:
--   1. member lookup by random token        4. insert attendance
--   2. active check                         5. duplicate/race handling
--   3. current active meeting lookup        6. structured result for the UI
-- Returns one of:
--   { status: "success" | "already_recorded" | "invalid_token" |
--             "inactive_member" | "no_active_meeting", … }
-- It never raises, so the UI never sees a raw Postgres error.
-- ─────────────────────────────────────────────────────────────────────────────
create or replace function public.check_in_with_token(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_token   text := btrim(coalesce(p_token, ''));
  v_member  public.members%rowtype;
  v_meeting public.meetings%rowtype;
  v_row     public.attendance%rowtype;
begin
  -- Tokens are long random strings; anything shorter cannot be one.
  if length(v_token) < 16 then
    return jsonb_build_object('status', 'invalid_token');
  end if;

  select * into v_member from public.members where qr_token = v_token limit 1;
  if not found then
    return jsonb_build_object('status', 'invalid_token');
  end if;

  if not v_member.active then
    return jsonb_build_object(
      'status', 'inactive_member',
      'member', jsonb_build_object('name', v_member.name, 'member_code', v_member.member_code)
    );
  end if;

  -- Exactly one meeting should be 'active'; if several are, the most recently
  -- dated one wins instead of erroring out.
  select * into v_meeting
    from public.meetings
   where status = 'active'
   order by meeting_date desc, created_at desc
   limit 1;

  if not found then
    return jsonb_build_object(
      'status', 'no_active_meeting',
      'member', jsonb_build_object('name', v_member.name, 'member_code', v_member.member_code)
    );
  end if;

  -- Race safe: two simultaneous scans of the same QR -> one row, one
  -- "already_recorded". `on conflict do nothing` never raises 23505.
  insert into public.attendance (meeting_id, member_id)
  values (v_meeting.id, v_member.id)
  on conflict (meeting_id, member_id) do nothing
  returning * into v_row;

  if v_row.id is null then
    -- Row already existed → this was a duplicate scan.
    select * into v_row
      from public.attendance
     where meeting_id = v_meeting.id and member_id = v_member.id;

    return jsonb_build_object(
      'status', 'already_recorded',
      'member',  jsonb_build_object('name', v_member.name, 'member_code', v_member.member_code),
      'meeting', jsonb_build_object(
        'id', v_meeting.id,
        'title', v_meeting.title,
        'meeting_date', to_char(v_meeting.meeting_date, 'YYYY-MM-DD')
      ),
      'check_in_time', v_row.check_in_time
    );
  end if;

  return jsonb_build_object(
    'status', 'success',
    'member',  jsonb_build_object('name', v_member.name, 'member_code', v_member.member_code),
    'meeting', jsonb_build_object(
      'id', v_meeting.id,
      'title', v_meeting.title,
      'meeting_date', to_char(v_meeting.meeting_date, 'YYYY-MM-DD')
    ),

    'check_in_time', v_row.check_in_time
  );
end;
$$;

revoke all on function public.check_in_with_token(text) from public;
-- STAFF-ONLY: the RPC is reachable only through the server (service_role).
-- The Next.js layer enforces the admin/servant password (POST
-- /api/attendance/checkin) — the public /api/checkin is identify-only. For
-- existing deployments apply supabase-attendance-lockdown.sql to revoke the
-- anon/authenticated grants made by older versions of this file.
grant execute on function public.check_in_with_token(text) to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security + grants
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.members    enable row level security;
alter table public.meetings   enable row level security;
alter table public.attendance enable row level security;

-- Intentionally NO policies → the publishable/anon role cannot read or write
-- members, meetings or attendance (QR tokens, member names and attendance
-- history must never be reachable with a public key). Server-side routes use
-- the secret key (which bypasses RLS) and the public check-in goes exclusively
-- through check_in_with_token().

grant select, insert, update, delete on public.members    to service_role;
grant select, insert, update, delete on public.meetings   to service_role;
grant select, insert, update, delete on public.attendance to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL demo data — uncomment to smoke-test the flow right after the
-- migration. Safe to skip; delete the rows later from /admin/attendance/members.
-- ─────────────────────────────────────────────────────────────────────────────
-- insert into public.members (member_code, name, qr_token) values
--   ('M001', 'Michael Mansour',
--    'demo0000demo0000demo0000demo0000demo0000demo0000demo0000demo0000demo0000'),
--   ('M002', 'Mina Adel',
--    'demo1111demo1111demo1111demo1111demo1111demo1111demo1111demo1111demo1111')
-- on conflict (member_code) do nothing;
--
-- insert into public.meetings (title, meeting_date, start_time, status)
-- select 'اجتماع الأحد', current_date, '19:00', 'active'
-- where not exists (select 1 from public.meetings);

