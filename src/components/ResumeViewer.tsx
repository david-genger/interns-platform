"use client";

import { useEffect, useState } from "react";

/**
 * Resume as an inline preview that expands into a full-screen viewer.
 * - The preview is a live (non-interactive) render of the PDF's first page.
 * - Clicking the preview opens the modal viewer.
 * - Clicking the backdrop (or Esc, or ✕) closes it; clicking the PDF does not.
 *
 * `/interns/[id]/resume` redirects to a short-lived signed URL that the
 * iframes load directly.
 */
export function ResumeViewer({ internId }: { internId: string }) {
  const [open, setOpen] = useState(false);
  const src = `/interns/${internId}/resume`;
  // Hide the browser PDF chrome in the small preview; keep it in the full view.
  const previewSrc = `${src}#toolbar=0&navpanes=0&scrollbar=0&view=FitH`;

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [open]);

  return (
    <section>
      <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
        Resume
      </h3>

      {/* Inline preview — click to open the full viewer. */}
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="group relative block w-full overflow-hidden rounded-lg border border-slate-200 bg-slate-100 shadow-sm transition hover:border-brand/40 hover:shadow-md"
        aria-label="Open resume"
      >
        <div className="pointer-events-none h-72 w-full overflow-hidden">
          <iframe
            src={previewSrc}
            title="Resume preview"
            tabIndex={-1}
            className="h-full w-full"
          />
        </div>
        <div className="absolute inset-0 flex items-center justify-center bg-slate-900/0 transition group-hover:bg-slate-900/30">
          <span className="flex items-center gap-2 rounded-full bg-white/95 px-4 py-2 text-sm font-medium text-slate-800 opacity-0 shadow-lg transition group-hover:opacity-100">
            <ExpandIcon />
            View resume
          </span>
        </div>
      </button>

      {open && (
        // Backdrop — clicking it closes the viewer.
        <div
          className="fixed inset-0 z-50 flex flex-col bg-slate-900/70 backdrop-blur-sm"
          onClick={() => setOpen(false)}
        >
          {/* Header — stop propagation so its buttons don't close via backdrop. */}
          <div
            className="flex items-center justify-between gap-3 px-4 py-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
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

          {/* PDF panel — stop propagation so clicking the doc doesn't close. */}
          <div className="mx-auto w-full max-w-4xl flex-1 px-4 pb-4">
            <iframe
              src={src}
              title="Resume"
              onClick={(e) => e.stopPropagation()}
              className="h-full w-full rounded-lg bg-white shadow-2xl"
            />
          </div>
        </div>
      )}
    </section>
  );
}

function ExpandIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M15 3h6v6M9 21H3v-6M21 3l-7 7M3 21l7-7" />
    </svg>
  );
}
