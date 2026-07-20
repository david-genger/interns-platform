/**
 * Airtable access for the intern sync.
 *
 * This module is the PRIVACY BOUNDARY: only the fields listed in FIELD below
 * are ever requested from Airtable, and only the columns written by mapRecord
 * reach our database. To expose more/less about an intern, change this file.
 *
 * Design goals: stay LIGHT. We never scan the full base — every fetch is
 * filtered to `Intern Year` set + a recent `Last Modified` window, and we only
 * request the columns we map (`fields[]` + returnFieldsByFieldId).
 */

import { normalizePhone } from "@/lib/phone";

const BASE = process.env.AIRTABLE_BASE_ID!;
const TABLE = process.env.AIRTABLE_TABLE_ID!;
const TOKEN = process.env.AIRTABLE_TOKEN!;

// filterByFormula references fields by NAME (not ID), so the dedupe query needs
// the human names of the email / phone columns. Defaults match the standard
// Local Talent columns; override via env if the base renames them.
const EMAIL_FIELD_NAME = process.env.AIRTABLE_EMAIL_FIELD_NAME ?? "Email";
const PHONE_FIELD_NAME = process.env.AIRTABLE_PHONE_FIELD_NAME ?? "Phone";
// Separate PAT, scoped to data.records:write on this base only. Kept distinct
// from the read-only sync TOKEN so the write path is the ONLY thing that can
// mutate Airtable — currently just the student resume field.
const WRITE_TOKEN = process.env.AIRTABLE_WRITE_TOKEN!;

// Field IDs in the "Local Talent" table (stable across renames).
export const FIELD = {
  name: "fldQMUBlwXtIKja8R",
  firstName: "fldrg9bGV3ZWiLxp7",
  lastName: "fldwmL8fznarPLNNq",
  jobTitle: "fldRCqFRayYr1uzX0",
  candidateSummary: "fld8WVHEpZbhFPY6i",
  resumeSummary: "fldl7SGGiVzYbF16m",
  technologies: "fld9CnOnlBsrJ22zk", // Name (from Technologies)
  techCategories: "fldWxizhVWquoBYjQ", // Tech categories (lookup)
  internYear: "fldtU4VcPltGPMFDK",
  expectedGraduation: "fldFdJRHHzH9RLfOW",
  educationalInstitution: "fldxKfWt3zuCVFHa8",
  location: "fld7K3yWv3ORYr4by",
  city: "fldiYAbTUOlTZGVEX",
  state: "fldWhzrHOuNeWFLAM",
  country: "fldB7deycLNWbF9Ze",
  remotePreference: "fldErauQK53ZY0tvR",
  profileImage: "fldSOm8fyGYbKzlcK",
  resume: "fld2fSGjnNefUqnqx", // full Resume attachment
  email: "fldHYPCxfADaPrmSO", // student login match key + company-visible contact
  phone: "fld08nVIKQMljWY3u", // company-visible contact
  linkedin: "fldU6vHPqLsFvMQnF", // "LinkedIn Profile" — company-visible
  lastModified: "fldqqlX3UYoabjuHr",
} as const;

export type AirtableAttachment = {
  id: string;
  url: string;
  filename: string;
  type?: string;
};

export type AirtableRecord = {
  id: string;
  fields: Record<string, unknown>;
};

function str(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === "string") return v.trim() || null;
  if (Array.isArray(v)) {
    const joined = v.map((x) => (typeof x === "string" ? x : "")).join(", ");
    return joined.trim() || null;
  }
  return String(v);
}

function strArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return Array.from(
    new Set(v.filter((x): x is string => typeof x === "string" && x.trim() !== ""))
  );
}

function firstAttachment(v: unknown): AirtableAttachment | null {
  if (Array.isArray(v) && v.length > 0) return v[0] as AirtableAttachment;
  return null;
}

/** Map an Airtable record (fields keyed by field ID) to an interns-table row. */
export function mapRecord(rec: AirtableRecord) {
  const f = rec.fields;
  return {
    row: {
      airtable_id: rec.id,
      name: str(f[FIELD.name]),
      first_name: str(f[FIELD.firstName]),
      last_name: str(f[FIELD.lastName]),
      headline: str(f[FIELD.jobTitle]),
      summary: str(f[FIELD.candidateSummary]) ?? str(f[FIELD.resumeSummary]),
      technologies: strArray(f[FIELD.technologies]),
      tech_categories: strArray(f[FIELD.techCategories]),
      intern_year: str(f[FIELD.internYear]),
      expected_graduation: str(f[FIELD.expectedGraduation]),
      educational_institution: str(f[FIELD.educationalInstitution]),
      location: str(f[FIELD.location]),
      city: str(f[FIELD.city]),
      state: str(f[FIELD.state]),
      country: str(f[FIELD.country]),
      remote_preference: str(f[FIELD.remotePreference]),
      email: str(f[FIELD.email]),
      phone: str(f[FIELD.phone]),
      phone_normalized: normalizePhone(str(f[FIELD.phone])),
      linkedin_url: str(f[FIELD.linkedin]),
      airtable_modified_at: str(f[FIELD.lastModified]),
    },
    // Attachments handled separately (re-hosted to Storage).
    profileImage: firstAttachment(f[FIELD.profileImage]),
    resume: firstAttachment(f[FIELD.resume]),
  };
}

