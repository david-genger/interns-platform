import { getSyncStatus } from "@/lib/admin";
import { SyncPanel } from "@/components/admin/SyncPanel";

export const dynamic = "force-dynamic";

export default async function AdminSyncPage() {
  const { internCount, lastSyncedAt } = await getSyncStatus();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Sync</h1>
        <p className="mt-1 text-sm text-slate-500">
          Intern data mirrors one-way from Airtable on a schedule (hourly +
          daily). Trigger a manual pass below if you need fresh data now.
        </p>
      </div>

      <SyncPanel internCount={internCount} lastSyncedAt={lastSyncedAt} />
    </div>
  );
}
