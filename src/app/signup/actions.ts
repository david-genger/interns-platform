"use server";

import { headers } from "next/headers";
import { createAdminClient } from "@/lib/supabase/admin";
import {
  sendCompanySignupNotification,
  sendStudentSignupNotification,
} from "@/lib/email";
import { createLocalTalentRecord } from "@/lib/airtable-write";
import { normalizeLiveUrl } from "@/lib/url";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export type RegisterResult = { ok: true } | { ok: false; error: string };

/** Log the real error server-side, return a generic message (no schema leakage). */
function safeError(context: string, err: unknown): string {
  console.error(`[signup:${context}]`, err);
  return "Something went wrong. Please try again.";
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

/** Cohort label written to Airtable so the record syncs in as a current intern. */
function defaultInternYear(): string {
  return process.env.AIRTABLE_DEFAULT_INTERN_YEAR ?? String(new Date().getFullYear());
}

/**
 * Self-serve STUDENT signup. Unlike the partner invite (which leaves the record
 * unvetted), this sets Intern Year so the sync ingests it — the internal review
 * gate (`review_status`) then decides visibility. The record is written to
 * Airtable (the source of truth) AND materialized locally right away, so the
 * student can sign in and manage their projects before the next scheduled sync.
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
  const city = str(formData.get("city"));
  const state = str(formData.get("state"));
  const remotePreference = str(formData.get("remote_preference"));
  const expectedGraduation = str(formData.get("expected_graduation"));
  const school = str(formData.get("school"));
  const linkedInUrl = str(formData.get("linkedin_url"));
  const technologies = parseTech(formData.get("technologies"));

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!firstName) return { ok: false, error: "Enter your first name." };
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

  // Already known? Just let them sign in (client sends a magic link). Never
  // clobber an existing record or its review decision.
  const { data: existing } = await admin
    .from("interns")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { ok: true };

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
  if (rErr) return { ok: false, error: safeError("registerStudent:resume", rErr) };

  let photoUrl: string | null = null;
  if (photo instanceof File && photoExt) {
    const photoPath = `signups/${uid}.${photoExt}`;
    const { error: pErr } = await admin.storage
      .from("profile-images")
      .upload(photoPath, new Uint8Array(await photo.arrayBuffer()), {
        contentType: photo.type,
        upsert: true,
      });
    if (pErr) return { ok: false, error: safeError("registerStudent:photo", pErr) };
    photoUrl = admin.storage.from("profile-images").getPublicUrl(photoPath).data
      .publicUrl;
  }

  // 2. Short-lived signed resume URL so Airtable can snapshot the bytes.
  const { data: signed } = await admin.storage
    .from("resumes")
    .createSignedUrl(resumePath, 3600);

  // 3. Create the Airtable record (source of truth) WITH Intern Year set.
  let airtableId: string;
  try {
    airtableId = await createLocalTalentRecord({
      firstName,
      lastName,
      email,
      city,
      state,
      remotePreference,
      expectedGraduation,
      technologies,
      school,
      resumeUrl: signed?.signedUrl ?? null,
      linkedInUrl,
      profileImageUrl: photoUrl,
      internYear: defaultInternYear(),
    });
  } catch (e) {
    return { ok: false, error: safeError("registerStudent:airtable", e) };
  }

  // 4. Materialize the Supabase row now so the student can edit immediately.
  // review_status defaults to 'pending'; the next sync enriches Airtable-computed
  // fields but preserves the review decision (columns not in the sync payload).
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
        city,
        state,
        location,
        remote_preference: remotePreference,
        expected_graduation: expectedGraduation,
        technologies,
        educational_institution: school,
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
    return { ok: false, error: safeError("registerStudent:upsert", upErr) };
  }

  // 5. Insert published project links.
  if (projectUrls.length) {
    const rows = projectUrls.map((url, i) => ({
      intern_id: internRow.id,
      url,
      sort_order: i,
    }));
    const { error: projErr } = await admin.from("intern_projects").insert(rows);
    if (projErr) console.error("[signup:projects]", projErr);
  }

  // 6. Best-effort notify David that a new student is waiting for review.
  const { ok, error } = await sendStudentSignupNotification({
    name,
    email,
    school,
    reviewUrl: `${siteBase()}/admin/candidates`,
  });
  if (!ok && error !== "email-not-configured") {
    console.error("[signup:notify-student]", error);
  }

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
