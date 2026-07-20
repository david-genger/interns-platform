/**
 * Phone normalization.
 *
 * Phones arrive in every format ("(512) 555-1234", "+1 512 555 1234",
 * "512.555.1234"), so we reduce them to a canonical digits-only key before
 * storing or comparing. A leading US country code (a 1 in front of an 11-digit
 * number) is dropped so "+1 512…" and "512…" collapse to the same key.
 *
 * Feeds the `interns.phone_normalized` column (written by the app and by every
 * sync). NOTE: automatic signup dedupe merges on EMAIL ONLY — a phone match is
 * never a merge key, because merging on phone would let a signup carrying
 * someone else's number overwrite that person's record from a public endpoint.
 * The normalized column exists for consistent storage and admin-side duplicate
 * checks.
 */
export function normalizePhone(raw: string | null | undefined): string {
  const digits = (raw ?? "").replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("1")) return digits.slice(1);
  return digits;
}
