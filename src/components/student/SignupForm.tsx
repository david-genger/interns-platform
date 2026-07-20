"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { registerStudent } from "@/app/signup/actions";
import type { SchoolOption } from "@/app/signup/actions";

const REMOTE_OPTIONS = ["Remote", "Hybrid", "On-site", "Flexible"];
const OTHER = "__other__";

/**
 * THE student profile form — shared by direct signup and the bootcamp invite.
 * Both submit through the same `registerStudent` action, so the rules, dedupe,
 * and approval are identical. The invite just passes a locked school + token.
 *
 *   - mode="authed": the visitor is already signed in; on success we drop them
 *     into /student to keep editing while we review.
 *   - mode="invite": no session (public link); on success we show a confirmation
 *     and they'll get a sign-in link once approved.
 */
export function SignupForm({
  email,
  mode,
  schools = [],
  lockedSchool = null,
  token = null,
  defaultFirstName = "",
  defaultLastName = "",
}: {
  email: string;
  mode: "authed" | "invite";
  schools?: SchoolOption[];
  lockedSchool?: { partnerId: string | null; name: string } | null;
  token?: string | null;
  defaultFirstName?: string | null;
  defaultLastName?: string | null;
}) {
  const router = useRouter();
  const [firstName, setFirstName] = useState(defaultFirstName ?? "");
  const [lastName, setLastName] = useState(defaultLastName ?? "");
  const [phone, setPhone] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [remote, setRemote] = useState("");
  const [grad, setGrad] = useState("");
  const [schoolChoice, setSchoolChoice] = useState("");
  const [schoolOther, setSchoolOther] = useState("");
  const [tech, setTech] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [projects, setProjects] = useState<string[]>([""]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  function setProject(i: number, v: string) {
    setProjects((p) => p.map((x, idx) => (idx === i ? v : x)));
  }
  function addProject() {
    setProjects((p) => [...p, ""]);
  }
  function removeProject(i: number) {
    setProjects((p) => (p.length === 1 ? [""] : p.filter((_, idx) => idx !== i)));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!resume) {
      setError("Please attach your resume (PDF).");
      return;
    }

    // Resolve the school + partner link. Locked (invite) uses the inviting org;
    // otherwise the dropdown value is a partner id, or "Other" → free text.
    let partnerId = "";
    let school = "";
    if (lockedSchool) {
      partnerId = lockedSchool.partnerId ?? "";
      school = lockedSchool.name;
    } else if (schoolChoice === OTHER) {
      school = schoolOther.trim();
    } else if (schoolChoice) {
      partnerId = schoolChoice;
      school = schools.find((s) => s.id === schoolChoice)?.name ?? "";
    }

    setLoading(true);
    const fd = new FormData();
    fd.set("first_name", firstName);
    fd.set("last_name", lastName);
    fd.set("email", email);
    fd.set("phone", phone);
    fd.set("city", city);
    fd.set("state", state);
    fd.set("remote_preference", remote);
    fd.set("expected_graduation", grad);
    fd.set("partner_id", partnerId);
    fd.set("school", school);
    fd.set("technologies", tech);
    fd.set("linkedin_url", linkedin);
    fd.set("resume", resume);
    if (photo) fd.set("photo", photo);
    if (token) fd.set("invite_token", token);
    for (const p of projects.map((x) => x.trim()).filter(Boolean)) {
      fd.append("projects", p);
    }

    const result = await registerStudent(fd);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    if (mode === "authed") {
      router.replace("/student");
    } else {
      setDone(true);
      setLoading(false);
    }
  }

  if (done) {
    return (
      <div className="rounded-xl bg-emerald-50 p-5 text-sm text-emerald-800 ring-1 ring-emerald-200">
        <p className="font-medium">Profile submitted 🎉</p>
        <p className="mt-1 text-emerald-700">
          Thanks! The Devx team will review your profile. Once you&apos;re
          approved we&apos;ll email you a link to sign in and keep it up to date.
          You can close this page.
        </p>
      </div>
    );
  }

  return (
    <form onSubmit={onSubmit} className="space-y-3">
      <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
        <span className="text-xs font-medium text-slate-500">
          {mode === "authed" ? "Signed in as" : "Email"}
        </span>
        <div className="font-medium text-slate-800">{email}</div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Field label="First name" value={firstName} onChange={setFirstName} required />
        <Field label="Last name" value={lastName} onChange={setLastName} />
      </div>

      <Field
        label="Phone (optional)"
        value={phone}
        onChange={setPhone}
        type="tel"
        placeholder="(512) 555-1234"
      />

      <div className="grid grid-cols-2 gap-3">
        <Field label="City" value={city} onChange={setCity} />
        <Field label="State" value={state} onChange={setState} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            Work preference
          </span>
          <select
            value={remote}
            onChange={(e) => setRemote(e.target.value)}
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
          label="Expected graduation"
          value={grad}
          onChange={setGrad}
          type="month"
        />
      </div>

      {/* School: locked to the inviting org, or chosen from the canonical list. */}
      {lockedSchool ? (
        <label className="block">
          <span className="mb-1 block text-xs font-medium text-slate-600">
            School / bootcamp
          </span>
          <input
            value={lockedSchool.name}
            readOnly
            className="h-11 w-full rounded-lg border border-slate-200 bg-slate-50 px-3 text-sm text-slate-500"
          />
        </label>
      ) : (
        <>
          <label className="block">
            <span className="mb-1 block text-xs font-medium text-slate-600">
              School / bootcamp
            </span>
            <select
              value={schoolChoice}
              onChange={(e) => setSchoolChoice(e.target.value)}
              className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
            >
              <option value="">Select…</option>
              {schools.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
              <option value={OTHER}>Other (not listed)</option>
            </select>
          </label>
          {schoolChoice === OTHER && (
            <Field
              label="Your school / bootcamp"
              value={schoolOther}
              onChange={setSchoolOther}
              placeholder="e.g. General Assembly"
              required
            />
          )}
        </>
      )}

      <Field
        label="Skills (comma-separated)"
        value={tech}
        onChange={setTech}
        placeholder="React, TypeScript, Node.js"
      />
      <Field
        label="LinkedIn URL"
        value={linkedin}
        onChange={setLinkedin}
        type="url"
        placeholder="https://linkedin.com/in/you"
      />

      <FileField
        label="Resume (PDF)"
        accept="application/pdf"
        file={resume}
        onPick={setResume}
        required
      />
      <FileField
        label="Profile photo (optional)"
        accept="image/png,image/jpeg,image/webp"
        file={photo}
        onPick={setPhoto}
      />

      {/* Project links */}
      <div className="rounded-lg border border-slate-200 bg-slate-50 p-3">
        <span className="mb-1 block text-xs font-medium text-slate-600">
          Project links (live websites only)
        </span>
        <p className="mb-2 text-xs text-slate-400">
          Add links to projects that are deployed and reachable at an https://
          address.
        </p>
        <div className="space-y-2">
          {projects.map((p, i) => (
            <div key={i} className="flex gap-2">
              <input
                type="url"
                value={p}
                onChange={(e) => setProject(i, e.target.value)}
                placeholder="https://my-project.com"
                className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
              />
              <button
                type="button"
                onClick={() => removeProject(i)}
                className="rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-500 transition hover:bg-slate-50"
                aria-label="Remove link"
              >
                ✕
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={addProject}
          className="mt-2 text-sm font-medium text-brand hover:underline"
        >
          + Add another link
        </button>
      </div>

      <button
        type="submit"
        disabled={loading}
        className="flex h-11 w-full items-center justify-center rounded-lg bg-brand-gradient px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
      >
        {loading ? "Submitting…" : "Submit for review"}
      </button>

      {error && <p className="mt-1 text-sm text-red-600">{error}</p>}
    </form>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  type = "text",
  required,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  type?: string;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type={type}
        required={required}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="h-11 w-full rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
      />
    </label>
  );
}

function FileField({
  label,
  accept,
  file,
  onPick,
  required,
}: {
  label: string;
  accept: string;
  file: File | null;
  onPick: (f: File | null) => void;
  required?: boolean;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-medium text-slate-600">{label}</span>
      <input
        type="file"
        accept={accept}
        required={required}
        onChange={(e) => onPick(e.target.files?.[0] ?? null)}
        className="block w-full text-sm text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-brand/10 file:px-3 file:py-2 file:text-sm file:font-medium file:text-brand hover:file:bg-brand/20"
      />
      {file && (
        <span className="mt-1 block truncate text-xs text-slate-400">
          {file.name}
        </span>
      )}
    </label>
  );
}
