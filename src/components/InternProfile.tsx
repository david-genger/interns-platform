import type { Intern, InternProject } from "@/lib/types";
import {
  Avatar,
  Pill,
  PinIcon,
  displayName,
  gradLabel,
  locationLabel,
} from "@/components/ui";
import { ResumeViewer } from "@/components/ResumeViewer";

export function InternProfile({
  intern,
  projects = [],
  resumeSrc,
}: {
  intern: Intern;
  /** Published live project links, shown to companies and in the student preview. */
  projects?: InternProject[];
  /** Resume route to load. Defaults to the company-gated route; the student
   *  dashboard passes `/student/resume` to serve their own copy. */
  resumeSrc?: string;
}) {
  const loc = locationLabel(intern);
  const grad = gradLabel(intern);

  return (
    <div className="space-y-6">
      <header className="flex items-start gap-4">
        <Avatar intern={intern} size={64} />
        <div className="min-w-0">
          <h2 className="text-lg font-semibold text-slate-900">
            {displayName(intern)}
          </h2>
          {intern.headline && (
            <p className="text-sm text-slate-600">{intern.headline}</p>
          )}
          {loc && (
            <p className="mt-1 flex items-center gap-1 text-sm text-slate-600">
              <PinIcon />
              <span>{loc}</span>
            </p>
          )}
          {intern.email && (
            <p className="mt-1 text-sm">
              <a
                href={`mailto:${intern.email}`}
                className="text-brand hover:underline"
              >
                {intern.email}
              </a>
            </p>
          )}
          {intern.phone && (
            <p className="mt-1 text-sm">
              <a
                href={`tel:${intern.phone}`}
                className="text-brand hover:underline"
              >
                {intern.phone}
              </a>
            </p>
          )}
          {intern.linkedin_url && (
            <p className="mt-1 text-sm">
              <a
                href={intern.linkedin_url}
                target="_blank"
                rel="noopener noreferrer"
                className="text-brand hover:underline"
              >
                LinkedIn
              </a>
            </p>
          )}
          <div className="mt-2 flex flex-wrap gap-1.5">
            {intern.intern_year && <Pill>Intern {intern.intern_year}</Pill>}
            {intern.remote_preference && <Pill>{intern.remote_preference}</Pill>}
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Field label="School">{intern.educational_institution ?? "—"}</Field>
        <Field label="Expected graduation">{grad ?? "—"}</Field>
        <Field label="Cohort">
          {intern.intern_year ? `Intern ${intern.intern_year}` : "—"}
        </Field>
        <Field label="Location">{loc ?? "—"}</Field>
      </dl>

      {intern.summary && (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Summary
          </h3>
          <p className="whitespace-pre-line text-sm leading-relaxed text-slate-700">
            {intern.summary}
          </p>
        </section>
      )}

      {intern.technologies.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Skills
          </h3>
          <div className="flex flex-wrap gap-1.5">
            {intern.technologies.map((t) => (
              <Pill key={t}>{t}</Pill>
            ))}
          </div>
        </section>
      )}

      {projects.length > 0 && (
        <section>
          <h3 className="mb-1.5 text-xs font-semibold uppercase tracking-wide text-slate-400">
            Projects
          </h3>
          <ul className="space-y-1.5">
            {projects.map((p) => (
              <li key={p.id}>
                <a
                  href={p.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-brand hover:underline"
                >
                  <LinkIcon />
                  <span className="truncate">{p.title || hostname(p.url)}</span>
                </a>
              </li>
            ))}
          </ul>
        </section>
      )}

      {intern.resume_path && (
        <ResumeViewer src={resumeSrc ?? `/interns/${intern.id}/resume`} />
      )}
    </div>
  );
}

/** Bare hostname for display when a project has no explicit title. */
function hostname(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, "");
  } catch {
    return url;
  }
}

function LinkIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71" />
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71" />
    </svg>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <dt className="text-xs font-medium uppercase tracking-wide text-slate-400">
        {label}
      </dt>
      <dd className="mt-0.5 text-slate-800">{children}</dd>
    </div>
  );
}
