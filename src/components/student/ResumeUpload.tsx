"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

type Phase = "idle" | "uploading" | "done" | "error";

export function ResumeUpload({ hasResume }: { hasResume: boolean }) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);

  async function upload(file: File) {
    if (file.type !== "application/pdf") {
      setPhase("error");
      setMessage("Please choose a PDF file.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setPhase("error");
      setMessage("That file is over 10 MB. Please upload a smaller PDF.");
      return;
    }

    setPhase("uploading");
    setMessage("Uploading and syncing your resume…");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/student/resume", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        warning?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Upload failed. Please try again.");
      }
      setPhase("done");
      setMessage(
        data.warning
          ? "Resume updated. It's live for companies now; syncing to our records may take a moment."
          : "Resume updated. It's live for companies now."
      );
      router.refresh(); // re-render the profile preview with the new resume
    } catch (e) {
      setPhase("error");
      setMessage((e as Error).message);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = ""; // allow re-selecting the same file
  }

  const busy = phase === "uploading";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">
        {hasResume ? "Replace your resume" : "Add your resume"}
      </h3>
      <p className="mt-1 text-sm text-slate-500">
        PDF only, up to 10 MB. Your new resume goes live to companies right
        away.
      </p>

      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        onChange={onPick}
        className="hidden"
      />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="mt-4 inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
      >
        {busy ? "Uploading…" : hasResume ? "Choose a new PDF" : "Choose a PDF"}
      </button>

      {message && (
        <p
          className={`mt-3 text-sm ${
            phase === "error"
              ? "text-red-600"
              : phase === "done"
              ? "text-emerald-700"
              : "text-slate-500"
          }`}
        >
          {message}
        </p>
      )}
    </div>
  );
}
