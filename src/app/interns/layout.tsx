import Link from "next/link";

export default function InternsLayout({
  children,
  slideout,
}: {
  children: React.ReactNode;
  slideout: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <header className="sticky top-0 z-30 border-b border-slate-200 bg-white/80 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-4 py-3">
          <Link href="/interns" className="font-semibold text-slate-900">
            Devx <span className="text-brand">Interns</span>
          </Link>
          <form action="/auth/signout" method="post">
            <button className="text-sm font-medium text-slate-500 hover:text-slate-800">
              Sign out
            </button>
          </form>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
      {slideout}
    </div>
  );
}
