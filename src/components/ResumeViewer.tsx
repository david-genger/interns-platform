"use client";

import { useEffect, useState } from "react";

/**
 * Opens the intern's resume in an in-app PDF viewer (embedded iframe) instead
 * of a new browser tab. The `/interns/[id]/resume` route redirects to a
 * short-lived signed URL, which the iframe loads directly.
 */
export function ResumeViewer({ internId }: { internId: string }) {
  const [open, setOpen] = useState(false);
  const src = `/interns/${internId}/resume`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open]);

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-dark"
      >
        <FileIcon />
        View resume
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 backdrop-blur-sm">
          <div className="flex items-center justify-between gap-3 px-4 py-3 text-white">
            <span className="text-sm font-medium">Resume</span>
            <div className="flex items-center gap-2">
              <a
                href={src}
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-md px-3 py-1.5 text-sm font-medium text-white/90 hover:bg-white/10"
              >
                Open in new tab
              </a>
              <button
                onClick={() => setOpen(false)}
                className="rounded-md p-1.5 text-white/80 hover:bg-white/10"
                aria-label="Close"
              >
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M18 6 6 18M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>
          <div className="mx-auto w-full max-w-4xl flex-1 px-4 pb-4">
            <iframe
              src={src}
              title="Resume"
              className="h-full w-full rounded-lg bg-white shadow-2xl"
            />
          </div>
        </div>
      )}
    </>
  );
}

function FileIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6M9 15h6M9 11h2" />
    </svg>
  );
}
