"use client";

import { createClient } from "@/lib/supabase/client";
import { DevxLogo } from "@/components/Logo";
import { registerStudent } from "../actions";
import { useState } from "react";
import Link from "next/link";

const REMOTE_OPTIONS = ["Remote", "Hybrid", "On-site", "Flexible"];

export default function StudentSignupPage() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [city, setCity] = useState("");
  const [state, setState] = useState("");
  const [remote, setRemote] = useState("");
  const [grad, setGrad] = useState("");
  const [school, setSchool] = useState("");
  const [tech, setTech] = useState("");
  const [linkedin, setLinkedin] = useState("");
  const [resume, setResume] = useState<File | null>(null);
  const [photo, setPhoto] = useState<File | null>(null);
  const [projects, setProjects] = useState<string[]>([""]);

  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
  }

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
    setLoading(true);

    const fd = new FormData();
    fd.set("first_name", firstName);
    fd.set("last_name", lastName);
    fd.set("email", email);
    fd.set("city", city);
    fd.set("state", state);
    fd.set("remote_preference", remote);
    fd.set("expected_graduation", grad);
    fd.set("school", school);
    fd.set("technologies", tech);
    fd.set("linkedin_url", linkedin);
    fd.set("resume", resume);
    if (photo) fd.set("photo", photo);
    for (const p of projects.map((x) => x.trim()).filter(Boolean)) {
      fd.append("projects", p);
    }

    const result = await registerStudent(fd);
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Send a magic link so they can sign in and manage their profile.
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/student` },
    });
    setLoading(false);
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="grid min-h-screen lg:grid-cols-2">
      {/* Brand panel */}
      <section className="relative hidden overflow-hidden bg-brand-ink lg:flex lg:flex-col lg:justify-between lg:p-12">
        <div
          className="pointer-events-none absolute inset-0 opacity-90"
          style={{
            background:
              "radial-gradient(120% 90% at 85% 10%, rgba(102,55,237,0.55) 0%, rgba(28,117,188,0.35) 40%, rgba(11,11,20,0) 70%), radial-gradient(90% 70% at 10% 100%, rgba(106,215,229,0.20) 0%, rgba(11,11,20,0) 60%)",
          }}
        />
        <div className="relative">
          <DevxLogo height={40} theme="dark" priority />
        </div>
        <div className="relative">
          <h2 className="max-w-md text-3xl font-semibold leading-tight text-white">
            Get in front of hiring companies.
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300">
            Build a profile, add your resume, and showcase the projects
            you&apos;ve shipped. Companies browse Devx talent every day.
          </p>
        </div>
        <p className="relative text-xs text-slate-400">
          © {new Date().getFullYear()} Devx Staffing. All rights reserved.
        </p>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-md">
          <div className="mb-8 lg:hidden">
            <DevxLogo height={36} priority />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Create your candidate profile
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            It takes a few minutes. We&apos;ll review your profile before it goes
            live to companies — you can keep editing it anytime.
          </p>

          {sent ? (
            <div className="mt-8 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200">
              <p className="font-medium">You&apos;re in — check your email</p>
              <p className="mt-1 text-emerald-700">
                We sent a sign-in link to{" "}
                <span className="font-medium">{email}</span>. Open it to manage
                your profile and projects while we review your submission.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field label="First name" value={firstName} onChange={setFirstName} required />
                <Field label="Last name" value={lastName} onChange={setLastName} />
              </div>
              <Field label="Email" value={email} onChange={setEmail} type="email" required placeholder="you@email.com" />
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
                <Field label="Expected graduation" value={grad} onChange={setGrad} type="date" />
              </div>
              <Field label="School / bootcamp" value={school} onChange={setSchool} placeholder="e.g. General Assembly" />
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
                  Add links to projects that are deployed and reachable at an
                  https:// address.
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
                {loading ? "Submitting…" : "Create my profile"}
              </button>
            </form>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <p className="mt-6 text-sm text-slate-500">
            Already applied?{" "}
            <Link href="/student/login" className="font-medium text-brand hover:underline">
              Sign in
            </Link>
          </p>
        </div>
      </section>
    </main>
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
