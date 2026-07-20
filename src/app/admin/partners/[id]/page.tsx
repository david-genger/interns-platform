import Link from "next/link";
import { notFound } from "next/navigation";
import { requireAdmin } from "@/lib/admin";
import { getPartnerDetail } from "@/lib/admin-partners";
import { rosterStats } from "@/lib/partners";
import { StatCards } from "@/components/partners/StatCards";
import { RosterUpload } from "@/components/partners/RosterUpload";
import { RosterTable } from "@/components/partners/RosterTable";
import { SendInvitesButton } from "@/components/partners/SendInvitesButton";
import {
  adminAddStudents,
  adminSendInvites,
  adminResendInvite,
} from "@/app/admin/partners/actions";

export const dynamic = "force-dynamic";

const REVIEW_STYLE: Record<string, string> = {
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-emerald-100 text-emerald-700",
  denied: "bg-slate-100 text-slate-500",
};

export default async function AdminPartnerDetailPage({
  params,
}: {
  params: { id: string };
}) {
  await requireAdmin();
  const detail = await getPartnerDetail(params.id);
  if (!detail) notFound();

  const stats = rosterStats(detail.roster);
  const pendingInvites = detail.roster.filter(
    (r) => r.status === "uploaded"
  ).length;

  // Bind the partner id into the shared roster engine actions, so the same
  // components the partner portal uses work here on this org's behalf.
  const addStudents = adminAddStudents.bind(null, detail.id);
  const sendInvites = adminSendInvites.bind(null, detail.id);
  const resendInvite = adminResendInvite.bind(null, detail.id);

  return (
    <div className="space-y-8">
      <div>
        <Link
          href="/admin/partners"
          className="text-xs font-medium text-slate-400 hover:text-slate-600"
        >
          ← All partners
        </Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
              {detail.name}
            </h1>
            <p className="mt-1 text-sm text-slate-500">
              Manage this program&apos;s roster and invites on its behalf.
            </p>
          </div>
          {pendingInvites > 0 && (
            <SendInvitesButton count={pendingInvites} sendInvites={sendInvites} />
          )}
        </div>
      </div>

      <StatCards stats={stats} />

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Add students</h2>
        <p className="mt-1 text-sm text-slate-500">
          Paste emails (one per line) or a CSV with first name, last name, and
          email. Nothing is emailed until you send invites.
        </p>
        <div className="mt-4">
          <RosterUpload addStudents={addStudents} />
        </div>
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Roster{" "}
            <span className="ml-1 text-sm font-normal text-slate-400">
              {stats.total}
            </span>
          </h2>
        </div>
        <RosterTable roster={detail.roster} resendInvite={resendInvite} />
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Signed-up candidates{" "}
            <span className="ml-1 text-sm font-normal text-slate-400">
              {detail.internsByYear.reduce((n, g) => n + g.interns.length, 0)}
            </span>
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Students from this program who&apos;ve created a profile, grouped by
            intern year.
          </p>
        </div>

        {detail.internsByYear.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-400">
            No one from this program has signed up yet.
          </p>
        ) : (
          detail.internsByYear.map((group) => (
            <div key={group.year} className="border-b border-slate-50 last:border-0">
              <div className="bg-slate-50/60 px-6 py-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                {group.year}
                <span className="ml-2 font-normal">{group.interns.length}</span>
              </div>
              <ul className="divide-y divide-slate-50">
                {group.interns.map((i) => (
                  <li
                    key={i.id}
                    className="flex flex-wrap items-center justify-between gap-3 px-6 py-3"
                  >
                    <div>
                      <div className="text-sm font-medium text-slate-800">
                        {i.name ||
                          [i.first_name, i.last_name].filter(Boolean).join(" ") ||
                          "—"}
                      </div>
                      <div className="text-xs text-slate-400">{i.email}</div>
                    </div>
                    <div className="flex items-center gap-3">
                      <span
                        className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
                          REVIEW_STYLE[i.review_status] ??
                          "bg-slate-100 text-slate-500"
                        }`}
                      >
                        {i.review_status}
                      </span>
                      <Link
                        href={`/admin/candidates`}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        Review
                      </Link>
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          ))
        )}
      </section>
    </div>
  );
}
