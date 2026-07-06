import Link from "next/link";
import { DevxLogo } from "@/components/Logo";
import { AccountTypeChooser } from "@/components/AccountTypeChooser";

export const metadata = { title: "Sign up · Devx Staffing" };

export default function SignupChooserPage() {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <div className="mb-8 flex justify-center">
          <DevxLogo height={36} priority />
        </div>

        <h1 className="text-center text-2xl font-semibold tracking-tight text-slate-900">
          What brings you to Devx?
        </h1>
        <p className="mx-auto mt-2 max-w-sm text-center text-sm text-slate-500">
          Choose how you&apos;d like to get started. It only takes a minute.
        </p>

        <div className="mt-8">
          <AccountTypeChooser />
        </div>

        <p className="mt-6 text-center text-sm text-slate-500">
          Already have access?{" "}
          <Link href="/login" className="font-medium text-brand hover:underline">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
