"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendCompanySignupNotification,
  sendStudentSignupNotification,
} from "@/lib/email";
import {
  createLocalTalentRecord,
  updateLocalTalentRecord,
} from "@/lib/airtable-write";
import { findLocalTalentRecord } from "@/lib/airtable";
import { normalizeLiveUrl } from "@/lib/url";
import { normalizePhone } from "@/lib/phone";
import { resolvePartnerId } from "@/lib/partner-resolve";
import { linkRosterOnSignup } from "@/lib/rosters";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { trackServer } from "@/lib/analytics";
import { EVENTS } from "@/lib/analytics-events";

export type RegisterResult = { ok: true } | { ok: false; error: string };

/**
 * Log the real error server-side (with its `[signup:<stage>]` tag, visible in
 * Vercel logs) and return a safe, user-facing message. The message names the
 * STAGE that failed — no schema leakage, but enough to tell resume-upload from
 * an Airtable write from a DB save without digging through logs.
 */
function safeError(
  context: string,
  err: unknown,
  userMsg = "Something went wrong. Please try again."
): string {
  console.error(`[signup:${context}]`, err);
  return userMsg;
}

export type SchoolOption = { id: string; name: string };

/**
 * Bootcamps / colleges for the student signup dropdown — the single canonical
 * `partners` list that the partners portal, admin console, and interns filters
 * all share, so the name a student picks is always tied to a real partner id.
 * The form adds an "Other" option for schools not yet in the list (stored as
 * free text with no partner link; an admin can attach them to an org later).
 */
export async function getSchoolOptions(): Promise<SchoolOption[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partners")
    .select("id, name")
    .order("name", { ascending: true });
  return (data ?? [])
    .map((p) => ({ id: p.id as string, name: (p.name as string) ?? "" }))
    .filter((p) => p.name);
}

