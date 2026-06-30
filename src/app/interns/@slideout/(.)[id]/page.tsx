import { notFound } from "next/navigation";
import { Slideout } from "@/components/Slideout";
import { InternProfile } from "@/components/InternProfile";
import { getIntern } from "@/lib/interns";

// Intercepting route: soft navigation to /interns/[id] renders here, as a
// slideout over the list, instead of the full page.
export default async function InterceptedIntern({
  params,
}: {
  params: { id: string };
}) {
  const intern = await getIntern(params.id);
  if (!intern) notFound();

  return (
    <Slideout>
      <InternProfile intern={intern} />
    </Slideout>
  );
}
