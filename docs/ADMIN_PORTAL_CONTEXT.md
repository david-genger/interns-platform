# Admin Portal — Build Context / Handoff

This doc is a self-contained brief for building the **admin portal** on top of the
existing Devx Interns platform. Read it first; it captures everything decided so far.

---

## 1. What the product is

A company-facing web app where **approved companies sign in and browse vetted
interns**. Intern data is mirrored **one-way from Airtable** on a schedule.
Companies are read-only; the platform is a storefront over the intern slice of
Devx's ATS.

- **Repo:** `/Users/davidgenger/Documents/Code/Interns Platform`
- **Live:** deployed on Vercel (project `interns-platform`,
  `prj_GlBe4YnT5h0dT22RdlGsplqRLMok`, org `team_wSYaQ1SD78MSSROxOjpiG6UM`).
  Deploys via Vercel's GitHub integration and **works in production**.
- Company: **Devx Staffing** (devxstaffing.com), a staffing/recruiting business.
  Primary user / owner: David (david@devxstaffing.com).

## 2. Stack

- **Next.js 14.2** App Router, TypeScript, `src/` dir, `@/*` path alias.
- **Tailwind CSS 3** (config: `tailwind.config.ts`). Brand palette + `brand-gradient`;
  Halyard Display font for headings (`--font-display`), system sans for body.
- **Supabase**: Postgres + Auth (Google OAuth **and** email magic link) + Storage.
- **Airtable** REST API as source of truth (sync only).
- Deployed on Vercel; Vercel Cron drives the sync.

## 3. Data model (Supabase Postgres)

Schema lives in `supabase/migrations/0001_init.sql` + `supabase/storage.sql`.
**No migration runner** — SQL is pasted into the Supabase SQL editor by hand.
The production DB already has this schema + synced intern data.

Tables:
- **`companies`** — `id uuid pk`, `name`, `domain`, `created_at`.
- **`company_users`** — the approval allowlist: `id uuid pk`, `email unique`,
  `company_id` (fk → companies, nullable), **`approved boolean`**, **`role text`
  ('viewer' | 'admin')**, `created_at`. A login is only allowed in if a matching
  approved row exists.
- **`interns`** — curated mirror of Airtable "Local Talent" (rows where
  `Intern Year` is set). Key columns: `airtable_id unique`, `name`, `first_name`,
  `last_name`, `headline`, `summary`, `technologies text[]`, `tech_categories text[]`,
  `intern_year`, `expected_graduation date`, `educational_institution`,
  `location/city/state/country`, `remote_preference`, `profile_image_url`,
  `resume_path`, `airtable_modified_at`, `last_synced_at`.
  **Deliberately NOT present:** ratings, experience level, institution type — all
  removed per product decisions (ratings are internal-only; interns are all
  beginners so seniority/level is meaningless).

RLS (already in place):
- `is_approved_user()` — SQL helper: true if `auth.jwt() ->> 'email'` matches an
  approved `company_users` row.
- `interns`: SELECT allowed to approved users. No write policy (service role only).
- `company_users`: a user may SELECT only **their own** row.
- `companies`: approved users may SELECT only their own company.

Storage buckets: **`resumes`** (private; served via short-lived signed URLs) and
**`profile-images`** (public). See `supabase/storage.sql`.

## 4. Auth & approval model (what admin extends)

- Google OAuth or email magic link, both via Supabase Auth, both land on
  `/auth/callback`.
- `src/middleware.ts` gates every non-public page:
  not signed in → `/login`; signed in but not approved → `/pending`.
- **Approval today is manual**: David edits `company_users` in the Supabase table
  editor (set `approved = true`). There is intentionally **no admin UI yet** — that
  is exactly what the admin portal will add.
- **`company_users.role` already exists** (`'viewer' | 'admin'`) — gate the admin
  portal on `role = 'admin'`.

## 5. Airtable sync (context; admin may surface status)

- Source: base **"Applicant tracking system"** (`appAzft2IyOUVJ0ZQ`), table
  **"Local Talent"** (`tblO6El5ATyaaKt5R`). Gate = `Intern Year` is set.
- Two tiers, kept light (never scans the full base of thousands):
  - **Hourly** (`/api/sync/hourly`): interns modified in the last ~2h.
  - **Daily** (`/api/sync/daily`): interns modified in the last ~25h + **reconcile**
    (deletes interns whose `Intern Year` was cleared, via `fetchAllInternIds()`).
  - Both re-host resume/photo into Storage (Airtable attachment URLs expire ~2h).
- Scheduled by `vercel.json` crons. Protected by `CRON_SECRET` (Vercel-injected
  Bearer) or `SYNC_SECRET` (`?secret=` for manual curl).
- **Privacy boundary is `src/lib/airtable.ts`** — the `FIELD` map + `mapRecord()`
  define exactly which columns leave Airtable. Change there to expose more/less.

## 6. Key files

