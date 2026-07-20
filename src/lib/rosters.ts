/**
 * Roster + invite engine, shared by the partners portal and the admin console.
 *
 * Every function here is parameterized by `partnerId` and does NO auth of its
 * own — the caller owns the gate. The partners portal wraps these with
 * `requireApprovedPartner()` (scoped to the caller's own org); the admin console
 * wraps them with `requireAdmin()` and an explicit partnerId, so David can act
 * on any bootcamp's behalf. Identical behavior either way, which is exactly what
 * makes the flow backwards-compatible when a bootcamp later self-serves: it's
 * the same data keyed on the same partner_id.
 *
 * All writes use the service-role client (roster tables are read-only under RLS).
 */
import { createAdminClient } from "@/lib/supabase/admin";
import { headers } from "next/headers";
import { sendInviteBatch, emailConfigured, type InviteEmail } from "@/lib/email";
import type { RosterRow } from "@/lib/csv";

/** Days an invite link stays valid after it's (re)sent. */
const INVITE_TTL_DAYS = 30;
function inviteExpiry(): string {
  return new Date(Date.now() + INVITE_TTL_DAYS * 24 * 60 * 60 * 1000).toISOString();
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

export type AddStudentsResult = {
  ok: boolean;
  added: number;
  skipped: number;
  error?: string;
};

function safeError(context: string, err: unknown): string {
  console.error(`[rosters:${context}]`, err);
  return "Something went wrong. Please try again.";
}

/**
 * Insert roster rows for a partner. Emails already on that partner's roster are
 * skipped. Rows land as `status = 'uploaded'`; nothing is emailed until an
 * explicit send. The roster stays local — no Airtable record is created until
 * the student actually signs up.
 */
export async function addStudentsToRoster(
  partnerId: string,
  rows: RosterRow[]
): Promise<AddStudentsResult> {
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

  return {
    ok: true,
    added: toInsert.length,
    skipped: clean.length - toInsert.length,
  };
}

export type SendInvitesResult = {
  ok: boolean;
  sent: number;
  failed: number;
  error?: string;
};

/** Send invites to every not-yet-invited roster student for a partner. */
export async function sendPartnerInvites(
  partnerId: string
): Promise<SendInvitesResult> {
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

  return { ok: true, sent, failed };
}

/** Re-send (or first-send) the invite for a single roster student. */
export async function resendPartnerInvite(
  partnerId: string,
  studentId: string
): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) {
    return { ok: false, error: "Email isn't configured yet." };
  }

  const admin = createAdminClient();
  const { data: student } = await admin
    .from("partner_students")
    .select("id, first_name, email, invite_token, status, partner_id")
    .eq("id", studentId)
    .maybeSingle();

  // Scope to the given partner — the caller's gate already resolved partnerId.
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

  // Bump invited_at and refresh the link's expiry; only advance an un-invited
  // student to "invited" (never regress someone who already clicked/completed).
  const update: Record<string, unknown> = {
    invited_at: new Date().toISOString(),
    expires_at: inviteExpiry(),
  };
  if (student.status === "uploaded") update.status = "invited";
  await admin.from("partner_students").update(update).eq("id", studentId);

  return { ok: true };
}

/**
 * Update the roster funnel when a student completes signup, so bootcamp staff
 * can see who landed and whether it came from their invite email.
 *
 *   - With an invite token: mark THAT roster row completed, attributed 'invite'.
 *   - Otherwise: match any not-yet-completed roster row on email and attribute
 *     it 'direct' — so a student who ignores the invite but signs up directly
 *     still shows as landed for their bootcamp.
 *
 * Best-effort and idempotent: a completed row is never regressed.
 */
export async function linkRosterOnSignup(opts: {
  inviteToken: string | null;
  email: string;
  airtableId: string;
}): Promise<void> {
  const admin = createAdminClient();
  const now = new Date().toISOString();
  const email = opts.email.trim().toLowerCase();

  if (opts.inviteToken) {
    await admin
      .from("partner_students")
      .update({
        status: "completed",
        completed_at: now,
        completed_via: "invite",
        airtable_id: opts.airtableId,
      })
      .eq("invite_token", opts.inviteToken)
      .neq("status", "completed");
    return;
  }

  // Direct signup: attribute to any roster row this email is on.
  await admin
    .from("partner_students")
    .update({
      status: "completed",
      completed_at: now,
      completed_via: "direct",
      airtable_id: opts.airtableId,
    })
    .eq("email", email)
    .neq("status", "completed");
}
