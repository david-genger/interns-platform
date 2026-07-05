"use client";

import { useRef, useState, useTransition } from "react";
import { createCompany } from "@/app/admin/actions";

export function AddCompanyForm() {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  function onSubmit(formData: FormData) {
    setError(null);
    startTransition(async () => {
      const res = await createCompany(formData);
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
        <span className="text-base leading-none">+</span> Add company
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
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">Name</span>
          <input
            name="name"
            required
            placeholder="Acme Inc."
            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
        </label>
        <label className="flex min-w-[200px] flex-1 flex-col gap-1">
          <span className="text-xs font-medium text-slate-500">
            Domain <span className="text-slate-400">(optional)</span>
          </span>
          <input
            name="domain"
            placeholder="acme.com"
            className="h-9 w-full rounded-lg border border-slate-300 px-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
          />
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
