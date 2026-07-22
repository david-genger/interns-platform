import { notFound } from "next/navigation";
import { Slideout } from "@/components/Slideout";
import { InternProfile } from "@/components/InternProfile";
import { TrackView } from "@/components/TrackView";
import { getIntern, getProjects, getViewerEmail } from "@/lib/interns";
import { EVENTS } from "@/lib/analytics-events";

// Intercepting route: soft navigation to /interns/[id] renders here, as a
// slideout over the list, instead of the full page.
export default async function InterceptedIntern({
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
    <Slideout>
      <TrackView
        event={EVENTS.internViewed}
        props={{ intern_id: intern.id, viewer }}
      />
      <InternProfile intern={intern} projects={projects} />
    </Slideout>
  );
}
