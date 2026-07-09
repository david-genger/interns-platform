-- Company signup capture + candidate review — v1
--
-- Two additions layered on the existing model:
--
--   1. Self-serve COMPANY signup. Until now a company_users row was only ever
--      created by hand in Supabase, so a visitor who signed in with Google left
--      no record to approve. The new /signup/company form creates a pending
--      company_users row and captures the contact details it collects
--      (full name, phone, and whether they've worked with Devx before).
--
--   2. A candidate (intern) REVIEW gate. Every intern now carries a
--      `review_status`; companies only ever see rows that are 'approved'. The
--      admin Candidates page walks pending → approved / denied. Because the
--      sync upsert never lists these columns, a review decision is PRESERVED
--      across every hourly / daily / backfill sync (Postgres only touches the
--      columns named in the upsert payload). New interns arrive as 'pending';
--      denials stay visible in the admin Denied filter.
--
-- No migration runner — paste into the Supabase SQL editor after 0005.
-- NOTE: per the rollout decision, ALL existing interns become 'pending' (hidden
-- from companies) until reviewed. Approve them from admin → Candidates.

-- ------------------------------------------------------------------
-- 1. Company signup contact fields
-- ------------------------------------------------------------------
alter table public.company_users
  add column if not exists full_name         text,
  add column if not exists phone             text,
  add column if not exists worked_with_devx  boolean not null default false;

-- ------------------------------------------------------------------
-- 2. Candidate review workflow on interns
-- ------------------------------------------------------------------
alter table public.interns
  add column if not exists review_status text not null default 'pending',
  add column if not exists reviewed_at   timestamptz,
  add column if not exists reviewed_by   text,
  add column if not exists review_note   text;

do $$ begin
  alter table public.interns
    add constraint interns_review_status_chk
    check (review_status in ('pending', 'approved', 'denied'));
exception when duplicate_object then null; end $$;

create index if not exists interns_review_status_idx on public.interns (review_status);

-- ------------------------------------------------------------------
-- 3. Companies only ever read APPROVED candidates.
-- Replaces the 0001 policy with the same approval check AND a review gate.
-- The separate "student reads own row" policy (0003) is unchanged, so a student
-- still sees their own record regardless of review_status, and the admin
-- Candidates page reads every row through the service-role client (bypasses RLS).
-- ------------------------------------------------------------------
drop policy if exists "approved can read interns" on public.interns;
create policy "approved can read interns"
  on public.interns for select
  to authenticated
  using (public.is_approved_user() and review_status = 'approved');
