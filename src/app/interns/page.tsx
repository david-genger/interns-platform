import { Filters } from "@/components/Filters";
import { InternCard } from "@/components/InternCard";
import { getFacets, getInterns } from "@/lib/interns";
import type { InternFilters } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function InternsPage({
  searchParams,
}: {
  searchParams: Record<string, string | undefined>;
}) {
  const filters: InternFilters = {
    q: searchParams.q,
    tech: searchParams.tech,
    internYear: searchParams.internYear,
    experienceLevel: searchParams.experienceLevel,
    institutionType: searchParams.institutionType,
    minRating: searchParams.minRating ? Number(searchParams.minRating) : undefined,
  };

  const [interns, facets] = await Promise.all([getInterns(filters), getFacets()]);

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-2xl font-semibold text-slate-900">Interns</h1>
        <p className="text-sm text-slate-500">
          {interns.length} {interns.length === 1 ? "intern" : "interns"} available
        </p>
      </div>

      <Filters facets={facets} />

      {interns.length === 0 ? (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-12 text-center text-sm text-slate-500">
          No interns match these filters.
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {interns.map((intern) => (
            <InternCard key={intern.id} intern={intern} />
          ))}
        </div>
      )}
    </div>
  );
}
