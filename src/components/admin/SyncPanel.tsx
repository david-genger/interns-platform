"use client";

import { useState, useTransition } from "react";
import { triggerSync } from "@/app/admin/actions";
import type { SyncResult } from "@/lib/sync";

export function SyncPanel({
  internCount,
  lastSyncedAt,
}: {
  internCount: number;
  lastSyncedAt: string | null;
}) {
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<SyncResult | null>(null);

  function run() {
    setError(null);
    setResult(null);
    startTransition(async () => {
      const res = await triggerSync("hourly");
      if (res.ok) setResult(res.result ?? null);
      else setError(res.error ?? "Sync failed.");
    });
  }

  return (
    <div className="space-y-5">
      <div className="grid gap-4 sm:grid-cols-2">
        <Stat label="Interns synced" value={internCount.toLocaleString()} />
        <Stat
          label="Last synced"
          value={
            lastSyncedAt
              ? new Date(lastSyncedAt).toLocaleString(undefined, {
                  dateStyle: "medium",
                  timeStyle: "short",
                })
              : "Never"
          }
        />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-sm font-medium text-slate-800">
              Run hourly sync now
            </div>
            <p className="mt-0.5 text-sm text-slate-500">
              Pulls interns modified in the last ~2 hours from Airtable.
            </p>
          </div>
          <button
            onClick={run}
            disabled={pending}
            className="h-9 shrink-0 rounded-lg bg-brand px-4 text-sm font-medium text-white hover:bg-brand-dark disabled:opacity-60"
          >
            {pending ? "Syncing…" : "Sync now"}
          </button>
        </div>

        {error && <p className="mt-3 text-sm text-red-600">{error}</p>}

        {result && (
          <div className="mt-3 rounded-lg bg-slate-50 p-3 text-sm text-slate-600 ring-1 ring-slate-200">
            <span className="font-medium text-slate-800">Done in {result.ms}ms.</span>{" "}
            Scanned {result.scanned}, upserted {result.upserted}, pruned{" "}
            {result.pruned}.
            {result.errors.length > 0 && (
              <div className="mt-1 text-amber-700">
                {result.errors.length} error(s): {result.errors.join("; ")}
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
      <div className="text-xs font-medium uppercase tracking-wide text-slate-500">
        {label}
      </div>
      <div className="mt-1 text-2xl font-semibold text-slate-900">{value}</div>
    </div>
  );
}
