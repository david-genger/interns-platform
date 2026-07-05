import Link from "next/link";
import { DevxLogo } from "@/components/Logo";

export default function StudentAppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-slate-50">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-3xl items-center justify-between px-4 py-3">
          <Link
            href="/student"
            className="flex items-center gap-2.5"
            aria-label="Devx — your profile"
          >
            <DevxLogo height={34} priority />
            <span className="hidden border-l border-slate-200 pl-2.5 text-sm font-medium text-slate-400 sm:inline">
              My Profile
            </span>
          </Link>
          <form action="/auth/signout" method="post">
            <input type="hidden" name="redirect" value="/student/login" />
            <button className="text-sm font-medium text-slate-500 hover:text-slate-800">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-3xl px-4 py-8">{children}</main>
    </div>
  );
}
