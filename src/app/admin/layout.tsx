import Link from "next/link";
import { DevxLogo } from "@/components/Logo";
import { AdminNav } from "@/components/admin/AdminNav";
import { requireAdmin } from "@/lib/admin";

export const dynamic = "force-dynamic";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Authoritative gate — non-admins never render any admin page.
  await requireAdmin();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto max-w-6xl px-4">
          <div className="flex items-center justify-between py-3">
            <Link
              href="/admin"
              className="flex items-center gap-2.5"
              aria-label="Devx Admin — home"
            >
              <DevxLogo height={34} priority />
              <span className="border-l border-slate-200 pl-2.5 text-sm font-semibold text-brand">
                Admin
              </span>
            </Link>
            <div className="flex items-center gap-4 text-sm font-medium text-slate-500">
              <Link href="/interns" className="hover:text-slate-800">
                Interns
              </Link>
              <form action="/auth/signout" method="post">
                <button className="hover:text-slate-800">Sign out</button>
              </form>
            </div>
          </div>
          <AdminNav />
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
