"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPartnerUser } from "@/lib/partners";
import type { RosterRow } from "@/lib/csv";
import {
  addStudentsToRoster,
  sendPartnerInvites,
  resendPartnerInvite,
  type AddStudentsResult,
  type SendInvitesResult,
} from "@/lib/rosters";
import { revalidatePath } from "next/cache";
import { rateLimit, clientIp } from "@/lib/rate-limit";
import { trackServer } from "@/lib/analytics";
import { EVENTS } from "@/lib/analytics-events";

export type { AddStudentsResult, SendInvitesResult };

/**
 * Log the real error server-side and return a generic message. Keeps Postgres
 * schema/constraint details out of responses that reach untrusted clients.
 */
function safeError(context: string, err: unknown): string {
  console.error(`[partners:${context}]`, err);
  return "Something went wrong. Please try again.";
}

export type RegisterResult = { ok: true } | { ok: false; error: string };

/**
 * Resolve the signed-in, approved partner staff member and their partner_id.
 * Throws if the caller isn't an approved partner user — every roster/invite
 * action runs through this so writes are always scoped to the caller's org.
 * The shared roster engine (`@/lib/rosters`) does the work; these thin wrappers
 * just supply the gate + the caller's partnerId.
 */
async function requireApprovedPartner(): Promise<{
  email: string;
  partnerId: string;
}> {
  const pu = await getPartnerUser();
  if (!pu?.approved || !pu.partner_id) {
    throw new Error("Not authorized.");
  }
  return { email: pu.email, partnerId: pu.partner_id };
}

/** Upload roster rows for the caller's own partner. */
export async function addStudents(
  rows: RosterRow[]
): Promise<AddStudentsResult> {
  let partnerId: string;
  try {
    ({ partnerId } = await requireApprovedPartner());
  } catch (e) {
    return { ok: false, added: 0, skipped: 0, error: (e as Error).message };
  }
  const res = await addStudentsToRoster(partnerId, rows);
  if (res.ok) {
    revalidatePath("/partners");
    await trackServer(EVENTS.partnerRosterUploaded, { added: res.added });
  }
  return res;
}

/** Send invites to every not-yet-invited student on the caller's roster. */
export async function sendInvites(): Promise<SendInvitesResult> {
  let partnerId: string;
  try {
    ({ partnerId } = await requireApprovedPartner());
  } catch (e) {
    return { ok: false, sent: 0, failed: 0, error: (e as Error).message };
  }
  const res = await sendPartnerInvites(partnerId);
  if (res.ok) {
    revalidatePath("/partners");
    await trackServer(EVENTS.partnerInvitesSent, { sent: res.sent });
  }
  return res;
}

/** Re-send (or first-send) the invite for one of the caller's students. */
export async function resendInvite(
  studentId: string
): Promise<{ ok: boolean; error?: string }> {
  let partnerId: string;
  try {
    ({ partnerId } = await requireApprovedPartner());
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  const res = await resendPartnerInvite(partnerId, studentId);
  if (res.ok) revalidatePath("/partners");
  return res;
}

/**
 * Self-serve partner signup. Creates the partner org (if new for this email)
 * and a PENDING partner_users row. Approval is manual (David flips
 * `approved = true` in Supabase for v1). After this, the client sends a magic
 * link so the staff member can sign in and land on the pending screen.
 *
 * Uses the service role because the visitor has no session yet and RLS would
 * otherwise block the insert.
 */
export async function registerPartner(input: {
  orgName: string;
  website: string;
  email: string;
}): Promise<RegisterResult> {
  // Public endpoint — throttle per IP to blunt signup floods.
  if (!rateLimit(`registerPartner:${clientIp()}`, 5, 10 * 60 * 1000).ok) {
    return { ok: false, error: "Too many attempts. Please try again shortly." };
  }

  const email = input.email.trim().toLowerCase();
  const orgName = input.orgName.trim();
  const website = input.website.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { ok: false, error: "Enter a valid email address." };
  }
  if (!orgName) {
    return { ok: false, error: "Enter your bootcamp or college name." };
  }

  const admin = createAdminClient();

  // Already registered? Leave their row (and approval) untouched — just let the
  // client send a fresh magic link so they can sign back in.
  const { data: existing } = await admin
    .from("partner_users")
    .select("id")
    .eq("email", email)
    .maybeSingle();
  if (existing) return { ok: true };

  // Reuse an existing org with the same name (case-insensitive) instead of
  // splitting one bootcamp across two rows — so a self-serve signup lands on the
  // exact org David has been managing, inheriting its roster and history.
  let partnerId: string;
  const { data: existingPartner } = await admin
    .from("partners")
    .select("id")
    .ilike("name", orgName)
    .maybeSingle();
  if (existingPartner) {
    partnerId = existingPartner.id as string;
  } else {
    const { data: partner, error: partnerErr } = await admin
      .from("partners")
      .insert({ name: orgName, website: website || null })
      .select("id")
      .single();
    if (partnerErr) {
      return { ok: false, error: safeError("registerPartner:partner", partnerErr) };
    }
    partnerId = partner.id as string;
  }

  const { error: userErr } = await admin.from("partner_users").insert({
    email,
    partner_id: partnerId,
    approved: false,
    role: "staff",
  });
  if (userErr) return { ok: false, error: safeError("registerPartner:user", userErr) };

  await trackServer(EVENTS.partnerSignup);

  return { ok: true };
}
