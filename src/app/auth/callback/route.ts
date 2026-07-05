import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

/** OAuth redirect target. Exchanges the code for a session, then routes on. */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only allow same-origin relative paths. Reject anything that could redirect
  // off-site: protocol-relative ("//evil.com"), backslash tricks, or absolute
  // URLs. Everything else falls back to the default landing page.
  const rawNext = searchParams.get("next");
  const next = isSafeNext(rawNext) ? rawNext! : "/interns";

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) return NextResponse.redirect(`${origin}${next}`);
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

/** True only for same-origin relative paths (e.g. "/interns"). */
function isSafeNext(next: string | null): next is string {
  if (!next) return false;
  // Must be a root-relative path, but not protocol-relative ("//host") or a
  // backslash variant browsers normalise to "//".
  return /^\/(?![/\\])/.test(next);
}
