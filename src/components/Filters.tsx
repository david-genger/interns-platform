"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

type Facets = {
  technologies: string[];
  internYears: string[];
  experienceLevels: string[];
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
      startTransition(() => {
        router.replace(`/interns?${next.toString()}`, { scroll: false });
      });
    },
    [params, router]
  );

  const val = (k: string) => params.get(k) ?? "";
  const anyActive = ["q", "tech", "internYear", "experienceLevel", "institutionType", "minRating"].some(
    (k) => params.get(k)
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <input
        type="search"
        placeholder="Search name, role, school…"
        defaultValue={val("q")}
        onChange={(e) => setParam("q", e.target.value)}
        className="h-9 w-56 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none focus:border-brand focus:ring-1 focus:ring-brand"
      />

      <Select value={val("tech")} onChange={(v) => setParam("tech", v)} placeholder="All skills">
        {facets.technologies.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </Select>

      <Select value={val("internYear")} onChange={(v) => setParam("internYear", v)} placeholder="All cohorts">
        {facets.internYears.map((y) => (
          <option key={y} value={y}>
            Intern {y}
          </option>
        ))}
      </Select>

      <Select
        value={val("experienceLevel")}
        onChange={(v) => setParam("experienceLevel", v)}
        placeholder="Any level"
      >
        {facets.experienceLevels.map((l) => (
          <option key={l} value={l}>
            {l}
          </option>
        ))}
      </Select>

      <Select
        value={val("institutionType")}
        onChange={(v) => setParam("institutionType", v)}
        placeholder="College or bootcamp"
      >
        <option value="college">College</option>
        <option value="bootcamp">Bootcamp</option>
      </Select>

      <Select value={val("minRating")} onChange={(v) => setParam("minRating", v)} placeholder="Any rating">
        <option value="3">3★ and up</option>
        <option value="4">4★ and up</option>
        <option value="5">5★ only</option>
      </Select>

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
