"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { Intern, ReviewStatus } from "@/lib/types";
import { InternProfile } from "@/components/InternProfile";
import { Avatar, displayName } from "@/components/ui";
import { setCandidateReview } from "@/app/admin/actions";

export function CandidatesBoard({ candidates }: { candidates: Intern[] }) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = candidates.find((c) => c.id === selectedId) ?? null;

  if (candidates.length === 0) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center text-sm text-slate-500">
        No candidates in this view.
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-200 bg-slate-50 text-left text-xs font-medium uppercase tracking-wide text-slate-500">
              <th className="px-4 py-2.5">Candidate</th>
              <th className="px-4 py-2.5">School</th>
              <th className="px-4 py-2.5">Cohort</th>
              <th className="px-4 py-2.5">Status</th>
              <th className="px-4 py-2.5 text-right">Reviewed</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {candidates.map((c) => (
              <tr
                key={c.id}
                onClick={() => setSelectedId(c.id)}
                className="cursor-pointer transition hover:bg-slate-50"
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-3">
                    <Avatar intern={c} size={36} />
                    <div className="min-w-0">
                      <div className="truncate font-medium text-slate-800">
                        {displayName(c)}
                      </div>
                      {c.headline && (
                        <div className="truncate text-xs text-slate-500">
                          {c.headline}
                        </div>
                      )}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.educational_institution || (
                    <span className="text-slate-400">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-slate-600">
                  {c.intern_year || <span className="text-slate-400">—</span>}
                </td>
                <td className="px-4 py-3">
                  <StatusBadge status={c.review_status} />
                </td>
                <td className="px-4 py-3 text-right text-xs text-slate-400">
                  {c.reviewed_at
                    ? new Date(c.reviewed_at).toLocaleDateString()
                    : "—"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {selected && (
        <CandidateSlideout
          key={selected.id}
          candidate={selected}
          onClose={() => setSelectedId(null)}
        />
      )}
    </>
  );
}

export function StatusBadge({ status }: { status: ReviewStatus }) {
  const map: Record<ReviewStatus, string> = {
    approved:
      "bg-emerald-50 text-emerald-700 ring-emerald-600/20",
    pending: "bg-amber-50 text-amber-700 ring-amber-600/20",
    denied: "bg-rose-50 text-rose-700 ring-rose-600/20",
  };
  const label: Record<ReviewStatus, string> = {
    approved: "Approved",
    pending: "Pending",
    denied: "Denied",
  };
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-medium ring-1 ${map[status]}`}
    >
      {label[status]}
    </span>
  );
}

function CandidateSlideout({
  candidate,
  onClose,
}: {
  candidate: Intern;
  onClose: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [note, setNote] = useState(candidate.review_note ?? "");
  const [error, setError] = useState<string | null>(null);

  function review(status: ReviewStatus) {
    setError(null);
    startTransition(async () => {
      const res = await setCandidateReview(candidate.id, status, note);
      if (!res.ok) {
        setError(res.error ?? "Update failed.");
        return;
      }
      router.refresh();
      onClose();
    });
  }

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px] animate-[fadeIn_150ms_ease-out]"
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="absolute right-0 top-0 flex h-full w-full max-w-md flex-col bg-white shadow-xl ring-1 ring-slate-200 animate-[slideIn_200ms_ease-out]"
      >
        <div className="sticky top-0 z-10 flex items-center justify-between border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur">
          <StatusBadge status={candidate.review_status} />
          <button
            onClick={onClose}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          <InternProfile
            intern={candidate}
            resumeSrc={`/admin/candidates/${candidate.id}/resume`}
          />
        </div>

        {/* Review controls pinned to the bottom */}
        <div className="border-t border-slate-200 bg-slate-50 p-4">
          <label className="mb-2 block">
            <span className="mb-1 block text-xs font-medium text-slate-500">
              Internal note <span className="text-slate-400">(optional)</span>
            </span>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              rows={2}
              placeholder="Why you approved or denied — visible to admins only."
              className="w-full resize-none rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
            />
          </label>

          {error && <p className="mb-2 text-sm text-red-600">{error}</p>}

          <div className="flex items-center gap-2">
            {candidate.review_status !== "approved" && (
              <button
                disabled={pending}
                onClick={() => review("approved")}
                className="h-9 flex-1 rounded-lg bg-emerald-600 px-3 text-sm font-medium text-white hover:bg-emerald-700 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Approve"}
              </button>
            )}
            {candidate.review_status !== "denied" && (
              <button
                disabled={pending}
                onClick={() => review("denied")}
                className="h-9 flex-1 rounded-lg bg-rose-600 px-3 text-sm font-medium text-white hover:bg-rose-700 disabled:opacity-60"
              >
                {pending ? "Saving…" : "Deny"}
              </button>
            )}
            {candidate.review_status !== "pending" && (
              <button
                disabled={pending}
                onClick={() => review("pending")}
                className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm font-medium text-slate-600 hover:bg-slate-100 disabled:opacity-60"
              >
                Reset
              </button>
            )}
          </div>
        </div>
      </aside>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
