"use client";

import { createClient } from "@/lib/supabase/client";
import { DevxLogo } from "@/components/Logo";
import { registerPartner } from "../actions";
import { useState } from "react";
import Link from "next/link";

export default function PartnerSignupPage() {
  const [orgName, setOrgName] = useState("");
  const [website, setWebsite] = useState("");
  const [email, setEmail] = useState("");
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

    const result = await registerPartner({ orgName, website, email });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Send a magic link so they can sign in (they'll land on the pending screen
    // until David approves the account).
    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim(),
      options: { emailRedirectTo: `${siteUrl()}/auth/callback?next=/partners` },
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
            Get your students in front of hiring companies.
          </h2>
          <p className="mt-4 max-w-md text-base leading-relaxed text-slate-300">
            Invite your cohort in a few clicks. Students upload their resumes,
            and you track sign-ups as they come in.
          </p>
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
            Register your program
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            For bootcamp &amp; college staff. We&apos;ll review your request and
            email you once you&apos;re approved.
          </p>

          {sent ? (
            <div className="mt-8 rounded-xl bg-emerald-50 p-4 text-sm text-emerald-800 ring-1 ring-emerald-200">
              <p className="font-medium">Check your email</p>
              <p className="mt-1 text-emerald-700">
                We sent a sign-in link to{" "}
                <span className="font-medium">{email}</span>. Open it to finish
                setting up. Your account will be reviewed before you can send
                invites.
              </p>
            </div>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-3">
              <Field
                label="Bootcamp / college name"
                value={orgName}
                onChange={setOrgName}
                placeholder="Acme Coding Bootcamp"
                required
              />
              <Field
                label="Website"
                value={website}
                onChange={setWebsite}
                placeholder="acmebootcamp.com"
                type="text"
              />
              <Field
                label="Your work email"
                value={email}
                onChange={setEmail}
                placeholder="you@acmebootcamp.com"
                type="email"
                required
              />
              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-brand-gradient px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
              >
                {loading ? "Submitting…" : "Create account"}
              </button>
            </form>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}

          <p className="mt-6 text-sm text-slate-500">
            Already registered?{" "}
            <Link
              href="/partners/login"
              className="font-medium text-brand hover:underline"
            >
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
