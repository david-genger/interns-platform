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
  profile_image_url: string | null;
  resume_path: string | null;
  airtable_modified_at: string | null;
  last_synced_at: string;
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
  created_at: string;
};
