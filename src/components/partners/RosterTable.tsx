"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { PartnerStudent, StudentStatus } from "@/lib/partners";
import { resendInvite } from "@/app/partners/actions";

const STATUS_STYLE: Record<StudentStatus, { label: string; cls: string }> = {
  uploaded: { label: "Not invited", cls: "bg-slate-100 text-slate-600" },
  invited: { label: "Invited", cls: "bg-blue-100 text-blue-700" },
  clicked: { label: "Opened", cls: "bg-amber-100 text-amber-700" },
  completed: { label: "Completed", cls: "bg-emerald-100 text-emerald-700" },
};

export function RosterTable({ roster }: { roster: PartnerStudent[] }) {
  if (roster.length === 0) {
    return (
      <div className="px-6 py-12 text-center text-sm text-slate-400">
        No students yet. Add your roster above to get started.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 text-left text-xs uppercase tracking-wide text-slate-400">
            <th className="px-6 py-3 font-medium">Student</th>
            <th className="px-6 py-3 font-medium">Status</th>
            <th className="px-6 py-3 font-medium">Last update</th>
            <th className="px-6 py-3 font-medium text-right">Actions</th>
          </tr>
        </thead>
        <tbody>
          {roster.map((s) => (
            <Row key={s.id} student={s} />
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ student }: { student: PartnerStudent }) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);
  const status = STATUS_STYLE[student.status];
  const name =
    [student.first_name, student.last_name].filter(Boolean).join(" ") || "—";

  const lastUpdate =
    student.completed_at ??
    student.clicked_at ??
    student.invited_at ??
    student.created_at;

  async function resend() {
    setBusy(true);
    await resendInvite(student.id);
    setBusy(false);
    router.refresh();
  }

  async function copyLink() {
    const url = `${window.location.origin}/invite/${student.invite_token}`;
    await navigator.clipboard.writeText(url);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  return (
    <tr className="border-b border-slate-50 last:border-0">
      <td className="px-6 py-3">
        <div className="font-medium text-slate-800">{name}</div>
        <div className="text-xs text-slate-400">{student.email}</div>
      </td>
      <td className="px-6 py-3">
        <span
          className={`inline-block rounded-full px-2.5 py-0.5 text-xs font-medium ${status.cls}`}
        >
          {status.label}
        </span>
      </td>
      <td className="px-6 py-3 text-xs text-slate-400">
        {formatDate(lastUpdate)}
      </td>
      <td className="px-6 py-3">
        <div className="flex items-center justify-end gap-3">
          {student.status !== "completed" && (
            <button
              onClick={resend}
              disabled={busy}
              className="text-xs font-medium text-brand hover:underline disabled:opacity-50"
            >
              {busy
                ? "Sending…"
                : student.status === "uploaded"
                ? "Send invite"
                : "Resend"}
            </button>
          )}
          <button
            onClick={copyLink}
            className="text-xs font-medium text-slate-500 hover:text-slate-800"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
      </td>
    </tr>
  );
}

function formatDate(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString(undefined, {
    month: "short",
    day: "numeric",
  });
}
