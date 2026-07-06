-- Student projects + LinkedIn — v1
--
-- Two additions on top of the review gate from 0006:
--
--   1. `interns.linkedin_url` — synced from Airtable's "LinkedIn Profile" field,
--      company-visible on the profile. One-way like every other synced column.
--
--   2. `intern_projects` — a Supabase-ONLY table of live project links a student
--      publishes so companies can see what they've built. Deliberately NOT
--      mirrored to Airtable: it lives here and survives every sync because the
--      sync upsert never names this table. Rows cascade-delete with their intern
--      (e.g. when an intern is pruned because Intern Year was cleared).
--
-- Reads follow the same shape as `interns`: approved company users see projects
-- of APPROVED interns only, and a student sees their own. All writes are
-- service-role only (student edits go through the admin client after an
-- ownership check, exactly like the resume upload route).
--
-- No migration runner — paste into the Supabase SQL editor after 0006.

-- ------------------------------------------------------------------
-- 1. LinkedIn column (synced from Airtable)
-- ------------------------------------------------------------------
alter table public.interns
  add column if not exists linkedin_url text;

-- ------------------------------------------------------------------
-- 2. Published projects (Supabase-only, student-editable via service role)
-- ------------------------------------------------------------------
create table if not exists public.intern_projects (
  id          uuid primary key default gen_random_uuid(),
  intern_id   uuid not null references public.interns(id) on delete cascade,
  url         text not null,
  title       text,
  sort_order  int  not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists intern_projects_intern_idx
  on public.intern_projects (intern_id, sort_order);

alter table public.intern_projects enable row level security;

-- Approved company users read projects of APPROVED interns only. Mirrors the
-- "approved can read interns" gate (0006) one level down via the parent row.
drop policy if exists "approved can read projects" on public.intern_projects;
create policy "approved can read projects"
  on public.intern_projects for select
  to authenticated
  using (
    public.is_approved_user()
    and exists (
      select 1 from public.interns i
      where i.id = intern_projects.intern_id
        and i.review_status = 'approved'
    )
  );

-- A student reads their own projects (parent intern matched by email), mirroring
-- the "student reads own row" policy (0003).
drop policy if exists "student reads own projects" on public.intern_projects;
create policy "student reads own projects"
  on public.intern_projects for select
  to authenticated
  using (
    exists (
      select 1 from public.interns i
      where i.id = intern_projects.intern_id
        and lower(i.email) = lower(auth.jwt() ->> 'email')
    )
  );
