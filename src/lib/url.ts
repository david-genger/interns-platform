/**
 * Project links must point to a LIVE public website so the company experience
 * stays consistent. This is format-only validation (no reachability ping):
 * require a well-formed https:// URL with a real public hostname. We reject
 * http://, localhost, and bare IPs so a link can't resolve to something private
 * or plainly non-production.
 *
 * Returns the normalized href, or null if the input isn't an acceptable link.
 */
export function normalizeLiveUrl(input: string): string | null {
  const raw = input.trim();
  if (!raw) return null;

  let url: URL;
  try {
    url = new URL(raw);
  } catch {
    return null;
  }

  // Live sites are served over https. Anything else (http, ftp, mailto…) is out.
  if (url.protocol !== "https:") return null;

  // No embedded credentials.
  if (url.username || url.password) return null;

  const host = url.hostname.toLowerCase();

  // Must look like a public domain: has a dot, not localhost, not an IP literal.
  if (host === "localhost" || host.endsWith(".localhost")) return null;
  if (!host.includes(".")) return null;
  if (isIpLiteral(host)) return null;

  return url.href;
}

/** True for IPv4 dotted quads and bracketed IPv6 hosts. */
function isIpLiteral(host: string): boolean {
  if (host.includes(":")) return true; // IPv6 (URL keeps brackets off hostname)
  return /^\d{1,3}(\.\d{1,3}){3}$/.test(host);
}
