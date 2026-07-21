/**
 * Transactional email via Resend. SERVER ONLY.
 *
 * Requires:
 *   RESEND_API_KEY       — from resend.com
 *   PARTNERS_FROM_EMAIL  — e.g. "Devx Staffing <careers@interns.devxstaffing.com>"
 *                          The domain must be verified in Resend / DNS AND the
 *                          API key must be scoped to send from it. All outbound
 *                          mail (invites, signup notices, denials) uses this one
 *                          address, so it must be on the authorized domain.
 */
import { Resend } from "resend";

const FROM =
  process.env.PARTNERS_FROM_EMAIL ??
  "Devx Staffing <careers@interns.devxstaffing.com>";

/** Where new-signup / approval notifications go. Override with ADMIN_NOTIFY_EMAIL. */
const ADMIN_NOTIFY_EMAIL =
  process.env.ADMIN_NOTIFY_EMAIL ?? "david@devxstaffing.com";

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

export type CompanySignupNotice = {
  companyName: string;
  contactName: string | null;
  email: string;
  phone: string | null;
  workedWithDevx: boolean;
  /** Absolute URL to the admin users list, so David can approve in one click. */
  reviewUrl: string;
};

/**
 * Notify David that a new company signed up and is waiting for approval.
 * Best-effort: returns an error string instead of throwing so signup never
 * fails just because the notification couldn't be sent.
 */
export async function sendCompanySignupNotification(
  n: CompanySignupNotice
): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "email-not-configured" };

  const rows: [string, string][] = [
    ["Company", n.companyName],
    ["Contact", n.contactName || "—"],
    ["Email", n.email],
    ["Phone", n.phone || "—"],
    ["Worked with Devx before", n.workedWithDevx ? "Yes" : "No"],
  ];

  const textBody = [
    "A new company just signed up and is waiting for approval.",
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Approve or deny: ${n.reviewUrl}`,
  ].join("\n");

  const htmlRows = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px;white-space:nowrap;">${escapeHtml(
          k
        )}</td><td style="padding:4px 0;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(
          v
        )}</td></tr>`
    )
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="background:linear-gradient(90deg,#1C75BC 0%,#4A4FD6 50%,#6637ED 100%);height:6px;"></td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6637ED;">New company signup</p>
        <h1 style="margin:0 0 16px;font-size:18px;color:#0f172a;">${escapeHtml(
          n.companyName
        )} is waiting for approval</h1>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">${htmlRows}</table>
        <a href="${escapeHtml(
          n.reviewUrl
        )}" style="display:inline-block;background:linear-gradient(90deg,#1C75BC 0%,#4A4FD6 50%,#6637ED 100%);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:10px;">Review in admin</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const resend = client();
  const { error } = await resend.emails.send({
    from: FROM,
    to: ADMIN_NOTIFY_EMAIL,
    subject: `New signup: ${n.companyName} is waiting for approval`,
    html,
    text: textBody,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type CompanyApprovalEmail = {
  to: string;
  contactName: string | null;
  companyName: string | null;
  /** Absolute URL to the sign-in page. */
  loginUrl: string;
};

/**
 * Welcome an approved company in, with a link to sign in. Sent when an admin
 * flips their company_users row to approved — this is the ONLY login invite a
 * company gets (signup itself no longer emails a link). Best-effort: returns an
 * error string instead of throwing so approval never fails on a mail hiccup.
 */
export async function sendCompanyApprovalEmail(
  e: CompanyApprovalEmail
): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "email-not-configured" };

  const forCompany = e.companyName ? ` for ${e.companyName}` : "";
  const textBody = [
    greeting(e.contactName),
    "",
    `Good news — your Devx Staffing account${forCompany} has been approved.`,
    "",
    "You can now sign in and start browsing hand-vetted candidates:",
    e.loginUrl,
    "",
    "Sign in with the same email you signed up with.",
    "",
    "— Devx Staffing",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="background:linear-gradient(90deg,#1C75BC 0%,#4A4FD6 50%,#6637ED 100%);height:6px;"></td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">${greeting(
          e.contactName
        )}</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
          Good news — your Devx Staffing account${escapeHtml(
            forCompany
          )} has been <strong>approved</strong>. You can now sign in and start browsing hand-vetted candidates.
        </p>
        <a href="${escapeHtml(
          e.loginUrl
        )}" style="display:inline-block;background:linear-gradient(90deg,#1C75BC 0%,#4A4FD6 50%,#6637ED 100%);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:10px;">Sign in to the portal</a>
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">
          Sign in with the same email you signed up with.
        </p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} Devx Staffing</p>
  </td></tr></table>
