import type { Intern } from "@/lib/types";
import {
  Avatar,
  Pill,
  Stars,
  displayName,
  gradLabel,
  locationLabel,
} from "@/components/ui";

const SKILL_RATINGS: { label: string; key: keyof Intern }[] = [
  { label: "Technical", key: "rating_technical" },
  { label: "Soft skills", key: "rating_soft" },
  { label: "Frontend", key: "rating_frontend" },
  { label: "Backend", key: "rating_backend" },
  { label: "Database", key: "rating_db" },
  { label: "Cloud", key: "rating_cloud" },
];

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
          <div className="mt-2 flex flex-wrap gap-1.5">
            {intern.intern_year && <Pill>Intern {intern.intern_year}</Pill>}
            {intern.experience_level && <Pill>{intern.experience_level}</Pill>}
            {intern.remote_preference && <Pill>{intern.remote_preference}</Pill>}
          </div>
        </div>
      </header>

      <dl className="grid grid-cols-2 gap-4 text-sm">
        <Field label="Overall rating">
          <Stars value={intern.rating_total} />
        </Field>
        <Field label="Location">{loc ?? "—"}</Field>
        <Field label="School">{intern.educational_institution ?? "—"}</Field>
        <Field label="Program">
          {intern.institution_type ? (
            <span className="capitalize">{intern.institution_type}</span>
          ) : (
            "—"
          )}
        </Field>
        <Field label="Expected graduation">{grad ?? "—"}</Field>
        <Field label="Experience level">
          {intern.experience_level ?? "—"}
        </Field>
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

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
          Ratings
        </h3>
        <div className="grid grid-cols-2 gap-y-2 gap-x-6 text-sm">
          {SKILL_RATINGS.map(({ label, key }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-slate-600">{label}</span>
              <Stars value={intern[key] as number | null} />
            </div>
          ))}
        </div>
      </section>

      {intern.resume_path && (
        <a
          href={`/interns/${intern.id}/resume`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2.5 text-sm font-medium text-white transition hover:bg-brand-dark"
        >
          View resume
        </a>
      )}
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
