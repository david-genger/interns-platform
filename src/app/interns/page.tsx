import { Filters } from "@/components/Filters";
import { InternResults } from "@/components/InternResults";
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
    school: searchParams.school,
    location: searchParams.location,
  };

  const [interns, facets] = await Promise.all([getInterns(filters), getFacets()]);

  return (
    <div className="space-y-5">
      <h1 className="text-2xl font-semibold text-slate-900">Interns</h1>

      <Filters facets={facets} />

      <InternResults interns={interns} />
    </div>
  );
}
