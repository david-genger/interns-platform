"use client";

import { useState, useTransition } from "react";
import type { Company } from "@/lib/types";
import {
  deleteCompany,
  updateCompany,
  type ActionResult,
} from "@/app/admin/actions";

export function CompaniesTable({
  companies,
  userCounts,
}: {
  companies: Company[];
  userCounts: Record<string, number>;
}) {
  if (companies.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No companies yet. Add one above.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Name</th>
            <th className="px-4 py-2.5">Domain</th>
            <th className="px-4 py-2.5">Users</th>
            <th className="px-4 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {companies.map((company) => (
            <CompanyRow
              key={company.id}
              company={company}
              userCount={userCounts[company.id] ?? 0}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function CompanyRow({
  company,
  userCount,
}: {
  company: Company;
  userCount: number;
}) {
  const [editing, setEditing] = useState(false);
  const [name, setName] = useState(company.name);
  const [domain, setDomain] = useState(company.domain ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function run(fn: () => Promise<ActionResult>, onOk?: () => void) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (res.ok) onOk?.();
      else setError(res.error ?? "Update failed.");
    });
  }

  if (editing) {
    return (
      <tr>
        <td className="px-4 py-3">
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="h-8 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
          {error && <div className="mt-1 text-xs text-red-600">{error}</div>}
        </td>
        <td className="px-4 py-3">
          <input
            value={domain}
            onChange={(e) => setDomain(e.target.value)}
            placeholder="—"
            className="h-8 w-full rounded-lg border border-slate-300 px-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </td>
        <td className="px-4 py-3 text-slate-500">{userCount}</td>
        <td className="px-4 py-3">
          <div className="flex items-center justify-end gap-2">
            <button
              disabled={pending}
              onClick={() =>
                run(
                  () => updateCompany(company.id, name, domain || null),
                  () => setEditing(false)
                )
              }
              className="h-8 rounded-lg bg-brand px-2.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
            >
              {pending ? "Saving…" : "Save"}
            </button>
            <button
              disabled={pending}
              onClick={() => {
                setName(company.name);
                setDomain(company.domain ?? "");
                setError(null);
                setEditing(false);
              }}
              className="h-8 rounded-lg px-2.5 text-sm font-medium text-slate-500 hover:text-slate-800"
            >
              Cancel
            </button>
          </div>
        </td>
      </tr>
    );
  }

  return (
    <tr className={pending ? "opacity-60" : undefined}>
      <td className="px-4 py-3 font-medium text-slate-800">
        {company.name}
        {error && <div className="mt-0.5 text-xs text-red-600">{error}</div>}
      </td>
      <td className="px-4 py-3 text-slate-600">
        {company.domain || <span className="text-slate-400">—</span>}
      </td>
      <td className="px-4 py-3 text-slate-500">{userCount}</td>
      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          <button
            disabled={pending}
            onClick={() => setEditing(true)}
            className="h-8 rounded-lg px-2.5 text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-60"
          >
            Edit
          </button>
          <button
            disabled={pending}
            onClick={() => {
              if (
                confirm(
                  `Delete ${company.name}? Its ${userCount} user(s) will be unassigned but keep access.`
                )
              ) {
                run(() => deleteCompany(company.id));
              }
            }}
            className="h-8 rounded-lg px-2.5 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
          >
            Delete
          </button>
        </div>
      </td>
    </tr>
  );
}
