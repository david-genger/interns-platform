import Link from "next/link";
import { getCandidateCounts, listCandidates } from "@/lib/admin";
import { CandidatesBoard } from "@/components/admin/CandidatesBoard";
import type { ReviewStatus } from "@/lib/types";

export const dynamic = "force-dynamic";

type Filter = ReviewStatus | "all";
const FILTERS: { key: Filter; label: string }[] = [
  { key: "pending", label: "Pending" },
  { key: "approved", label: "Approved" },
  { key: "denied", label: "Denied" },
  { key: "all", label: "All" },
];

function parseFilter(v: string | undefined): Filter {
  if (v === "approved" || v === "denied" || v === "all" || v === "pending") {
    return v;
  }
  return "pending"; // default to the work queue
}

export default async function AdminCandidatesPage({
  searchParams,
}: {
  searchParams: { status?: string };
}) {
  const filter = parseFilter(searchParams.status);
  const [candidates, counts] = await Promise.all([
    listCandidates(filter),
    getCandidateCounts(),
  ]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Candidates</h1>
        <p className="mt-1 text-sm text-slate-500">
          Approve candidates to make them visible to companies. Decisions stick
          across syncs.
          {counts.pending > 0 && (
            <>
              {" · "}
              <span className="font-medium text-amber-600">
                {counts.pending} awaiting review
              </span>
            </>
          )}
        </p>
      </div>

      {/* Status filter */}
      <div className="flex flex-wrap gap-2">
        {FILTERS.map((f) => {
          const active = f.key === filter;
          return (
            <Link
              key={f.key}
              href={`/admin/candidates?status=${f.key}`}
              className={`inline-flex items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition ${
                active
                  ? "bg-brand text-white"
                  : "bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50"
              }`}
            >
              {f.label}
              <span
                className={`rounded-full px-1.5 text-xs ${
                  active ? "bg-white/20" : "bg-slate-100 text-slate-500"
                }`}
              >
                {counts[f.key]}
              </span>
            </Link>
          );
        })}
      </div>

      <CandidatesBoard candidates={candidates} />
    </div>
  );
}
