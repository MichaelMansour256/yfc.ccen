-- =============================================================================
-- e3dady.ccen — Studies & Resources content library
-- =============================================================================
-- HOW TO APPLY
--   Supabase Dashboard → SQL Editor → New query → paste this whole file → Run.
--   The file is idempotent: running it twice is safe.
--
-- WHAT IT CREATES
--   Table   : content_library — one row per Study  (`type = 'study'`)
--                              or per Resource (`type = 'resource'`),
--             rendered by /bible/studies and /bible/resources.
--   Indexes : public listing (published + not archived), bible-reference
--             lookup, related-study lookup
--   Trigger : updated_at refreshed on UPDATE (reuses public.set_updated_at()
--             from supabase-attendance-migration.sql — defined here too, so
--             this file can also be applied on its own)
--   RLS     : enabled. `anon` / `authenticated` may SELECT only rows that are
--             published AND not archived; there is no insert/update/delete
--             policy, so nothing can be written with a public key.
--
-- SECURITY MODEL
--   Reads  : public pages go through GET /api/content (server route, secret key)
--            and additionally filter on published/archived themselves. Even a
--            direct PostgREST call with a publishable key can only ever see
--            published + non-archived rows.
--   Writes : only through /api/admin/content, which requires the
--            x-admin-password header (src/lib/auth.ts → ADMIN_PASSWORD) and
--            then uses the service_role key (bypasses RLS by design).
--
-- STORAGE
--   This table stores METADATA + a link only. The files themselves stay where
--   they already live (Google Drive, Cloudinary, any external host) and are
--   referenced by `url`; `image` optionally holds a cover image URL. No file
--   storage/bucket is created by this migration.
--
-- RELATIONSHIPS ARE OPTIONAL
--   book / chapter / verse / related_study_id are all nullable on purpose:
--   "Bible Reading Guide.pdf" is a perfectly valid row with none of them set.
--
-- VERIFY AFTER RUNNING
--   select type, published, archived, count(*)
--     from public.content_library
--    group by type, published, archived;
-- =============================================================================

create extension if not exists pgcrypto;

-- ─────────────────────────────────────────────────────────────────────────────
-- content_library — studies AND resources in one table
-- ─────────────────────────────────────────────────────────────────────────────
-- One table (not two) because both types share the same shape and the public
-- pages filter by `type`; a resource may additionally point at the study it
-- belongs to (related_study_id), which a single table can enforce with a FK.
create table if not exists public.content_library (
  id                uuid        primary key default gen_random_uuid(),
  -- 'study' = structured teaching material, 'resource' = general useful material
  type              text        not null,
  -- Arabic title is the primary one (the site is Arabic-first), English optional
  title             text        not null,
  title_en          text,
  description       text,
  description_en    text,
  -- The actual content: Google Drive link, PDF, external URL, website page,…
  url               text        not null,
  -- Optional cover/thumbnail (Cloudinary URL or any external https URL)
  image             text,
  -- Free-text grouping. Preset ids (see src/lib/content-library.ts) or anything
  -- a servant types in the admin dashboard — the column stays flexible.
  category          text,
  -- Resources only: pdf | video | audio | presentation | book | link | document | other
  resource_type     text,
  -- Optional Bible relationship (1..66 = BIBLE_BOOKS nr, see src/lib/bibleBooks.ts)
  book              smallint,
  chapter           smallint,
  verse             smallint,
  -- Optional link resource → study. ON DELETE SET NULL keeps the resource alive
  -- (as a standalone item) when the study it referenced is removed.
  related_study_id  uuid        references public.content_library (id) on delete set null,
  published         boolean     not null default false,
  archived          boolean     not null default false,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  constraint content_library_type_valid       check (type in ('study', 'resource')),
  constraint content_library_title_not_blank  check (length(btrim(title)) > 0),
  constraint content_library_url_not_blank    check (length(btrim(url)) > 0),
  constraint content_library_book_range       check (book is null or book between 1 and 66),
  constraint content_library_chapter_positive check (chapter is null or chapter >= 1),
  constraint content_library_verse_positive   check (verse is null or verse >= 1),
  constraint content_library_not_self_related check (related_study_id is null or related_study_id <> id)
);

-- ─────────────────────────────────────────────────────────────────────────────
-- Indexes — the public listing only ever reads published, non-archived rows
-- ─────────────────────────────────────────────────────────────────────────────
create index if not exists idx_content_library_public
  on public.content_library (type, created_at desc)
  where published and not archived;

-- Related content: "everything for Psalms 23"
create index if not exists idx_content_library_reference
  on public.content_library (book, chapter)
  where published and not archived;

create index if not exists idx_content_library_related_study
  on public.content_library (related_study_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- updated_at trigger (same helper the attendance tables use)
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

drop trigger if exists trg_content_library_updated_at on public.content_library;
create trigger trg_content_library_updated_at
  before update on public.content_library
  for each row execute function public.set_updated_at();

-- ─────────────────────────────────────────────────────────────────────────────
-- Row Level Security + grants
-- ─────────────────────────────────────────────────────────────────────────────
alter table public.content_library enable row level security;

-- Visitors may read published content only. Unpublished drafts, archived items
-- and every write operation stay invisible to the publishable/anon key.
drop policy if exists content_library_public_read on public.content_library;
create policy content_library_public_read on public.content_library
  for select
  to anon, authenticated
  using (published and not archived);

-- Deliberately NO insert/update/delete policies: only the service_role
-- (server routes, which bypass RLS) can create, edit, publish or delete.
grant select on public.content_library to anon, authenticated;
grant select, insert, update, delete on public.content_library to service_role;

-- ─────────────────────────────────────────────────────────────────────────────
-- OPTIONAL demo row — uncomment to smoke-test the flow right after applying,
-- then edit/delete it from the admin dashboard (📚 Content tab).
-- ─────────────────────────────────────────────────────────────────────────────
-- insert into public.content_library (type, title, title_en, description, url, category, published)
-- values ('study', 'دراسة سفر التكوين', 'Genesis Study',
--         'دراسة أسبوعية في سفر التكوين', 'https://drive.google.com/', 'bible-studies', true)
-- on conflict do nothing;