```
src/
  middleware.ts                 auth + approval gate (extend for /admin role check)
  app/
    login/page.tsx              Google + magic-link sign in (split-panel, branded)
    pending/page.tsx            "awaiting approval" screen
    auth/callback|signout       OAuth handlers
    interns/
      layout.tsx                header (logo + sign out) + @slideout slot
      page.tsx                  filterable list (grid/list toggle)
      [id]/page.tsx             full-page profile
      [id]/resume/route.ts      signed resume redirect (approval-checked)
      @slideout/(.)[id]/page.tsx  intercepted slideout profile
    api/sync/[mode]/route.ts    cron sync endpoint
  components/
    InternCard / InternRow / InternResults (grid+list+toggle)
    InternProfile               profile body (used by slideout + full page)
    Filters                     name search, tech, cohort, school, location
    ResumeViewer                inline PDF preview -> full modal viewer
    Logo (DevxLogo/DevxMark)    theme-aware full "devx staffing" lockup
    ui.tsx                      Avatar, Pill, PinIcon, name/location/grad helpers
  lib/
    airtable.ts                 field map + fetch (PRIVACY BOUNDARY) + fetchAllInternIds
    sync.ts                     two-tier sync engine (+ reconcile/prune)
    interns.ts                  data access + facets + signed resume URLs
    types.ts                    Intern, InternFilters, ViewMode
    supabase/{server,client,admin}.ts   SSR / browser / service-role clients
supabase/
  migrations/0001_init.sql      schema + RLS
  storage.sql                   buckets + storage RLS
scripts/sync.ts                 manual sync runner (npm run sync:hourly|daily)
public/                         logo-regular.png (light), logo-white.png (dark),
                                devx-logo.png (devx-only), devx-mark.png (x)
docs/ADMIN_PORTAL_CONTEXT.md    this file
```

## 7. Environment / running

- Local dev works: `npm run dev`. Type-check with `npx tsc --noEmit`.
- **Env:** `.env.local` currently holds only `VERCEL_OIDC_TOKEN`; a gitignored
  `.env.development.local` has **placeholder** Supabase values so pages render but
  auth/data don't work locally. Real keys live on Vercel. To get a working local
  backend: `vercel login` then `vercel env pull .env.local`, then delete
  `.env.development.local` — OR paste real Supabase/Airtable keys into `.env.local`.
  (See `.env.example` for the full list.)
- **Gotcha:** if `next dev` hangs at "Starting…", delete a corrupted partial build
  with `rm -rf .next`. Cold route compiles can take ~20s on a loaded machine.

---

## 8. THE TASK: Admin portal

Goal: give Devx staff a UI to **manage company access** (and likely more) instead
of hand-editing Supabase. Gate everything on `company_users.role = 'admin'`.

Recommended v1 scope (confirm/trim with David in the new chat):
1. **`/admin` section**, access-gated to admins. Non-admins get 404/redirect.
2. **Company users / approvals**: list all `company_users` (highlight pending
   `approved = false`), approve/revoke, set `role`, assign/change `company_id`,
   add a user by email, remove a user.
3. **Companies**: list + create/edit/delete companies (name, domain).
4. (Optional) **Sync visibility**: last sync time, intern count, a button to
   trigger `/api/sync/hourly` manually.
5. (Optional) **Access/audit log**: who viewed which intern — requires a new
   `view_log` table + writing to it from the resume/profile routes (not built yet).

### Important implementation notes / gotchas
- **RLS today only lets a user read their own `company_users` row.** Admin needs to
  read/write ALL rows in `company_users` and `companies`. Two options:
  - **(Recommended) Do admin mutations server-side** via Route Handlers or Server
    Actions using the **service-role client** (`src/lib/supabase/admin.ts`), after
    verifying the caller is an authenticated admin. Avoids broadening RLS.
  - Or add admin RLS policies (an `is_admin()` SQL helper mirroring
    `is_approved_user()` but checking `role = 'admin'`, plus INSERT/UPDATE/DELETE
    policies). More SQL, but keeps logic in the DB.
- **Gate the admin routes in `src/middleware.ts`** (or a per-layout server check):
  add a check that for `/admin/*`, the user's `company_users.role = 'admin'`.
- Reuse the existing brand/UI: `DevxLogo`, `brand`/`brand-gradient`, `Pill`,
  Halyard headings, the same layout patterns as `interns/`.
- Approving a user is just flipping `approved` (and optionally setting
  `company_id`/`role`) — the auth account itself is created by Supabase on first
  login; the `company_users` row is purely the allowlist.
- Make David an admin first: `update company_users set role='admin', approved=true
  where email='david@devxstaffing.com';`

### Open questions to resolve with David
- Should approval be per-email, or **auto-approve by company domain** (anyone
  `@company.com`)?
- Does he want the audit/view log now, or later?
- Should admins be able to manually trigger a sync from the UI?
- Any need to edit/override intern data in-platform, or stays 100% Airtable-driven?
  (Default assumption: interns remain read-only, Airtable is source of truth.)
