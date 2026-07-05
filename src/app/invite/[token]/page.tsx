import { getStudentByToken } from "@/lib/partners";
import { markInviteClicked } from "../actions";
import { InviteForm } from "@/components/partners/InviteForm";
import { DevxLogo } from "@/components/Logo";

export const dynamic = "force-dynamic";

export default async function InvitePage({
  params,
}: {
  params: { token: string };
}) {
  const student = await getStudentByToken(params.token);

  if (!student) {
    return (
      <Shell>
        <h1 className="text-xl font-semibold text-slate-900">
          This link isn&apos;t valid
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          The invite link may be mistyped or expired. Ask your program to send a
          fresh one.
        </p>
      </Shell>
    );
  }

  if (student.status === "completed") {
    return (
      <Shell>
        <div className="mb-4 flex justify-center">
          <CheckBadge />
        </div>
        <h1 className="text-xl font-semibold text-slate-900">
          You&apos;re all set
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Your profile has been submitted. The Devx team will review it and add
          you to the platform. Nothing more to do!
        </p>
      </Shell>
    );
  }

  // Fire-and-forget: record that the link was opened.
  await markInviteClicked(params.token);

  return (
    <main className="min-h-screen bg-slate-50">
      <div className="mx-auto max-w-lg px-4 py-10">
        <div className="mb-8 flex justify-center">
          <DevxLogo height={36} priority />
        </div>
        <div className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200 sm:p-8">
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            Set up your profile
          </h1>
          <p className="mt-2 text-sm text-slate-500">
            {student.partner_name ? (
              <>
                <span className="font-medium text-slate-700">
                  {student.partner_name}
                </span>{" "}
                invited you to join the Devx talent platform. It takes about 5
                minutes.
              </>
            ) : (
              "You've been invited to join the Devx talent platform. It takes about 5 minutes."
            )}
          </p>
          <div className="mt-6">
            <InviteForm
              token={params.token}
              email={student.email}
              firstName={student.first_name}
              lastName={student.last_name}
            />
          </div>
        </div>
        <p className="mt-6 text-center text-xs text-slate-400">
          © {new Date().getFullYear()} Devx Staffing
        </p>
      </div>
    </main>
  );
}

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-md rounded-2xl bg-white p-8 text-center shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex justify-center">
          <DevxLogo height={32} />
        </div>
        {children}
      </div>
    </main>
  );
}

function CheckBadge() {
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-emerald-100">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
        <path
          d="M5 13l4 4L19 7"
          stroke="#059669"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </div>
  );
}
