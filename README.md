# Devx Interns Platform

A storefront where **approved companies sign in and browse vetted interns**, plus self-service portals for the students themselves and for partner orgs (bootcamps/colleges) who onboard them. Candidate data is mirrored one-way from the Airtable **Local Talent** table (the intern subset, flagged by `Intern Year`). Companies are read-only; the only writes back to Airtable come from students editing their own profile.

## Stack
- **Next.js 14** (App Router) + **Tailwind CSS**
- **Supabase** — Postgres (with RLS), Auth (Google OAuth + email magic link), Storage (resumes + photos)
- **Airtable** REST API as the source of truth (read-only sync + a narrow student write-back)
- **Resend** for transactional email (signup/approval notifications, partner invites)
- Deployed on **Vercel**; Vercel Cron drives the sync

## The four portals

Every request runs through `src/middleware.ts`, which refreshes the Supabase session and gates by path prefix. Each portal has its own allowlist table and its own public entry points; the server (RLS + `requireAdmin()`) is the authoritative gate, with middleware as a fast first line of defense.

| Portal | Paths | Gate | Unapproved → |
|--------|-------|------|--------------|
| **Company** (default) | `/interns`, `/interns/[id]` | `company_users.approved` | `/pending` |
| **Admin** | `/admin/*` | `company_users.role = 'admin'` | `/interns` |
| **Partners** | `/partners/*` | `partner_users.approved` | `/partners/pending` |
| **Student** | `/student/*` | signed-in email matches an `interns` row | `/student/pending` |

- **Auth:** Supabase Auth — Google OAuth or email magic link. Both land on `/auth/callback`, which exchanges the code for a session.
- **Self-serve signup:** `/signup` (account-type chooser) → company or student signup. Company signups create a **pending** `company_users` row and email an admin; student signups create a Local Talent record in Airtable and materialize the Supabase row so the student can sign in immediately.
- **Admin portal** (`/admin`): review queue for candidates (approve/deny → `review_status`), company/user management, and sync visibility. Companies only ever see `approved` interns.
- **Partners portal** (`/partners`): bootcamp/college staff upload a student roster and send **invite links** (`/invite/[token]`) that create each student's Local Talent record; a funnel tracks uploaded → invited → clicked → completed.

## How it works
- **Browse:** `/interns` is a filterable grid (search, tech, cohort, school, location). Clicking a card opens a **right-side slideout** at `/interns/[id]` (Next.js parallel + intercepting routes); a direct load of that URL renders the full page.
- **Resumes & photos:** resumes live in a **private** Storage bucket, served only via short-lived signed URLs from route handlers that re-check authorization. Profile images live in a public bucket.
- **Student write-back:** a student editing their profile writes **Supabase first** (live to companies at once), then mirrors to Airtable via a write-scoped token. An Airtable failure is non-fatal — the next sync reconciles.
- **Sync (three tiers, kept light — never scans the full base):**
  - `GET /api/sync/hourly` — interns touched in the last ~2h (skips unchanged rows).
  - `GET /api/sync/daily` — interns modified in the last ~25h (reconcile edits, re-host attachments).
  - `GET /api/sync/backfill` — no time window; re-syncs every current intern (populates newly-added columns).
  - Windowed tiers filter on `AND({Intern Year}, IS_AFTER({Last Modified}, …))` and request only the mapped fields. Sync also prunes interns whose `Intern Year` was cleared. Scheduled by `vercel.json` crons.

## Setup
1. **Install:** `npm install`
2. **Env:** copy `.env.example` → `.env.local` and fill in Supabase + Airtable values. For email/invites also set `RESEND_API_KEY` (+ `PARTNERS_FROM_EMAIL`, `ADMIN_NOTIFY_EMAIL`); for student write-back set `AIRTABLE_WRITE_TOKEN`.
3. **Database:** in the Supabase SQL editor, run the `supabase/migrations/*.sql` files in order (`0001` … `0007`), then `supabase/storage.sql`.
4. **Auth providers:** Supabase → Authentication.
   - **Email magic link** works out of the box. Add `${SITE_URL}/auth/callback` under URL Configuration → Redirect URLs.
   - **Google (optional):** Providers → Google, and add the same `${SITE_URL}/auth/callback` redirect.
5. **Approve access:** insert/flip `approved = true` on a `company_users` row (set `role = 'admin'` for the admin portal), or a `partner_users` row for partners. Students need no allowlist row — they're recognized by an email match against a synced `interns` record.
6. **Run:** `npm run dev` → http://localhost:3000

## Sync
- Manual: `npm run sync:hourly` or `npm run sync:daily` (reads `.env.local`).
- Production: Vercel Cron hits the `/api/sync/*` routes. Set `CRON_SECRET` (Vercel sends it as a Bearer token) — the routes reject anything else. `SYNC_SECRET` also works as a `?secret=` for manual curl.

## Two boundaries to respect
- **Privacy boundary:** `src/lib/airtable.ts` is the **only** place that decides what leaves Airtable. The `FIELD` map + `mapRecord()` define exactly which columns sync — edit there to expose more or less.
- **Read vs. write token:** `AIRTABLE_TOKEN` is read-only (sync). `AIRTABLE_WRITE_TOKEN` is a separate write-scoped PAT used *only* by the student write-back paths, so the write path is the one thing that can mutate Airtable.

See `CLAUDE.md` for the fuller architecture notes and `docs/*_CONTEXT.md` for per-portal build briefs.

## Project map
```
src/
  middleware.ts                 auth + per-portal approval gate
  app/
    login, pending              company auth screens
    signup/                     account-type chooser + company/student signup
    auth/callback, signout      OAuth handlers
    interns/                    company storefront: grid + @slideout slot
      [id]/resume/route.ts      signed resume redirect
    admin/                      review queue, companies, users, sync
    partners/                   staff signup, roster upload, invites, funnel
    student/                    student login + self-service profile editor
    invite/[token]/             public invite landing (creates Local Talent record)
    api/sync/[mode]/route.ts    cron sync endpoint (hourly | daily | backfill)
  components/                   storefront, admin/, partners/, student/, ui
  lib/
    airtable.ts                 field map + read fetch (privacy boundary)
    airtable-write.ts           record creation for signups/invites
    sync.ts                     three-tier sync engine
    interns.ts                  intern data access + signed URLs
    admin.ts / partners.ts      admin- and partner-scoped data access
    email.ts                    Resend transactional email
    rate-limit.ts               in-memory guard for public endpoints
    supabase/                   server / client / admin clients
supabase/                       SQL migrations + storage setup
scripts/sync.ts                 manual sync runner
```
