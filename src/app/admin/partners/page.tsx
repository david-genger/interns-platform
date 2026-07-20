import Link from "next/link";
import { requireAdmin } from "@/lib/admin";
import { listPartnersOverview, listPartnerStaff } from "@/lib/admin-partners";
import { CreatePartnerForm } from "@/components/admin/CreatePartnerForm";
import { PartnerStaffApprovals } from "@/components/admin/PartnerStaffApprovals";

export const dynamic = "force-dynamic";

export default async function AdminPartnersPage() {
  await requireAdmin();
  const [partners, staff] = await Promise.all([
    listPartnersOverview(),
    listPartnerStaff(),
  ]);
  const pendingStaff = staff.filter((s) => !s.approved).length;

  return (
    <div className="space-y-8">
      <div>
        <h1 className="text-xl font-semibold tracking-tight text-slate-900">
          Bootcamps &amp; colleges
        </h1>
        <p className="mt-1 text-sm text-slate-500">
          Every partner org. Open one to manage its roster and invites on its
          behalf. When a bootcamp signs up, approve their staff below and they
          inherit this same list.
        </p>
      </div>

      <section className="rounded-2xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <h2 className="text-base font-semibold text-slate-900">Add a partner</h2>
        <p className="mb-4 mt-1 text-sm text-slate-500">
          Create an org so you can upload its roster and send invites now — the
          bootcamp can take it over later.
        </p>
        <CreatePartnerForm />
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Partners{" "}
            <span className="ml-1 text-sm font-normal text-slate-400">
              {partners.length}
            </span>
          </h2>
        </div>
        {partners.length === 0 ? (
          <p className="px-6 py-8 text-center text-sm text-slate-400">
            No partners yet. Add one above.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
                  <th className="px-6 py-3 font-medium">Partner</th>
                  <th className="px-6 py-3 font-medium">On roster</th>
                  <th className="px-6 py-3 font-medium">Invited</th>
                  <th className="px-6 py-3 font-medium">Completed</th>
                  <th className="px-6 py-3 font-medium">Signed up</th>
                  <th className="px-6 py-3 font-medium text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {partners.map((p) => (
                  <tr key={p.id} className="border-b border-slate-50 last:border-0">
                    <td className="px-6 py-3">
                      <div className="font-medium text-slate-800">{p.name}</div>
                      {p.pendingStaff > 0 && (
                        <div className="text-xs text-amber-600">
                          {p.pendingStaff} staff pending
                        </div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-slate-600">{p.onRoster}</td>
                    <td className="px-6 py-3 text-slate-600">{p.invited}</td>
                    <td className="px-6 py-3 text-slate-600">{p.completed}</td>
                    <td className="px-6 py-3 text-slate-600">{p.signedUp}</td>
                    <td className="px-6 py-3 text-right">
                      <Link
                        href={`/admin/partners/${p.id}`}
                        className="text-xs font-medium text-brand hover:underline"
                      >
                        Manage →
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="rounded-2xl bg-white shadow-sm ring-1 ring-slate-200">
        <div className="border-b border-slate-100 px-6 py-4">
          <h2 className="text-base font-semibold text-slate-900">
            Staff accounts{" "}
            {pendingStaff > 0 && (
              <span className="ml-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">
                {pendingStaff} pending
              </span>
            )}
          </h2>
          <p className="mt-1 text-sm text-slate-500">
            Approve a bootcamp&apos;s staff to hand them self-service access to
            their org.
          </p>
        </div>
        <PartnerStaffApprovals staff={staff} />
      </section>
    </div>
  );
}
