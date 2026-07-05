/**
 * Transactional email via Resend. SERVER ONLY.
 *
 * Requires:
 *   RESEND_API_KEY       — from resend.com
 *   PARTNERS_FROM_EMAIL  — e.g. "Devx Staffing <invites@devxstaffing.com>"
 *                          (the domain must be verified in Resend / DNS)
 */
import { Resend } from "resend";

const FROM =
  process.env.PARTNERS_FROM_EMAIL ?? "Devx Staffing <invites@devxstaffing.com>";

export function emailConfigured(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

function client(): Resend {
  const key = process.env.RESEND_API_KEY;
  if (!key) throw new Error("RESEND_API_KEY is not set.");
  return new Resend(key);
}

export type InviteEmail = {
  to: string;
  firstName: string | null;
  partnerName: string | null;
  link: string;
};

/**
 * Send a batch of invite emails (Resend caps a batch at 100). Returns the
 * addresses that were accepted, so callers can mark exactly those as invited.
 */
export async function sendInviteBatch(
  emails: InviteEmail[]
): Promise<{ sentTo: string[]; error?: string }> {
  if (emails.length === 0) return { sentTo: [] };
  const resend = client();

  const payload = emails.map((e) => ({
    from: FROM,
    to: e.to,
    subject: e.partnerName
      ? `${e.partnerName} invited you to join Devx`
      : "You're invited to join Devx",
    html: inviteHtml(e),
    text: inviteText(e),
  }));

  const { data, error } = await resend.batch.send(payload);
  if (error) return { sentTo: [], error: error.message };

  // Resend returns one result per item, in order. Any without an id failed.
  const sentTo: string[] = [];
  const results = (data?.data ?? []) as { id?: string }[];
  emails.forEach((e, i) => {
    if (results[i]?.id) sentTo.push(e.to);
  });
  // If Resend didn't itemise (older shape), assume the whole batch went.
  if (results.length === 0) return { sentTo: emails.map((e) => e.to) };
  return { sentTo };
}

function greeting(firstName: string | null): string {
  return firstName ? `Hi ${firstName},` : "Hi,";
}

function inviteText(e: InviteEmail): string {
  const from = e.partnerName ? `${e.partnerName} and Devx Staffing` : "Devx Staffing";
  return [
    greeting(e.firstName),
    "",
    `${from} would like to add your profile to the Devx talent platform, where vetted companies browse for interns and junior developers.`,
    "",
    "It takes about 5 minutes — upload your resume and add a few details:",
    e.link,
    "",
    "This link is unique to you. If you weren't expecting this, you can ignore it.",
    "",
    "— Devx Staffing",
  ].join("\n");
}

function inviteHtml(e: InviteEmail): string {
  const from = e.partnerName
    ? `${escapeHtml(e.partnerName)} and Devx Staffing`
    : "Devx Staffing";
  return `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td style="background:linear-gradient(90deg,#1C75BC 0%,#4A4FD6 50%,#6637ED 100%);height:6px;"></td></tr>
          <tr><td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">${greeting(
              e.firstName
            )}</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
              ${from} would like to add your profile to the <strong>Devx talent platform</strong>,
              where vetted companies browse for interns and junior developers.
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">
              It takes about 5 minutes — just upload your resume and add a few details.
            </p>
            <a href="${escapeHtml(e.link)}"
               style="display:inline-block;background:linear-gradient(90deg,#1C75BC 0%,#4A4FD6 50%,#6637ED 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:10px;">
              Set up my profile
            </a>
            <p style="margin:24px 0 0;font-size:12px;color:#94a3b8;">
              This link is unique to you. If you weren't expecting this, you can ignore this email.
            </p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} Devx Staffing</p>
      </td></tr>
    </table>
  </body>
</html>`;
}

function escapeHtml(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
