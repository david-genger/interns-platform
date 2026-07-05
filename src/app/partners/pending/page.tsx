import { createClient } from "@/lib/supabase/server";
import { DevxLogo } from "@/components/Logo";

export default async function PartnerPendingPage() {
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
        <h1 className="text-xl font-semibold">Account under review</h1>
        <p className="mt-2 text-sm text-slate-500">
          {user?.email ? (
            <>
              Thanks for registering. We&apos;re reviewing{" "}
              <span className="font-medium text-slate-700">{user.email}</span>{" "}
              and will email you once your program is approved. You&apos;ll then
              be able to upload your roster and send invites.
            </>
          ) : (
            "Your account isn't approved yet."
          )}
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <input type="hidden" name="redirect" value="/partners/login" />
          <button className="text-sm font-medium text-brand hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
