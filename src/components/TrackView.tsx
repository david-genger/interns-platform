"use client";

import { useEffect, useRef } from "react";
import { track } from "@vercel/analytics";

/**
 * Fire a Vercel Web Analytics custom event once, when this component mounts in
 * the browser.
 *
 * Why a client mount effect instead of `trackServer` on the page: the intern
 * profile opens as a *prefetched intercepting route* (the slideout). Next.js
 * renders that route's RSC payload during background prefetch and then reuses
 * the cache on the real click — so a server-side track either runs during
 * prefetch (wrong — no one opened anything) or never runs again on the actual
 * open. An effect runs only when the component is really mounted in the DOM,
 * which is exactly "the user opened this profile", prefetch-safe by nature.
 *
 * Rendered as a leaf inside a Server Component; renders nothing.
 */
export function TrackView({
  event,
  props,
}: {
  event: string;
  props?: Record<string, string | number | boolean | null>;
}) {
  const fired = useRef(false);
  useEffect(() => {
    // Guard against React 18 StrictMode's double-invoke in dev; in prod the
    // effect runs once per mount, i.e. once per open.
    if (fired.current) return;
    fired.current = true;
    track(event, props);
  }, [event, props]);
  return null;
}
