import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  await supabase.auth.signOut();

  // Return to the right login screen — partners land back on /partners/login.
  const form = await request.formData().catch(() => null);
  const raw = form?.get("redirect");
  // Same-origin relative paths only. Reject protocol-relative ("//evil.com")
  // and backslash variants, which new URL() would otherwise resolve off-site.
  const redirect =
    typeof raw === "string" && /^\/(?![/\\])/.test(raw) ? raw : "/login";

  return NextResponse.redirect(new URL(redirect, request.url), { status: 303 });
}
