import { createClient } from "@/lib/supabase/server";
import { DevxLogo } from "@/components/Logo";
import { AccountTypeChooser } from "@/components/AccountTypeChooser";

export const dynamic = "force-dynamic";

/**
 * Landing for a signed-in user who can't yet reach the company storefront.
 * Two states:
 *   1. They have a company_users row (signed up, awaiting approval) → a warm
 *      "you're on the list" message.
 *   2. They have no record anywhere (a bare Google/email login that never went
 *      through a signup flow) → the account-type chooser so they can pick what
 *      they're here for and finish setting up.
 */
export default async function PendingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  const email = user?.email?.toLowerCase();

  // RLS lets a user read only their own rows across these tables.
  const [membership, partnerUser, intern] = email
    ? await Promise.all([
        supabase
          .from("company_users")
          .select("id")
          .eq("email", email)
          .maybeSingle(),
        supabase
          .from("partner_users")
          .select("id")
          .eq("email", email)
          .maybeSingle(),
        supabase.from("interns").select("id").eq("email", email).maybeSingle(),
      ])
    : [{ data: null }, { data: null }, { data: null }];

  const hasAnyAccount =
    Boolean(membership.data) || Boolean(partnerUser.data) || Boolean(intern.data);

  // Signed in, but no account of any kind yet — let them choose a signup path.
  if (user && !hasAnyAccount) {
    return (
      <main className="flex min-h-screen items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 flex justify-center">
            <DevxLogo height={34} />
          </div>
          <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
            Let&apos;s finish setting up your account
          </h1>
          <p className="mx-auto mt-2 max-w-sm text-center text-sm text-slate-500">
            You&apos;re signed in as{" "}
            <span className="font-medium text-slate-700">{user.email}</span>.
            Tell us what brings you here so we can point you the right way.
          </p>
          <div className="mt-8">
            <AccountTypeChooser />
          </div>
          <form action="/auth/signout" method="post" className="mt-6 text-center">
            <button className="text-sm font-medium text-slate-400 hover:text-slate-600">
              Sign out
            </button>
          </form>
        </div>
      </main>
    );
  }

  // Company signed up — approval pending.
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex justify-center">
          <DevxLogo height={32} />
        </div>
        <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-50 text-emerald-600 ring-1 ring-emerald-200">
          <CheckIcon />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          You&apos;re on the list! 🎉
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-slate-600">
          Thanks for signing up
          {user?.email ? (
            <>
              {" "}
              as{" "}
              <span className="font-medium text-slate-800">{user.email}</span>
            </>
          ) : null}
          . Your request is in and we&apos;re getting your access set up now —
          it&apos;s usually quick. We&apos;ll email you the moment you&apos;re
          approved, and you&apos;ll be browsing candidates in no time.
        </p>
        <p className="mt-4 rounded-lg bg-slate-50 p-3 text-sm text-slate-500 ring-1 ring-slate-100">
          Questions or need access sooner? Email{" "}
          <a
            href="mailto:david@devxstaffing.com"
            className="font-medium text-brand hover:underline"
          >
            david@devxstaffing.com
          </a>{" "}
          directly.
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="text-sm font-medium text-slate-400 hover:text-slate-600">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}

function CheckIcon() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
