import { NextRequest, NextResponse } from "next/server";
import { runSync, type SyncMode } from "@/lib/sync";

export const dynamic = "force-dynamic";
export const maxDuration = 60; // seconds

/**
 * Sync endpoint hit by Vercel Cron: /api/sync/hourly and /api/sync/daily.
 * Protected by SYNC_SECRET (Vercel Cron sends it as the Authorization header;
 * a ?secret= query param is also accepted for manual curl).
 */
export async function GET(
  req: NextRequest,
  { params }: { params: { mode: string } }
) {
  // Vercel Cron auto-sends `Authorization: Bearer $CRON_SECRET`. We accept that
  // or our own SYNC_SECRET (header or ?secret= for manual curl).
  const allowed = [process.env.CRON_SECRET, process.env.SYNC_SECRET].filter(Boolean);
  const auth = req.headers.get("authorization");
  const provided =
    (auth?.startsWith("Bearer ") ? auth.slice(7) : null) ||
    req.nextUrl.searchParams.get("secret");

  if (allowed.length === 0 || !provided || !allowed.includes(provided)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const mode = params.mode as SyncMode;
  if (mode !== "hourly" && mode !== "daily") {
    return NextResponse.json({ error: "invalid mode" }, { status: 400 });
  }

  try {
    const result = await runSync(mode);
    return NextResponse.json(result, { status: result.errors.length ? 207 : 200 });
  } catch (e) {
    return NextResponse.json({ error: (e as Error).message }, { status: 500 });
  }
}
