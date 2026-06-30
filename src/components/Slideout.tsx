"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";

/**
 * Client wrapper that renders an intercepted intern profile as a right-side
 * panel over the list. Closing (backdrop, ✕, or Esc) navigates back, which
 * unmounts the intercepting route and restores the plain list URL.
 */
export function Slideout({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") router.back();
    };
    document.addEventListener("keydown", onKey);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", onKey);
      document.body.style.overflow = "";
    };
  }, [router]);

  return (
    <div className="fixed inset-0 z-40">
      <div
        className="absolute inset-0 bg-slate-900/30 backdrop-blur-[1px] animate-[fadeIn_150ms_ease-out]"
        onClick={() => router.back()}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        className="absolute right-0 top-0 h-full w-full max-w-md overflow-y-auto bg-white shadow-xl ring-1 ring-slate-200 animate-[slideIn_200ms_ease-out]"
      >
        <div className="sticky top-0 z-10 flex justify-end border-b border-slate-100 bg-white/80 px-4 py-3 backdrop-blur">
          <button
            onClick={() => router.back()}
            className="rounded-md p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-700"
            aria-label="Close"
          >
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M18 6 6 18M6 6l12 12" />
            </svg>
          </button>
        </div>
        <div className="p-6">{children}</div>
      </aside>

      <style>{`
        @keyframes slideIn { from { transform: translateX(100%); } to { transform: translateX(0); } }
        @keyframes fadeIn { from { opacity: 0; } to { opacity: 1; } }
      `}</style>
    </div>
  );
}
