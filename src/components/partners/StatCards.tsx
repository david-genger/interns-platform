import type { RosterStats } from "@/lib/partners";

/** Funnel summary: total on the roster, then how far each has progressed. */
export function StatCards({ stats }: { stats: RosterStats }) {
  const cards: { label: string; value: number; hint: string }[] = [
    { label: "On roster", value: stats.total, hint: "students added" },
    { label: "Invited", value: stats.invited, hint: "emails sent" },
    { label: "Opened link", value: stats.clicked, hint: "clicked invite" },
    { label: "Completed", value: stats.completed, hint: "profile submitted" },
  ];

  return (
    <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
      {cards.map((c) => (
        <div
          key={c.label}
          className="rounded-2xl bg-white p-5 shadow-sm ring-1 ring-slate-200"
        >
          <p className="text-xs font-medium uppercase tracking-wide text-slate-400">
            {c.label}
          </p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">
            {c.value}
          </p>
          <p className="mt-1 text-xs text-slate-400">{c.hint}</p>
        </div>
      ))}
    </div>
  );
}
