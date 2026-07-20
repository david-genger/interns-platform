import { createAdminClient } from "@/lib/supabase/admin";
import {
  fetchAllInternIds,
  fetchInterns,
  mapRecord,
  type AirtableAttachment,
} from "@/lib/airtable";
import { resolvePartnerId } from "@/lib/partner-resolve";

export type SyncMode = "hourly" | "daily" | "backfill";

// Hourly = catch new/just-touched interns quickly. Daily = reconcile recent
// edits. Backfill = no window: re-sync every current intern, so columns added
// after a record was last modified in Airtable still get populated.
const WINDOW_HOURS: Record<SyncMode, number | null> = {
  hourly: 2,
  daily: 25,
  backfill: null,
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

  // Cache school → partner id for this run so a cohort of students from the same
  // school resolves the partner once, not once per record.
  const partnerCache = new Map<string, string | null>();

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

  async function processRecord(rec: (typeof records)[number]): Promise<void> {
    try {
      const { row, profileImage, resume } = mapRecord(rec);

      const prevModified = existing.get(rec.id);
      const unchanged =
        prevModified && row.airtable_modified_at && prevModified === row.airtable_modified_at;

      // Hourly tier: skip rows we already have at the same revision — keeps it cheap.
      if (mode === "hourly" && unchanged) return;

      // The two attachments are independent — fetch/upload them concurrently.
      const [profile_image_url, resume_path] = await Promise.all([
        rehost("profile-images", rec.id, profileImage),
        rehost("resumes", rec.id, resume),
      ]);

      // Ensure this student's school exists as a partner and link it — so a
      // school first appearing in Airtable shows up in the partners list on the
      // very next sync, with no separate reconciling step.
      const partner_id = await resolvePartnerId(
        admin,
        row.educational_institution,
        partnerCache
      );

      const { error } = await admin.from("interns").upsert(
        {
          ...row,
          partner_id,
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

  // Process records with bounded concurrency so a growing intern set doesn't
  // run the (serial) re-hosting into the function timeout.
  const CONCURRENCY = 5;
  for (let i = 0; i < records.length; i += CONCURRENCY) {
    await Promise.all(records.slice(i, i + CONCURRENCY).map(processRecord));
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
