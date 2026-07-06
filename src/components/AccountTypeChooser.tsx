import Link from "next/link";

type Choice = {
  href: string;
  title: string;
  blurb: string;
  icon: React.ReactNode;
};

const CHOICES: Choice[] = [
  {
    href: "/signup/company",
    title: "I'm hiring",
    blurb:
      "Browse vetted interns and junior developers as a Devx client. Free, no obligation.",
    icon: <BuildingIcon />,
  },
  {
    href: "/signup/student",
    title: "I'm a candidate",
    blurb:
      "Create a profile, add your resume, and showcase the projects you've built.",
    icon: <UserIcon />,
  },
  {
    href: "/partners/signup",
    title: "I'm a bootcamp or college",
    blurb: "Invite your cohort and track sign-ups from your dashboard.",
    icon: <SchoolIcon />,
  },
];

/**
 * Three-way "what are you here for?" chooser. Shown on the public /signup page
 * and to a signed-in visitor who has no account yet, so they can pick the right
 * signup flow (company / candidate / partner).
 */
export function AccountTypeChooser() {
  return (
    <div className="grid gap-3">
      {CHOICES.map((c) => (
        <Link
          key={c.href}
          href={c.href}
          className="group flex items-start gap-4 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-brand/50 hover:shadow-md"
        >
          <span className="mt-0.5 flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-brand/10 text-brand">
            {c.icon}
          </span>
          <span className="min-w-0 flex-1">
            <span className="flex items-center justify-between gap-2">
              <span className="font-semibold text-slate-900">{c.title}</span>
              <span className="text-slate-300 transition group-hover:translate-x-0.5 group-hover:text-brand">
                →
              </span>
            </span>
            <span className="mt-0.5 block text-sm leading-relaxed text-slate-500">
              {c.blurb}
            </span>
          </span>
        </Link>
      ))}
    </div>
  );
}

function BuildingIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M3 21h18M6 21V5a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v16M9 7h1m4 0h1M9 11h1m4 0h1M9 15h1m4 0h1" />
    </svg>
  );
}

function UserIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 21a8 8 0 0 0-16 0" />
      <circle cx="12" cy="7" r="4" />
    </svg>
  );
}

function SchoolIcon() {
  return (
    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="m22 10-10-5L2 10l10 5 10-5Z" />
      <path d="M6 12v5c0 1 2.5 2.5 6 2.5s6-1.5 6-2.5v-5" />
    </svg>
  );
}
