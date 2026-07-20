import Link from "next/link";
import { notFound } from "next/navigation";
import { InternProfile } from "@/components/InternProfile";
import { getIntern, getProjects } from "@/lib/interns";
import { trackServer } from "@/lib/analytics";
import { EVENTS } from "@/lib/analytics-events";

// Full-page profile: direct load / refresh / shared link of /interns/[id].
export default async function InternPage({
  params,
}: {
  params: { id: string };
}) {
  const intern = await getIntern(params.id);
  if (!intern) notFound();
  const projects = await getProjects(intern.id);

  await trackServer(EVENTS.internViewed, { intern_id: intern.id, source: "page" });

  return (
    <div className="mx-auto max-w-2xl">
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
