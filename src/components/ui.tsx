import type { Intern } from "@/lib/types";

export function initials(intern: Intern): string {
  const a = intern.first_name?.[0] ?? intern.name?.[0] ?? "?";
  const b = intern.last_name?.[0] ?? "";
  return (a + b).toUpperCase();
}

export function displayName(intern: Intern): string {
  return intern.name || [intern.first_name, intern.last_name].filter(Boolean).join(" ") || "Unnamed intern";
}

export function locationLabel(intern: Intern): string | null {
  // The Airtable `Location` single-select ("Brooklyn, NY", "London") is the
  // reliably-populated field; city/state are usually empty. Fall back to those.
  if (intern.location) return intern.location;
  const parts = [intern.city, intern.state, intern.country].filter(Boolean);
  return parts.length ? parts.join(", ") : null;
}

export function gradLabel(intern: Intern): string | null {
  if (!intern.expected_graduation) return null;
  const d = new Date(intern.expected_graduation);
  if (isNaN(d.getTime())) return intern.expected_graduation;
  return d.toLocaleDateString(undefined, { month: "short", year: "numeric" });
}

export function Avatar({ intern, size = 48 }: { intern: Intern; size?: number }) {
  if (intern.profile_image_url) {
    // eslint-disable-next-line @next/next/no-img-element
    return (
      <img
        src={intern.profile_image_url}
        alt={displayName(intern)}
        width={size}
        height={size}
        className="rounded-full object-cover ring-1 ring-slate-200"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="flex items-center justify-center rounded-full bg-brand/10 font-semibold text-brand ring-1 ring-brand/20"
      style={{ width: size, height: size, fontSize: size * 0.36 }}
    >
      {initials(intern)}
    </div>
  );
}

export function PinIcon({ className = "" }: { className?: string }) {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      className={`shrink-0 text-slate-400 ${className}`}
      aria-hidden
    >
      <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0Z" />
      <circle cx="12" cy="10" r="3" />
    </svg>
  );
}

export function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
      {children}
    </span>
  );
}
