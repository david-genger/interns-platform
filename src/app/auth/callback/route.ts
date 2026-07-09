import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { cookies } from "next/headers";
import { NextResponse } from "next/server";
import { resolvePostLoginPath } from "@/lib/account";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * OAuth / magic-link redirect target. Exchanges the code for a session, then
 * routes by account type (unified entry flow): existing users land in their
 * portal, brand-new users land on the account-type selector (/signup). An
 * explicit, same-origin `next` param still wins when present (e.g. a student
 * invite link that wants to force /student) — otherwise we resolve by account.
 *
 * The session cookies Supabase mints during the exchange are written straight
 * onto the redirect response we return, so the freshly-minted (and chunked)
 * auth cookie reaches the browser on this first hand-off — instead of relying
 * on the framework to forward cookies onto a separately constructed redirect,
 * the source of "have to sign in twice".
 */
export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  // Only allow same-origin relative paths. Reject anything that could redirect
  // off-site: protocol-relative ("//evil.com"), backslash tricks, or absolute
  // URLs. When absent we resolve the landing path by account type below.
  const rawNext = searchParams.get("next");
  const next = isSafeNext(rawNext) ? rawNext! : null;

  if (code) {
    const cookieStore = cookies();
    // Collect any session cookies the exchange sets so we can attach them to
    // whichever redirect we ultimately return (the target isn't known until
    // after we resolve the account type).
    const pending: CookieToSet[] = [];

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: CookieToSet[]) {
            pending.push(...cookiesToSet);
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      // Explicit next wins; otherwise resolve by account type using the SAME
      // client that just exchanged the code (it carries the fresh session in
      // memory, so the RLS "read own row" policies resolve for this user).
      let target = next;
      if (!target) {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        target = await resolvePostLoginPath(supabase, user?.email);
      }

      const response = NextResponse.redirect(`${origin}${target}`);
      pending.forEach(({ name, value, options }) =>
        response.cookies.set(name, value, options)
      );
      return response;
    }
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
