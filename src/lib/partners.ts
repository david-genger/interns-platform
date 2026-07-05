import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type PartnerUser = {
  id: string;
  email: string;
  partner_id: string | null;
  approved: boolean;
  role: string;
};

export type Partner = {
  id: string;
  name: string;
  website: string | null;
};

export type StudentStatus = "uploaded" | "invited" | "clicked" | "completed";

export type PartnerStudent = {
  id: string;
  partner_id: string;
  first_name: string | null;
  last_name: string | null;
  email: string;
  invite_token: string;
  status: StudentStatus;
  invited_at: string | null;
  clicked_at: string | null;
  completed_at: string | null;
  airtable_id: string | null;
  created_at: string;
};

/**
 * The signed-in user's partner membership (own row only, via RLS). Returns
 * null when the user has no partner_users row at all.
 */
export async function getPartnerUser(): Promise<PartnerUser | null> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return null;

  const { data } = await supabase
    .from("partner_users")
    .select("id, email, partner_id, approved, role")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();

  return (data as PartnerUser) ?? null;
}

/** The current user's partner org (RLS-scoped to their own). */
export async function getPartner(): Promise<Partner | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("partners")
    .select("id, name, website")
    .maybeSingle();
  return (data as Partner) ?? null;
}

/** The current partner's roster, newest first (RLS-scoped). */
export async function getRoster(): Promise<PartnerStudent[]> {
  const supabase = createClient();
  const { data, error } = await supabase
    .from("partner_students")
    .select(
      "id, partner_id, first_name, last_name, email, invite_token, status, invited_at, clicked_at, completed_at, airtable_id, created_at"
    )
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as PartnerStudent[];
}

export type RosterStats = {
  total: number;
  uploaded: number;
  invited: number;
  clicked: number;
  completed: number;
};

/** Funnel counts. `invited` counts everyone who has been sent an invite,
 * including those who later clicked/completed (cumulative funnel). */
export function rosterStats(roster: PartnerStudent[]): RosterStats {
  const s: RosterStats = {
    total: roster.length,
    uploaded: 0,
    invited: 0,
    clicked: 0,
    completed: 0,
  };
  for (const r of roster) {
    if (r.status === "uploaded") s.uploaded++;
    if (r.invited_at) s.invited++;
    if (r.clicked_at) s.clicked++;
    if (r.status === "completed") s.completed++;
  }
  return s;
}

/**
 * Look up a student by invite token using the service role (the invite page
 * is public — no session — so RLS can't help here).
 */
export async function getStudentByToken(
  token: string
): Promise<(PartnerStudent & { partner_name: string | null }) | null> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_students")
    .select(
      "id, partner_id, first_name, last_name, email, invite_token, status, invited_at, clicked_at, completed_at, airtable_id, created_at, partners(name)"
    )
    .eq("invite_token", token)
    .maybeSingle();
  if (!data) return null;
  const { partners, ...student } = data as PartnerStudent & {
    // Supabase types an embedded to-one relation as an array.
    partners: { name: string } | { name: string }[] | null;
  };
  const partner = Array.isArray(partners) ? partners[0] : partners;
  return { ...student, partner_name: partner?.name ?? null };
}
