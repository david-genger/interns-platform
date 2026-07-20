"use client";

import { useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { adminCreatePartner } from "@/app/admin/partners/actions";

/** Create a bootcamp / college org from the admin console. */
export function CreatePartnerForm() {
  const router = useRouter();
  const formRef = useRef<HTMLFormElement>(null);
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await adminCreatePartner(fd);
      if (!res.ok) {
        setError(res.error ?? "Something went wrong.");
        return;
      }
      formRef.current?.reset();
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} className="flex flex-wrap items-end gap-3">
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Bootcamp / college name
        </span>
        <input
          name="name"
          required
          placeholder="e.g. General Assembly"
          className="h-10 w-64 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </label>
      <label className="block">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Website (optional)
        </span>
        <input
          name="website"
          placeholder="https://…"
          className="h-10 w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
      </label>
      <button
        type="submit"
        disabled={pending}
        className="h-10 rounded-lg bg-brand-gradient px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
      >
        {pending ? "Adding…" : "Add partner"}
      </button>
      {error && <p className="w-full text-sm text-red-600">{error}</p>}
    </form>
  );
}
