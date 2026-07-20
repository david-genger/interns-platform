import { notFound } from "next/navigation";
import { Slideout } from "@/components/Slideout";
import { InternProfile } from "@/components/InternProfile";
import { getIntern, getProjects } from "@/lib/interns";
import { trackServer } from "@/lib/analytics";
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
  const projects = await getProjects(intern.id);

  await trackServer(EVENTS.internViewed, {
    intern_id: intern.id,
    source: "slideout",
  });

  return (
    <Slideout>
      <InternProfile intern={intern} projects={projects} />
    </Slideout>
  );
}
