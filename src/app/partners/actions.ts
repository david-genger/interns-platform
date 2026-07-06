"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { getPartnerUser } from "@/lib/partners";
import type { RosterRow } from "@/lib/csv";
import { sendInviteBatch, emailConfigured, type InviteEmail } from "@/lib/email";
import { revalidatePath } from "next/cache";
import { headers } from "next/headers";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/** Days an invite link stays valid after it's (re)sent. */
const INVITE_TTL_DAYS = 30;
function inviteExpiry(): string {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
}

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

export type AddStudentsResult = {
  ok: boolean;
  added: number;
  skipped: number;
  error?: string;
};

/**
 * Insert roster rows for the caller's partner. Emails already on the roster are
 * skipped (not re-invited). Rows land as `status = 'uploaded'`; nothing is
 * emailed until the staff member explicitly clicks "Send invites".
 */
export async function addStudents(
  rows: RosterRow[]
): Promise<AddStudentsResult> {
  let partnerId: string;
  try {
    ({ partnerId } = await requireApprovedPartner());
  } catch (e) {
    return { ok: false, added: 0, skipped: 0, error: (e as Error).message };
  }

  const clean = rows
    .map((r) => ({ ...r, email: r.email.trim().toLowerCase() }))
    .filter((r) => r.email);
  if (clean.length === 0) return { ok: true, added: 0, skipped: 0 };

  const admin = createAdminClient();
  const emails = clean.map((r) => r.email);

  const { data: existing } = await admin
    .from("partner_students")
    .select("email")
    .eq("partner_id", partnerId)
    .in("email", emails);
  const existingSet = new Set(
    (existing ?? []).map((e) => (e.email as string).toLowerCase())
  );

  const toInsert = clean.filter((r) => !existingSet.has(r.email));
  if (toInsert.length > 0) {
    const { error } = await admin.from("partner_students").insert(
      toInsert.map((r) => ({
        partner_id: partnerId,
        first_name: r.first_name,
        last_name: r.last_name,
        email: r.email,
        status: "uploaded",
      }))
    );
    if (error) {
      return { ok: false, added: 0, skipped: 0, error: safeError("addStudents", error) };
    }
  }

  revalidatePath("/partners");
  return {
    ok: true,
    added: toInsert.length,
    skipped: clean.length - toInsert.length,
  };
}

/** Absolute base URL for invite links (prefers the configured site URL). */
function siteBase(): string {
  const configured = process.env.NEXT_PUBLIC_SITE_URL;
  if (configured) return configured.replace(/\/$/, "");
  const h = headers();
  const host = h.get("host");
  const proto = h.get("x-forwarded-proto") ?? "https";
  return `${proto}://${host}`;
}

export type SendInvitesResult = {
  ok: boolean;
  sent: number;
  failed: number;
  error?: string;
};

/** Send invites to every roster student who hasn't been invited yet. */
export async function sendInvites(): Promise<SendInvitesResult> {
  let partnerId: string;
  try {
    ({ partnerId } = await requireApprovedPartner());
  } catch (e) {
    return { ok: false, sent: 0, failed: 0, error: (e as Error).message };
  }
  if (!emailConfigured()) {
    return {
      ok: false,
      sent: 0,
      failed: 0,
      error: "Email isn't configured yet (missing RESEND_API_KEY).",
    };
  }

  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partners")
    .select("name")
    .eq("id", partnerId)
    .maybeSingle();

  const { data: students } = await admin
    .from("partner_students")
    .select("id, first_name, email, invite_token")
    .eq("partner_id", partnerId)
    .eq("status", "uploaded");

  const pending = students ?? [];
  if (pending.length === 0) return { ok: true, sent: 0, failed: 0 };

  const base = siteBase();
  let sent = 0;
  let failed = 0;

  // Resend batches cap at 100.
  for (let i = 0; i < pending.length; i += 100) {
    const chunk = pending.slice(i, i + 100);
    const emails: InviteEmail[] = chunk.map((s) => ({
      to: s.email as string,
      firstName: (s.first_name as string) ?? null,
      partnerName: (partner?.name as string) ?? null,
      link: `${base}/invite/${s.invite_token}`,
    }));

    const { sentTo, error } = await sendInviteBatch(emails);
    if (error) {
      failed += chunk.length;
      continue;
    }
    const sentSet = new Set(sentTo);
    const sentIds = chunk
      .filter((s) => sentSet.has(s.email as string))
      .map((s) => s.id as string);
    failed += chunk.length - sentIds.length;

    if (sentIds.length > 0) {
      await admin
        .from("partner_students")
        .update({
          status: "invited",
          invited_at: new Date().toISOString(),
          expires_at: inviteExpiry(),
        })
        .in("id", sentIds);
      sent += sentIds.length;
    }
  }

  revalidatePath("/partners");
  return { ok: true, sent, failed };
}

/** Re-send (or first-send) the invite for a single student. */
export async function resendInvite(
  studentId: string
): Promise<{ ok: boolean; error?: string }> {
  let partnerId: string;
  try {
    ({ partnerId } = await requireApprovedPartner());
  } catch (e) {
    return { ok: false, error: (e as Error).message };
  }
  if (!emailConfigured()) {
    return { ok: false, error: "Email isn't configured yet." };
  }

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("partner_students")
    .select("id, first_name, email, invite_token, status, partner_id")
    .eq("id", studentId)
    .maybeSingle();

  // Scope to the caller's own partner.
  if (!student || student.partner_id !== partnerId) {
    return { ok: false, error: "Student not found." };
  }

  const { data: partner } = await admin
    .from("partners")
    .select("name")
    .eq("id", partnerId)
    .maybeSingle();

  const base = siteBase();
  const { sentTo, error } = await sendInviteBatch([
    {
      to: student.email as string,
      firstName: (student.first_name as string) ?? null,
      partnerName: (partner?.name as string) ?? null,
      link: `${base}/invite/${student.invite_token}`,
    },
  ]);
  if (error || sentTo.length === 0) {
    return { ok: false, error: error ?? "Couldn't send the email." };
  }

  // Bump invited_at and refresh the link's expiry (reviving an expired link);
  // only advance an un-invited student to "invited" (don't regress someone who
  // already clicked or completed).
  const update: Record<string, unknown> = {
    invited_at: new Date().toISOString(),
    expires_at: inviteExpiry(),
  };
  if (student.status === "uploaded") update.status = "invited";
  await admin.from("partner_students").update(update).eq("id", studentId);

  revalidatePath("/partners");
  return { ok: true };
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

  const { data: partner, error: partnerErr } = await admin
    .from("partners")
    .insert({ name: orgName, website: website || null })
    .select("id")
    .single();
  if (partnerErr) return { ok: false, error: safeError("registerPartner:partner", partnerErr) };

  const { error: userErr } = await admin.from("partner_users").insert({
    email,
    partner_id: partner.id,
    approved: false,
    role: "staff",
  });
  if (userErr) return { ok: false, error: safeError("registerPartner:user", userErr) };

  return { ok: true };
}
