import { NextResponse } from "next/server";
import { getMyIntern } from "@/lib/interns";
import { createAdminClient } from "@/lib/supabase/admin";
import { updateInternFields } from "@/lib/airtable";

export const dynamic = "force-dynamic";

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB
const TYPES: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/**
 * Replace the logged-in student's profile photo.
 *  1. Verify the caller owns an intern record (RLS-scoped lookup).
 *  2. Store the image in the public `profile-images` bucket (companies see it
 *     at once).
 *  3. Write it back to Airtable's Profile Image field via the write-scoped
 *     token so the source of truth stays in sync. A write-back failure is
 *     non-fatal — the Supabase copy is already live; we return a warning.
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
  const ext = TYPES[file.type];
  if (!ext) {
    return NextResponse.json(
      { ok: false, error: "Please upload a JPG, PNG, or WEBP image." },
      { status: 400 }
    );
  }
  if (file.size > MAX_BYTES) {
    return NextResponse.json(
      { ok: false, error: "Image exceeds the 5 MB limit." },
      { status: 400 }
    );
  }

  const admin = createAdminClient();
  // Same path convention as the sync's rehost, so a later sync overwrites the
  // same object rather than orphaning it.
  const path = `${intern.airtable_id}.${ext}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  const { error: uploadError } = await admin.storage
    .from("profile-images")
    .upload(path, bytes, { contentType: file.type, upsert: true });
  if (uploadError) {
    return NextResponse.json(
      { ok: false, error: `Upload failed: ${uploadError.message}` },
      { status: 500 }
    );
  }

  const publicUrl = admin.storage.from("profile-images").getPublicUrl(path).data
    .publicUrl;
  // Cache-bust so the freshly-uploaded image shows immediately.
  const displayUrl = `${publicUrl}?v=${Date.now()}`;

  const { error: updateError } = await admin
    .from("interns")
    .update({ profile_image_url: displayUrl })
    .eq("id", intern.id);
  if (updateError) {
    return NextResponse.json(
      { ok: false, error: `Save failed: ${updateError.message}` },
      { status: 500 }
    );
  }

  // Write back to Airtable (fetches the public URL and snapshots the bytes).
  let warning: string | undefined;
  try {
    await updateInternFields(intern.airtable_id, { profileImageUrl: publicUrl });
  } catch (e) {
    warning = "airtable-write-failed";
    console.error(`photo Airtable write-back failed for ${intern.airtable_id}:`, e);
  }

  return NextResponse.json({ ok: true, warning, url: displayUrl });
}
