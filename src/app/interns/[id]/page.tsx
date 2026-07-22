import Link from "next/link";
import { notFound } from "next/navigation";
import { InternProfile } from "@/components/InternProfile";
import { TrackView } from "@/components/TrackView";
import { getIntern, getProjects, getViewerEmail } from "@/lib/interns";
import { EVENTS } from "@/lib/analytics-events";

// Full-page profile: direct load / refresh / shared link of /interns/[id].
export default async function InternPage({
  params,
}: {
  params: { id: string };
}) {
  const intern = await getIntern(params.id);
  if (!intern) notFound();
  const [projects, viewer] = await Promise.all([
    getProjects(intern.id),
    getViewerEmail(),
  ]);

  return (
    <div className="mx-auto max-w-2xl">
      <TrackView
        event={EVENTS.internViewed}
        props={{ intern_id: intern.id, viewer }}
      />
      <Link
        href="/interns"
        className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-slate-500 hover:text-slate-800"
      >
        ← Back to interns
      </Link>
      <div className="rounded-2xl bg-white p-6 ring-1 ring-slate-200">
        <InternProfile intern={intern} projects={projects} />
      </div>
    </div>
  );
}
