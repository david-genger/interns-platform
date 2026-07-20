"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/admin/users", label: "Users" },
  { href: "/admin/companies", label: "Companies" },
  { href: "/admin/candidates", label: "Candidates" },
  { href: "/admin/partners", label: "Partners" },
  { href: "/admin/sync", label: "Sync" },
] as const;

export function AdminNav() {
  const pathname = usePathname();

  return (
    <nav className="-mb-px flex gap-6">
      {TABS.map((tab) => {
        const active =
          pathname === tab.href || pathname.startsWith(tab.href + "/");
        return (
          <Link
            key={tab.href}
            href={tab.href}
            className={`border-b-2 px-0.5 pb-2.5 pt-1 text-sm font-medium transition-colors ${
              active
                ? "border-brand text-brand"
                : "border-transparent text-slate-500 hover:text-slate-800"
            }`}
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
