"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/admin";
import { createAdminClient } from "@/lib/supabase/admin";
import type { RosterRow } from "@/lib/csv";
import {
  addStudentsToRoster,
  sendPartnerInvites,
  resendPartnerInvite,
  type AddStudentsResult,
  type SendInvitesResult,
} from "@/lib/rosters";

export type ActionResult = { ok: boolean; error?: string };

function safeError(context: string, err: unknown): string {
  console.error(`[admin:partners:${context}]`, err);
  return "Something went wrong. Please try again.";
}

const LIST_PATH = "/admin/partners";
const detailPath = (id: string) => `/admin/partners/${id}`;

/**
 * Upload a roster on a bootcamp's behalf. Same engine the partner portal uses
 * (`@/lib/rosters`), just gated by requireAdmin with an explicit partnerId so
 * David can act for any org. Bound to partnerId when passed to the client.
 */
export async function adminAddStudents(
  partnerId: string,
  rows: RosterRow[]
): Promise<AddStudentsResult> {
  await requireAdmin();
  const res = await addStudentsToRoster(partnerId, rows);
  if (res.ok) {
    revalidatePath(detailPath(partnerId));
    revalidatePath(LIST_PATH);
  }
  return res;
}

/** Send invites to a bootcamp's not-yet-invited students, on their behalf. */
export async function adminSendInvites(
  partnerId: string
): Promise<SendInvitesResult> {
  await requireAdmin();
  const res = await sendPartnerInvites(partnerId);
  if (res.ok) {
    revalidatePath(detailPath(partnerId));
    revalidatePath(LIST_PATH);
  }
  return res;
}

/** Re-send (or first-send) one student's invite, on the bootcamp's behalf. */
export async function adminResendInvite(
  partnerId: string,
  studentId: string
): Promise<ActionResult> {
  await requireAdmin();
  const res = await resendPartnerInvite(partnerId, studentId);
  if (res.ok) revalidatePath(detailPath(partnerId));
  return res;
}

/**
 * Create a bootcamp / college org. Deduped by name (case-insensitive) so the
 * same school never splits into two rows — a bootcamp that later self-serves
 * lands on the exact org David has been managing.
 */
export async function adminCreatePartner(
  formData: FormData
): Promise<ActionResult> {
  await requireAdmin();
  const name = String(formData.get("name") ?? "").trim();
  const website = String(formData.get("website") ?? "").trim() || null;
  if (!name) return { ok: false, error: "Enter a name." };

  const admin = createAdminClient();
  const { data: existing } = await admin
    .from("partners")
    .select("id")
    .ilike("name", name)
    .maybeSingle();
  if (existing) {
    return { ok: false, error: "A partner with that name already exists." };
  }

  const { error } = await admin.from("partners").insert({ name, website });
  if (error) return { ok: false, error: safeError("createPartner", error) };

  revalidatePath(LIST_PATH);
  return { ok: true };
}

/** Approve / un-approve a partner staff account. */
export async function adminSetPartnerStaffApproved(
  id: string,
  approved: boolean
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("partner_users")
    .update({ approved })
    .eq("id", id);
  if (error) return { ok: false, error: safeError("approveStaff", error) };
  revalidatePath(LIST_PATH);
  return { ok: true };
}

/**
 * Assign a staff account to a specific bootcamp / college org — how David hands
 * a signed-up staffer the exact list he's been managing. Their portal is scoped
 * by this partner_id (RLS `current_partner_id`), so they immediately manage that
 * org's roster and history. Pass null to unassign.
 */
export async function adminSetPartnerStaffPartner(
  id: string,
  partnerId: string | null
): Promise<ActionResult> {
  await requireAdmin();
  const admin = createAdminClient();
  const { error } = await admin
    .from("partner_users")
    .update({ partner_id: partnerId })
    .eq("id", id);
  if (error) return { ok: false, error: safeError("assignStaff", error) };
  revalidatePath(LIST_PATH);
  return { ok: true };
}
