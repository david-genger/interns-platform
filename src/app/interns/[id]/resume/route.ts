import { NextResponse } from "next/server";
import { getResumeSignedUrl } from "@/lib/interns";

export const dynamic = "force-dynamic";

/** Redirects to a fresh signed resume URL (server-gated by approval check). */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const url = await getResumeSignedUrl(params.id);
  if (!url) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(url);
}
