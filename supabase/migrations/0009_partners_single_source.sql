-- Partners as the single source of truth for schools — no fragile side-sync.
--
-- The goal: a school and its partner org are ONE and the same. Any code that
-- records a school (the Airtable sync, direct signup, invite) resolves-or-creates
-- the partner in the SAME write, so the partners list is always complete by
-- construction — never dependent on a separate reconciling job.
--
-- This installs:
--   1. A case-insensitive unique index on partner name (so a school can't exist
--      twice) — the conflict target the resolver relies on.
--   2. `resolve_partner(name)` — atomic get-or-create returning the partner id.
--      Race-safe via ON CONFLICT, so concurrent syncs/signups never duplicate.
--   3. A one-time seed of every existing candidate school into partners + link,
--      so today's data is complete immediately (going forward the resolver keeps
--      it complete on every write).
--
-- SAFE + IDEMPOTENT. Nothing is deleted or renamed. No migration runner — paste
-- into the Supabase SQL editor after 0008.
--
-- PRECONDITION: the unique index fails if two existing partners have names that
-- differ only by case/whitespace. With a handful of partners this is fine; if it
-- errors, merge the duplicates first, then re-run.

-- ------------------------------------------------------------------
-- 1. One partner per name (case-insensitive).
-- ------------------------------------------------------------------
create unique index if not exists partners_name_lower_key
  on public.partners (lower(trim(name)));

-- ------------------------------------------------------------------
-- 2. Atomic get-or-create. Returns null for a blank name.
-- ------------------------------------------------------------------
create or replace function public.resolve_partner(p_name text)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_clean text := nullif(trim(p_name), '');
  v_id    uuid;
begin
  if v_clean is null then
    return null;
  end if;

  select id into v_id
  from public.partners
  where lower(trim(name)) = lower(v_clean)
  limit 1;
  if v_id is not null then
    return v_id;
  end if;

  insert into public.partners (name)
  values (v_clean)
  on conflict (lower(trim(name))) do nothing
  returning id into v_id;

  -- Lost the race to a concurrent insert — re-read the winner's row.
  if v_id is null then
    select id into v_id
    from public.partners
    where lower(trim(name)) = lower(v_clean)
    limit 1;
  end if;

  return v_id;
end;
$$;

-- ------------------------------------------------------------------
-- 3. Seed today's schools + link candidates (one-time; resolver keeps it
--    current from here on).
-- ------------------------------------------------------------------
insert into public.partners (name)
select distinct on (lower(trim(i.educational_institution)))
       trim(i.educational_institution)
from public.interns i
where nullif(trim(i.educational_institution), '') is not null
  and not exists (
    select 1 from public.partners p
    where lower(trim(p.name)) = lower(trim(i.educational_institution))
  )
order by lower(trim(i.educational_institution));

update public.interns i
set partner_id = p.id
from public.partners p
where i.partner_id is null
  and nullif(trim(i.educational_institution), '') is not null
  and lower(trim(i.educational_institution)) = lower(trim(p.name));
