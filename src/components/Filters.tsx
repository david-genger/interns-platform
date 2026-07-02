"use client";

import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useTransition } from "react";

type Facets = {
  technologies: string[];
  internYears: string[];
  schools: string[];
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
  const anyActive = ["q", "tech", "internYear", "school"].some((k) =>
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

      <Select value={val("school")} onChange={(v) => setParam("school", v)} placeholder="All schools">
        {facets.schools.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
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
