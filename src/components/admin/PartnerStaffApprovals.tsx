"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PartnerStaff } from "@/lib/admin-partners";
import {
  adminSetPartnerStaffApproved,
  adminSetPartnerStaffPartner,
} from "@/app/admin/partners/actions";

export type PartnerOption = { id: string; name: string };

/**
 * Approve / revoke bootcamp staff accounts and assign each to a specific org.
 * Assigning + approving is the handoff: the staffer inherits the exact partner
 * David has been managing (everything is keyed on partner_id).
 */
export function PartnerStaffApprovals({
  staff,
  partners,
}: {
  staff: PartnerStaff[];
  partners: PartnerOption[];
}) {
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
        <Row key={s.id} staff={s} partners={partners} />
      ))}
    </ul>
  );
}

function Row({
  staff,
  partners,
}: {
  staff: PartnerStaff;
  partners: PartnerOption[];
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);

  async function setApproved(approved: boolean) {
    setBusy(true);
    await adminSetPartnerStaffApproved(staff.id, approved);
    setBusy(false);
    router.refresh();
  }

  async function assign(partnerId: string) {
    setBusy(true);
    await adminSetPartnerStaffPartner(staff.id, partnerId || null);
    setBusy(false);
    router.refresh();
  }

  return (
    <li className="flex flex-wrap items-center justify-between gap-3 px-6 py-3">
      <div className="min-w-0">
        <div className="truncate text-sm font-medium text-slate-800">
          {staff.email}
        </div>
        <div className="text-xs text-slate-400">
          {staff.partner_name ?? "No org assigned"} · {staff.role}
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={staff.partner_id ?? ""}
          onChange={(e) => assign(e.target.value)}
          disabled={busy}
          className="h-8 max-w-[13rem] rounded-lg border border-slate-300 bg-white px-2 text-xs outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30 disabled:opacity-50"
        >
          <option value="">— Assign to org —</option>
          {partners.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
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
          onClick={() => setApproved(!staff.approved)}
          disabled={busy}
          className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
        >
          {busy ? "…" : staff.approved ? "Revoke" : "Approve"}
        </button>
      </div>
    </li>
  );
}
