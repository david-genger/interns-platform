"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import type { SendInvitesResult } from "@/lib/rosters";

/**
 * Sends invites to everyone on the roster who hasn't been invited yet. The
 * `sendInvites` action is injected so the partner portal and admin console can
 * both reuse this button.
 */
export function SendInvitesButton({
  count,
  sendInvites,
}: {
  count: number;
  sendInvites: () => Promise<SendInvitesResult>;
}) {
  const router = useRouter();
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function send() {
    setBusy(true);
    setError(null);
    setMsg(null);
    const res = await sendInvites();
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? "Couldn't send invites.");
      return;
    }
    setMsg(
      `Sent ${res.sent} invite${res.sent === 1 ? "" : "s"}` +
        (res.failed > 0 ? ` — ${res.failed} failed.` : ".")
    );
    router.refresh();
  }

  return (
    <div className="text-right">
      <button
        onClick={send}
        disabled={busy}
        className="rounded-lg bg-brand-gradient px-4 py-2.5 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
      >
        {busy ? "Sending…" : `Send ${count} invite${count === 1 ? "" : "s"}`}
      </button>
      {msg && <p className="mt-2 text-xs font-medium text-emerald-700">{msg}</p>}
      {error && <p className="mt-2 text-xs text-red-600">{error}</p>}
    </div>
  );
}
