"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { parseRoster, type ParsedRoster } from "@/lib/csv";
import { addStudents } from "@/app/partners/actions";

export function RosterUpload() {
  const router = useRouter();
  const [text, setText] = useState("");
  const [parsed, setParsed] = useState<ParsedRoster | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  function onText(value: string) {
    setText(value);
    setResult(null);
    setError(null);
    setParsed(value.trim() ? parseRoster(value) : null);
  }

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const content = await file.text();
    onText(content);
  }

  async function confirm() {
    if (!parsed || parsed.valid.length === 0) return;
    setSubmitting(true);
    setError(null);
    const res = await addStudents(parsed.valid);
    setSubmitting(false);
    if (!res.ok) {
      setError(res.error ?? "Something went wrong.");
      return;
    }
    setResult(
      `Added ${res.added} student${res.added === 1 ? "" : "s"}` +
        (res.skipped > 0 ? ` — ${res.skipped} already on your roster.` : ".")
    );
    setText("");
    setParsed(null);
    router.refresh();
  }

  return (
    <div className="space-y-4">
      <textarea
        value={text}
        onChange={(e) => onText(e.target.value)}
        rows={5}
        placeholder={"jane@student.edu\njohn@student.edu\n\n…or paste CSV: First,Last,Email"}
        className="w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
      />

      <div className="flex flex-wrap items-center gap-3">
        <label className="cursor-pointer rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm font-medium text-slate-600 transition hover:bg-slate-50">
          Upload CSV
          <input
            type="file"
            accept=".csv,text/csv,text/plain"
            onChange={onFile}
            className="hidden"
          />
        </label>
        {parsed && parsed.valid.length > 0 && (
          <button
            onClick={confirm}
            disabled={submitting}
            className="rounded-lg bg-brand-gradient px-4 py-2 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
          >
            {submitting
              ? "Adding…"
              : `Add ${parsed.valid.length} student${
                  parsed.valid.length === 1 ? "" : "s"
                }`}
          </button>
        )}
      </div>

      {parsed && (
        <div className="rounded-lg bg-slate-50 p-4 text-sm ring-1 ring-slate-200">
          <p className="font-medium text-slate-700">
            {parsed.valid.length} ready to add
            {parsed.duplicatesInFile.length > 0 &&
              ` · ${parsed.duplicatesInFile.length} duplicate${
                parsed.duplicatesInFile.length === 1 ? "" : "s"
              } in file`}
            {parsed.invalid.length > 0 &&
              ` · ${parsed.invalid.length} skipped`}
          </p>

          {parsed.valid.length > 0 && (
            <ul className="mt-3 max-h-40 space-y-1 overflow-auto text-slate-600">
              {parsed.valid.slice(0, 50).map((r) => (
                <li key={r.email} className="flex gap-2">
                  <span className="text-slate-400">
                    {[r.first_name, r.last_name].filter(Boolean).join(" ") || "—"}
                  </span>
                  <span>{r.email}</span>
                </li>
              ))}
              {parsed.valid.length > 50 && (
                <li className="text-slate-400">
                  …and {parsed.valid.length - 50} more
                </li>
              )}
            </ul>
          )}

          {parsed.invalid.length > 0 && (
            <details className="mt-3">
              <summary className="cursor-pointer text-xs font-medium text-amber-700">
                {parsed.invalid.length} row(s) skipped
              </summary>
              <ul className="mt-2 space-y-1 text-xs text-amber-700">
                {parsed.invalid.slice(0, 20).map((r, i) => (
                  <li key={i}>
                    <span className="text-amber-500">({r.reason})</span> {r.line}
                  </li>
                ))}
              </ul>
            </details>
          )}
        </div>
      )}

      {result && (
        <p className="text-sm font-medium text-emerald-700">{result}</p>
      )}
      {error && <p className="text-sm text-red-600">{error}</p>}
    </div>
  );
}
