import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Intern, InternFilters } from "@/lib/types";

const COLUMNS =
  "id, airtable_id, name, first_name, last_name, headline, summary, technologies, tech_categories, experience_level, intern_year, expected_graduation, educational_institution, institution_type, location, city, state, country, remote_preference, rating_total, rating_technical, rating_soft, rating_frontend, rating_backend, rating_db, rating_cloud, profile_image_url, resume_path, airtable_modified_at, last_synced_at";

/** List interns for the logged-in (approved) user. RLS enforces access. */
export async function getInterns(filters: InternFilters): Promise<Intern[]> {
  const supabase = createClient();
  let query = supabase
    .from("interns")
    .select(COLUMNS)
    .order("rating_total", { ascending: false, nullsFirst: false })
    .limit(200);

  if (filters.q) {
    const q = `%${filters.q}%`;
    query = query.or(
      `name.ilike.${q},headline.ilike.${q},educational_institution.ilike.${q}`
    );
  }
  if (filters.tech) query = query.contains("technologies", [filters.tech]);
  if (filters.internYear) query = query.eq("intern_year", filters.internYear);
  if (filters.experienceLevel)
    query = query.eq("experience_level", filters.experienceLevel);
  if (filters.institutionType)
    query = query.eq("institution_type", filters.institutionType);
  if (filters.minRating) query = query.gte("rating_total", filters.minRating);

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
    .select("technologies, intern_year, experience_level")
    .limit(1000);

  const tech = new Set<string>();
  const years = new Set<string>();
  const levels = new Set<string>();
  for (const row of data ?? []) {
    (row.technologies as string[] | null)?.forEach((t) => tech.add(t));
    if (row.intern_year) years.add(row.intern_year as string);
    if (row.experience_level) levels.add(row.experience_level as string);
  }
  return {
    technologies: [...tech].sort(),
    internYears: [...years].sort().reverse(),
    experienceLevels: [...levels].sort(),
  };
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
