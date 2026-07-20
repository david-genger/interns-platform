-- Canonical school link + phone dedupe — v1
--
-- Two foundations for the unified student intake:
--
--   1. `interns.partner_id` — the durable link from a candidate to the bootcamp
--      / college that referred them, pointing at the SAME `partners` list the
--      partners portal and admin console use. Name strings drift; an FK doesn't.
--      Set at signup (from the school dropdown) and backfilled below by matching
--      the existing free-text `educational_institution` against partner names.
--      `on delete set null` so removing an org never deletes candidates.
--
--   2. `interns.phone_normalized` — a digits-only copy of `phone`, written by
--      the app AND by every sync (mapRecord fills it), so it's always consistent
--      regardless of who wrote the row. Indexed for O(1) lookups. NOTE: signup
--      auto-merge is EMAIL-ONLY (a phone match must never merge — it would let a
--      signup carrying someone else's number overwrite their record); this column
--      is for consistent storage and admin-side duplicate checks. The one-time
--      backfill here is a rough strip; the next `backfill` sync re-normalizes
--      every row through the app's normalizePhone().
--
--   3. `partner_students.completed_via` — records HOW a roster student landed:
--      via their own invite link ('invite') or by signing up directly and being
--      matched on email/phone ('direct'). Both count as completed in the funnel;
--      this just tells staff whether the invite emails are doing the work.
--
-- No migration runner — paste into the Supabase SQL editor after 0007.

-- ------------------------------------------------------------------
-- 1. Canonical school link on interns
-- ------------------------------------------------------------------
alter table public.interns
  add column if not exists partner_id uuid references public.partners(id) on delete set null;

create index if not exists interns_partner_id_idx on public.interns (partner_id);

-- Backfill: attach existing candidates to a partner when their free-text school
-- matches a partner name exactly (case-insensitive). Ambiguous / unmatched rows
-- are left null and can be attached from the admin console later.
update public.interns i
set partner_id = p.id
from public.partners p
where i.partner_id is null
  and i.educational_institution is not null
  and lower(trim(i.educational_institution)) = lower(trim(p.name));

-- ------------------------------------------------------------------
-- 2. Phone dedupe key
-- ------------------------------------------------------------------
alter table public.interns
  add column if not exists phone_normalized text;

-- Rough one-time backfill (digits only). The next backfill sync overwrites this
-- with the app's canonical normalization (which also drops a US country code).
update public.interns
set phone_normalized = regexp_replace(coalesce(phone, ''), '[^0-9]', '', 'g')
where phone_normalized is null;

-- Partial index: only non-empty keys participate in dedupe lookups, so blank
-- phones never match each other.
create index if not exists interns_phone_normalized_idx
  on public.interns (phone_normalized)
  where phone_normalized <> '';

-- ------------------------------------------------------------------
-- 3. Roster completion attribution
-- ------------------------------------------------------------------
alter table public.partner_students
  add column if not exists completed_via text;

do $$ begin
  alter table public.partner_students
    add constraint partner_students_completed_via_chk
    check (completed_via in ('invite', 'direct'));
exception when duplicate_object then null; end $$;

-- Global email index so a direct signup can be cross-linked to ANY partner's
-- roster row (the existing unique index is per-partner, lower(email)).
create index if not exists partner_students_email_idx
  on public.partner_students (lower(email));
