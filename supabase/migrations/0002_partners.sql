-- Partners portal — bootcamp / college staff, their student rosters, and the
-- invite pipeline. Mirrors the company-access model in 0001_init.sql:
--   partners        ~ companies
--   partner_users   ~ company_users (self-serve signup, manual approval)
--   partner_students = the uploaded roster + per-student invite tracking.
--
-- Staff only ever READ their own rows through RLS. Every write (roster upload,
-- invite send, status transitions, Airtable write-back) goes through server
-- routes using the service-role client, which bypasses RLS. No migration
-- runner — paste into the Supabase SQL editor after 0001.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------
-- Partners (approved bootcamps / colleges)
-- ------------------------------------------------------------------
create table if not exists public.partners (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  website     text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Partner users — the staff approval allowlist.
-- Signup creates the partner + a pending (approved=false) row here.
-- David approves by hand in the Supabase table editor for v1.
-- ------------------------------------------------------------------
create table if not exists public.partner_users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  partner_id  uuid references public.partners(id) on delete set null,
  approved    boolean not null default false,
  role        text not null default 'staff',   -- 'staff' | 'admin'
  created_at  timestamptz not null default now()
);

create index if not exists partner_users_email_idx on public.partner_users (lower(email));

-- ------------------------------------------------------------------
-- Partner students — the roster. One row per invited student.
-- status walks: uploaded -> invited -> clicked -> completed.
-- ------------------------------------------------------------------
create table if not exists public.partner_students (
  id            uuid primary key default gen_random_uuid(),
  partner_id    uuid not null references public.partners(id) on delete cascade,
  first_name    text,
  last_name     text,
  email         text not null,
  invite_token  uuid not null unique default gen_random_uuid(),
  status        text not null default 'uploaded',  -- uploaded | invited | clicked | completed
  invited_at    timestamptz,
  clicked_at    timestamptz,
  completed_at  timestamptz,
  airtable_id   text,            -- set after the Local Talent record is created
  created_at    timestamptz not null default now(),
  unique (partner_id, lower(email))
);

create index if not exists partner_students_partner_idx on public.partner_students (partner_id);
create index if not exists partner_students_status_idx on public.partner_students (status);

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------
alter table public.partners enable row level security;
alter table public.partner_users enable row level security;
alter table public.partner_students enable row level security;

-- Helper: is the current user an approved partner staff member?
create or replace function public.is_approved_partner_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.partner_users pu
    where lower(pu.email) = lower(auth.jwt() ->> 'email')
      and pu.approved = true
  );
$$;

-- Helper: the partner_id the current user belongs to (null if none).
create or replace function public.current_partner_id()
returns uuid
language sql
stable
security definer
set search_path = public
as $$
  select pu.partner_id from public.partner_users pu
  where lower(pu.email) = lower(auth.jwt() ->> 'email')
    and pu.approved = true
  limit 1;
$$;

-- A user may read their own partner_users row (so the app can check status).
drop policy if exists "read own partner membership" on public.partner_users;
create policy "read own partner membership"
  on public.partner_users for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Approved staff may read their own partner.
drop policy if exists "read own partner" on public.partners;
create policy "read own partner"
  on public.partners for select
  to authenticated
  using (id = public.current_partner_id());

-- Approved staff may read their own partner's roster. No write policy — the
-- service role owns all writes.
drop policy if exists "read own roster" on public.partner_students;
create policy "read own roster"
  on public.partner_students for select
  to authenticated
  using (partner_id = public.current_partner_id());
