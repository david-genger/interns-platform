import { createClient } from "@/lib/supabase/server";
import { DevxLogo } from "@/components/Logo";

export default async function PendingPage() {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex justify-center">
          <DevxLogo height={24} />
        </div>
        <h1 className="text-xl font-semibold">Access Pending</h1>
        <p className="mt-2 text-sm text-slate-500">
          {user?.email ? (
            <>
              <span className="font-medium text-slate-700">{user.email}</span>{" "}
              isn&apos;t approved yet. We&apos;ll email you once your company has
              been granted access.
            </>
          ) : (
            "Your account isn't approved yet."
          )}
        </p>
        <form action="/auth/signout" method="post" className="mt-6">
          <button className="text-sm font-medium text-brand hover:underline">
            Sign out
          </button>
        </form>
      </div>
    </main>
  );
}
