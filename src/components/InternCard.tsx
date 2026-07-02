import Link from "next/link";
import type { Intern } from "@/lib/types";
import { Avatar, Pill, PinIcon, displayName, locationLabel } from "@/components/ui";

export function InternCard({ intern }: { intern: Intern }) {
  const loc = locationLabel(intern);
  return (
    <Link
      href={`/interns/${intern.id}`}
      scroll={false}
      className="group block rounded-xl bg-white p-4 ring-1 ring-slate-200 transition hover:ring-brand/40 hover:shadow-sm"
    >
      <div className="flex items-start gap-3">
        <Avatar intern={intern} size={44} />
        <div className="min-w-0 flex-1">
          <h3 className="truncate font-medium text-slate-900 group-hover:text-brand">
            {displayName(intern)}
          </h3>
          {intern.headline && (
            <p className="truncate text-sm text-slate-500">{intern.headline}</p>
          )}
          {loc && (
            <p className="mt-0.5 flex items-center gap-1 text-sm text-slate-500">
              <PinIcon />
              <span className="truncate">{loc}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {intern.intern_year && <Pill>Intern {intern.intern_year}</Pill>}
        {intern.educational_institution && (
          <Pill>{intern.educational_institution}</Pill>
        )}
      </div>
    </Link>
  );
}
