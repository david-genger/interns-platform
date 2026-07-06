"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { sendStudentDenialEmail } from "@/lib/email";
import { runSync, type SyncMode, type SyncResult } from "@/lib/sync";
import type { ReviewStatus } from "@/lib/types";

export type ActionResult = { ok: boolean; error?: string };

const USERS_PATH = "/admin/users";
const COMPANIES_PATH = "/admin/companies";
const CANDIDATES_PATH = "/admin/candidates";

/** Log the real DB error, return a generic message (no schema leakage). */
function safeError(context: string, err: unknown): string {
  console.error(`[admin:${context}]`, err);
  return "Something went wrong. Please try again.";
}

// ------------------------------------------------------------------
// Company users
// ------------------------------------------------------------------

/** Add a user to the allowlist by email. Optionally approved / role / company. */
export async function addUser(formData: FormData): Promise<ActionResult> {
  await requireAdmin();

  const email = String(formData.get("email") ?? "").trim().toLowerCase();
  const role = String(formData.get("role") ?? "viewer");
  const companyId = String(formData.get("company_id") ?? "") || null;
  const approved = formData.get("approved") === "on";

  if (!email || !email.includes("@")) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (role !== "viewer" && role !== "admin") {
    return { ok: false, error: "Invalid role." };
  }

  const admin = createAdminClient();
  const { error } = await admin.from("company_users").insert({
    email,
    role,
    company_id: companyId,
    approved,
  });

  if (error) {
    if (error.code === "23505") {
      return { ok: false, error: "That email is already on the list." };
    }
    return { ok: false, error: safeError("addUser", error) };
  }

  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function setUserApproved(
  id: string,
  approved: boolean
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("company_users")
    .update({ approved })
    .eq("id", id);
  if (error) return { ok: false, error: safeError("write", error) };
  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function setUserRole(
  id: string,
  role: string
): Promise<ActionResult> {
  await requireAdmin();
  if (role !== "viewer" && role !== "admin") {
    return { ok: false, error: "Invalid role." };
  }
  const admin = createAdminClient();
  const { error } = await admin
    .from("company_users")
    .update({ role })
    .eq("id", id);
  if (error) return { ok: false, error: safeError("write", error) };
  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function setUserCompany(
  id: string,
  companyId: string | null
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("company_users")
    .update({ company_id: companyId || null })
    .eq("id", id);
  if (error) return { ok: false, error: safeError("write", error) };
  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function removeUser(id: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("company_users").delete().eq("id", id);
  if (error) return { ok: false, error: safeError("write", error) };
  revalidatePath(USERS_PATH);
  return { ok: true };
}

// ------------------------------------------------------------------
// Companies
// ------------------------------------------------------------------

export async function createCompany(formData: FormData): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const domain = String(formData.get("domain") ?? "").trim() || null;
  if (!name) return { ok: false, error: "Company name is required." };

  const admin = createAdminClient();
  const { error } = await admin.from("companies").insert({ name, domain });
  if (error) return { ok: false, error: safeError("write", error) };
  revalidatePath(COMPANIES_PATH);
  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function updateCompany(
  id: string,
  name: string,
  domain: string | null
): Promise<ActionResult> {
  await requireAdmin();
  const trimmed = name.trim();
  if (!trimmed) return { ok: false, error: "Company name is required." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("companies")
    .update({ name: trimmed, domain: domain?.trim() || null })
    .eq("id", id);
  if (error) return { ok: false, error: safeError("write", error) };
  revalidatePath(COMPANIES_PATH);
  revalidatePath(USERS_PATH);
  return { ok: true };
}

/**
 * Delete a company. The `company_users.company_id` FK is `on delete set null`,
 * so members are unassigned rather than removed.
 */
export async function deleteCompany(id: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("companies").delete().eq("id", id);
  if (error) return { ok: false, error: safeError("write", error) };
  revalidatePath(COMPANIES_PATH);
  revalidatePath(USERS_PATH);
  return { ok: true };
}

// ------------------------------------------------------------------
// Candidates (interns) review
// ------------------------------------------------------------------

/**
 * Set a candidate's review status. 'approved' makes them visible to companies;
 * 'denied' / 'pending' hide them. The decision lives on the intern row and is
 * preserved across every sync (the sync upsert never lists these columns), so
 * denials stay put and remain visible under the admin Denied filter.
 */
export async function setCandidateReview(
  id: string,
  status: ReviewStatus,
  note?: string | null
): Promise<ActionResult> {
  const email = await requireAdmin();
  if (status !== "pending" && status !== "approved" && status !== "denied") {
    return { ok: false, error: "Invalid status." };
  }

  const admin = createAdminClient();
  const { data: updated, error } = await admin
    .from("interns")
    .update({
      review_status: status,
      reviewed_at: new Date().toISOString(),
      reviewed_by: email,
      // Only touch the note when one is explicitly provided.
      ...(note !== undefined ? { review_note: note?.trim() || null } : {}),
    })
    .eq("id", id)
    .select("email, first_name, review_status")
    .single();
  if (error) return { ok: false, error: safeError("setCandidateReview", error) };

  // On denial, send the warm "we'll help you find a regular role" email.
  // Best-effort — never fail the review action if the email can't be sent.
  if (status === "denied" && updated?.email) {
    const { ok, error: mailErr } = await sendStudentDenialEmail({
      to: updated.email,
      firstName: updated.first_name ?? null,
    });
    if (!ok && mailErr !== "email-not-configured") {
      console.error("[admin:denyCandidate:email]", mailErr);
    }
  }

  revalidatePath(CANDIDATES_PATH);
  return { ok: true };
}

// ------------------------------------------------------------------
// Sync
// ------------------------------------------------------------------

/** Manually trigger a sync (defaults to the light hourly pass). */
export async function triggerSync(
  mode: SyncMode = "hourly"
): Promise<{ ok: boolean; error?: string; result?: SyncResult }> {
  await requireAdmin();
  try {
    const result = await runSync(mode);
    revalidatePath("/admin/sync");
    return { ok: true, result };
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
}
