"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getStudentByToken } from "@/lib/partners";
import { createLocalTalentRecord } from "@/lib/airtable-write";
import { revalidatePath } from "next/cache";
import { rateLimit, clientIp } from "@/lib/rate-limit";

export type SubmitResult = { ok: true } | { ok: false; error: string };

/** Record that the invite link was opened (first view only). */
export async function markInviteClicked(token: string): Promise<void> {
  // Cheap public write — cap per IP to avoid it being used as a token oracle
  // or a write flood. Silently no-op when over the limit.
  if (!rateLimit(`markInviteClicked:${clientIp()}`, 60, 60 * 1000).ok) return;

  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_students")
    .select("id, status, clicked_at")
    .eq("invite_token", token)
    .maybeSingle();
  if (!data || data.clicked_at) return;

  const update: Record<string, unknown> = {
    clicked_at: new Date().toISOString(),
  };
  // Advance the funnel, but never regress a completed profile.
  if (data.status === "invited" || data.status === "uploaded") {
    update.status = "clicked";
  }
  await admin.from("partner_students").update(update).eq("id", data.id);
}

/**
 * Student submits their profile from the invite page. Uploads the resume to
 * Storage, creates the (unvetted) Local Talent record in Airtable, and marks
 * the roster row completed.
 */
export async function submitProfile(
  token: string,
  formData: FormData
): Promise<SubmitResult> {
  // Public endpoint that creates an Airtable record + Storage upload — throttle
  // per IP to cap abuse and cost.
  if (!rateLimit(`submitProfile:${clientIp()}`, 10, 10 * 60 * 1000).ok) {
    return { ok: false, error: "Too many attempts. Please try again shortly." };
  }

  const student = await getStudentByToken(token);
  if (!student) return { ok: false, error: "This invite link is not valid." };
  if (student.status === "completed") {
    return { ok: false, error: "You've already submitted your profile." };
  }

  const firstName = str(formData.get("first_name"));
  const lastName = str(formData.get("last_name"));
  const city = str(formData.get("city"));
  const state = str(formData.get("state"));
  const remotePreference = str(formData.get("remote_preference"));
  const expectedGraduation = str(formData.get("expected_graduation"));
  const technologies = parseTech(formData.get("technologies"));
  const resume = formData.get("resume");

  if (!(resume instanceof File) || resume.size === 0) {
    return { ok: false, error: "Please attach your resume." };
  }
  if (resume.size > 10 * 1024 * 1024) {
    return { ok: false, error: "Resume must be under 10 MB." };
  }

  // Only allow document types. The extension and content type are derived from
  // this whitelist, never from the (attacker-controlled) filename or MIME —
  // otherwise a student could host arbitrary HTML/JS from our Storage domain.
  const RESUME_TYPES: Record<string, string> = {
    "application/pdf": "pdf",
    "application/msword": "doc",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document":
      "docx",
  };
  const ext = RESUME_TYPES[resume.type];
  if (!ext) {
    return { ok: false, error: "Please upload a PDF or Word document." };
  }

  const admin = createAdminClient();

  // 1. Upload resume to the private bucket. Path is built only from IDs from
  // the whitelist, so it can never escape the partner-invites/ prefix.
  const path = `partner-invites/${student.id}.${ext}`;
  const bytes = new Uint8Array(await resume.arrayBuffer());
  const { error: upErr } = await admin.storage
    .from("resumes")
    .upload(path, bytes, {
      contentType: resume.type,
      upsert: true,
    });
  if (upErr) {
    console.error("[invite:submitProfile] resume upload failed", upErr);
    return { ok: false, error: "We couldn't upload your resume. Please try again." };
  }

  // 2. Short-lived signed URL so Airtable can fetch the file at create time.
  const { data: signed } = await admin.storage
    .from("resumes")
    .createSignedUrl(path, 3600);

  // 3. Create the unvetted Airtable record (Intern Year deliberately unset).
  let airtableId: string;
  try {
    airtableId = await createLocalTalentRecord({
      firstName,
      lastName,
      email: student.email,
      city,
      state,
      remotePreference,
      expectedGraduation,
      technologies,
      school: student.partner_name,
      resumeUrl: signed?.signedUrl ?? null,
    });
  } catch (e) {
    return {
      ok: false,
      error:
        "We saved your resume but couldn't finish submitting. Please try again shortly.",
    };
  }

  // 4. Mark completed.
  await admin
    .from("partner_students")
    .update({
      status: "completed",
      completed_at: new Date().toISOString(),
      airtable_id: airtableId,
      first_name: firstName ?? student.first_name,
      last_name: lastName ?? student.last_name,
    })
    .eq("id", student.id);

  revalidatePath("/partners");
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
