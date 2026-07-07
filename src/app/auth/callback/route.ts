import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { resolvePostLoginPath } from "@/lib/account";

/**
 * OAuth / magic-link redirect target. Exchanges the code for a session, then
 * routes by account type (unified entry flow): existing users land in their
 * portal, brand-new users land on the account-type selector (/signup).
 *
 * An explicit, same-origin `next` param still wins when present (e.g. a student
 * invite link that wants to force /student) — otherwise we resolve by account.
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const rawNext = searchParams.get("next");
  const next = isSafeNext(rawNext) ? rawNext! : null;

  if (code) {
    const supabase = createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      if (next) return NextResponse.redirect(`${origin}${next}`);
      const {
        data: { user },
      } = await supabase.auth.getUser();
      const path = await resolvePostLoginPath(supabase, user?.email);
      return NextResponse.redirect(`${origin}${path}`);
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth`);
}

/** True only for same-origin relative paths (e.g. "/interns"). */
function isSafeNext(next: string | null): next is string {
  if (!next) return false;
  return /^\/(?![/\\])/.test(next);
}
