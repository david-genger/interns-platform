"use server";

import { createAdminClient } from "@/lib/supabase/admin";
import { rateLimit, clientIp } from "@/lib/rate-limit";

/**
 * Record that an invite link was opened (first view only), for the bootcamp's
 * funnel stats. Profile submission itself goes through the shared student intake
 * (`registerStudent`), which marks the roster row completed on success — so this
 * file only tracks the click.
 */
export async function markInviteClicked(token: string): Promise<void> {
  // Cheap public write — cap per IP to avoid it being used as a token oracle
  // or a write flood. Silently no-op when over the limit.
  if (!rateLimit(`markInviteClicked:${clientIp()}`, 60, 60 * 1000).ok) return;

  const admin = createAdminClient();
  const { data } = await admin
    .from("partner_students")
    .select("id, status, clicked_at")
    .eq("invite_token", token)
    .maybeSingle();
  if (!data || data.clicked_at) return;

  const update: Record<string, unknown> = {
    clicked_at: new Date().toISOString(),
  };
  // Advance the funnel, but never regress a completed profile.
  if (data.status === "invited" || data.status === "uploaded") {
    update.status = "clicked";
  }
  await admin.from("partner_students").update(update).eq("id", data.id);
}
