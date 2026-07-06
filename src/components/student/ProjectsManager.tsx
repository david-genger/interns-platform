"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import type { InternProject } from "@/lib/types";
import { addProject, removeProject, updateProject } from "@/app/student/actions";

export function ProjectsManager({ projects }: { projects: InternProject[] }) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [newUrl, setNewUrl] = useState("");
  const [error, setError] = useState<string | null>(null);

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError(null);
    startTransition(async () => {
      const res = await fn();
      if (!res.ok) setError(res.error ?? "Something went wrong.");
      else router.refresh();
    });
  }

  function onAdd(e: React.FormEvent) {
    e.preventDefault();
    const url = newUrl.trim();
    if (!url) return;
    run(async () => {
      const res = await addProject(url);
      if (res.ok) setNewUrl("");
      return res;
    });
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <h3 className="text-sm font-semibold text-slate-900">Projects</h3>
      <p className="mt-1 text-sm text-slate-500">
        Add links to live, deployed projects (https:// only). Companies see these
        on your profile.
      </p>

      <ul className="mt-4 space-y-2">
        {projects.length === 0 && (
          <li className="text-sm text-slate-400">No projects yet.</li>
        )}
        {projects.map((p) => (
          <ProjectRow key={p.id} project={p} disabled={pending} onRun={run} />
        ))}
      </ul>

      <form onSubmit={onAdd} className="mt-4 flex gap-2">
        <input
          type="url"
          value={newUrl}
          onChange={(e) => setNewUrl(e.target.value)}
          placeholder="https://my-project.com"
          className="h-10 flex-1 rounded-lg border border-slate-300 bg-white px-3 text-sm outline-none transition focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        <button
          type="submit"
          disabled={pending || !newUrl.trim()}
          className="inline-flex h-10 items-center justify-center rounded-lg bg-brand-gradient px-4 text-sm font-medium text-white shadow-sm transition hover:opacity-95 disabled:opacity-60"
        >
          Add
        </button>
      </form>

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}

function ProjectRow({
  project,
  disabled,
  onRun,
}: {
  project: InternProject;
  disabled: boolean;
  onRun: (fn: () => Promise<{ ok: boolean; error?: string }>) => void;
}) {
  const [editing, setEditing] = useState(false);
  const [url, setUrl] = useState(project.url);
  const [title, setTitle] = useState(project.title ?? "");

  if (editing) {
    return (
      <li className="flex flex-col gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3 sm:flex-row">
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Label (optional)"
          className="h-9 rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 sm:w-40"
        />
        <input
          type="url"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
          className="h-9 flex-1 rounded-lg border border-slate-300 bg-white px-2.5 text-sm outline-none focus:border-brand focus:ring-2 focus:ring-brand/30"
        />
        <div className="flex gap-2">
          <button
            type="button"
            disabled={disabled}
            onClick={() =>
              onRun(async () => {
                const res = await updateProject(project.id, url, title);
                if (res.ok) setEditing(false);
                return res;
              })
            }
            className="h-9 rounded-lg bg-brand-gradient px-3 text-sm font-medium text-white disabled:opacity-60"
          >
            Save
          </button>
          <button
            type="button"
            onClick={() => {
              setUrl(project.url);
              setTitle(project.title ?? "");
              setEditing(false);
            }}
            className="h-9 rounded-lg border border-slate-300 bg-white px-3 text-sm text-slate-600"
          >
            Cancel
          </button>
        </div>
      </li>
    );
  }

  return (
    <li className="flex items-center gap-2 rounded-lg border border-slate-200 p-3">
      <div className="min-w-0 flex-1">
        {project.title && (
          <p className="truncate text-sm font-medium text-slate-800">
            {project.title}
          </p>
        )}
        <a
          href={project.url}
          target="_blank"
          rel="noopener noreferrer"
          className="block truncate text-sm text-brand hover:underline"
        >
          {project.url}
        </a>
      </div>
      <button
        type="button"
        onClick={() => setEditing(true)}
        className="text-sm font-medium text-slate-500 hover:text-slate-700"
      >
        Edit
      </button>
      <button
        type="button"
        disabled={disabled}
        onClick={() => onRun(() => removeProject(project.id))}
        className="text-sm font-medium text-red-500 hover:text-red-600 disabled:opacity-60"
      >
        Remove
      </button>
    </li>
  );
}
