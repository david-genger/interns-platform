import Link from "next/link";
import type { Intern } from "@/lib/types";
import { Avatar, PinIcon, displayName, locationLabel } from "@/components/ui";

export function InternRow({ intern }: { intern: Intern }) {
  const loc = locationLabel(intern);
  return (
    <Link
      href={`/interns/${intern.id}`}
      scroll={false}
      className="group flex items-center gap-4 bg-white px-4 py-3 transition hover:bg-slate-50"
    >
      <Avatar intern={intern} size={40} />

      <div className="min-w-0 flex-1">
        <p className="truncate font-medium text-slate-900 group-hover:text-brand">
          {displayName(intern)}
        </p>
        {intern.headline && (
          <p className="truncate text-sm text-slate-500">{intern.headline}</p>
        )}
      </div>

      <div className="hidden w-44 shrink-0 items-center gap-1 truncate text-sm text-slate-600 sm:flex">
        {loc ? (
          <>
            <PinIcon />
            <span className="truncate">{loc}</span>
          </>
        ) : (
          "—"
        )}
      </div>

      <div className="hidden w-40 shrink-0 truncate text-sm text-slate-600 md:block">
        {intern.educational_institution ?? "—"}
      </div>

      <div className="w-24 shrink-0 text-right text-sm text-slate-500">
        {intern.intern_year ? `Intern ${intern.intern_year}` : "—"}
      </div>
    </Link>
  );
}
