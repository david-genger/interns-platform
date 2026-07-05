import { createServerClient, type CookieOptions } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";

type CookieToSet = { name: string; value: string; options?: CookieOptions };

const PUBLIC_PATHS = [
  "/login",
  "/pending",
  "/auth",
  // Partners portal public entry points + the public student invite pages.
  "/partners/login",
  "/partners/signup",
  "/partners/pending",
  "/invite",
  // Student portal public entry points.
  "/student/login",
  "/student/pending",
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
      const url = request.nextUrl.clone();
      url.pathname = "/partners/login";
      return NextResponse.redirect(url);
    }
    const { data: partnerUser } = await supabase
      .from("partner_users")
      .select("approved")
      .eq("email", email)
      .maybeSingle();

    if (!partnerUser?.approved) {
      const url = request.nextUrl.clone();
      url.pathname = "/partners/pending";
      return NextResponse.redirect(url);
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
      const url = request.nextUrl.clone();
      url.pathname = "/student/login";
      return NextResponse.redirect(url);
    }
    const { data: internRow } = await supabase
      .from("interns")
      .select("id")
      .eq("email", email)
      .maybeSingle();

    if (!internRow) {
      const url = request.nextUrl.clone();
      url.pathname = "/student/pending";
      return NextResponse.redirect(url);
    }
    return response;
  }

  // ----- Company portal (default): gate on company_users -----
  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    return NextResponse.redirect(url);
  }

  const { data: membership } = await supabase
    .from("company_users")
    .select("approved, role")
    .eq("email", email)
    .maybeSingle();

  if (!membership?.approved) {
    const url = request.nextUrl.clone();
    url.pathname = "/pending";
    return NextResponse.redirect(url);
  }

  // Admin section is admins-only. Approved non-admins get bounced to /interns.
  // (Server-side requireAdmin() in the admin layout/actions is the authoritative
  // gate; this is a fast first line of defense.)
  if (path === "/admin" || path.startsWith("/admin/")) {
    if (membership.role !== "admin") {
      const url = request.nextUrl.clone();
      url.pathname = "/interns";
      return NextResponse.redirect(url);
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
