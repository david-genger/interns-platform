import Link from "next/link";
import { DevxLogo } from "@/components/Logo";
import { getPartner } from "@/lib/partners";

export default async function PartnerAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const partner = await getPartner();

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
          <Link
            href="/partners"
            className="flex items-center gap-2.5"
            aria-label="Devx Partner Portal — home"
          >
            <DevxLogo height={34} priority />
            <span className="hidden border-l border-slate-200 pl-2.5 text-sm font-medium text-slate-400 sm:inline">
              Partner Portal
            </span>
          </Link>
          <div className="flex items-center gap-4">
            {partner?.name && (
              <span className="hidden text-sm font-medium text-slate-600 sm:inline">
                {partner.name}
              </span>
            )}
            <form action="/auth/signout" method="post">
              <input type="hidden" name="redirect" value="/partners/login" />
              <button className="text-sm font-medium text-slate-500 hover:text-slate-800">
                Sign out
              </button>
            </form>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 py-8">{children}</main>
    </div>
  );
}
