"use client";

import { useState } from "react";
import { submitProfile } from "@/app/invite/actions";

const REMOTE_OPTIONS = ["Remote", "Hybrid", "On-site", "Flexible"];

export function InviteForm({
  token,
  email,
  firstName,
  lastName,
}: {
  token: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
}) {
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fileName, setFileName] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    const formData = new FormData(e.currentTarget);
    const res = await submitProfile(token, formData);
    setSubmitting(false);
    if (res.ok) setDone(true);
    else setError(res.error);
  }

  if (done) {
    return (
      <div className="rounded-xl bg-emerald-50 p-5 text-sm text-emerald-800 ring-1 ring-emerald-200">
        <p className="font-medium">Profile submitted 🎉</p>
        <p className="mt-1 text-emerald-700">
          Thanks! The Devx team will review your profile and add you to the
          platform. You can close this page.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field name="first_name" label="First name" defaultValue={firstName} required />
        <Field name="last_name" label="Last name" defaultValue={lastName} required />
      </div>

      <div>
        <Label>Email</Label>
        <input
          value={email}
          readOnly
          className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
        />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field name="city" label="City" placeholder="Austin" />
        <Field name="state" label="State" placeholder="TX" />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Work preference</Label>
          <select
            name="remote_preference"
            defaultValue=""
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="" disabled>
              Select…
            </option>
            {REMOTE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </div>
        <div>
          <Label>Expected graduation</Label>
          <input
            type="month"
            name="expected_graduation"
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
          />
        </div>
      </div>

      <div>
        <Label>Technologies &amp; skills</Label>
        <input
          name="technologies"
          placeholder="React, TypeScript, Node.js, Python"
          className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        <p className="mt-1 text-xs text-slate-400">Separate with commas.</p>
      </div>

      <div>
        <Label>Resume</Label>
        <label className="flex h-11 w-full cursor-pointer items-center gap-3 rounded-lg border border-dashed border-slate-300 bg-white px-3 text-sm text-slate-500 transition hover:border-brand">
          <span className="rounded-md bg-slate-100 px-2 py-1 text-xs font-medium text-slate-600">
            Choose file
          </span>
          <span className="truncate">
            {fileName ?? "PDF, DOC or DOCX (max 10 MB)"}
          </span>
          <input
            type="file"
            name="resume"
            accept=".pdf,.doc,.docx,application/pdf"
            required
            onChange={(e) => setFileName(e.target.files?.[0]?.name ?? null)}
            className="hidden"
          />
        </label>
      </div>

      <button
        type="submit"
        disabled={submitting}
        className="flex h-11 w-full items-center justify-center rounded-lg bg-brand-gradient px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
      >
        {submitting ? "Submitting…" : "Submit my profile"}
      </button>

      {error && <p className="text-sm text-red-600">{error}</p>}
    </form>
  );
}

function Label({ children }: { children: React.ReactNode }) {
  return (
    <span className="mb-1 block text-xs font-medium text-slate-600">
      {children}
    </span>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  required,
}: {
  name: string;
  label: string;
  defaultValue?: string | null;
  placeholder?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <Label>{label}</Label>
      <input
        name={name}
        defaultValue={defaultValue ?? undefined}
        placeholder={placeholder}
        required={required}
        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
      />
    </label>
  );
}
