# Partners Portal (college/bootcamp login) — Build Context

Planning brief for the **partners portal**: a section of the Interns Platform where
**bootcamp / college career-services staff** sign up, upload student rosters, trigger
invite emails, and track how many students completed their profile. Decided with
David on 2026-07-05 (branch `student-login`). Read alongside
`docs/ADMIN_PORTAL_CONTEXT.md` for the existing platform context.

---

## 1. Product decisions (settled)

- **Audience:** bootcamp/college staff — *not* students. Students are handled via
  invite links this portal generates (or via the existing manual Airtable flow,
  kept separate for now, consolidated later).
- **Naming:** "Partners". Routes live under `/partners` in the same Next.js app.
- **Staff access:** self-serve signup page + **manual approval by David** (same
  pattern as `company_users` — pending screen until approved; admin portal will
  eventually own approvals).
- **Core loop:**
  1. Staff upload a roster (student names + emails).
  2. Upload shows a **parsed preview** (invalid emails / duplicates flagged);
     staff click **"Send invites"** explicitly — never auto-send on upload.
  3. Each student gets a branded email (via **Resend**) with a unique invite link.
  4. Link opens a **branded upload page in this app**, pre-filled with their
     name/email; student uploads resume + fills profile basics.
  5. Submission is written **directly into Airtable "Local Talent", unvetted** —
     invisible to companies until Devx vets it and sets `Intern Year` (the
     existing sync gate handles visibility automatically).
  6. Staff dashboard shows funnel stats: uploaded → invited → clicked → completed.
- **Student form fields:** confirm name/email + resume upload + location +
  remote preference + expected graduation / cohort + technologies. School is
  auto-set from the partner.
- **Email:** Resend, branded from-address on devxstaffing.com (needs SPF/DKIM DNS
  setup + `RESEND_API_KEY`).

## 2. Data model (new migration `0002_partners.sql`)

- **`partners`** — `id uuid pk`, `name`, `website`, `created_at`.
- **`partner_users`** — mirrors `company_users`: `id`, `email unique`,
  `partner_id fk`, **`approved boolean default false`**, `role`, `created_at`.
  Signup creates the `partners` row + a pending `partner_users` row.
- **`partner_students`** (the roster) — `id uuid pk`, `partner_id fk`,
  `first_name`, `last_name`, `email`, `invite_token uuid unique default gen_random_uuid()`,
  `status` (`'uploaded' | 'invited' | 'clicked' | 'completed'`),
  `invited_at`, `clicked_at`, `completed_at`, `airtable_id` (set after write-back),
  `created_at`. Unique `(partner_id, email)`.

RLS (mirror the existing style):
- `is_approved_partner_user()` helper (email match, approved = true).
- `partner_users`: SELECT own row only.
- `partners`: approved staff SELECT own partner.
- `partner_students`: approved staff SELECT rows for their `partner_id`.
  All writes go through server routes with the service-role client (keeps CSV
  validation, invite sending, and status transitions server-side).
- No migration runner — paste into the Supabase SQL editor, as with 0001.

## 3. Routes & middleware

New routes (same app, `/partners` section):

```
src/app/partners/
  login/page.tsx        staff sign-in (reuse Google OAuth + magic link, shared /auth/callback)
  signup/page.tsx       staff self-serve signup (name, bootcamp name, website)
  pending/page.tsx      awaiting-approval screen (partners flavor)
  page.tsx              dashboard: funnel stats + roster table + upload
  (server actions/routes for CSV parse, invite send, resend)
src/app/invite/[token]/page.tsx   PUBLIC student invite page + submit route
```

Middleware changes (`src/middleware.ts`):
- Split gating by section: paths under `/partners` check `partner_users`;
  everything else keeps the `company_users` check as today.
- Add to public paths: `/partners/login`, `/partners/signup`, `/invite`.
- Same Supabase Auth session for both audiences; a company user hitting
  `/partners` lands on the partners pending screen, and vice versa.

## 4. Invite pipeline

- **Roster upload:** CSV upload (or paste emails) → server parses, validates,
  dedupes against existing `partner_students` → preview → confirm inserts rows
  with `status = 'uploaded'`.
- **Send:** "Send invites" server action batches through Resend (batch API,
  ≤100/call), link = `/invite/{invite_token}`, sets `status='invited'`,
  `invited_at`. Per-student "resend" available for stragglers.
- **Invite page:** token lookup → mark `clicked_at` (first hit) → pre-filled
  form → on submit:
  1. Upload resume to Supabase Storage (`resumes` bucket, private).
  2. Create the Airtable "Local Talent" record via REST: name, email, location,
     remote preference, expected graduation, technologies, school = partner name,
     plus a **source field identifying the partner** (needs a new Airtable field —
     see open items). Attach resume via Airtable's upload-attachment content API
     (or a short-lived signed Supabase URL).
  3. Store `airtable_id`, set `status='completed'`, `completed_at`.
