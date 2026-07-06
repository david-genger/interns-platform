-- Security hardening — v1
--   1. Invite tokens gain an expiry so a leaked link stops working.
--   2. Case-insensitive uniqueness on the allowlist emails, matching how the
--      app always lowercases before insert (prevents Bob@x.com vs bob@x.com
--      duplicates created by hand in the Supabase table editor).
--
-- No migration runner: paste into the Supabase SQL editor after 0003.

-- ------------------------------------------------------------------
-- 1. Invite token expiry
-- ------------------------------------------------------------------
-- Existing rows get a NULL expiry (treated as "never expires" by the app, so
-- outstanding invites keep working). New rows default to 30 days out; the app
-- refreshes this whenever an invite is (re)sent.
alter table public.partner_students
  add column if not exists expires_at timestamptz default (now() + interval '30 days');

-- ------------------------------------------------------------------
-- 2. Case-insensitive email uniqueness
-- ------------------------------------------------------------------
-- company_users / partner_users already have a plain unique(email); add a
-- functional unique index on lower(email) so casing can't slip a duplicate in.
-- (If either of these fails, you already have a case-variant duplicate — dedupe
-- it by hand first, then re-run.)
create unique index if not exists company_users_email_lower_uidx
  on public.company_users (lower(email));

create unique index if not exists partner_users_email_lower_uidx
  on public.partner_users (lower(email));
