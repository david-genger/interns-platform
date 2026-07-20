import { track } from "@vercel/analytics/server";
import { headers } from "next/headers";

/**
 * Server-side Vercel Web Analytics helper for custom events fired from Server
 * Actions and Route Handlers. (Client Components use `track` from
 * "@vercel/analytics" directly — this module imports the server SDK and
 * `next/headers`, so it must never be pulled into a client bundle.)
 *
 * Two things this wrapper guarantees over calling `track` directly:
 *   1. Best-effort — an analytics hiccup must never break a signup, a review,
 *      or a resume download. Failures are logged and swallowed.
 *   2. Prefetch-safe — Next.js prefetches route segments in the background;
 *      those renders aren't real user views, so we skip them when tracking on
 *      a Server Component render (e.g. the intern profile page).
 *
 * Awaited so the event flushes before the serverless function returns.
 */
type EventProps = Record<string, string | number | boolean | null | undefined>;

export async function trackServer(
  event: string,
  props?: EventProps
): Promise<void> {
  try {
    const h = headers();
    if (
      h.get("next-router-prefetch") === "1" ||
      h.get("purpose") === "prefetch"
    ) {
      return;
    }
    await track(event, props);
  } catch (err) {
    // Analytics is never allowed to fail the request it's observing.
    console.error(`[analytics] failed to track "${event}"`, err);
  }
}
