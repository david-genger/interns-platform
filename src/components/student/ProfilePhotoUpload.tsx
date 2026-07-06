"use client";

import { useRef, useState } from "react";
import { useRouter } from "next/navigation";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const ACCEPT = "image/png,image/jpeg,image/webp";

type Phase = "idle" | "uploading" | "done" | "error";

export function ProfilePhotoUpload({
  currentUrl,
  name,
}: {
  currentUrl: string | null;
  name: string | null;
}) {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [phase, setPhase] = useState<Phase>("idle");
  const [message, setMessage] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(currentUrl);

  async function upload(file: File) {
    if (!ACCEPT.split(",").includes(file.type)) {
      setPhase("error");
      setMessage("Please choose a JPG, PNG, or WEBP image.");
      return;
    }
    if (file.size > MAX_BYTES) {
      setPhase("error");
      setMessage("That image is over 5 MB. Please choose a smaller one.");
      return;
    }

    setPhase("uploading");
    setMessage("Uploading your photo…");
    try {
      const body = new FormData();
      body.append("file", file);
      const res = await fetch("/student/photo", { method: "POST", body });
      const data = (await res.json().catch(() => ({}))) as {
        ok?: boolean;
        error?: string;
        warning?: string;
        url?: string;
      };
      if (!res.ok || !data.ok) {
        throw new Error(data.error || "Upload failed. Please try again.");
      }
      if (data.url) setPreview(data.url);
      setPhase("done");
      setMessage(
        data.warning
          ? "Photo updated. It's live for companies; syncing to our records may take a moment."
          : "Photo updated. It's live for companies now."
      );
      router.refresh();
    } catch (e) {
      setPhase("error");
      setMessage((e as Error).message);
    }
  }

  function onPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void upload(file);
    e.target.value = "";
  }

  const initials =
    name
      ?.split(" ")
      .map((p) => p[0])
      .filter(Boolean)
      .slice(0, 2)
      .join("")
      .toUpperCase() || "?";
  const busy = phase === "uploading";

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Profile photo</h3>
      <p className="mt-1 text-sm text-slate-500">
        JPG, PNG, or WEBP, up to 5 MB. Shown to companies on your profile.
      </p>

      <div className="mt-4 flex items-center gap-4">
        {preview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={preview}
            alt="Your profile photo"
            className="h-16 w-16 rounded-full object-cover ring-1 ring-slate-200"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-brand/10 text-lg font-semibold text-brand ring-1 ring-slate-200">
            {initials}
          </div>
        )}

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          onChange={onPick}
          className="hidden"
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={busy}
          className="inline-flex h-10 items-center justify-center rounded-lg border border-slate-300 bg-white px-4 text-sm font-medium text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
        >
          {busy ? "Uploading…" : preview ? "Change photo" : "Upload photo"}
        </button>
      </div>

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
