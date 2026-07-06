export type Intern = {
  id: string;
  airtable_id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  headline: string | null;
  summary: string | null;
  technologies: string[];
  tech_categories: string[];
  intern_year: string | null;
  expected_graduation: string | null;
  educational_institution: string | null;
  location: string | null;
  city: string | null;
  state: string | null;
  country: string | null;
  remote_preference: string | null;
  email: string | null;
  phone: string | null;
  linkedin_url: string | null;
  profile_image_url: string | null;
  resume_path: string | null;
  review_status: ReviewStatus;
  reviewed_at: string | null;
  reviewed_by: string | null;
  review_note: string | null;
  airtable_modified_at: string | null;
  last_synced_at: string;
};

/** Candidate approval gate. Companies only ever see `approved` interns. */
export type ReviewStatus = "pending" | "approved" | "denied";

/** A live project link an intern publishes. Supabase-only (not in Airtable). */
export type InternProject = {
  id: string;
  intern_id: string;
  url: string;
  title: string | null;
  sort_order: number;
  created_at: string;
};

export type InternFilters = {
  q?: string;
  tech?: string;
  internYear?: string;
  school?: string;
  location?: string;
};

export type ViewMode = "grid" | "list";

export type Company = {
  id: string;
  name: string;
  domain: string | null;
  created_at: string;
};

export type UserRole = "viewer" | "admin";

export type CompanyUser = {
  id: string;
  email: string;
  company_id: string | null;
  approved: boolean;
  role: string; // 'viewer' | 'admin'
  full_name: string | null;
  phone: string | null;
  worked_with_devx: boolean;
  created_at: string;
};
