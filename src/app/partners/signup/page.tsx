"use client";

import { createClient } from "@/lib/supabase/client";
import { DevxLogo } from "@/components/Logo";
import { registerPartner } from "../actions";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function PartnerSignupPage() {
  const router = useRouter();
  // Email comes from the signed-in session (captured at the sign-in step).
  const [email, setEmail] = useState<string | null>(null);
  const [orgName, setOrgName] = useState("");
  const [website, setWebsite] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Require a session; a signed-out visitor is sent to the unified sign-in page.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.email) router.replace("/login");
      else setEmail(user.email);
    });
  }, [router]);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!email) return;
    setError(null);
    setLoading(true);

    const result = await registerPartner({ orgName, website, email });
    if (!result.ok) {
      setError(result.error);
      setLoading(false);
      return;
    }

    // Already signed in — no magic link needed. Land on the pending screen
    // until an admin approves the account.
    router.replace("/partners/pending");
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

          {email === null ? (
            <p className="mt-8 text-sm text-slate-400">Loading…</p>
          ) : (
            <form onSubmit={onSubmit} className="mt-8 space-y-3">
              <div className="rounded-lg bg-slate-50 px-3 py-2 text-sm ring-1 ring-slate-200">
                <span className="text-xs font-medium text-slate-500">
                  Signed in as
                </span>
                <div className="font-medium text-slate-800">{email}</div>
              </div>
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
              <button
                type="submit"
                disabled={loading}
                className="flex h-11 w-full items-center justify-center rounded-lg bg-brand-gradient px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
              >
                {loading ? "Submitting…" : "Submit for approval"}
              </button>
            </form>
          )}

          {error && <p className="mt-4 text-sm text-red-600">{error}</p>}
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
