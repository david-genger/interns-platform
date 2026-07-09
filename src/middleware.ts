import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

/**
 * Redirect while preserving any auth cookies Supabase refreshed onto `base`.
 * A bare NextResponse.redirect() starts from an empty cookie jar, so a rotated
 * session token written during getUser() would be lost — leaving the browser
 * and server out of sync and logging the user out prematurely.
 */
function redirectWithCookies(
  request: NextRequest,
  base: NextResponse,
  pathname: string
) {
  const url = request.nextUrl.clone();
  url.pathname = pathname;
  const redirect = NextResponse.redirect(url);
  base.cookies.getAll().forEach((cookie) => redirect.cookies.set(cookie));
  return redirect;
}

// Paths anyone can reach without a per-portal approval check. The "pending"
// pages are deliberately NOT listed here — they're gated inside each portal
// block below so that an approved user who lands on (or refreshes) a pending
// page is sent straight into the app, instead of being stuck there until they
// navigate away or sign in again.
const PUBLIC_PATHS = [
  "/login",
  "/auth",
  // Public self-serve signup (account-type chooser + company signup form).
  "/signup",
  // Partners portal public entry points + the public student invite pages.
  "/partners/login",
  "/partners/signup",
  "/invite",
  // Student portal public entry points.
  "/student/login",
];

export async function middleware(request: NextRequest) {
  // Fail with a clear message instead of an unhandled Supabase exception
  // when .env.local hasn't been filled in yet (see README setup steps).
  if (
    !process.env.NEXT_PUBLIC_SUPABASE_URL ||
    !process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  ) {
    return new NextResponse(
      "Supabase isn't configured yet. Add NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY to .env.local (see README.md), then restart the dev server.",
      { status: 500, headers: { "content-type": "text/plain" } }
    );
  }

  let response = NextResponse.next({ request });

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet: CookieToSet[]) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          );
        },
      },
    }
  );

  // Refreshes the auth cookie if needed.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = PUBLIC_PATHS.some((p) => path === p || path.startsWith(p + "/"));

  if (isPublic) return response;

  const isPartners = path === "/partners" || path.startsWith("/partners/");
  const email = user?.email?.toLowerCase();

  // ----- Partners portal: gate on partner_users -----
  if (isPartners) {
    if (!user) {
      return redirectWithCookies(request, response, "/partners/login");
    }
    const onPending = path === "/partners/pending";
    const { data: partnerUser } = await supabase
      .from("partner_users")
      .select("approved")
      .eq("email", email)
      .maybeSingle();

    if (!partnerUser?.approved) {
      // Not approved yet: let the pending page render; bounce everything else.
      return onPending
        ? response
        : redirectWithCookies(request, response, "/partners/pending");
    }
    // Approved: don't strand them on the pending page (e.g. after refreshing
    // it once their program was approved) — send them into the portal.
    if (onPending) {
      return redirectWithCookies(request, response, "/partners");
    }
    return response;
  }

  // ----- Student portal: gate on an intern email match -----
  // A student is anyone whose email matches a synced Local Talent record,
  // however that record was created (partner invite, direct Airtable, or
  // direct signup). RLS's "student reads own row" policy scopes this lookup to
  // their own row.
  const isStudent = path === "/student" || path.startsWith("/student/");
  if (isStudent) {
    if (!user) {
      return redirectWithCookies(request, response, "/student/login");
    }
    const onPending = path === "/student/pending";
    const { data: internRow } = await supabase
      .from("interns")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!internRow) {
      // No matching profile yet: let the pending page render; bounce the rest.
      return onPending
        ? response
        : redirectWithCookies(request, response, "/student/pending");
    }
    // Profile now exists (e.g. after a sync): don't strand them on pending.
    if (onPending) {
      return redirectWithCookies(request, response, "/student");
    }
    return response;
  }

  // ----- Company portal (default): gate on company_users -----
  if (!user) {
    return redirectWithCookies(request, response, "/login");
  }

  const onPending = path === "/pending";
  const { data: membership } = await supabase
    .from("company_users")
    .select("approved, role")
    .eq("email", email)
    .maybeSingle();

  if (!membership?.approved) {
    // Not approved yet: let the pending page render; bounce everything else.
    return onPending
      ? response
      : redirectWithCookies(request, response, "/pending");
  }
  // Approved: don't strand them on the pending page after being approved +
  // refreshing — send them into the app.
  if (onPending) {
    return redirectWithCookies(request, response, "/interns");
  }

  // Admin section is admins-only. Approved non-admins get bounced to /interns.
  // (Server-side requireAdmin() in the admin layout/actions is the authoritative
  // gate; this is a fast first line of defense.)
  if (path === "/admin" || path.startsWith("/admin/")) {
    if (membership.role !== "admin") {
      return redirectWithCookies(request, response, "/interns");
    }
  }

  return response;
}

export const config = {
  // Run on everything except Next internals, the sync API, and static
  // asset files (images, icons, fonts) served from /public.
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|api/sync|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico|woff2?|ttf)$).*)",
  ],
};