/** Absolute base URL (prefers the configured site URL). */
function siteBase(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export type CompanySignupInput = {
  fullName: string;
  companyName: string;
  email: string;
  phone: string;
  workedWithDevx: boolean;
};

/**
 * Self-serve COMPANY signup. Creates the company (if new) and a PENDING
 * company_users row capturing the contact details, then emails David that a new
 * company is waiting for approval. The client follows up with a magic link so
 * the visitor can sign in and land on the pending screen.
 *
 * Uses the service role because the visitor has no session yet and RLS would
 * otherwise block the insert. Idempotent: re-submitting an existing email leaves
 * the row (and its approval state) untouched.
 */
export async function registerCompany(
  input: CompanySignupInput
): Promise<RegisterResult> {
  // Public endpoint — throttle per IP to blunt signup floods.
  if (!rateLimit(`registerCompany:${clientIp()}`, 5, 10 * 60 * 1000).ok) {
    return { ok: false, error: "Too many attempts. Please try again shortly." };
  }

  const email = input.email.trim().toLowerCase();
  const fullName = input.fullName.trim();
  const companyName = input.companyName.trim();
  const phone = input.phone.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!fullName) return { ok: false, error: "Enter your full name." };
  if (!companyName) return { ok: false, error: "Enter your company name." };
  if (!phone) return { ok: false, error: "Enter a phone number." };

  const admin = createAdminClient();

  // Already registered? Leave their row (and approval) untouched — the client
  // just sends a fresh magic link so they can sign back in.
  const { data: existing } = await admin
    .from("company_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { ok: true };

  const { data: company, error: companyErr } = await admin
    .from("companies")
    .insert({ name: companyName })
    .select("id")
    .single();
  if (companyErr) {
    return { ok: false, error: safeError("registerCompany:company", companyErr) };
  }

  const { error: userErr } = await admin.from("company_users").insert({
    email,
    company_id: company.id,
    approved: false,
    role: "viewer",
    full_name: fullName,
    phone,
    worked_with_devx: input.workedWithDevx,
  });
  if (userErr) {
    return { ok: false, error: safeError("registerCompany:user", userErr) };
  }

  // Best-effort notification — never fail the signup if the email doesn't send.
  const { ok, error } = await sendCompanySignupNotification({
    companyName,
    contactName: fullName,
    email,
    phone,
    workedWithDevx: input.workedWithDevx,
    reviewUrl: `${siteBase()}/admin/users`,
  });
  if (!ok && error !== "email-not-configured") {
    console.error("[signup:notify]", error);
  }

  await trackServer(EVENTS.companySignup, {
    worked_with_devx: input.workedWithDevx,
  });

  return { ok: true };
}

// ------------------------------------------------------------------
// Self-serve STUDENT signup
// ------------------------------------------------------------------

const RESUME_MAX = 10 * 1024 * 1024; // 10 MB
const PHOTO_MAX = 5 * 1024 * 1024; // 5 MB
const PHOTO_TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Cohort label written to Airtable so the record syncs in as a current intern.
 * Always the CURRENT calendar year — deliberately not configurable, so it can
 * never be pinned to a stale value and silently mislabel next year's cohort.
 */
function defaultInternYear(): string {
  return String(new Date().getFullYear());
}

/**
 * THE single student intake path. Every student — direct signup or bootcamp
 * invite — comes through here, so the rules, validation, and dedupe are shared.
 * The invite is just a funnel: it prefills email + school and passes an
 * `invite_token` so we can update the roster funnel on completion.
 *
 * Sets Intern Year so the sync ingests the record; the internal review gate
 * (`review_status`) then decides visibility. Writes Airtable (source of truth)
 * AND materializes the Supabase row immediately so the student can sign in and
 * manage their profile before the next scheduled sync.
 *
 * DEDUPE: matches an existing candidate by EMAIL — first in Supabase (indexed,
 * instant), then via one Airtable query for records not yet synced. On a match
 * it UPDATES that record instead of creating a duplicate, then upserts the
 * Supabase row on the SAME airtable_id — so from here on every future Airtable
 * edit for this person flows to the platform through the normal sync.
 * Deliberately email-only: phone is a contact field, not a merge key — merging
 * on a phone match would let a signup with someone else's number overwrite that
 * person's record (and its email, the login key) from a public endpoint.
 * Intern Year is only set when the matched record doesn't already have one, so
 * a merge never moves an existing candidate to a different cohort.
 */
export async function registerStudent(
  formData: FormData
): Promise<RegisterResult> {
  // Public endpoint that uploads files + writes Airtable — throttle per IP.
  if (!rateLimit(`registerStudent:${clientIp()}`, 8, 10 * 60 * 1000).ok) {
    return { ok: false, error: "Too many attempts. Please try again shortly." };
  }

  const email = str(formData.get("email"))?.toLowerCase() ?? "";
  const firstName = str(formData.get("first_name"));
  const lastName = str(formData.get("last_name"));
  const phoneRaw = str(formData.get("phone"));
  const city = str(formData.get("city"));
  const state = str(formData.get("state"));
  const remotePreference = str(formData.get("remote_preference"));
  const expectedGraduation = str(formData.get("expected_graduation"));
  const school = str(formData.get("school"));
  const linkedInUrl = str(formData.get("linkedin_url"));
  const inviteToken = str(formData.get("invite_token"));
  const technologies = parseTech(formData.get("technologies"));

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!firstName) return { ok: false, error: "Enter your first name." };
  // Phone is optional — validated only when provided.
  const phoneDigits = normalizePhone(phoneRaw);
  if (phoneRaw && phoneDigits.length < 7) {
    return { ok: false, error: "Enter a valid phone number." };
  }
  if (linkedInUrl && !normalizeLiveUrl(linkedInUrl)) {
    return { ok: false, error: "Enter a valid https:// LinkedIn URL." };
  }

  // Project links: keep only well-formed live URLs; reject if any were entered
  // but invalid, so a student doesn't silently lose a link.
  const rawProjects = formData
    .getAll("projects")
    .map((v) => (typeof v === "string" ? v.trim() : ""))
    .filter(Boolean);
  const projectUrls: string[] = [];
  for (const p of rawProjects) {
    const norm = normalizeLiveUrl(p);
    if (!norm) {
      return {
        ok: false,
        error: `"${p}" isn't a valid live link. Use a full https:// address.`,
      };
    }
    projectUrls.push(norm);
  }

  // Resume (required, PDF) + optional profile photo.
  const resume = formData.get("resume");
  if (!(resume instanceof File) || resume.size === 0) {
    return { ok: false, error: "Please attach your resume (PDF)." };
  }
  if (resume.type !== "application/pdf") {
    return { ok: false, error: "Your resume must be a PDF." };
  }
  if (resume.size > RESUME_MAX) {
    return { ok: false, error: "Resume must be under 10 MB." };
  }

  const photo = formData.get("photo");
  let photoExt: string | null = null;
  if (photo instanceof File && photo.size > 0) {
    photoExt = PHOTO_TYPES[photo.type] ?? null;
    if (!photoExt) {
      return { ok: false, error: "Profile photo must be a JPG, PNG, or WEBP." };
    }
    if (photo.size > PHOTO_MAX) {
      return { ok: false, error: "Profile photo must be under 5 MB." };
    }
  }

  const admin = createAdminClient();

  // Resolve-or-create the canonical partner from the school name — the SAME
  // mechanism the sync uses. Whether the student picked from the list or typed
  // an "Other" school, it ends up in the one partners list and the candidate is
  // linked by id (not a drifting name string).
  const partnerId = await resolvePartnerId(admin, school);

  // ---- DEDUPE: find an existing record by EMAIL (never phone — see above). ----
  // 1) Supabase first (indexed) — covers anyone already synced or materialized.
  //    Capture review_status so we don't re-notify for a candidate that's
  //    already been reviewed, and intern_year so a merge preserves their cohort.
  let existingAirtableId: string | null = null;
  let existingReviewStatus: string | null = null;
  let existingHasInternYear = false;
  {
    const { data: match } = await admin
      .from("interns")
      .select("airtable_id, review_status, intern_year")
      .eq("email", email)
      .limit(1)
      .maybeSingle();
    if (match) {
      existingAirtableId = match.airtable_id as string;
      existingReviewStatus = (match.review_status as string) ?? null;
      existingHasInternYear = Boolean(match.intern_year);
    }
  }
  // 2) Not in Supabase? One Airtable query catches records that exist there but
  //    haven't synced (e.g. added straight in Airtable).
  if (!existingAirtableId) {
    try {
      const found = await findLocalTalentRecord({ email });
      if (found) {
        existingAirtableId = found.id;
        existingHasInternYear = found.internYearSet;
      }
    } catch (e) {
      // Non-fatal: fall through to create. A transient lookup failure should
      // never block a signup — worst case is a duplicate the next sync surfaces.
      console.error("[signup:dedupe-lookup]", e);
    }
  }

  // 1. Upload resume (private) + photo (public). Temp paths keyed by a random
  // id; the next sync re-hosts to `${airtable_id}.*` and converges resume_path.
  const uid = crypto.randomUUID();
  const resumePath = `signups/${uid}.pdf`;
  const { error: rErr } = await admin.storage
    .from("resumes")
    .upload(resumePath, new Uint8Array(await resume.arrayBuffer()), {
      contentType: "application/pdf",
      upsert: true,
    });
  if (rErr)
    return {
      ok: false,
      error: safeError(
        "registerStudent:resume",
        rErr,
        "We couldn't upload your resume. Please try again."
      ),
    };

  let photoUrl: string | null = null;
  if (photo instanceof File && photoExt) {
    const photoPath = `signups/${uid}.${photoExt}`;
    const { error: pErr } = await admin.storage
      .from("profile-images")
      .upload(photoPath, new Uint8Array(await photo.arrayBuffer()), {
        contentType: photo.type,
        upsert: true,
      });
    if (pErr)
      return {
        ok: false,
        error: safeError(
          "registerStudent:photo",
          pErr,
          "We couldn't upload your profile photo. Please try again."
        ),
      };
    photoUrl = admin.storage.from("profile-images").getPublicUrl(photoPath).data
      .publicUrl;
  }

  // 2. Short-lived signed resume URL so Airtable can snapshot the bytes.
  const { data: signed } = await admin.storage
    .from("resumes")
    .createSignedUrl(resumePath, 3600);

  // 3. Write Airtable (source of truth) — updating the matched record if we
  // found one, otherwise creating a new one. Intern Year: a new record gets the
  // current default; a matched record keeps its existing cohort and only gets
  // the default when it has none (so it still enters sync scope either way —
  // buildLocalTalentFields skips a null internYear).
  const airtableRecord = {
    firstName,
    lastName,
    email,
    phone: phoneRaw,
    city,
    state,
    remotePreference,
    expectedGraduation,
    technologies,
    school,
    resumeUrl: signed?.signedUrl ?? null,
    linkedInUrl,
    profileImageUrl: photoUrl,
    internYear: existingHasInternYear ? null : defaultInternYear(),
  };
  let airtableId: string;
  try {
    if (existingAirtableId) {
      await updateLocalTalentRecord(existingAirtableId, airtableRecord);
      airtableId = existingAirtableId;
    } else {
      airtableId = await createLocalTalentRecord(airtableRecord);
    }
  } catch (e) {
    return {
      ok: false,
      error: safeError(
        "registerStudent:airtable",
        e,
        "We couldn't submit your application to our records system. Please try again shortly."
      ),
    };
  }

  // 4. Materialize / update the Supabase row on the SAME airtable_id, so the
  // student can edit immediately and future syncs converge on this one record.
  // review_status is left to its column default ('pending') on insert and NOT
  // named here on update, so an existing review decision is preserved.
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
  const location = [city, state].filter(Boolean).join(", ") || null;
  const { data: internRow, error: upErr } = await admin
    .from("interns")
    .upsert(
      {
        airtable_id: airtableId,
        name,
        first_name: firstName,
        last_name: lastName,
        email,
        phone: phoneRaw,
        phone_normalized: phoneDigits,
        city,
        state,
        location,
        remote_preference: remotePreference,
        expected_graduation: expectedGraduation,
        technologies,
        educational_institution: school,
        partner_id: partnerId,
        linkedin_url: linkedInUrl,
        resume_path: resumePath,
        profile_image_url: photoUrl,
        last_synced_at: new Date().toISOString(),
      },
      { onConflict: "airtable_id" }
    )
    .select("id")
    .single();
  if (upErr || !internRow) {
    return {
      ok: false,
      error: safeError(
        "registerStudent:upsert",
        upErr,
        "We couldn't save your profile to the database. Please try again."
      ),
    };
  }

  // 5. Insert published project links, skipping any URL already saved (so a
  // re-submission by a returning student doesn't duplicate links).
  if (projectUrls.length) {
    const { data: existingProjects } = await admin
      .from("intern_projects")
      .select("url")
      .eq("intern_id", internRow.id);
    const have = new Set((existingProjects ?? []).map((p) => p.url as string));
    const fresh = projectUrls.filter((url) => !have.has(url));
    if (fresh.length) {
      const rows = fresh.map((url, i) => ({
        intern_id: internRow.id,
        url,
        sort_order: have.size + i,
      }));
      const { error: projErr } = await admin
        .from("intern_projects")
        .insert(rows);
      if (projErr) console.error("[signup:projects]", projErr);
    }
  }

  // 6. Update the referring bootcamp's roster funnel (invite click-through or a
  // direct-signup match), so staff can track who landed. Best-effort.
  try {
    await linkRosterOnSignup({
      inviteToken,
      email,
      airtableId,
    });
  } catch (e) {
    console.error("[signup:roster-link]", e);
  }

  // 7. Notify David a student is waiting for review — but not when we just
  // updated a candidate that was already reviewed (approved/denied).
  const needsReview =
    existingReviewStatus === null || existingReviewStatus === "pending";
  if (needsReview) {
    const { ok, error } = await sendStudentSignupNotification({
      name,
      email,
      school,
      reviewUrl: `${siteBase()}/admin/candidates`,
    });
    if (!ok && error !== "email-not-configured") {
      console.error("[signup:notify-student]", error);
    }
  }

  await trackServer(EVENTS.studentSignup, {
    via_invite: Boolean(inviteToken),
    returning: Boolean(existingAirtableId),
    school: school ?? "unspecified",
  });

  return { ok: true };
}

function str(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function parseTech(v: FormDataEntryValue | null): string[] {
  if (typeof v !== "string") return [];
  return Array.from(
    new Set(
      v
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );
}
