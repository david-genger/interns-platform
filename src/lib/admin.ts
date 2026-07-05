import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import type { Company, CompanyUser } from "@/lib/types";

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
    .select("id, email, company_id, approved, role, created_at")
    .order("created_at", { ascending: false });
  if (error) throw new Error(error.message);
  return (data ?? []) as CompanyUser[];
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