- Expired/used tokens get a friendly dead-end page.

## 5. Dashboard v1

Per partner: counts for uploaded / invited / clicked / completed, plus a student
table (name, email, status, dates, resend action). Down the line: profile views
by companies, placement status — needs data we don't track yet; out of scope.

## 6. Build order

1. Migration `0002_partners.sql` + middleware split + staff signup/login/pending.
2. Dashboard shell + roster CSV upload with preview/confirm.
3. Resend integration (DNS, env var) + invite send/resend + status tracking.
4. Public `/invite/[token]` page: form, resume upload, Airtable write-back.
5. Stats polish + empty states + duplicate-invite handling.

## 6b. Implementation status (built 2026-07-05)

All v1 code is in place on branch `student-login`. Files added:

```
supabase/migrations/0002_partners.sql        partners, partner_users, partner_students + RLS
src/lib/csv.ts                               roster parsing/validation (CSV or pasted emails)
src/lib/partners.ts                          data access (partner user, roster, stats, token lookup)
src/lib/email.ts                             Resend client + branded invite template
src/lib/airtable-write.ts                    createLocalTalentRecord() — unvetted write-back
src/app/partners/actions.ts                  registerPartner, addStudents, sendInvites, resendInvite
src/app/partners/login|signup|pending/       staff auth pages
src/app/partners/(app)/layout.tsx + page.tsx dashboard (route group keeps header off auth pages)
src/app/invite/[token]/page.tsx              public student invite page
src/app/invite/actions.ts                    markInviteClicked, submitProfile
src/components/partners/*                     StatCards, RosterUpload, RosterTable,
                                             SendInvitesButton, InviteForm
src/middleware.ts                            split: /partners gates on partner_users
src/app/auth/signout/route.ts                honors ?redirect so partners return to their login
```

`resend@^4.8` was added to package.json.

### Setup required before it works end to end
1. **Run the SQL:** paste `supabase/migrations/0002_partners.sql` into the
   Supabase SQL editor (no migration runner, same as 0001).
2. **Env vars** (Vercel + local `.env.local`):
   - `RESEND_API_KEY` — from resend.com.
   - `PARTNERS_FROM_EMAIL` — e.g. `Devx Staffing <invites@devxstaffing.com>`
     (verify the domain in Resend + add SPF/DKIM DNS).
   - `NEXT_PUBLIC_SITE_URL` — already used elsewhere; ensures invite links are
     absolute in emails.
   - `AIRTABLE_EMAIL_FIELD` — Airtable field name/ID for the student's email
     (optional; skipped if unset — team can match manually meanwhile).
   - `AIRTABLE_SOURCE_FIELD` — optional partner/source tag field.
   - `AIRTABLE_TECH_FIELD` — optional *writable* skills field. The read-side
     `technologies` field is a lookup and can't be written to, so tech is only
     saved if this points at a writable column.
   - Reuses existing `AIRTABLE_BASE_ID`, `AIRTABLE_TABLE_ID`, `AIRTABLE_TOKEN`,
     `SUPABASE_SERVICE_ROLE_KEY`.
   - The Airtable **token must have write scope** (`data.records:write`) — the
     current sync only needs read.
3. **Approve the first staff account:** after David signs up at
   `/partners/signup`, flip `approved = true` on their `partner_users` row in
   Supabase (this is the manual gate until the admin portal owns it).
4. **School dropdown:** the write-back sets the existing college/bootcamp
   dropdown (`educational_institution`, field `fldxKfWt3zuCVFHa8`) to the
   partner name via `typecast: true`, so a new bootcamp becomes a new option
   automatically.

## 7. Open items (small, decide during build)

- **Airtable "source" field:** add a field on Local Talent (e.g. "Source" or a
  linked "Partner" field) so partner-sourced students are identifiable — David
  to create it; the write-back maps to it. Also confirm which existing Airtable
  fields the form values map to (email, remote preference, cohort).
- **CSV format:** expected columns (first name, last name, email) — document on
  the upload UI; also allow a plain pasted email list?
- **Resend DNS:** SPF/DKIM records for devxstaffing.com, choose from-address
  (e.g. invites@devxstaffing.com).
- **Technologies input:** free-text tags vs. the curated list companies filter
  on (`tech_categories`) — curated keeps facets clean.
- **Duplicate protection:** student already in Airtable with same email — the
  invite flow can't detect this (email isn't synced); vetting catches it. Fine
  for v1.
