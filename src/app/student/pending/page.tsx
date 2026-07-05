import { createClient } from "@/lib/supabase/server";
import { DevxLogo } from "@/components/Logo";

/**
 * Shown when a signed-in user has no matching Local Talent record — usually a
 * student who signed in with a different email than the one on their profile.
 */
export default async function StudentPendingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex justify-center">
          <DevxLogo height={32} />
        </div>
        <h1 className="text-xl font-semibold">No profile found</h1>
        <p className="mt-2 text-sm text-slate-500">
          {user?.email ? (
            <>
              We couldn&apos;t find a student profile for{" "}
              <span className="font-medium text-slate-700">{user.email}</span>.
              Make sure you signed in with the email you applied with. If you
              were invited by your school or bootcamp, open the link in your
              invite email first.
            </>
          ) : (
            "We couldn't find a student profile for this account."
          )}
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <input type="hidden" name="redirect" value="/student/login" />
          <button className="text-sm font-medium text-brand hover:underline">
            Try a different email
          </button>
        </form>
      </div>
    </main>
  );
}
