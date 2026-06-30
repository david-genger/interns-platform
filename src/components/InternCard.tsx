import Link from "next/link";
import type { Intern } from "@/lib/types";
import { Avatar, Pill, Stars, displayName, gradLabel, locationLabel } from "@/components/ui";

export function InternCard({ intern }: { intern: Intern }) {
  const loc = locationLabel(intern);
  const grad = gradLabel(intern);

  return (
    <Link
      href={`/interns/${intern.id}`}
      scroll={false}
      className="group block rounded-xl bg-white p-4 ring-1 ring-slate-200 transition hover:ring-brand/40 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <Avatar intern={intern} size={44} />
        <div className="min-w-0 flex-1">
          <div className="flex items-center justify-between gap-2">
            <h3 className="truncate font-medium text-slate-900 group-hover:text-brand">
              {displayName(intern)}
            </h3>
            <Stars value={intern.rating_total} />
          </div>
          {intern.headline && (
            <p className="truncate text-sm text-slate-500">{intern.headline}</p>
          )}
          <div className="mt-1 text-xs text-slate-400">
            {[loc, grad && `Grad ${grad}`].filter(Boolean).join(" · ")}
          </div>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {intern.intern_year && <Pill>Intern {intern.intern_year}</Pill>}
        {intern.institution_type && (
          <Pill>
            <span className="capitalize">{intern.institution_type}</span>
          </Pill>
        )}
        {intern.technologies.slice(0, 4).map((t) => (
          <Pill key={t}>{t}</Pill>
        ))}
        {intern.technologies.length > 4 && (
          <Pill>+{intern.technologies.length - 4}</Pill>
        )}
      </div>
    </Link>
  );
}
