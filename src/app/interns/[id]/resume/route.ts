import { NextResponse } from "next/server";
import { getResumeSignedUrl, getViewerEmail } from "@/lib/interns";
import { trackServer } from "@/lib/analytics";
import { EVENTS } from "@/lib/analytics-events";

export const dynamic = "force-dynamic";

/** Redirects to a fresh signed resume URL (server-gated by approval check). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const url = await getResumeSignedUrl(params.id);
  if (!url) return new NextResponse("Not found", { status: 404 });
  const viewer = await getViewerEmail();
  await trackServer(EVENTS.resumeDownloaded, { intern_id: params.id, viewer });
  return NextResponse.redirect(url);
}
