"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Intern } from "@/lib/types";
import { updateProfile } from "@/app/student/actions";

const REMOTE_OPTIONS = ["Remote", "Hybrid", "On-site", "Flexible"];

export function ProfileFieldsForm({ intern }: { intern: Intern }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(
    null
  );

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setMessage(null);
    const fd = new FormData(e.currentTarget);
    startTransition(async () => {
      const res = await updateProfile(fd);
      if (!res.ok) {
        setMessage({ ok: false, text: res.error ?? "Something went wrong." });
        return;
      }
      setMessage({
        ok: true,
        text: res.warning
          ? "Saved. Syncing to our records may take a moment."
          : "Profile saved.",
      });
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={onSubmit}
      className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm"
    >
      <h3 className="text-sm font-semibold text-slate-900">Profile details</h3>
      <p className="mt-1 text-sm text-slate-500">
        Keep these current — this is what companies see.
      </p>

      <div className="mt-4 space-y-3">
        <div className="grid grid-cols-2 gap-3">
          <Field
            name="first_name"
            label="First name"
            defaultValue={intern.first_name ?? ""}
            required
          />
          <Field
            name="last_name"
            label="Last name"
            defaultValue={intern.last_name ?? ""}
          />
        </div>
        <Field
          name="phone"
          label="Phone (optional)"
          type="tel"
          defaultValue={intern.phone ?? ""}
          placeholder="(512) 555-1234"
        />
        <Field
          name="headline"
          label="Headline"
          defaultValue={intern.headline ?? ""}
          placeholder="e.g. Full-stack developer"
        />
        <div className="grid grid-cols-2 gap-3">
          <Field name="city" label="City" defaultValue={intern.city ?? ""} />
          <Field name="state" label="State" defaultValue={intern.state ?? ""} />
        </div>
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Work preference
          </span>
          <select
            name="remote_preference"
            defaultValue={intern.remote_preference ?? ""}
            className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
          >
            <option value="">Select…</option>
            {REMOTE_OPTIONS.map((o) => (
              <option key={o} value={o}>
                {o}
              </option>
            ))}
          </select>
        </label>
        <Field
          name="linkedin_url"
          label="LinkedIn URL"
          type="url"
          defaultValue={intern.linkedin_url ?? ""}
          placeholder="https://linkedin.com/in/you"
        />
        <Field
          name="technologies"
          label="Skills (comma-separated)"
          defaultValue={intern.technologies.join(", ")}
          placeholder="React, TypeScript, Node.js"
        />

        {/* Read-only: school + expected graduation anchor the cohort and can't be
            self-edited. Shown so the student can see them; not submitted. */}
        <div className="grid grid-cols-2 gap-3">
          <ReadOnly
            label="School / bootcamp"
            value={intern.educational_institution}
          />
          <ReadOnly
            label="Expected graduation"
            value={intern.expected_graduation}
          />
        </div>
        <p className="text-xs text-slate-400">
          Need to change your school or graduation date? Contact the Devx team.
        </p>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <button
          type="submit"
          disabled={pending}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
        >
          {pending ? "Saving…" : "Save changes"}
        </button>
        {message && (
          <span
            className={`text-sm ${
              message.ok ? "text-emerald-700" : "text-red-600"
            }`}
          >
            {message.text}
          </span>
        )}
      </div>
    </form>
  );
}

function Field({
  name,
  label,
  defaultValue,
  placeholder,
  type = "text",
  required,
}: {
  name: string;
  label: string;
  defaultValue: string;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        name={name}
        type={type}
        required={required}
        defaultValue={defaultValue}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
      />
    </label>
  );
}

/** A non-editable field, shown for context (school / graduation). */
function ReadOnly({ label, value }: { label: string; value: string | null }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        value={value ?? "—"}
        readOnly
        className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
      />
    </label>
  );
}
