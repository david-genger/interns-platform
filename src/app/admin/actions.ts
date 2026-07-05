"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import { runSync, type SyncMode, type SyncResult } from "@/lib/sync";

export type ActionResult = { ok: boolean; error?: string };

const USERS_PATH = "/admin/users";
const COMPANIES_PATH = "/admin/companies";

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
    return { ok: false, error: error.message };
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
  if (error) return { ok: false, error: error.message };
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
  if (error) return { ok: false, error: error.message };
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
  if (error) return { ok: false, error: error.message };
  revalidatePath(USERS_PATH);
  return { ok: true };
}

export async function removeUser(id: string): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin.from("company_users").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
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
  if (error) return { ok: false, error: error.message };
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
  if (error) return { ok: false, error: error.message };
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
  if (error) return { ok: false, error: error.message };
  revalidatePath(COMPANIES_PATH);
  revalidatePath(USERS_PATH);
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
