-- Student login — v1
-- Adds student self-service on top of the company storefront:
--   1. `interns.email` — synced from Airtable. Company-visible (shown on the
--      profile) AND the match key that lets a student sign in as themselves.
--   2. An RLS policy so a signed-in student can read ONLY their own intern row
--      (they aren't approved company users, so is_approved_user() doesn't cover
--      them). Writes to `interns` stay service-role only — the resume upload
--      route uses the admin client after verifying the caller.
--
-- No migration runner: paste this into the Supabase SQL editor (after 0001 and
-- 0002), then run a daily sync (or one-off backfill) to populate `email`.
--
-- This is the student self-service layer. Students reach the platform however
-- their Local Talent record was created — partner invite (0002_partners),
-- direct Airtable entry, or direct signup — and sign in at /student/login to
-- view their profile and replace their resume. Login is a plain email match on
-- this column; nothing here depends on the partner/invite tables.

-- ------------------------------------------------------------------
-- Email column
-- ------------------------------------------------------------------
alter table public.interns add column if not exists email text;
create index if not exists interns_email_idx on public.interns (lower(email));

-- ------------------------------------------------------------------
-- RLS: a student may read their own intern row.
-- Permissive policies are OR'd with "approved can read interns", so companies
-- keep full read access and a student additionally sees exactly their own row.
-- ------------------------------------------------------------------
drop policy if exists "student reads own row" on public.interns;
create policy "student reads own row"
  on public.interns for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));
