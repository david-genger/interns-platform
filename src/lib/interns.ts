import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Intern, InternFilters, InternProject } from "@/lib/types";

const COLUMNS =
  "id, airtable_id, name, first_name, last_name, headline, summary, technologies, tech_categories, intern_year, expected_graduation, educational_institution, location, city, state, country, remote_preference, email, phone, linkedin_url, profile_image_url, resume_path, review_status, reviewed_at, reviewed_by, review_note, airtable_modified_at, last_synced_at";

const PROJECT_COLUMNS = "id, intern_id, url, title, sort_order, created_at";

/** List interns for the logged-in (approved) user. RLS enforces access. */
export async function getInterns(filters: InternFilters): Promise<Intern[]> {
  const supabase = createClient();
  let query = supabase
    .from("interns")
    .select(COLUMNS)
    .order("name", { ascending: true })
    .limit(200);

  // Search is name-only.
  if (filters.q) query = query.ilike("name", `%${filters.q}%`);
  if (filters.tech) query = query.contains("technologies", [filters.tech]);
  if (filters.internYear) query = query.eq("intern_year", filters.internYear);
  if (filters.school) query = query.eq("educational_institution", filters.school);
  if (filters.location) query = query.eq("location", filters.location);

  const { data, error } = await query;
  if (error) throw new Error(error.message);
  return (data ?? []) as Intern[];
}

export async function getIntern(id: string): Promise<Intern | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("interns")
    .select(COLUMNS)
    .eq("id", id)
    .maybeSingle();
  return (data as Intern) ?? null;
}

/** Distinct filter facet values, derived from the synced set. */
export async function getFacets() {
  const supabase = createClient();
  const { data } = await supabase
    .from("interns")
    .select("technologies, intern_year, educational_institution, location")
    .limit(1000);

  const tech = new Set<string>();
  const years = new Set<string>();
  const schools = new Set<string>();
  const locations = new Set<string>();
  for (const row of data ?? []) {
    (row.technologies as string[] | null)?.forEach((t) => tech.add(t));
    if (row.intern_year) years.add(row.intern_year as string);
    if (row.educational_institution)
      schools.add(row.educational_institution as string);
    if (row.location) locations.add(row.location as string);
  }
  return {
    technologies: [...tech].sort(),
    internYears: [...years].sort().reverse(),
    schools: [...schools].sort(),
    locations: [...locations].sort(),
  };
}

/**
 * Resolve the logged-in student's OWN intern record by email match. RLS's
 * "student reads own row" policy limits this to their single row. Returns null
 * if the signed-in email doesn't match any intern (e.g. a company user, or a
 * student who used the wrong email).
 */
export async function getMyIntern(): Promise<Intern | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data } = await supabase
    .from("interns")
    .select(COLUMNS)
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  return (data as Intern) ?? null;
}

/**
 * Read an intern's published projects. RLS limits this to APPROVED interns for
 * company users, so a pending candidate's links never leak. Ordered for display.
 */
export async function getProjects(internId: string): Promise<InternProject[]> {
  const supabase = createClient();
  const { data } = await supabase
    .from("intern_projects")
    .select(PROJECT_COLUMNS)
    .eq("intern_id", internId)
    .order("sort_order", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []) as InternProject[];
}

/** Read the logged-in student's OWN projects (RLS "student reads own projects"). */
export async function getMyProjects(): Promise<InternProject[]> {
  const intern = await getMyIntern();
  if (!intern) return [];
  return getProjects(intern.id);
}

/** Mint a short-lived signed URL for the logged-in student's own resume. */
export async function getMyResumeSignedUrl(): Promise<string | null> {
  const intern = await getMyIntern();
  if (!intern?.resume_path) return null;

  const admin = createAdminClient();
  const { data } = await admin.storage
    .from("resumes")
    .createSignedUrl(intern.resume_path, 60 * 5); // 5 minutes
  return data?.signedUrl ?? null;
}

/**
 * Verify the caller is approved, then mint a short-lived signed URL for an
 * intern's resume (private bucket). Returns null if not allowed / no resume.
 */
export async function getResumeSignedUrl(id: string): Promise<string | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data: membership } = await supabase
    .from("company_users")
    .select("approved")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  if (!membership?.approved) return null;

  const intern = await getIntern(id);
  if (!intern?.resume_path) return null;

  const admin = createAdminClient();
  const { data } = await admin.storage
    .from("resumes")
    .createSignedUrl(intern.resume_path, 60 * 5); // 5 minutes
  return data?.signedUrl ?? null;
}
