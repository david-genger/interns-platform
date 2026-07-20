/**
 * Admin-side reads for the bootcamp / college console. Service-role (bypasses
 * RLS) — every caller is behind `requireAdmin()` (the admin layout gate + an
 * explicit check in each page). Gives David the same visibility a bootcamp has
 * of its own roster, across ALL partners, keyed on the single canonical
 * `partners` list.
 */
import { createAdminClient } from "@/lib/supabase/admin";
import type { PartnerStudent } from "@/lib/partners";
import type { ReviewStatus } from "@/lib/types";

export type PartnerOverview = {
  id: string;
  name: string;
  website: string | null;
  /** Roster funnel. */
  onRoster: number;
  invited: number;
  completed: number;
  /** Candidates linked to this partner (signed up), regardless of roster. */
  signedUp: number;
  /** Staff accounts awaiting approval. */
  pendingStaff: number;
};

/** Every partner with roster funnel + signed-up counts, alphabetical. */
export async function listPartnersOverview(): Promise<PartnerOverview[]> {
  const admin = createAdminClient();
  const [partnersRes, studentsRes, internsRes, usersRes] = await Promise.all([
    admin.from("partners").select("id, name, website").order("name"),
    admin
      .from("partner_students")
      .select("partner_id, status, invited_at, completed_at"),
    admin.from("interns").select("partner_id"),
    admin.from("partner_users").select("partner_id, approved"),
  ]);

  const students = studentsRes.data ?? [];
  const interns = internsRes.data ?? [];
  const users = usersRes.data ?? [];

  return (partnersRes.data ?? []).map((p) => {
    const pid = p.id as string;
    const roster = students.filter((s) => s.partner_id === pid);
    return {
      id: pid,
      name: (p.name as string) ?? "",
      website: (p.website as string) ?? null,
      onRoster: roster.length,
      invited: roster.filter((s) => s.invited_at).length,
      completed: roster.filter((s) => s.status === "completed").length,
      signedUp: interns.filter((i) => i.partner_id === pid).length,
      pendingStaff: users.filter((u) => u.partner_id === pid && !u.approved)
        .length,
    };
  });
}

/** A candidate who signed up under a partner, for the grouped-by-year view. */
export type PartnerIntern = {
  id: string;
  name: string | null;
  first_name: string | null;
  last_name: string | null;
  email: string | null;
  intern_year: string | null;
  review_status: ReviewStatus;
};

export type PartnerDetail = {
  id: string;
  name: string;
  website: string | null;
  roster: PartnerStudent[];
  /** Signed-up candidates linked to this partner, grouped by intern year. */
  internsByYear: { year: string; interns: PartnerIntern[] }[];
};

/** Full detail for one partner: org, roster rows, and signed-up candidates. */
export async function getPartnerDetail(
  partnerId: string
): Promise<PartnerDetail | null> {
  const admin = createAdminClient();
  const { data: partner } = await admin
    .from("partners")
    .select("id, name, website")
    .eq("id", partnerId)
    .maybeSingle();
  if (!partner) return null;

  const [rosterRes, internsRes] = await Promise.all([
    admin
      .from("partner_students")
      .select(
        "id, partner_id, first_name, last_name, email, invite_token, status, invited_at, clicked_at, completed_at, completed_via, airtable_id, created_at, expires_at"
      )
      .eq("partner_id", partnerId)
      .order("created_at", { ascending: false }),
    admin
      .from("interns")
      .select(
        "id, name, first_name, last_name, email, intern_year, review_status"
      )
      .eq("partner_id", partnerId)
      .order("name", { ascending: true }),
  ]);

  const interns = (internsRes.data ?? []) as PartnerIntern[];
  const byYear = new Map<string, PartnerIntern[]>();
  for (const i of interns) {
    const year = i.intern_year || "Unassigned";
    if (!byYear.has(year)) byYear.set(year, []);
    byYear.get(year)!.push(i);
  }
  // Most recent cohort first; "Unassigned" sinks to the bottom.
  const internsByYear = [...byYear.entries()]
    .sort((a, b) => {
      if (a[0] === "Unassigned") return 1;
      if (b[0] === "Unassigned") return -1;
      return b[0].localeCompare(a[0]);
    })
    .map(([year, list]) => ({ year, interns: list }));

  return {
    id: partner.id as string,
    name: (partner.name as string) ?? "",
    website: (partner.website as string) ?? null,
    roster: (rosterRes.data ?? []) as PartnerStudent[],
    internsByYear,
  };
}

/** Staff accounts across all partners, for the approvals panel. */
export type PartnerStaff = {
  id: string;
  email: string;
  partner_id: string | null;
  partner_name: string | null;
  approved: boolean;
  role: string;
  created_at: string;
};

export async function listPartnerStaff(): Promise<PartnerStaff[]> {
  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_users")
    .select("id, email, partner_id, approved, role, created_at, partners(name)")
    .order("created_at", { ascending: false });

  return (data ?? []).map((u) => {
    const partners = (u as { partners: { name: string } | { name: string }[] | null })
      .partners;
    const partner = Array.isArray(partners) ? partners[0] : partners;
    return {
      id: u.id as string,
      email: u.email as string,
      partner_id: (u.partner_id as string) ?? null,
      partner_name: partner?.name ?? null,
      approved: Boolean(u.approved),
      role: (u.role as string) ?? "staff",
      created_at: u.created_at as string,
    };
  });
}
