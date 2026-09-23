-- ═════════════════════════════════════════════════════════════════════════════
-- supabase-attendance-lockdown.sql — STAFF-ONLY attendance recording
-- Run this in the Supabase SQL editor on EXISTING deployments.
--
-- ⚠️  PREREQUISITE: add SUPABASE_SERVICE_ROLE_KEY to .env.local / Vercel
--     (Supabase dashboard → Project Settings → API → service_role secret) and
--     redeploy BEFORE running this file. The server-side client
--     (src/lib/supabase.ts) automatically prefers that key; without it the
--     app would lose database access once the public grants below are revoked.
--
-- After this file runs, the ONLY way to record attendance is the Next.js
-- server route POST /api/attendance/checkin, which requires the admin/servant
-- password (x-admin-password) and re-validates it on every request.
--
--   QR token → identifies the student        (never records anything)
--   Admin/servant password → authorizes      (server-side, every request)
--   UNIQUE(meeting_id, member_id) → no duplicates (database level)
-- ═════════════════════════════════════════════════════════════════════════════

-- 1) The check-in RPC can no longer be called with the publishable/anon key
--    (previously granted to anon + authenticated). A student holding their own
--    QR token could otherwise self-check-in straight against Supabase.
revoke execute on function public.check_in_with_token(text) from anon, authenticated;
grant execute on function public.check_in_with_token(text) to service_role;

-- 2) Row Level Security on the attendance tables (idempotent — matches
--    supabase-attendance-migration.sql). No policies are created: with RLS on
--    and no policies, anon/authenticated can neither read nor write, while the
--    server keeps working through the service_role key (RLS bypassed).
alter table public.members    enable row level security;
alter table public.meetings   enable row level security;
alter table public.attendance enable row level security;

-- 3) Remove the default table grants from the public roles (idempotent).
--    NOTE: this is scoped to the attendance tables only; other features that
--    read Supabase (prayer wall, notifications) go through server routes too
--    and keep working with the service_role key.
revoke all on public.members    from anon, authenticated;
revoke all on public.meetings   from anon, authenticated;
revoke all on public.attendance from anon, authenticated;