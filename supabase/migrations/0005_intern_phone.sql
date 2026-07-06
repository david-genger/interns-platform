-- Intern phone — v1
-- Adds `interns.phone`, a company-visible contact field mirrored one-way from
-- Airtable (field "Phone", fld08nVIKQMljWY3u) alongside `email` (0003). It's
-- surfaced only on the profile slideout, like email. No new RLS: it rides the
-- existing SELECT policies on `interns` (approved company users + a student's
-- own row), and writes stay service-role only via the sync.
--
-- No migration runner: paste into the Supabase SQL editor after 0004, then run
-- a full backfill sync (admin → Sync → "Backfill all") to populate existing
-- rows whose Airtable record hasn't changed inside the normal sync window.

alter table public.interns add column if not exists phone text;
