"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";
import { track } from "@vercel/analytics";
import { EVENTS } from "@/lib/analytics-events";

type Facets = {
  technologies: string[];
  internYears: string[];
  schools: string[];
  locations: string[];
};

export function Filters({ facets }: { facets: Facets }) {
  const router = useRouter();
  const params = useSearchParams();
  const [, startTransition] = useTransition();

  const setParam = useCallback(
    (key: string, value: string) => {
      const next = new URLSearchParams(params.toString());
      if (value) next.set(key, value);
      else next.delete(key);
      // Track applied facet filters (not every keystroke in the name search) so
      // we can see what companies actually filter interns by.
      if (key !== "q" && value) {
        track(EVENTS.internsFiltered, { filter: key, value });
      }
      startTransition(() => {
        router.replace(`/interns?${next.toString()}`, { scroll: false });
      });
    },
    [params, router]
  );

  const val = (k: string) => params.get(k) ?? "";
  const anyActive = ["q", "tech", "internYear", "school", "location"].some((k) =>
    params.get(k)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        placeholder="Search by name…"
        defaultValue={val("q")}
        onChange={(e) => setParam("q", e.target.value)}
        className="h-9 w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />

      {facets.locations.length > 0 && (
        <Select value={val("location")} onChange={(v) => setParam("location", v)} placeholder="All locations">
          {facets.locations.map((l) => (
            <option key={l} value={l}>
              {l}
            </option>
          ))}
        </Select>
      )}

      {facets.technologies.length > 0 && (
        <Select value={val("tech")} onChange={(v) => setParam("tech", v)} placeholder="All skills">
          {facets.technologies.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </Select>
      )}

      <Select value={val("internYear")} onChange={(v) => setParam("internYear", v)} placeholder="All cohorts">
        {facets.internYears.map((y) => (
          <option key={y} value={y}>
            Intern {y}
          </option>
        ))}
      </Select>

      {facets.schools.length > 0 && (
        <Select value={val("school")} onChange={(v) => setParam("school", v)} placeholder="All schools">
          {facets.schools.map((s) => (
            <option key={s} value={s}>
              {s}
            </option>
          ))}
        </Select>
      )}

      {anyActive && (
        <button
          onClick={() => startTransition(() => router.replace("/interns", { scroll: false }))}
          className="h-9 rounded-lg px-3 text-sm font-medium text-slate-500 hover:text-slate-800"
        >
          Clear
        </button>
      )}
    </div>
  );
}

function Select({
  value,
  onChange,
  placeholder,
  children,
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  children: React.ReactNode;
}) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
    >
      <option value="">{placeholder}</option>
      {children}
    </select>
  );
}
