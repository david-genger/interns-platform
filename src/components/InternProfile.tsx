import type { Intern } from "@/lib/types";
import {
  Avatar,
  Pill,
  PinIcon,
  displayName,
  gradLabel,
  locationLabel,
} from "@/components/ui";
import { ResumeViewer } from "@/components/ResumeViewer";

export function InternProfile({ intern }: { intern: Intern }) {
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

      {intern.resume_path && <ResumeViewer internId={intern.id} />}
    </div>
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
