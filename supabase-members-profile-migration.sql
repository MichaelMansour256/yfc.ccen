-- =============================================================================
-- yfc.ccen — members: optional phone + date of birth (Excel bulk import)
-- =============================================================================
-- HOW TO APPLY
--   Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--   The file is idempotent: running it twice is safe.
--
-- WHAT IT DOES
--   Adds two NULLABLE columns to public.members:
--     phone          text  — OPTIONAL, never required
--     date_of_birth  date  — OPTIONAL, never required
--
--   Backward compatibility: existing member rows simply keep NULL in both
--   columns. Nothing else changes — member ids, member codes, qr_tokens,
--   meetings and attendance history are untouched, so every QR code, session,
--   dashboard and report keeps working exactly as before. No row-by-row data
--   migration is needed and none is performed.
--
--   The app also works BEFORE this file is applied for name-only operations
--   (it only mentions the new columns when it actually writes a phone/date) —
--   but supply a phone or date of birth anywhere and you get a clear 503
--   pointing at THIS file until you run it.
--
-- VERIFY AFTER RUNNING
--   select column_name, data_type, is_nullable
--     from information_schema.columns
--    where table_schema = 'public'
--      and table_name   = 'members'
--      and column_name in ('phone', 'date_of_birth');
-- =============================================================================

alter table public.members
  add column if not exists phone         text,
  add column if not exists date_of_birth date;

-- phone: when present it must not be blank — the app stores "" as NULL.
-- (Added with drop-then-add because Postgres has no ADD CONSTRAINT IF NOT
--  EXISTS; both statements together are idempotent.)
do $$
begin
  alter table public.members
    drop constraint if exists members_phone_not_blank;
  alter table public.members
    add constraint members_phone_not_blank
    check (phone is null or length(btrim(phone)) > 0);
end $$;

-- date_of_birth: a plausible past date (the API additionally refuses future
-- dates before writing; fixed bounds keep the expression IMMUTABLE, which
-- Postgres requires for CHECK constraints).
do $$
begin
  alter table public.members
    drop constraint if exists members_date_of_birth_sane;
  alter table public.members
    add constraint members_date_of_birth_sane
    check (
      date_of_birth is null
      or (date_of_birth >= date '1900-01-01' and date_of_birth < date '2100-01-01')
    );
end $$;

-- Partial index: duplicate detection / phone search touch only rows that have
-- a phone (tiny table — this is future-proofing, not a requirement).
create index if not exists members_phone_idx
  on public.members (phone)
  where phone is not null;

-- Grants/RLS: nothing to do — the columns live in the already-granted,
-- already-RLS-locked public.members table (supabase-attendance-migration.sql
-- + supabase-attendance-lockdown.sql), and the server writes with the
-- service_role key exactly like every other member field.
