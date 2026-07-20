/**
 * Central registry of Vercel Web Analytics custom event names.
 *
 * One source of truth so names stay consistent between the server helper
 * (`trackServer` in `analytics.ts`) and client callers, and so the full set of
 * things we measure is discoverable in one place. This module is intentionally
 * dependency-free (just string constants) so it's safe to import from either a
 * Server Component / Server Action or a Client Component.
 *
 * Event names show up verbatim in the Vercel dashboard (Analytics → Events),
 * so keep them snake_case and stable — renaming one splits its history.
 */
export const EVENTS = {
  // Company storefront — the core "are companies engaging, and with whom" signal.
  internViewed: "intern_viewed", // a candidate profile was opened
  resumeDownloaded: "resume_downloaded", // a company pulled a candidate's resume
  internsFiltered: "interns_filtered", // a facet filter was applied to the list

  // Signup funnels (one event per portal, fired only on a genuine new signup).
  companySignup: "company_signup",
  studentSignup: "student_signup",
  partnerSignup: "partner_signup",

  // Student portal engagement.
  studentProfileUpdated: "student_profile_updated",
  studentResumeUpdated: "student_resume_updated",
  studentProjectAdded: "student_project_added",

  // Partner portal engagement.
  partnerRosterUploaded: "partner_roster_uploaded",
  partnerInvitesSent: "partner_invites_sent",

  // Admin review throughput.
  candidateReviewed: "candidate_reviewed",
} as const;

export type AnalyticsEvent = (typeof EVENTS)[keyof typeof EVENTS];
