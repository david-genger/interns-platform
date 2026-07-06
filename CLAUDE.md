# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev          # Next.js dev server → http://localhost:3000
npm run build        # Production build (also the fastest way to typecheck the whole tree)
npm run lint         # next lint
npm run sync:hourly  # Run the hourly Airtable→Supabase sync locally (reads .env.local)
npm run sync:daily   # Run the daily sync locally
```

There is no test runner in this repo. `npm run build` is the primary correctness check (strict TypeScript, `noEmit` typecheck via `tsc` is not wired as a separate script). To exercise a sync without waiting for cron, use the `sync:*` scripts (they call `runSync()` directly through `scripts/sync.ts`), or hit `GET /api/sync/{hourly|daily|backfill}` with the sync secret.

Env: copy `.env.example` → `.env.local`. Supabase schema lives in `supabase/migrations/*.sql` (run in order in the Supabase SQL editor) plus `supabase/storage.sql`.

## Architecture

A read-only storefront where **approved companies browse vetted interns**, plus self-service portals for students and partner orgs. Candidate data is mirrored **one-way** from an Airtable "Local Talent" table (the intern subset, flagged by `Intern Year`). Next.js 14 App Router + Supabase (Postgres, Auth, Storage) + Airtable REST. Path alias `@/*` → `src/*`.

### The two hard boundaries — respect these

1. **`src/lib/airtable.ts` is the privacy boundary.** The `FIELD` map (Airtable field IDs) plus `mapRecord()` define *exactly* which columns ever leave Airtable and reach our DB. To expose more/less about an intern, edit this file — nowhere else. Sync fetches only the mapped fields and never scans the full base (always filtered to `{Intern Year}` + a `Last Modified` window).

2. **Read token vs. write token.** `AIRTABLE_TOKEN` is read-only and used by sync. `AIRTABLE_WRITE_TOKEN` is a separate write-scoped PAT used *only* by the student write-back paths (`updateResumeAttachment`, `updateInternFields`, and `airtable-write.ts`'s record creation). Keep the write path as the only thing that can mutate Airtable.

### Sync engine (`src/lib/sync.ts`)

Three modes via `runSync(mode)`: `hourly` (2h window, skips unchanged rows), `daily` (25h window, reconciles edits), `backfill` (no window — re-syncs every current intern to populate newly-added columns). Attachments (resume, profile image) expire on Airtable's CDN (~2h), so `rehost()` mirrors the bytes into Supabase Storage: **resumes** → private bucket (path stored, signed on demand), **profile-images** → public bucket (public URL stored). Sync also **prunes** interns whose `Intern Year` was cleared (they fall out of `fetchAllInternIds()`). Driven by Vercel Cron (`vercel.json`) hitting `/api/sync/[mode]`, authed by `CRON_SECRET`/`SYNC_SECRET`.

### Four portals, gated in `src/middleware.ts`

Every request runs through middleware, which refreshes the Supabase auth cookie and routes by path prefix. Each portal has its own allowlist table and its own public entry points (see `PUBLIC_PATHS`):

| Portal | Path prefix | Gate table | Unapproved →  |
|--------|-------------|------------|---------------|
| Company (default) | `/interns`, `/admin`, … | `company_users` (`approved`, `role`) | `/pending` |
| Admin | `/admin` | `company_users.role = 'admin'` | `/interns` |
| Partners | `/partners` | `partner_users.approved` | `/partners/pending` |
| Student | `/student` | matching row in `interns` by email | `/student/pending` |

**Middleware is a fast first line of defense, not the authority.** Server Components / Server Actions must re-verify: `requireAdmin()` in `src/lib/admin.ts` is the authoritative admin gate, and RLS policies enforce per-portal data access at the DB layer. A student "is" anyone whose signed-in email matches a synced `interns.email`, however that row was created.

### Supabase clients (`src/lib/supabase/`)

- `server.ts` — request-scoped client using the user's cookie/JWT. **Runs under RLS.** Default for reads on behalf of a logged-in user.
- `client.ts` — browser client.
- `admin.ts` — **service role, bypasses RLS, SERVER ONLY.** Used by sync, by signed-URL minting, and by public-endpoint inserts where there's no session yet (e.g. self-serve signup). Never import into a Client Component. When you use it, *you* are responsible for the access check the RLS would have done.

RLS is doing real work here — e.g. `getMyIntern()` in `interns.ts` matches on email but relies on the "student reads own row" policy to scope it; company reads only ever see `review_status = 'approved'` interns. Don't reach for `admin.ts` to "make a query work" without understanding which policy you're bypassing.

### Data model highlights (`src/lib/types.ts`, migrations)

- `interns` — the synced candidate rows. `review_status` (`pending`/`approved`/`denied`) is the admin approval gate; companies only ever see `approved`. Most columns mirror Airtable; `review_*` and `intern_projects` are Supabase-only (not in Airtable).
- `company_users` / `companies` — company allowlist + orgs. `role` is `viewer`|`admin`.
- `partner_users` / `partners` / `partner_students` — bootcamp/college staff, their orgs, and uploaded student rosters with invite tokens (`/invite/[token]`) that create Local Talent records.
- `intern_projects` — student-published live project links, Supabase-only.

### Write-back flow (student edits)

Student profile edits (`src/app/student/actions.ts`) write **Supabase first** (live to companies immediately) then mirror to Airtable via the write token. An Airtable write failure is **non-fatal** — it returns a warning and the next sync reconciles. Resume/photo uploads go to Storage, then Airtable snapshots the file from a short-lived signed URL (`updateResumeAttachment`). Each write-back bumps Airtable's `Last Modified`, so the next sync re-hosts the same bytes — harmless convergence, not a loop.

### Other conventions

- **Interns list slideout:** `/interns` uses Next.js parallel + intercepting routes (`@slideout/(.)[id]`). Clicking a card opens a right-side slideout; a direct URL load renders the full page (`[id]/page.tsx`).
- **Resumes** are never served directly — always via short-lived signed URLs from a route handler that re-checks approval (`interns/[id]/resume/route.ts`, `admin/candidates/[id]/resume/route.ts`, `student/resume/route.ts`).
- **Email** (`src/lib/email.ts`) via Resend, for signup/approval notifications and partner invites. Gracefully no-ops if `RESEND_API_KEY` is unset (`emailConfigured()`).
- **Rate limiting** (`src/lib/rate-limit.ts`) is in-memory/per-instance — a cost-blunting guard on public endpoints, not a distributed limiter.
- **URL normalization:** always run user-supplied links (LinkedIn, project URLs) through `normalizeLiveUrl()` in `src/lib/url.ts`.
- **Server Actions** live in colocated `actions.ts` files and return a discriminated result (`{ ok: true } | { ok: false; error }`); they log the real error server-side and return a generic message to avoid schema leakage (`safeError()`).

### Reference docs

`docs/ADMIN_PORTAL_CONTEXT.md`, `docs/STUDENT_LOGIN_CONTEXT.md`, `docs/PARTNERS_PORTAL_CONTEXT.md` are detailed build/handoff briefs with product decisions and deployment info (Vercel project `interns-platform`). Read the relevant one before deep work on that portal.
