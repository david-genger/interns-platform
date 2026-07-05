import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();
  await supabase.auth.signOut();

  // Return to the right login screen — partners land back on /partners/login.
  const form = await request.formData().catch(() => null);
  const raw = form?.get("redirect");
  const redirect =
    typeof raw === "string" && raw.startsWith("/") ? raw : "/login";

  return NextResponse.redirect(new URL(redirect, request.url), { status: 303 });
}
