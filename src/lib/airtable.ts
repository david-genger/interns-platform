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

const BASE = process.env.AIRTABLE_BASE_ID!;
const TABLE = process.env.AIRTABLE_TABLE_ID!;
const TOKEN = process.env.AIRTABLE_TOKEN!;

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
  experienceLevel: "fldAz9MZ0OGAOujIp",
  internYear: "fldtU4VcPltGPMFDK",
  expectedGraduation: "fldFdJRHHzH9RLfOW",
  educationalInstitution: "fldxKfWt3zuCVFHa8",
  location: "fld7K3yWv3ORYr4by",
  city: "fldiYAbTUOlTZGVEX",
  state: "fldWhzrHOuNeWFLAM",
  country: "fldB7deycLNWbF9Ze",
  remotePreference: "fldErauQK53ZY0tvR",
  ratingTotal: "fldzfOOkTijrsws0e",
  ratingTechnical: "fldXG42f0gL7snRvj",
  ratingSoft: "fldwUvQY4yGl9YARu",
  ratingFrontend: "fld2OcDnkPJaxPA5i",
  ratingBackend: "fldLFl042DTsdFTy6",
  ratingDb: "fldl9B6GKTEIyUwqb",
  ratingCloud: "fldIQPd0WNGu2yy6p",
  profileImage: "fldSOm8fyGYbKzlcK",
  resume: "fld2fSGjnNefUqnqx", // full Resume attachment
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

/** Bootcamp signals used to derive institution_type from a school name. */
const BOOTCAMP_HINTS = [
  "bootcamp",
  "boot camp",
  "academy",
  "general assembly",
  "hack reactor",
  "flatiron",
  "app academy",
  "lambda",
  "springboard",
  "codesmith",
  "fullstack",
  "full stack",
  "nucamp",
  "tech elevator",
  "coding dojo",
  "le wagon",
  "ironhack",
  "galvanize",
  "thinkful",
  "bloomtech",
  "careerfoundry",
  "100devs",
];

export function deriveInstitutionType(
  institution: string | null
): "college" | "bootcamp" | null {
  if (!institution) return null;
  const v = institution.toLowerCase();
  if (BOOTCAMP_HINTS.some((h) => v.includes(h))) return "bootcamp";
  return "college";
}

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

function num(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}

function firstAttachment(v: unknown): AirtableAttachment | null {
  if (Array.isArray(v) && v.length > 0) return v[0] as AirtableAttachment;
  return null;
}

/** Map an Airtable record (fields keyed by field ID) to an interns-table row. */
export function mapRecord(rec: AirtableRecord) {
  const f = rec.fields;
  const institution = str(f[FIELD.educationalInstitution]);
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
      experience_level: str(f[FIELD.experienceLevel]),
      intern_year: str(f[FIELD.internYear]),
      expected_graduation: str(f[FIELD.expectedGraduation]),
      educational_institution: institution,
      institution_type: deriveInstitutionType(institution),
      location: str(f[FIELD.location]),
      city: str(f[FIELD.city]),
      state: str(f[FIELD.state]),
      country: str(f[FIELD.country]),
      remote_preference: str(f[FIELD.remotePreference]),
      rating_total: num(f[FIELD.ratingTotal]),
      rating_technical: num(f[FIELD.ratingTechnical]),
      rating_soft: num(f[FIELD.ratingSoft]),
      rating_frontend: num(f[FIELD.ratingFrontend]),
      rating_backend: num(f[FIELD.ratingBackend]),
      rating_db: num(f[FIELD.ratingDb]),
      rating_cloud: num(f[FIELD.ratingCloud]),
      airtable_modified_at: str(f[FIELD.lastModified]),
    },
    // Attachments handled separately (re-hosted to Storage).
    profileImage: firstAttachment(f[FIELD.profileImage]),
    resume: firstAttachment(f[FIELD.resume]),
  };
}

/**
 * Fetch intern records modified within the last `hours`, paginating until done.
 * Only requests the mapped fields. Used by both sync tiers (different windows).
 */
export async function fetchInterns(hours: number): Promise<AirtableRecord[]> {
  const filterByFormula = `AND({Intern Year}, IS_AFTER({Last Modified}, DATEADD(NOW(), -${hours}, 'hours')))`;

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
