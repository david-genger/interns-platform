import { NextResponse } from "next/server";
import { getMyIntern, getMyResumeSignedUrl } from "@/lib/interns";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateResumeAttachment } from "@/lib/airtable";
import { trackServer } from "@/lib/analytics";
import { EVENTS } from "@/lib/analytics-events";

export const dynamic = "force-dynamic";

const MAX_BYTES = 10 * 1024 * 1024; // 10 MB

/** Redirect to a fresh signed URL for the logged-in student's own resume. */
export async function GET() {
  const url = await getMyResumeSignedUrl();
  if (!url) return new NextResponse("Not found", { status: 404 });
  return NextResponse.redirect(url);
}

/**
 * Replace the logged-in student's resume.
 *  1. Verify the caller owns an intern record (RLS-scoped lookup).
 *  2. Store the PDF in the private `resumes` bucket (companies see it at once).
 *  3. Write it back to Airtable's Resume field via the write-scoped token, so
 *     the source of truth stays in sync. A write-back failure is non-fatal —
 *     the Supabase copy is already live; we return a warning to reconcile.
 */
export async function POST(request: Request) {
  const intern = await getMyIntern();
  if (!intern) {
    return NextResponse.json({ ok: false, error: "Not authorized." }, { status: 403 });
  }

  const form = await request.formData().catch(() => null);
  const file = form?.get("file");
  if (!(file instanceof File)) {
    return NextResponse.json({ ok: false, error: "No file provided." }, { status: 400 });
  }
  if (file.type !== "application/pdf") {
    return NextResponse.json(
      { ok: false, error: "Please upload a PDF." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "File exceeds the 10 MB limit." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  // Same path convention as the sync's rehost, so a later sync overwrites the
  // same object rather than orphaning it.
  const path = `${intern.airtable_id}.pdf`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage.from("resumes").upload(path, bytes, {
    contentType: "application/pdf",
    upsert: true,
  });
  if (uploadError) {
    return NextResponse.json(
      { ok: false, error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const { error: updateError } = await admin
    .from("interns")
    .update({ resume_path: path })
    .eq("id", intern.id);
  if (updateError) {
    return NextResponse.json(
      { ok: false, error: `Save failed: ${updateError.message}` },
      { status: 500 }
    );
  }

  // Write back to Airtable. Airtable fetches the file from a short-lived signed
  // URL, so it only needs to stay valid for a few seconds.
  let warning: string | undefined;
  try {
    const { data: signed } = await admin.storage
      .from("resumes")
      .createSignedUrl(path, 60 * 5);
    if (!signed?.signedUrl) throw new Error("could not sign resume URL");
    const filename =
      file.name && file.name.toLowerCase().endsWith(".pdf")
        ? file.name
        : "resume.pdf";
    await updateResumeAttachment(intern.airtable_id, signed.signedUrl, filename);
  } catch (e) {
    // Non-fatal: the resume is already live in Supabase for companies.
    warning = "airtable-write-failed";
    console.error(`resume Airtable write-back failed for ${intern.airtable_id}:`, e);
  }

  await trackServer(EVENTS.studentResumeUpdated, {
    airtable_write_failed: Boolean(warning),
  });

  return NextResponse.json({ ok: true, warning });
}
