"use server";

import { revalidatePath } from "next/cache";
import { createAdminClient } from "@/lib/supabase/admin";
import { getMyIntern } from "@/lib/interns";
import { updateInternFields } from "@/lib/airtable";
import { normalizeLiveUrl } from "@/lib/url";
import { normalizePhone } from "@/lib/phone";

export type ActionResult = { ok: boolean; error?: string; warning?: string };

const DASHBOARD = "/student";

function safeError(context: string, err: unknown): string {
  console.error(`[student:${context}]`, err);
  return "Something went wrong. Please try again.";
}

/**
 * Update the student's own editable profile fields. Writes Supabase (live to
 * companies at once) then mirrors to Airtable, the source of truth. An Airtable
 * write-back failure is non-fatal — returns a warning to reconcile on next sync.
 */
export async function updateProfile(formData: FormData): Promise<ActionResult> {
  const intern = await getMyIntern();
  if (!intern) return { ok: false, error: "Not authorized." };

  const firstName = str(formData.get("first_name"));
  const lastName = str(formData.get("last_name"));
  const phoneRaw = str(formData.get("phone"));
  const headline = str(formData.get("headline"));
  const city = str(formData.get("city"));
  const state = str(formData.get("state"));
  const remotePreference = str(formData.get("remote_preference"));
  const linkedInUrl = str(formData.get("linkedin_url"));
  const technologies = parseTech(formData.get("technologies"));

  if (!firstName) return { ok: false, error: "Enter your first name." };
  // Phone is optional — validated only when provided.
  const phoneDigits = normalizePhone(phoneRaw);
  if (phoneRaw && phoneDigits.length < 7) {
    return { ok: false, error: "Enter a valid phone number." };
  }
  if (linkedInUrl && !normalizeLiveUrl(linkedInUrl)) {
    return { ok: false, error: "Enter a valid https:// LinkedIn URL." };
  }

  // NOTE: school and expected graduation are deliberately NOT editable here —
  // they anchor the candidate to a cohort/partner and are managed upstream. We
  // ignore them even if a crafted post includes them (server-side enforcement).
  const name = [firstName, lastName].filter(Boolean).join(" ").trim() || null;
  const location = [city, state].filter(Boolean).join(", ") || null;

  const admin = createAdminClient();
  const { error } = await admin
    .from("interns")
    .update({
      name,
      first_name: firstName,
      last_name: lastName,
      phone: phoneRaw,
      phone_normalized: phoneDigits,
      headline,
      city,
      state,
      location,
      remote_preference: remotePreference,
      linkedin_url: linkedInUrl,
      technologies,
    })
    .eq("id", intern.id);
  if (error) return { ok: false, error: safeError("updateProfile", error) };

  let warning: string | undefined;
  try {
    await updateInternFields(intern.airtable_id, {
      name,
      firstName,
      lastName,
      phone: phoneRaw,
      headline,
      city,
      state,
      location,
      remotePreference,
      linkedInUrl,
      technologies,
    });
  } catch (e) {
    warning = "airtable-write-failed";
    console.error(`[student:updateProfile] Airtable write-back failed`, e);
  }

  revalidatePath(DASHBOARD);
  return { ok: true, warning };
}

/** Add a live project link to the student's own profile. */
export async function addProject(url: string): Promise<ActionResult> {
  const intern = await getMyIntern();
  if (!intern) return { ok: false, error: "Not authorized." };

  const normalized = normalizeLiveUrl(url);
  if (!normalized) {
    return { ok: false, error: "Enter a full https:// link to a live site." };
  }

  const admin = createAdminClient();
  // Append after the current last link.
  const { data: last } = await admin
    .from("intern_projects")
    .select("sort_order")
    .eq("intern_id", intern.id)
    .order("sort_order", { ascending: false })
    .limit(1)
    .maybeSingle();
  const sort_order = (last?.sort_order ?? -1) + 1;

  const { error } = await admin
    .from("intern_projects")
    .insert({ intern_id: intern.id, url: normalized, sort_order });
  if (error) return { ok: false, error: safeError("addProject", error) };

  revalidatePath(DASHBOARD);
  return { ok: true };
}

/** Update the URL/title of one of the student's own project links. */
export async function updateProject(
  id: string,
  url: string,
  title: string | null
): Promise<ActionResult> {
  const intern = await getMyIntern();
  if (!intern) return { ok: false, error: "Not authorized." };

  const normalized = normalizeLiveUrl(url);
  if (!normalized) {
    return { ok: false, error: "Enter a full https:// link to a live site." };
  }

  const admin = createAdminClient();
  // Scope the update to the caller's own rows — ownership check in the filter.
  const { data, error } = await admin
    .from("intern_projects")
    .update({ url: normalized, title: title?.trim() || null, updated_at: new Date().toISOString() })
    .eq("id", id)
    .eq("intern_id", intern.id)
    .select("id");
  if (error) return { ok: false, error: safeError("updateProject", error) };
  if (!data?.length) return { ok: false, error: "Link not found." };

  revalidatePath(DASHBOARD);
  return { ok: true };
}

/** Remove one of the student's own project links. */
export async function removeProject(id: string): Promise<ActionResult> {
  const intern = await getMyIntern();
  if (!intern) return { ok: false, error: "Not authorized." };

  const admin = createAdminClient();
  const { error } = await admin
    .from("intern_projects")
    .delete()
    .eq("id", id)
    .eq("intern_id", intern.id);
  if (error) return { ok: false, error: safeError("removeProject", error) };

  revalidatePath(DASHBOARD);
  return { ok: true };
}

function str(v: FormDataEntryValue | null): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  return t.length ? t : null;
}

function parseTech(v: FormDataEntryValue | null): string[] {
  if (typeof v !== "string") return [];
  return Array.from(
    new Set(
      v
        .split(",")
        .map((t) => t.trim())
        .filter(Boolean)
    )
  );
}
