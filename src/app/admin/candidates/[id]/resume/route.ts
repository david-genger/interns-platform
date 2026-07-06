import { NextResponse } from "next/server";
import { getCandidateResumeSignedUrl } from "@/lib/admin";

export const dynamic = "force-dynamic";

/**
 * Redirects to a fresh signed resume URL for a candidate. Admin-gated (via
 * getCandidateResumeSignedUrl → requireAdmin) and service-role, so it works for
 * pending / denied candidates the company-facing route can't reach.
 */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const url = await getCandidateResumeSignedUrl(params.id);
  if (!url) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(url);
}
