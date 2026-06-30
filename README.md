# Devx Interns Platform

A simple, read-only storefront where **approved companies sign in with Google and browse vetted interns**. Candidate data is mirrored one-way from the Airtable "Applicant tracking system" base (the intern subset of **Local Talent**, flagged by `Intern Year`). Companies never write back.

## Stack
- **Next.js 14** (App Router) + **Tailwind CSS**
- **Supabase** — Postgres, Auth (Google), Storage (resumes + photos)
- **Airtable** REST API as the source of truth (sync only)

## How it works
- **Auth:** Supabase Auth — **Google OAuth** or **email magic link** (Supabase's default OTP). Either way `middleware.ts` gates every page — not signed in → `/login`, signed in but not on the allowlist → `/pending`. Both methods land on `/auth/callback`, which exchanges the code for a session.
- **Approval allowlist:** the `company_users` table. A login is allowed only if a matching row has `approved = true`. Managed by hand in the Supabase table editor (no admin UI in v1).
- **Browse:** `/interns` is a filterable grid (search, skill, cohort, level, college/bootcamp, min rating). Clicking a card opens a **right-side slideout** at `/interns/[id]` (Next.js parallel + intercepting routes); a direct load of that URL renders the full page.
- **Resumes:** stored in a **private** Storage bucket, served via short-lived signed URLs from `/interns/[id]/resume` after re-checking approval.
- **Sync (two tiers, kept light — never scans the full base):**
  - `GET /api/sync/hourly` — interns touched in the last ~2h (new resumes appear fast).
  - `GET /api/sync/daily` — interns modified in the last ~25h (reconcile edits, re-host attachments).
  - Both filter on `AND({Intern Year}, IS_AFTER({Last Modified}, …))` and request only the mapped fields. Scheduled by `vercel.json` crons.

## Setup
1. **Install:** `npm install`
2. **Env:** copy `.env.example` → `.env.local` and fill in Supabase + Airtable values.
3. **Database:** in the Supabase SQL editor, run `supabase/migrations/0001_init.sql` then `supabase/storage.sql`.
4. **Auth providers:** Supabase → Authentication.
   - **Email magic link** works out of the box (no extra config). Add `${SITE_URL}/auth/callback` under URL Configuration → Redirect URLs.
   - **Google (optional):** Providers → Google, and add the same `${SITE_URL}/auth/callback` redirect.
5. **Approve a company:** insert a row into `company_users` with the company's Google email and `approved = true` (optionally link a `companies` row).
6. **Run:** `npm run dev` → http://localhost:3000

## Sync
- Manual: `npm run sync:hourly` or `npm run sync:daily` (reads `.env.local`).
- Production: Vercel Cron hits the `/api/sync/*` routes. Set `CRON_SECRET` (Vercel sends it as a Bearer token) — the routes reject anything else. `SYNC_SECRET` also works as a `?secret=` for manual curl.

## The privacy boundary
`src/lib/airtable.ts` is the **only** place that decides what leaves Airtable. The `FIELD` map + `mapRecord()` define exactly which columns sync. Edit there to expose more or less. `institution_type` (college vs bootcamp) is **derived** from `Educational Institution` in that file.

## Project map
```
src/
  middleware.ts                auth + approval gate
  app/
    login, pending             auth screens
    auth/callback, signout      OAuth handlers
    interns/                    list + slideout (@slideout slot)
      page.tsx                  filterable grid
      [id]/page.tsx             full-page profile
      [id]/resume/route.ts      signed resume redirect
      @slideout/(.)[id]/        intercepted slideout
    api/sync/[mode]/route.ts    cron sync endpoint
  components/                   InternCard, InternProfile, Filters, Slideout, ui
  lib/
    airtable.ts                 field map + fetch (privacy boundary)
    sync.ts                     two-tier sync engine
    interns.ts                  data access + signed resume URLs
    supabase/                   server / client / admin clients
supabase/                       SQL migrations + storage setup
scripts/sync.ts                 manual sync runner
```
