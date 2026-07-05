"use client";

import { useRef, useState, useTransition } from "react";
import type { Company } from "@/lib/types";
import { addUser } from "@/app/admin/actions";

export function AddUserForm({ companies }: { companies: Company[] }) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await addUser(formData);
      if (res.ok) {
        formRef.current?.reset();
        setOpen(false);
      } else {
        setError(res.error ?? "Something went wrong.");
      }
    });
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="inline-flex h-9 items-center gap-1.5 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-dark"
      >
        <span className="text-base leading-none">+</span> Add user
      </button>
    );
  }

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
    >
      <div className="flex flex-wrap items-end gap-3">
        <Field label="Email" className="min-w-[220px] flex-1">
          <input
            name="email"
            type="email"
            required
            placeholder="person@company.com"
            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </Field>

        <Field label="Company">
          <select
            name="company_id"
            defaultValue=""
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          >
            <option value="">No company</option>
            {companies.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>

        <Field label="Role">
          <select
            name="role"
            defaultValue="viewer"
            className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          >
            <option value="viewer">Viewer</option>
            <option value="admin">Admin</option>
          </select>
        </Field>

        <label className="flex h-9 items-center gap-2 text-sm text-slate-700">
          <input
            name="approved"
            type="checkbox"
            defaultChecked
            className="h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
          />
          Approved
        </label>

        <div className="flex items-center gap-2">
          <button
            type="submit"
            disabled={pending}
            className="h-9 rounded-lg bg-brand px-3.5 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? "Adding…" : "Add"}
          </button>
          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setError(null);
            }}
            className="h-9 rounded-lg px-3 text-sm font-medium text-slate-500 hover:text-slate-800"
          >
            Cancel
          </button>
        </div>
      </div>

      {error && <p className="mt-2 text-sm text-red-600">{error}</p>}
    </form>
  );
}

function Field({
  label,
  className = "",
  children,
}: {
  label: string;
  className?: string;
  children: React.ReactNode;
}) {
  return (
    <label className={`flex flex-col gap-1 ${className}`}>
      <span className="text-xs font-medium text-slate-500">{label}</span>
      {children}
    </label>
  );
}
