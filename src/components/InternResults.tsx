"use client";

import { useState } from "react";
import type { Intern, ViewMode } from "@/lib/types";
import { InternCard } from "@/components/InternCard";
import { InternRow } from "@/components/InternRow";

export function InternResults({ interns }: { interns: Intern[] }) {
  const [view, setView] = useState<ViewMode>("grid");

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <p className="text-sm text-slate-500">
          {interns.length} {interns.length === 1 ? "intern" : "interns"}
        </p>
        <ViewToggle view={view} onChange={setView} />
      </div>

      {interns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No interns match these filters.
        </div>
      ) : view === "grid" ? (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {interns.map((intern) => (
            <InternCard key={intern.id} intern={intern} />
          ))}
        </div>
      ) : (
        <div className="divide-y divide-slate-100 overflow-hidden rounded-xl ring-1 ring-slate-200">
          {interns.map((intern) => (
            <InternRow key={intern.id} intern={intern} />
          ))}
        </div>
      )}
    </div>
  );
}

function ViewToggle({
  view,
  onChange,
}: {
  view: ViewMode;
  onChange: (v: ViewMode) => void;
}) {
  return (
    <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
      <ToggleButton active={view === "grid"} onClick={() => onChange("grid")} label="Grid">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <rect x="3" y="3" width="7" height="7" rx="1" />
          <rect x="14" y="3" width="7" height="7" rx="1" />
          <rect x="3" y="14" width="7" height="7" rx="1" />
          <rect x="14" y="14" width="7" height="7" rx="1" />
        </svg>
      </ToggleButton>
      <ToggleButton active={view === "list"} onClick={() => onChange("list")} label="List">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
        </svg>
      </ToggleButton>
    </div>
  );
}

function ToggleButton({
  active,
  onClick,
  label,
  children,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  children: React.ReactNode;
}) {
  return (
    <button
      onClick={onClick}
      aria-pressed={active}
      aria-label={`${label} view`}
      className={`flex h-7 w-8 items-center justify-center rounded-md transition ${
        active ? "bg-brand text-white" : "text-slate-500 hover:text-slate-800"
      }`}
    >
      {children}
    </button>
  );
}
