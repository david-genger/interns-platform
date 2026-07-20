"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PartnerStaff } from "@/lib/admin-partners";
import { adminSetPartnerStaffApproved } from "@/app/admin/partners/actions";

/**
 * Approve / revoke bootcamp staff accounts. When approved, that staffer gets
 * access to the SAME partner org David has been managing — the backwards-compat
 * handoff, since it's all keyed on partner_id.
 */
export function PartnerStaffApprovals({ staff }: { staff: PartnerStaff[] }) {
  if (staff.length === 0) {
    return (
      <p className="px-6 py-8 text-center text-sm text-slate-400">
        No staff accounts yet.
      </p>
    );
  }
  return (
    <ul className="divide-y divide-slate-100">
      {staff.map((s) => (
        <Row key={s.id} staff={s} />
      ))}
    </ul>
  );
}

function Row({ staff }: { staff: PartnerStaff }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function set(approved: boolean) {
    setBusy(true);
    await adminSetPartnerStaffApproved(staff.id, approved);
    setBusy(false);
    router.refresh();
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
      <div>
        <div className="text-sm font-medium text-slate-800">{staff.email}</div>
        <div className="text-xs text-slate-400">
          {staff.partner_name ?? "No org"} · {staff.role}
        </div>
      </div>
      <div className="flex items-center gap-3">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${
            staff.approved
              ? "bg-emerald-100 text-emerald-700"
              : "bg-amber-100 text-amber-700"
          }`}
        >
          {staff.approved ? "Approved" : "Pending"}
        </span>
        <button
          onClick={() => set(!staff.approved)}
          disabled={busy}
          className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
        >
          {busy ? "…" : staff.approved ? "Revoke" : "Approve"}
        </button>
      </div>
    </li>
  );
}
