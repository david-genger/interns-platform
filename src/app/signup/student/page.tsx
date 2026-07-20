"use client";

import { createClient } from "@/lib/supabase/client";
import { DevxLogo } from "@/components/Logo";
import { getSchoolOptions, type SchoolOption } from "../actions";
import { SignupForm } from "@/components/student/SignupForm";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

export default function StudentSignupPage() {
  const router = useRouter();
  // Email comes from the signed-in session (captured at the sign-in step).
  const [email, setEmail] = useState<string | null>(null);
  const [schools, setSchools] = useState<SchoolOption[]>([]);

  // Require a session; a signed-out visitor is sent to the unified sign-in page.
  useEffect(() => {
    const supabase = createClient();
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user?.email) router.replace("/login");
      else setEmail(user.email);
    });
    getSchoolOptions().then(setSchools).catch(() => setSchools([]));
  }, [router]);

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

          {email === null ? (
            <p className="mt-8 text-sm text-slate-400">Loading…</p>
          ) : (
            <div className="mt-8">
              <SignupForm mode="authed" email={email} schools={schools} />
            </div>
          )}
        </div>
      </section>
    </main>
  );
}