</body></html>`;

  const resend = client();
  const { error } = await resend.emails.send({
    from: FROM,
    to: e.to,
    subject: "You're approved — welcome to Devx Staffing",
    html,
    text: textBody,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type StudentSignupNotice = {
  name: string | null;
  email: string;
  school: string | null;
  /** Absolute URL to the admin Candidates queue, so David can review in one click. */
  reviewUrl: string;
};

/**
 * Notify David that a new student signed up and is waiting for review. Same
 * best-effort contract as the company notice: returns an error string instead
 * of throwing so signup never fails on a notification hiccup.
 */
export async function sendStudentSignupNotification(
  n: StudentSignupNotice
): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "email-not-configured" };

  const rows: [string, string][] = [
    ["Name", n.name || "—"],
    ["Email", n.email],
    ["School / bootcamp", n.school || "—"],
  ];

  const textBody = [
    "A new student just signed up and is waiting for review.",
    "",
    ...rows.map(([k, v]) => `${k}: ${v}`),
    "",
    `Review candidates: ${n.reviewUrl}`,
  ].join("\n");

  const htmlRows = rows
    .map(
      ([k, v]) =>
        `<tr><td style="padding:4px 12px 4px 0;color:#64748b;font-size:13px;white-space:nowrap;">${escapeHtml(
          k
        )}</td><td style="padding:4px 0;color:#0f172a;font-size:14px;font-weight:600;">${escapeHtml(
          v
        )}</td></tr>`
    )
    .join("");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="background:linear-gradient(90deg,#1C75BC 0%,#4A4FD6 50%,#6637ED 100%);height:6px;"></td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 4px;font-size:12px;font-weight:600;letter-spacing:.05em;text-transform:uppercase;color:#6637ED;">New student signup</p>
        <h1 style="margin:0 0 16px;font-size:18px;color:#0f172a;">${escapeHtml(
          n.name || n.email
        )} is waiting for review</h1>
        <table role="presentation" cellpadding="0" cellspacing="0" style="margin:0 0 24px;">${htmlRows}</table>
        <a href="${escapeHtml(
          n.reviewUrl
        )}" style="display:inline-block;background:linear-gradient(90deg,#1C75BC 0%,#4A4FD6 50%,#6637ED 100%);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:10px;">Review candidates</a>
      </td></tr>
    </table>
  </td></tr></table>
</body></html>`;

  const resend = client();
  const { error } = await resend.emails.send({
    from: FROM,
    to: ADMIN_NOTIFY_EMAIL,
    subject: `New student: ${n.name || n.email} is waiting for review`,
    html,
    text: textBody,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type StudentApprovalEmail = {
  to: string;
  firstName: string | null;
  /** Absolute URL to the student sign-in page. */
  loginUrl: string;
};

/**
 * Tell a student their profile is approved and now visible to hiring companies,
 * with a link to sign in and keep it up to date. Best-effort (never throws).
 */
export async function sendStudentApprovalEmail(
  e: StudentApprovalEmail
): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "email-not-configured" };

  const textBody = [
    greeting(e.firstName),
    "",
    "Great news — your Devx profile has been approved and is now live to hiring companies on the Devx talent platform.",
    "",
    "You can sign in anytime to keep your resume, projects, and details up to date:",
    e.loginUrl,
    "",
    "Sign in with the same email you signed up with.",
    "",
    "— Devx Staffing",
  ].join("\n");

  const html = `<!doctype html>
<html><body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;"><tr><td align="center">
    <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#fff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
      <tr><td style="background:linear-gradient(90deg,#1C75BC 0%,#4A4FD6 50%,#6637ED 100%);height:6px;"></td></tr>
      <tr><td style="padding:32px;">
        <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">${greeting(
          e.firstName
        )}</p>
        <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
          Great news — your Devx profile has been <strong>approved</strong> and is now
          live to hiring companies on the Devx talent platform.
        </p>
        <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">
          Sign in anytime to keep your resume, projects, and details up to date.
        </p>
        <a href="${escapeHtml(
          e.loginUrl
        )}" style="display:inline-block;background:linear-gradient(90deg,#1C75BC 0%,#4A4FD6 50%,#6637ED 100%);color:#fff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:10px;">Sign in to my profile</a>
        <p style="margin:24px 0 0;font-size:13px;color:#94a3b8;">
          Sign in with the same email you signed up with.
        </p>
      </td></tr>
    </table>
    <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} Devx Staffing</p>
  </td></tr></table>
</body></html>`;

  const resend = client();
  const { error } = await resend.emails.send({
    from: FROM,
    to: e.to,
    subject: "You're approved — your Devx profile is live",
    html,
    text: textBody,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

export type StudentDenialEmail = {
  to: string;
  firstName: string | null;
};

/**
 * Send a warm denial to a student we can't feature on the talent platform. This
 * platform is for people who don't yet have professional experience; the message
 * reframes it as good news — we already have their resume and will help them find
 * a regular role through our recruitment services. Best-effort (never throws).
 */
export async function sendStudentDenialEmail(
  d: StudentDenialEmail
): Promise<{ ok: boolean; error?: string }> {
  if (!emailConfigured()) return { ok: false, error: "email-not-configured" };

  const textBody = [
    greeting(d.firstName),
    "",
    "Thanks for signing up with Devx Staffing.",
    "",
    "Our talent platform is built for people who are just starting out and don't " +
      "have professional work experience yet — so it isn't the right fit for your " +
      "profile. That's genuinely good news: it means you're further along than the " +
      "developers this platform is designed for.",
    "",
    "Here's the important part — we already have your resume on file, and our " +
      "recruitment team would love to help you find a regular role through our " +
      "staffing services. You don't need to do anything else right now; we'll be in touch.",
    "",
    "If you have any questions, just reply to this email — we're happy to help.",
    "",
    "— The Devx Staffing Team",
  ].join("\n");

  const html = `<!doctype html>
<html>
  <body style="margin:0;background:#f1f5f9;font-family:-apple-system,Segoe UI,Roboto,Helvetica,Arial,sans-serif;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="padding:32px 0;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;border:1px solid #e2e8f0;">
          <tr><td style="background:linear-gradient(90deg,#1C75BC 0%,#4A4FD6 50%,#6637ED 100%);height:6px;"></td></tr>
          <tr><td style="padding:32px;">
            <p style="margin:0 0 16px;font-size:15px;color:#0f172a;">${greeting(
              d.firstName
            )}</p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
              Thanks for signing up with <strong>Devx Staffing</strong>.
            </p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
              Our talent platform is built for people who are just starting out and
              don't have professional work experience yet — so it isn't the right fit
              for your profile. That's genuinely good news: it means you're further
              along than the developers this platform is designed for.
            </p>
            <p style="margin:0 0 16px;font-size:15px;line-height:1.6;color:#334155;">
              Here's the important part — we already have your resume on file, and our
              recruitment team would love to help you find a regular role through our
              staffing services. You don't need to do anything else right now; we'll
              be in touch.
            </p>
            <p style="margin:0 0 8px;font-size:15px;line-height:1.6;color:#334155;">
              If you have any questions, just reply to this email — we're happy to help.
            </p>
            <p style="margin:16px 0 0;font-size:15px;color:#334155;">— The Devx Staffing Team</p>
          </td></tr>
        </table>
        <p style="margin:16px 0 0;font-size:12px;color:#94a3b8;">© ${new Date().getFullYear()} Devx Staffing</p>
      </td></tr>
    </table>
  </body>
</html>`;

  const resend = client();
  const { error } = await resend.emails.send({
    from: FROM,
    to: d.to,
    subject: "About your Devx Staffing application",
    html,
    text: textBody,
  });
  if (error) return { ok: false, error: error.message };
  return { ok: true };
}

function greeting(firstName: string | null): string {
  return firstName ? `Hi ${firstName},` : "Hi,";
}

function inviteText(e: InviteEmail): string {
  const opener = e.partnerName
    ? `${e.partnerName} shared your info with us here at Devx Staffing.`
    : "You've been referred to us here at Devx Staffing.";
  return [
    greeting(e.firstName),
    "",
    `${opener} We are a recruiting firm focused specifically on tech, and we partner with bootcamps to help grads land their first real dev roles.`,
    "",
    "Part of what we offer is the Devx talent platform: it's where vetted companies come specifically to hire interns and junior developers, so it's built for exactly where you're at right now. Getting listed takes about 5 minutes — upload your resume, add a couple details, and you're in front of hiring teams.",
    e.link,
    "",
    "Excited to have you on there!",
    "",
    "This link is unique to you. If you weren't expecting this, you can ignore it.",
    "",
    "— Devx Staffing",
  ].join("\n");
}

function inviteHtml(e: InviteEmail): string {
  const opener = e.partnerName
    ? `${escapeHtml(e.partnerName)} shared your info with us here at Devx Staffing.`
    : "You've been referred to us here at Devx Staffing.";
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
              ${opener} We are a recruiting firm focused specifically on tech, and we
              partner with bootcamps to help grads land their first real dev roles.
            </p>
            <p style="margin:0 0 24px;font-size:15px;line-height:1.6;color:#334155;">
              Part of what we offer is the <strong>Devx talent platform</strong>: it's where
              vetted companies come specifically to hire interns and junior developers, so it's
              built for exactly where you're at right now. Getting listed takes about 5 minutes —
              upload your resume, add a couple details, and you're in front of hiring teams.
            </p>
            <a href="${escapeHtml(e.link)}"
               style="display:inline-block;background:linear-gradient(90deg,#1C75BC 0%,#4A4FD6 50%,#6637ED 100%);color:#ffffff;text-decoration:none;font-size:15px;font-weight:600;padding:12px 24px;border-radius:10px;">
              Set up my profile
            </a>
            <p style="margin:24px 0 0;font-size:15px;line-height:1.6;color:#334155;">
              Excited to have you on there!
            </p>
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
