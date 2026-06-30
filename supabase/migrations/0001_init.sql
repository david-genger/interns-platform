-- Interns Platform — initial schema
-- One-way mirror of the Airtable "Local Talent" intern subset, plus the
-- company-access allowlist. Companies only ever read; the sync job (service
-- role) is the only writer to `interns`.

create extension if not exists "pgcrypto";

-- ------------------------------------------------------------------
-- Companies (approved orgs that can browse interns)
-- ------------------------------------------------------------------
create table if not exists public.companies (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  domain      text,
  created_at  timestamptz not null default now()
);

-- ------------------------------------------------------------------
-- Company users — the approval allowlist.
-- A Google login is only allowed in if a matching, approved row exists.
-- Managed by hand in the Supabase table editor for v1 (no admin UI).
-- ------------------------------------------------------------------
create table if not exists public.company_users (
  id          uuid primary key default gen_random_uuid(),
  email       text not null unique,
  company_id  uuid references public.companies(id) on delete set null,
  approved    boolean not null default false,
  role        text not null default 'viewer',  -- 'viewer' | 'admin'
  created_at  timestamptz not null default now()
);

create index if not exists company_users_email_idx on public.company_users (lower(email));

-- ------------------------------------------------------------------
-- Interns — curated mirror of Local Talent (Intern Year is set).
-- ------------------------------------------------------------------
create table if not exists public.interns (
  id                       uuid primary key default gen_random_uuid(),
  airtable_id              text not null unique,
  name                     text,
  first_name               text,
  last_name                text,
  headline                 text,            -- Job title / specialty
  summary                  text,            -- Candidate summary / resume summary
  technologies             text[] not null default '{}',
  tech_categories          text[] not null default '{}',
  experience_level         text,
  intern_year              text,            -- cohort
  expected_graduation      date,
  educational_institution  text,
  institution_type         text,            -- derived: 'college' | 'bootcamp' | null
  location                 text,
  city                     text,
  state                    text,
  country                  text,
  remote_preference        text,
  rating_total             numeric,
  rating_technical         numeric,
  rating_soft              numeric,
  rating_frontend          numeric,
  rating_backend           numeric,
  rating_db                numeric,
  rating_cloud             numeric,
  profile_image_url        text,            -- Supabase Storage public URL
  resume_path              text,            -- Supabase Storage object path (private bucket)
  airtable_modified_at     timestamptz,
  last_synced_at           timestamptz not null default now()
);

create index if not exists interns_intern_year_idx on public.interns (intern_year);
create index if not exists interns_grad_idx on public.interns (expected_graduation);
create index if not exists interns_technologies_idx on public.interns using gin (technologies);

-- ------------------------------------------------------------------
-- Row Level Security
-- ------------------------------------------------------------------
alter table public.interns enable row level security;
alter table public.companies enable row level security;
alter table public.company_users enable row level security;

-- Helper: is the currently authenticated user an approved company user?
create or replace function public.is_approved_user()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.company_users cu
    where lower(cu.email) = lower(auth.jwt() ->> 'email')
      and cu.approved = true
  );
$$;

-- Approved company users can read interns. No insert/update/delete policy
-- exists for them, so the table is read-only to everyone except the service
-- role (which bypasses RLS).
drop policy if exists "approved can read interns" on public.interns;
create policy "approved can read interns"
  on public.interns for select
  to authenticated
  using (public.is_approved_user());

-- A user may read their own company_users row (so the app can check status).
drop policy if exists "read own membership" on public.company_users;
create policy "read own membership"
  on public.company_users for select
  to authenticated
  using (lower(email) = lower(auth.jwt() ->> 'email'));

-- Approved users may read their own company.
drop policy if exists "read own company" on public.companies;
create policy "read own company"
  on public.companies for select
  to authenticated
  using (
    exists (
      select 1 from public.company_users cu
      where cu.company_id = companies.id
        and lower(cu.email) = lower(auth.jwt() ->> 'email')
        and cu.approved = true
    )
  );
