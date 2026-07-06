"use client";

import { createClient } from "@/lib/supabase/client";
import { DevxLogo } from "@/components/Logo";
import { registerCompany } from "../actions";
import { useState } from "react";
import Link from "next/link";

export default function CompanySignupPage() {
  const [fullName, setFullName] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [workedWithDevx, setWorkedWithDevx] = useState(false);
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function siteUrl() {
    return process.env.NEXT_PUBLIC_SITE_URL ?? window.location.origin;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setLoading(true);

    const result = await registerCompany({
      fullName,
      companyName,
      email,
      phone,
      workedWithDevx,
    });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Send a magic link so they can sign in — they'll land on the pending
    // screen until David approves the company.
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${siteUrl()}/auth/callback` },
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
            Hire hand-vetted software talent.
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300">
            Sign up as a Devx client to browse current and future software
            superstars — ready to join your team.
          </p>
          <ul className="mt-6 space-y-2 text-sm text-slate-300">
            <li className="flex items-center gap-2">
              <CheckIcon /> Free to sign up
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon /> No obligation — browse first
            </li>
            <li className="flex items-center gap-2">
              <CheckIcon /> Approved in a day or less
            </li>
          </ul>
        </div>
        <p className="relative text-xs text-slate-400">
          © {new Date().getFullYear()} Devx Staffing. All rights reserved.
        </p>
      </section>

      {/* Form panel */}
      <section className="flex items-center justify-center px-4 py-12">
        <div className="w-full max-w-sm">
          <div className="mb-8 lg:hidden">
            <DevxLogo height={36} priority />
          </div>

          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Sign up as a Devx client
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            It&apos;s free and takes a minute — no obligation. We&apos;ll review
            your request and email you the moment you&apos;re approved.
          </p>

          {sent ? (
            <div className="mt-8 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200">
              <p className="font-medium">You&apos;re on the list — check your email</p>
              <p className="mt-1 text-emerald-700">
                We sent a sign-in link to{" "}
                <span className="font-medium">{email}</span>. Open it to finish
                setting up. Your account will be reviewed before you can browse
                candidates.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-3">
              <Field
                label="Full name"
                value={fullName}
                onChange={setFullName}
                placeholder="Jane Smith"
                required
              />
              <Field
                label="Company name"
                value={companyName}
                onChange={setCompanyName}
                placeholder="Acme Inc."
                required
              />
              <Field
                label="Work email"
                value={email}
                onChange={setEmail}
                placeholder="you@acme.com"
                type="email"
                required
              />
              <Field
                label="Phone"
                value={phone}
                onChange={setPhone}
                placeholder="(555) 123-4567"
                type="tel"
                required
              />

              <label className="flex items-start gap-2.5 rounded-lg border border-slate-200 bg-slate-50 p-3">
                <input
                  type="checkbox"
                  checked={workedWithDevx}
                  onChange={(e) => setWorkedWithDevx(e.target.checked)}
                  className="mt-0.5 h-4 w-4 rounded border-slate-300 text-brand focus:ring-brand"
                />
                <span className="text-sm text-slate-600">
                  I&apos;ve worked with Devx Staffing before
                </span>
              </label>

              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-brand-gradient px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
              >
                {loading ? "Submitting…" : "Create free account"}
              </button>
            </form>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <p className="mt-6 text-sm text-slate-500">
            Already have access?{" "}
            <Link href="/login" className="font-medium text-brand hover:underline">
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
      <span className="mb-1 block text-xs font-medium text-slate-600">
        {label}
      </span>
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

function CheckIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#6AD7E5" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}
