import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Decide where a freshly-signed-in user should land, based on which record(s)
 * already exist for their email. This is the heart of the unified entry flow:
 * one sign-in page for everyone, then route by account type.
 *
 *   approved company  → /interns
 *   pending company   → /pending
 *   approved partner  → /partners
 *   pending partner   → /partners/pending
 *   intern (student)  → /student
 *   no account yet    → /signup   (the account-type selector)
 *
 * Pass the SAME Supabase client that just exchanged the auth code — it carries
 * the fresh session in memory, so the RLS "read own row" policies resolve for
 * the just-authenticated user (a newly-constructed server client might not see
 * the new session cookie yet within the same request).
 */
export async function resolvePostLoginPath(
  supabase: SupabaseClient,
  email: string | null | undefined
): Promise<string> {
  const e = email?.toLowerCase();
  if (!e) return "/login";

  const [company, partner, intern] = await Promise.all([
    supabase.from("company_users").select("approved").eq("email", e).maybeSingle(),
    supabase.from("partner_users").select("approved").eq("email", e).maybeSingle(),
    supabase.from("interns").select("id").eq("email", e).maybeSingle(),
  ]);

  if (company.data) return company.data.approved ? "/interns" : "/pending";
  if (partner.data) return partner.data.approved ? "/partners" : "/partners/pending";
  if (intern.data) return "/student";
  return "/signup";
}
