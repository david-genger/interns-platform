import { getPartner, getRoster, rosterStats } from "@/lib/partners";
import { RosterUpload } from "@/components/partners/RosterUpload";
import { RosterTable } from "@/components/partners/RosterTable";
import { StatCards } from "@/components/partners/StatCards";
import { SendInvitesButton } from "@/components/partners/SendInvitesButton";

export const dynamic = "force-dynamic";

export default async function PartnerDashboardPage() {
  const [partner, roster] = await Promise.all([getPartner(), getRoster()]);
  const stats = rosterStats(roster);
  const pendingInvites = roster.filter((r) => r.status === "uploaded").length;

  return (
    <div className="space-y-8">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight text-slate-900">
            {partner?.name ?? "Your program"}
          </h1>
          <p className="mt-1 text-sm text-slate-500">
            Invite your students and track who&apos;s signed up.
          </p>
        </div>
        {pendingInvites > 0 && (
          <SendInvitesButton count={pendingInvites} />
        )}
      </div>

      <StatCards stats={stats} />

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Add students</h2>
        <p className="mt-1 text-sm text-slate-500">
          Paste emails (one per line) or a CSV with columns for first name, last
          name, and email. We&apos;ll show you a preview before anything is
          added.
        </p>
        <div className="mt-4">
          <RosterUpload />
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
        <RosterTable roster={roster} />
      </section>
    </div>
  );
}
