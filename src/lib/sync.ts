import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAllInternIds,
  fetchInterns,
  mapRecord,
  type AirtableAttachment,
} from "@/lib/airtable";

export type SyncMode = "hourly" | "daily";

// Hourly = catch new/just-touched interns quickly. Daily = reconcile recent edits.
const WINDOW_HOURS: Record<SyncMode, number> = {
  hourly: 2,
  daily: 25,
};

export type SyncResult = {
  mode: SyncMode;
  scanned: number;
  upserted: number;
  pruned: number;
  errors: string[];
  ms: number;
};

/**
 * Copy an Airtable attachment into a Storage bucket. Airtable URLs expire
 * (~2h), so we mirror the bytes and store a stable path. Returns the stored
 * object path (private bucket) or public URL (public bucket).
 */
async function rehost(
  bucket: "resumes" | "profile-images",
  airtableId: string,
  att: AirtableAttachment | null
): Promise<string | null> {
  if (!att?.url) return null;
  const admin = createAdminClient();

  const res = await fetch(att.url, { cache: "no-store" });
  if (!res.ok) return null;
  const bytes = new Uint8Array(await res.arrayBuffer());

  const ext = att.filename?.includes(".")
    ? att.filename.split(".").pop()!.toLowerCase()
    : bucket === "resumes"
    ? "pdf"
    : "jpg";
  const path = `${airtableId}.${ext}`;

  const { error } = await admin.storage.from(bucket).upload(path, bytes, {
    contentType: att.type || (bucket === "resumes" ? "application/pdf" : "image/jpeg"),
    upsert: true,
  });
  if (error) throw new Error(`storage ${bucket}: ${error.message}`);

  if (bucket === "profile-images") {
    return admin.storage.from(bucket).getPublicUrl(path).data.publicUrl;
  }
  return path; // resumes: store path, sign on demand
}

export async function runSync(mode: SyncMode): Promise<SyncResult> {
  const start = Date.now();
  const admin = createAdminClient();
  const errors: string[] = [];

  const records = await fetchInterns(WINDOW_HOURS[mode]);
  let upserted = 0;

  // Pull existing modified timestamps so we can skip unchanged rows and avoid
  // needless attachment re-hosting.
  const ids = records.map((r) => r.id);
  const existing = new Map<string, string | null>();
  if (ids.length) {
    const { data } = await admin
      .from("interns")
      .select("airtable_id, airtable_modified_at, resume_path, profile_image_url")
      .in("airtable_id", ids);
    for (const row of data ?? []) {
      existing.set(row.airtable_id, row.airtable_modified_at);
    }
  }

  for (const rec of records) {
    try {
      const { row, profileImage, resume } = mapRecord(rec);

      const prevModified = existing.get(rec.id);
      const unchanged =
        prevModified && row.airtable_modified_at && prevModified === row.airtable_modified_at;

      // Hourly tier: skip rows we already have at the same revision — keeps it cheap.
      if (mode === "hourly" && unchanged) continue;

      const profile_image_url = await rehost("profile-images", rec.id, profileImage);
      const resume_path = await rehost("resumes", rec.id, resume);

      const { error } = await admin.from("interns").upsert(
        {
          ...row,
          profile_image_url,
          resume_path,
          last_synced_at: new Date().toISOString(),
        },
        { onConflict: "airtable_id" }
      );
      if (error) throw new Error(error.message);
      upserted++;
    } catch (e) {
      errors.push(`${rec.id}: ${(e as Error).message}`);
    }
  }

  // Reconcile: delete interns whose Intern Year was cleared in Airtable (they
  // fall out of the current-intern set). Cheap — the set is small.
  let pruned = 0;
  try {
    const currentIds = await fetchAllInternIds();
    const { data: existingRows } = await admin.from("interns").select("airtable_id");
    const stale = (existingRows ?? [])
      .map((r) => r.airtable_id as string)
      .filter((id) => !currentIds.has(id));
    if (stale.length) {
      const { error } = await admin.from("interns").delete().in("airtable_id", stale);
      if (error) throw new Error(error.message);
      pruned = stale.length;
    }
  } catch (e) {
    errors.push(`reconcile: ${(e as Error).message}`);
  }

  return {
    mode,
    scanned: records.length,
    upserted,
    pruned,
    errors,
    ms: Date.now() - start,
  };
}
