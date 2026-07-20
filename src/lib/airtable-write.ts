/**
 * Airtable WRITE path for partner-sourced students.
 *
 * The read side (`airtable.ts`) is the privacy boundary for what leaves
 * Airtable. This module is the counterpart: it creates a new "Local Talent"
 * record from a student's invite submission. The record is left UNVETTED —
 * we deliberately never set `Intern Year`, so the existing sync gate keeps it
 * invisible on the companies platform until the Devx team reviews it.
 *
 * Field mapping uses the stable field IDs from `airtable.ts`. A few fields the
 * read side never touched (email, a partner "source" tag, a writable skills
 * field) don't have known IDs yet — they're configured via env so David can
 * point them at the right Airtable columns without a code change. Unset ones
 * are simply skipped, and the record still gets created.
 */
import { FIELD } from "@/lib/airtable";

const BASE = process.env.AIRTABLE_BASE_ID!;
const TABLE = process.env.AIRTABLE_TABLE_ID!;
// Creating records needs WRITE scope. AIRTABLE_TOKEN is the read-only sync
// token, so prefer the write-scoped token (same one airtable.ts uses for the
// resume write-back); fall back to AIRTABLE_TOKEN only if a single token carries
// both scopes.
const TOKEN = process.env.AIRTABLE_WRITE_TOKEN ?? process.env.AIRTABLE_TOKEN!;

// Optional columns without a known field ID on the read side. Set to the
// Airtable field NAME or field ID. Left blank -> that value isn't written.
const EMAIL_FIELD = process.env.AIRTABLE_EMAIL_FIELD; // e.g. "Email"
const SOURCE_FIELD = process.env.AIRTABLE_SOURCE_FIELD; // e.g. "Source"
const TECH_FIELD = process.env.AIRTABLE_TECH_FIELD; // writable skills field

export type NewStudentRecord = {
  firstName: string | null;
  lastName: string | null;
  email: string;
  phone?: string | null;
  city: string | null;
  state: string | null;
  remotePreference: string | null;
  expectedGraduation: string | null; // ISO date (YYYY-MM-DD)
  technologies: string[];
  school: string | null; // partner / bootcamp name
  /** Publicly fetchable URL Airtable can pull the resume from (short-lived ok). */
  resumeUrl: string | null;
  linkedInUrl?: string | null;
  /** Publicly fetchable URL Airtable snapshots into the Profile Image field. */
  profileImageUrl?: string | null;
  /**
   * Cohort label. The unified student intake always sets this to the current
   * year so the sync ingests the record and the admin review gate takes over.
   */
  internYear?: string | null;
};

/**
 * Build the Airtable `fields` payload from a student record. Shared by create
 * (POST) and update (PATCH) so both write exactly the same columns — only the
 * keys with a value are included, so an update never blanks a field the caller
 * didn't supply.
 */
function buildLocalTalentFields(r: NewStudentRecord): Record<string, unknown> {
  const fields: Record<string, unknown> = {};

  const fullName =
    [r.firstName, r.lastName].filter(Boolean).join(" ").trim() || null;
  if (fullName) fields[FIELD.name] = fullName;
  if (r.firstName) fields[FIELD.firstName] = r.firstName;
  if (r.lastName) fields[FIELD.lastName] = r.lastName;
  if (r.city) fields[FIELD.city] = r.city;
  if (r.state) fields[FIELD.state] = r.state;

  const location = [r.city, r.state].filter(Boolean).join(", ");
  if (location) fields[FIELD.location] = location;

  if (r.remotePreference) fields[FIELD.remotePreference] = r.remotePreference;
  if (r.expectedGraduation) fields[FIELD.expectedGraduation] = r.expectedGraduation;
  if (r.school) fields[FIELD.educationalInstitution] = r.school;
  if (r.linkedInUrl) fields[FIELD.linkedin] = r.linkedInUrl;
  if (r.internYear) fields[FIELD.internYear] = r.internYear;

  if (r.resumeUrl) fields[FIELD.resume] = [{ url: r.resumeUrl }];
  if (r.profileImageUrl) fields[FIELD.profileImage] = [{ url: r.profileImageUrl }];

  // Email/phone are stable field IDs on the read side; write via those ids
  // directly (falling back to the env NAME override only when configured).
  fields[EMAIL_FIELD ?? FIELD.email] = r.email;
  if (r.phone) fields[FIELD.phone] = r.phone;
  if (SOURCE_FIELD && r.school) fields[SOURCE_FIELD] = r.school;
  if (TECH_FIELD && r.technologies.length > 0) {
    fields[TECH_FIELD] = r.technologies;
  }

  return fields;
}

/**
 * Create the Local Talent record. Returns the new Airtable record id.
 * `typecast: true` lets single-select fields (school, remote preference)
 * accept values by label, creating the option if needed.
 */
export async function createLocalTalentRecord(
  r: NewStudentRecord
): Promise<string> {
  const fields = buildLocalTalentFields(r);

  const res = await fetch(`https://api.airtable.com/v0/${BASE}/${TABLE}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${TOKEN}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ fields, typecast: true }),
    cache: "no-store",
  });

  if (!res.ok) {
    throw new Error(`Airtable write ${res.status}: ${await res.text()}`);
  }
  const data = (await res.json()) as { id: string };
  return data.id;
}

/**
 * Update an existing Local Talent record from a fresh signup submission — the
 * dedupe path when a student already has a record (matched by email). Only
 * supplied fields are written; the caller passes `internYear` only when the
 * record doesn't already have one (never moving an existing candidate's cohort),
 * which still guarantees the record enters sync scope either way.
 */
export async function updateLocalTalentRecord(
  airtableId: string,
  r: NewStudentRecord
): Promise<void> {
  const fields = buildLocalTalentFields(r);
  if (Object.keys(fields).length === 0) return;

  const res = await fetch(
    `https://api.airtable.com/v0/${BASE}/${TABLE}/${airtableId}`,
    {
      method: "PATCH",
      headers: {
        Authorization: `Bearer ${TOKEN}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ fields, typecast: true }),
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Airtable write ${res.status}: ${await res.text()}`);
  }
}
