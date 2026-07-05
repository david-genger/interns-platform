"use client";

import { useState, useTransition } from "react";
import type { Company, CompanyUser } from "@/lib/types";
import {
  removeUser,
  setUserApproved,
  setUserCompany,
  setUserRole,
  type ActionResult,
} from "@/app/admin/actions";

export function UsersTable({
  users,
  companies,
}: {
  users: CompanyUser[];
  companies: Company[];
}) {
  if (users.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No users yet. Add one above to grant access.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
            <th className="px-4 py-2.5">Email</th>
            <th className="px-4 py-2.5">Company</th>
            <th className="px-4 py-2.5">Role</th>
            <th className="px-4 py-2.5">Status</th>
            <th className="px-4 py-2.5 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {users.map((user) => (
            <UserRow key={user.id} user={user} companies={companies} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function UserRow({
  user,
  companies,
}: {
  user: CompanyUser;
  companies: Company[];
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<ActionResult>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Update failed.");
    });
  }

  return (
    <tr className={pending ? "opacity-60" : undefined}>
      <td className="px-4 py-3">
        <div className="font-medium text-slate-800">{user.email}</div>
        {error && <div className="mt-0.5 text-xs text-red-600">{error}</div>}
      </td>

      <td className="px-4 py-3">
        <select
          value={user.company_id ?? ""}
          disabled={pending}
          onChange={(e) =>
            run(() => setUserCompany(user.id, e.target.value || null))
          }
          className="h-8 max-w-[180px] rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        >
          <option value="">—</option>
          {companies.map((c) => (
            <option key={c.id} value={c.id}>
              {c.name}
            </option>
          ))}
        </select>
      </td>

      <td className="px-4 py-3">
        <select
          value={user.role === "admin" ? "admin" : "viewer"}
          disabled={pending}
          onChange={(e) => run(() => setUserRole(user.id, e.target.value))}
          className="h-8 rounded-lg border border-slate-300 bg-white px-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
        >
          <option value="viewer">Viewer</option>
          <option value="admin">Admin</option>
        </select>
      </td>

      <td className="px-4 py-3">
        {user.approved ? (
          <span className="inline-flex items-center rounded-full bg-emerald-50 px-2.5 py-0.5 text-xs font-medium text-emerald-700 ring-1 ring-emerald-600/20">
            Approved
          </span>
        ) : (
          <span className="inline-flex items-center rounded-full bg-amber-50 px-2.5 py-0.5 text-xs font-medium text-amber-700 ring-1 ring-amber-600/20">
            Pending
          </span>
        )}
      </td>

      <td className="px-4 py-3">
        <div className="flex items-center justify-end gap-2">
          {user.approved ? (
            <button
              disabled={pending}
              onClick={() => run(() => setUserApproved(user.id, false))}
              className="h-8 rounded-lg px-2.5 text-sm font-medium text-slate-500 hover:text-slate-800 disabled:opacity-60"
            >
              Revoke
            </button>
          ) : (
            <button
              disabled={pending}
              onClick={() => run(() => setUserApproved(user.id, true))}
              className="h-8 rounded-lg bg-emerald-600 px-2.5 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              Approve
            </button>
          )}
          <button
            disabled={pending}
            onClick={() => {
              if (
                confirm(`Remove ${user.email} from the allowlist? They will lose access.`)
              ) {
                run(() => removeUser(user.id));
              }
            }}
            className="h-8 rounded-lg px-2.5 text-sm font-medium text-red-600 hover:text-red-700 disabled:opacity-60"
          >
            Remove
          </button>
        </div>
      </td>
    </tr>
  );
}
