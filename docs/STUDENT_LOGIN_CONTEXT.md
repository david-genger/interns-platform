# Student Login / Portal — Build Context

Self-contained brief for the **student login section** on the Devx Interns platform
(branch `student-login`). Companion to `ADMIN_PORTAL_CONTEXT.md`, which describes
the existing system in detail — read that for stack, data model, and sync context.

> **Status: BUILT (2026-07-05).** Sections 2–7 describe what shipped. The design
> was reconciled mid-build with a **Partners portal** (`0002_partners.sql`,
> `src/app/partners/*`) that was added in parallel — see the "Reconciliation"
> note below. The student portal now mirrors the partners portal's namespaced
> pattern instead of the earlier "one shared `/login` + `/signup` chooser" idea.

### Reconciliation with the Partners portal
The Partners portal onboards **net-new** students: bootcamp/college staff upload a
roster and send **invite links** (`/invite/[token]`, not built yet) that create the
student's Local Talent record. This student portal is the **login + self-service
layer** that sits on top: once a student has a Local Talent record — via partner
invite, direct Airtable entry, or direct signup — they sign in at `/student/login`
(email match) to view their profile and replace their resume. The two are
complementary; nothing here depends on the partner/invite tables.

---

## 1. Product decisions (confirmed with David, 2026-07-05)

1. **V1 scope for a signed-in student:**
   - **View their own profile** exactly as companies see it (reuse `InternProfile`).
   - **Upload / replace their resume** (and profile photo is *not* in v1 — resume only).
   - No editing of text fields (headline, skills, etc.) — those stay Airtable-managed.
   - No activity/interest signals in v1.
2. **Identity = email match from Airtable.** The student's email is synced from
   Airtable into the platform DB. Any intern in the mirror can sign in (magic link
   to that email) and is auto-linked to their record. No invites, no manual matching.
3. **Resume upload writes back to Airtable** — the platform's first write path.
   - Use a **separate Airtable token with write scope**, distinct from the read-only
     sync token. Writes are limited to **the resume attachment field only**.
   - New resume goes **live to companies immediately** (no staff review queue).
4. **Namespaced student portal** (revised — see Reconciliation). Students sign in
   at their own `/student/login` (magic link + Google), mirroring the Partners
   portal's `/partners/login`. No shared `/login` chooser and no intent metadata;
   each portal has its own entry and its own middleware gate. Identity is a plain
   email match against `interns.email`, so "signup" and "sign-in" are the same
   magic-link mechanism.
5. **Student emails are visible to companies** (decision reversed 2026-07-05;
   originally hidden). Email syncs onto the `interns` table like any other field
   and shows on the company-facing profile, so companies can contact interns
   directly. The same column doubles as the student-login match key.

## 2. Auth & routing model (as built)

### Pages (all under `src/app/student/`)
- `/student/login` — magic-link + Google sign-in; redirect target `/auth/callback?next=/student`. Public.
- `/student/pending` — "No profile found" screen for a signed-in email with no
  matching Local Talent record (wrong email, or invite not yet completed). Public.
- `/student` — the dashboard, in route group `(app)/` with its own header layout
  (logo + "My Profile" + sign out → `/student/login`). Gated.
- `/student/resume` — route handler: `GET` serves the student's own resume,
  `POST` replaces it. Gated (under `/student/*`).

### Authorization (`src/middleware.ts`)
The middleware now has one gate block per portal (partners, then student, then the
default company block). The **student block**: for any `/student/*` path (login and
pending are in `PUBLIC_PATHS`),
1. not signed in → `/student/login`;
2. signed in but no `interns` row matches their email → `/student/pending`;
3. otherwise → allow.
The email lookup runs under the user's session; RLS's "student reads own row"
policy (see §3) scopes it to their own record. Companies/partners keep their own
blocks and are unaffected.

## 3. Data model changes (migration `0003_student_login.sql`)

> Renumbered from `0002` to avoid colliding with the parallel `0002_partners.sql`.

### Airtable field targets (confirmed against the live base 2026-07-05)
- **Email**: field `fldHYPCxfADaPrmSO` ("Email", type `email`) on Local Talent
  (`tblO6El5ATyaaKt5R`) — add as `email: "fldHYPCxfADaPrmSO"` to the `FIELD` map
  in `src/lib/airtable.ts` (the privacy boundary; deliberate, documented exception).
