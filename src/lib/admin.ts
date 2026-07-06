import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Company, CompanyUser, Intern, ReviewStatus } from "@/lib/types";

const INTERN_COLUMNS =
  "id, airtable_id, name, first_name, last_name, headline, summary, technologies, tech_categories, intern_year, expected_graduation, educational_institution, location, city, state, country, remote_preference, email, phone, linkedin_url, profile_image_url, resume_path, review_status, reviewed_at, reviewed_by, review_note, airtable_modified_at, last_synced_at";

/**
 * Authoritative admin gate for Server Components / Server Actions. Verifies the
 * caller is a signed-in, approved user with `company_users.role = 'admin'`.
 * The membership read runs under the user's own JWT (RLS lets a user read their
 * own row), so this never depends on the service role. Redirects otherwise.
 * Returns the caller's email for convenience.
 */
export async function requireAdmin(): Promise<string> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) redirect("/login");

  const email = user.email.toLowerCase();
  const { data: membership } = await supabase
    .from("company_users")
    .select("approved, role")
    .eq("email", email)
    .maybeSingle();

  if (!membership?.approved) redirect("/pending");
  if (membership.role !== "admin") redirect("/interns");

  return email;
}

/** All companies, alphabetical. Service role (bypasses RLS) — admin-gated callers only. */
export async function listCompanies(): Promise<Company[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("companies")
    .select("id, name, domain, created_at")
    .order("name", { ascending: true });
  if (error) throw new Error(error.message);
  return (data ?? []) as Company[];
}

/** All company users, newest first. Service role — admin-gated callers only. */
export async function listCompanyUsers(): Promise<CompanyUser[]> {
  const admin = createAdminClient();
  const { data, error } = await admin
    .from("company_users")
    .select(
      "id, email, company_id, approved, role, full_name, phone, worked_with_devx, created_at"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CompanyUser[];
}

// ------------------------------------------------------------------
// Candidates (interns) review
// ------------------------------------------------------------------

/**
 * Candidates for the admin review queue. Service role — reads EVERY intern
 * (pending / approved / denied), bypassing the company RLS gate. Filter by
 * status, or pass nothing / "all" for the full list. Pending first (the work
 * queue), then most recently synced.
 */
export async function listCandidates(
  status?: ReviewStatus | "all"
): Promise<Intern[]> {
  const admin = createAdminClient();
  let query = admin
    .from("interns")
    .select(INTERN_COLUMNS)
    .order("last_synced_at", { ascending: false });
  if (status && status !== "all") query = query.eq("review_status", status);
  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Intern[];
}

/** Count of candidates by review_status, for the filter tabs. */
export async function getCandidateCounts(): Promise<
  Record<ReviewStatus | "all", number>
> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("interns").select("review_status");
  if (error) throw new Error(error.message);
  const counts = { all: 0, pending: 0, approved: 0, denied: 0 } as Record<
    ReviewStatus | "all",
    number
  >;
  for (const row of data ?? []) {
    const s = (row as { review_status: ReviewStatus }).review_status;
    counts.all += 1;
    if (s === "pending" || s === "approved" || s === "denied") counts[s] += 1;
  }
  return counts;
}

/** Mint a short-lived signed URL for a candidate's resume. Admin-gated. */
export async function getCandidateResumeSignedUrl(
  id: string
): Promise<string | null> {
  await requireAdmin();
  const admin = createAdminClient();
  const { data: intern } = await admin
    .from("interns")
    .select("resume_path")
    .eq("id", id)
    .maybeSingle();
  const path = (intern as { resume_path: string | null } | null)?.resume_path;
  if (!path) return null;
  const { data } = await admin.storage
    .from("resumes")
    .createSignedUrl(path, 60 * 5); // 5 minutes
  return data?.signedUrl ?? null;
}

/** Count of company users per company_id, for the companies list. */
export async function getCompanyUserCounts(): Promise<Record<string, number>> {
  const admin = createAdminClient();
  const { data, error } = await admin.from("company_users").select("company_id");
  if (error) throw new Error(error.message);
  const counts: Record<string, number> = {};
  for (const row of data ?? []) {
    const id = (row as { company_id: string | null }).company_id;
    if (id) counts[id] = (counts[id] ?? 0) + 1;
  }
  return counts;
}

/** Sync visibility: total interns + most recent `last_synced_at`. */
export async function getSyncStatus(): Promise<{
  internCount: number;
  lastSyncedAt: string | null;
}> {
  const admin = createAdminClient();
  const [{ count }, { data }] = await Promise.all([
    admin.from("interns").select("id", { count: "exact", head: true }),
    admin
      .from("interns")
      .select("last_synced_at")
      .order("last_synced_at", { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);
  return {
    internCount: count ?? 0,
    lastSyncedAt: (data?.last_synced_at as string | undefined) ?? null,
  };
}
