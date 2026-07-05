import Link from "next/link";
import { DevxLogo } from "@/components/Logo";
import { createClient } from "@/lib/supabase/server";

async function isAdmin(): Promise<boolean> {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user?.email) return false;
  const { data } = await supabase
    .from("company_users")
    .select("role")
    .eq("email", user.email.toLowerCase())
    .maybeSingle();
  return data?.role === "admin";
}

export default async function InternsLayout({
  children,
  slideout,
}: {
  children: React.ReactNode;
  slideout: React.ReactNode;
}) {
  const admin = await isAdmin();

  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/interns" className="flex items-center gap-2.5" aria-label="Devx Interns — home">
            <DevxLogo height={34} priority />
            <span className="hidden border-l border-slate-200 pl-2.5 text-sm font-medium text-slate-400 sm:inline">
              Interns
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {admin && (
              <Link
                href="/admin"
                className="text-sm font-medium text-brand hover:text-brand-dark"
              >
                Admin
              </Link>
            )}
            <form action="/auth/signout" method="post">
              <button className="text-sm font-medium text-slate-500 hover:text-slate-800">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      {slideout}
    </div>
  );
}