/**
 * Fetch the record IDs of ALL current interns (Intern Year set), no time
 * window. Requests a single field so the payload stays tiny — the intern
 * universe is small (dozens), unlike the full base. Used to prune rows whose
 * Intern Year was cleared (they fall out of this set and get deleted).
 */
export async function fetchAllInternIds(): Promise<Set<string>> {
  const ids = new Set<string>();
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${TABLE}`);
    url.searchParams.set("filterByFormula", "{Intern Year}");
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("returnFieldsByFieldId", "true");
    url.searchParams.append("fields[]", FIELD.internYear);
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      cache: "no-store",
    });
    if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    for (const r of data.records) ids.add(r.id);
    offset = data.offset;
  } while (offset);

  return ids;
}

/**
 * Write a new resume back to Airtable's Resume attachment field. `fileUrl` must
 * be a publicly-fetchable URL (a short-lived Supabase signed URL) — Airtable
 * downloads and snapshots the bytes itself. Uses the write-scoped token.
 *
 * The write bumps the record's Last Modified, so the next sync re-hosts the
 * same file into Storage — harmless convergence, not a loop.
 */
export async function updateResumeAttachment(
  airtableId: string,
  fileUrl: string,
  filename: string
): Promise<void> {
  if (!WRITE_TOKEN) {
    throw new Error("AIRTABLE_WRITE_TOKEN is not configured");
  }
  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}/${airtableId}`, {
    method: "PATCH",
    headers: {
      Authorization: `Bearer ${WRITE_TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      // Field IDs are accepted as keys in write requests.
      fields: { [FIELD.resume]: [{ url: fileUrl, filename }] },
    }),
    cache: "no-store",
  });
  if (!res.ok) {
    throw new Error(`Airtable write ${res.status}: ${await res.text()}`);
  }
}

/** A student-editable field the write-back supports. Values map to FIELD ids. */
export type InternFieldUpdate = {
  name?: string | null;
  firstName?: string | null;
  lastName?: string | null;
  phone?: string | null;
  headline?: string | null;
  city?: string | null;
  state?: string | null;
  location?: string | null;
  remotePreference?: string | null;
  linkedInUrl?: string | null;
  technologies?: string[];
  /** Publicly-fetchable URL Airtable snapshots into the Profile Image field. */
  profileImageUrl?: string | null;
};

/**
 * Patch the subset of writable fields a student can edit back into Airtable,
 * keeping the source of truth in sync. Uses the write-scoped token. Only the
 * keys present in `u` are written, so an unset key is left untouched in
 * Airtable. Each write bumps Last Modified, so the next sync re-hosts any
 * attachment — harmless convergence, not a loop.
 */
export async function updateInternFields(
  airtableId: string,
  u: InternFieldUpdate
): Promise<void> {
  if (!WRITE_TOKEN) {
    throw new Error("AIRTABLE_WRITE_TOKEN is not configured");
  }

  const fields: Record<string, unknown> = {};
  if (u.name !== undefined) fields[FIELD.name] = u.name;
  if (u.firstName !== undefined) fields[FIELD.firstName] = u.firstName;
  if (u.lastName !== undefined) fields[FIELD.lastName] = u.lastName;
  if (u.phone !== undefined) fields[FIELD.phone] = u.phone;
  if (u.headline !== undefined) fields[FIELD.jobTitle] = u.headline;
  if (u.city !== undefined) fields[FIELD.city] = u.city;
  if (u.state !== undefined) fields[FIELD.state] = u.state;
  if (u.location !== undefined) fields[FIELD.location] = u.location;
  if (u.remotePreference !== undefined) {
    fields[FIELD.remotePreference] = u.remotePreference;
  }
  if (u.linkedInUrl !== undefined) fields[FIELD.linkedin] = u.linkedInUrl;
  if (u.technologies !== undefined) fields[FIELD.technologies] = u.technologies;
  if (u.profileImageUrl) {
    fields[FIELD.profileImage] = [{ url: u.profileImageUrl }];
  }

  if (Object.keys(fields).length === 0) return;

  const res = await fetch(
    `https://api.airtable.com/v0/${BASE}/${TABLE}/${airtableId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${WRITE_TOKEN}`,
        "Content-Type": "application/json",
      },
      // typecast so single-select fields (remote preference) accept labels.
      body: JSON.stringify({ fields, typecast: true }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Airtable write ${res.status}: ${await res.text()}`);
  }
}

/**
 * Fetch a single intern record by id (all mapped fields), or null if it's gone.
 * Used right after a self-serve signup to materialize the Supabase row before
 * the next scheduled sync, so the student can sign in and edit immediately.
 */
export async function fetchInternById(
  airtableId: string
): Promise<AirtableRecord | null> {
  const url = new URL(
    `https://api.airtable.com/v0/${BASE}/${TABLE}/${airtableId}`
  );
  url.searchParams.set("returnFieldsByFieldId", "true");
  for (const id of Object.values(FIELD)) url.searchParams.append("fields[]", id);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  return (await res.json()) as AirtableRecord;
}

/**
 * Find an existing Local Talent record matching a signup by email OR phone, so
 * the intake path can UPDATE it instead of creating a duplicate. One filtered
 * query (server-side `filterByFormula`, capped to a single page), so per-signup
 * cost is constant regardless of base size — this scales.
 *
 * Phone is compared digits-only on BOTH sides (Airtable's REGEX_REPLACE strips
 * the stored value; the caller passes an already-normalized key), so formatting
 * differences never cause a miss. Empty inputs are skipped, so a blank phone can
 * never match another blank phone. Returns the record id + whether Intern Year
 * is already set (the caller ensures it becomes set on update).
 */
export async function findLocalTalentRecord(opts: {
  email?: string | null;
  phoneDigits?: string | null;
}): Promise<{ id: string; internYearSet: boolean } | null> {
  const email = opts.email?.trim().toLowerCase() || "";
  const phone = (opts.phoneDigits ?? "").replace(/\D/g, "");

  const clauses: string[] = [];
  // Email is validated upstream (no quotes possible); phone is digits-only.
  // Both are injection-safe, but we still hard-strip to be certain.
  if (email) {
    clauses.push(
      `LOWER({${EMAIL_FIELD_NAME}} & '') = '${email.replace(/'/g, "")}'`
    );
  }
  if (phone) {
    clauses.push(
      `REGEX_REPLACE({${PHONE_FIELD_NAME}} & '', '[^0-9]', '') = '${phone}'`
    );
  }
  if (clauses.length === 0) return null;
  const formula = clauses.length === 1 ? clauses[0] : `OR(${clauses.join(",")})`;

  const url = new URL(`https://api.airtable.com/v0/${BASE}/${TABLE}`);
  url.searchParams.set("filterByFormula", formula);
  url.searchParams.set("pageSize", "1");
  url.searchParams.set("returnFieldsByFieldId", "true");
  url.searchParams.append("fields[]", FIELD.internYear);
  url.searchParams.append("fields[]", FIELD.email);
  url.searchParams.append("fields[]", FIELD.phone);

  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${TOKEN}` },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`Airtable ${res.status}: ${await res.text()}`);
  const data = (await res.json()) as { records: AirtableRecord[] };
  const rec = data.records[0];
  if (!rec) return null;
  return { id: rec.id, internYearSet: Boolean(str(rec.fields[FIELD.internYear])) };
}

/**
 * Fetch intern records modified within the last `hours`, paginating until done.
 * Only requests the mapped fields. Used by both sync tiers (different windows).
 * Pass `null` to skip the time window and fetch every current intern — used by
 * the backfill sync to populate columns added after records were last touched.
 */
export async function fetchInterns(hours: number | null): Promise<AirtableRecord[]> {
  const filterByFormula =
    hours == null
      ? `{Intern Year}`
      : `AND({Intern Year}, IS_AFTER({Last Modified}, DATEADD(NOW(), -${hours}, 'hours')))`;

  const fieldIds = Object.values(FIELD);
  const records: AirtableRecord[] = [];
  let offset: string | undefined;

  do {
    const url = new URL(`https://api.airtable.com/v0/${BASE}/${TABLE}`);
    url.searchParams.set("filterByFormula", filterByFormula);
    url.searchParams.set("pageSize", "100");
    url.searchParams.set("returnFieldsByFieldId", "true");
    url.searchParams.set("sort[0][field]", "Last Modified");
    url.searchParams.set("sort[0][direction]", "desc");
    for (const id of fieldIds) url.searchParams.append("fields[]", id);
    if (offset) url.searchParams.set("offset", offset);

    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${TOKEN}` },
      // Always hit Airtable fresh.
      cache: "no-store",
    });
    if (!res.ok) {
      throw new Error(`Airtable ${res.status}: ${await res.text()}`);
    }
    const data = (await res.json()) as { records: AirtableRecord[]; offset?: string };
    records.push(...data.records);
    offset = data.offset;
  } while (offset);

  return records;
}