- **Resume**: already mapped — `FIELD.resume = "fld2fSGjnNefUqnqx"` ("full Resume
  attachment"). The write-back PATCHes this field.

### Where email lives in Supabase
- **`interns.email text` column** (indexed on `lower(email)`), written by the sync
  like every other mirrored field. Since emails are company-visible (§1.5), no
  separate table is needed — companies read it through the existing approved-user
  SELECT policy, and the profile UI surfaces it.
- **New RLS policy for students**: students aren't approved company users, so
  `is_approved_user()` doesn't cover them. Add a second SELECT policy on
  `interns`: allow when `lower(email) = lower(auth.jwt() ->> 'email')` — a student
  can read exactly their own row (it's their own profile), nothing else.
- Middleware/student pages find "my intern record" by that same email match.
- Manual step (no migration runner): paste SQL into the Supabase SQL editor,
  then run a daily sync (or a one-off backfill) to populate emails.

## 4. Resume upload flow (the write path)

Server-side only (Route Handler or Server Action) — never from the browser client:

1. **Verify** the caller is an authenticated student and resolve their intern
   record by email match on `interns.email`.
2. **Validate** the file: PDF only, size cap (proposed 10 MB).
3. **Upload to Supabase** `resumes` bucket (same private bucket companies are
   served from), update `interns.resume_path`. Companies see the new resume
   instantly.
4. **Write back to Airtable**: generate a short-lived signed URL for the new file
   and `PATCH` the record's resume attachment field with `[{ url, filename }]`
   using the **new `AIRTABLE_WRITE_TOKEN`** (PAT scoped to the ATS base,
   `data.records:write` only). Airtable fetches and snapshots the file.
   - Alternative if URL-fetch proves flaky: Airtable's direct upload endpoint
     (`content.airtable.com/...uploadAttachment`, base64, ≤ 5 MB) — smaller cap.
5. **Sync echo is harmless**: the write bumps Airtable's `Last Modified`, so the
   next hourly sync re-downloads the attachment and re-hosts it — same content,
   converges. No loop.
6. If the Airtable write fails, keep the Supabase copy live but surface the error
   (and log it) so staff can reconcile — Airtable is source of truth for everything
   *except* this transient window.

Resume serving is a **separate `/student/resume` GET** (not an extension of the
company-only `/interns/[id]/resume`), so students stay fully within `/student/*`.
`getMyResumeSignedUrl()` in `lib/interns.ts` signs the caller's own resume.

## 5. Student portal UI (`/student`) — as built

- `src/app/student/(app)/page.tsx`: heading, then the **resume card**, then a
  **profile preview**.
- **Resume card** = `src/components/student/ResumeUpload.tsx` (client): PDF picker,
  10 MB / PDF-only client validation, `POST` to `/student/resume`, phase states
  (uploading → done/error), then `router.refresh()` to re-render the preview.
- **Profile preview** reuses `InternProfile`, passing `resumeSrc="/student/resume"`.
  `InternProfile` now takes an optional `resumeSrc`, and `ResumeViewer` takes a
  `src` prop instead of building the company URL from an `internId`.
- Brand reuse: `DevxLogo`, `brand-gradient`, split-panel login layout copied from
  the partners login for visual consistency.

## 6. New env / config

- `AIRTABLE_WRITE_TOKEN` — new PAT, write scope, ATS base only. Keep the existing
  read token on sync so a leak of the sync path never grants writes (and vice versa).
- Supabase Auth → URL Configuration: confirm `/auth/callback` redirect covers the
  new login pages (same callback, so likely no change).

## 7. What shipped — file map

- `supabase/migrations/0003_student_login.sql` — `interns.email` + index +
  "student reads own row" RLS policy.
- `src/lib/airtable.ts` — `FIELD.email`, `mapRecord` email, `updateResumeAttachment()`
  (uses `AIRTABLE_WRITE_TOKEN`).
- `src/lib/types.ts` — `Intern.email`.
- `src/lib/interns.ts` — `email` in `COLUMNS`; `getMyIntern()`, `getMyResumeSignedUrl()`.
- `src/middleware.ts` — student gate block + `/student/login`, `/student/pending`
  in `PUBLIC_PATHS`.
- `src/components/ResumeViewer.tsx` — takes `src` prop; `src/components/InternProfile.tsx`
  — optional `resumeSrc`, shows the (now company-visible) email.
- `src/app/student/login/page.tsx`, `student/pending/page.tsx`,
  `student/(app)/layout.tsx`, `student/(app)/page.tsx`, `student/resume/route.ts`.
- `src/components/student/ResumeUpload.tsx`.
- `.env.example` — `AIRTABLE_WRITE_TOKEN`.

### Deploy checklist (manual steps, not code)
1. Paste `0003_student_login.sql` into the Supabase SQL editor (after 0001/0002).
2. Set `AIRTABLE_WRITE_TOKEN` (write-scoped PAT) in Vercel + `.env.local`.
3. Run a daily sync (or one-off backfill) to populate `interns.email`.
4. Confirm `/auth/callback` is in Supabase Auth → URL Configuration (already is).

## 8. Resolved follow-ups (2026-07-05)

- **Airtable fields**: Email = `fldHYPCxfADaPrmSO`, Resume = `fld2fSGjnNefUqnqx`
  (see §3). Confirmed against the live base.
- **Sign-in vs signup**: one shared `/login`; the student/company/staff split is
  signup-only (see §2).
- **Access**: ALL synced interns get access (the mirror is already `Intern Year`-
  gated). Cohort restrictions deferred.
- David floated a future **staff-driven student import** ("staff uploads the list
  of students") — not in v1 scope; sync from Airtable is the only import for now.
  If added later it just inserts `interns` rows (email included); nothing in this
  design blocks it.
- **Email visibility reversed**: companies DO see student emails — plain
  `interns.email` column, shown on the profile (§1.5, §3). The earlier
  `intern_auth` privacy table is dropped from the plan.
- **Resume constraints confirmed**: PDF-only, 10 MB cap.
- **Profile photo self-serve**: confirmed out of v1.

## 9. Remaining open questions

None — the plan is fully defined and ready to implement.
