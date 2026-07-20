/**
 * Resolve-or-create the canonical partner for a school name.
 *
 * This is THE mechanism that keeps the partners list and the schools on
 * candidate records one and the same: every write that references a school —
 * the Airtable sync, direct signup, invite — routes through here, so a partner
 * row always exists for it. No separate reconciling job to drift out of sync.
 *
 * Backed by the `resolve_partner` SQL function (atomic get-or-create via ON
 * CONFLICT), so concurrent callers never create duplicates. Returns null for a
 * blank school. An optional per-run cache avoids re-resolving the same school
 * many times within one sync pass.
 */
import type { createAdminClient } from "@/lib/supabase/admin";

type Admin = ReturnType<typeof createAdminClient>;

export async function resolvePartnerId(
  admin: Admin,
  schoolName: string | null | undefined,
  cache?: Map<string, string | null>
): Promise<string | null> {
  const clean = (schoolName ?? "").trim();
  if (!clean) return null;

  const key = clean.toLowerCase();
  if (cache?.has(key)) return cache.get(key) ?? null;

  const { data, error } = await admin.rpc("resolve_partner", { p_name: clean });
  if (error) {
    // Non-fatal: a failed resolve just leaves partner_id null for this write;
    // the next write/sync will link it. Never block the caller on it.
    console.error("[resolvePartnerId]", error);
    cache?.set(key, null);
    return null;
  }
  const id = (data as string | null) ?? null;
  cache?.set(key, id);
  return id;
}
