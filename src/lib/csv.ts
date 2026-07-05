/**
 * Roster CSV parsing + validation for the partners portal.
 *
 * Staff paste or upload a roster of students (first name, last name, email).
 * We parse it, normalise emails, and flag anything that can't be invited so
 * the preview screen can show it before anyone hits "Send invites".
 *
 * Accepts either a real CSV (with a header row we try to detect) or a plain
 * pasted list of emails, one per line.
 */

export type RosterRow = {
  first_name: string | null;
  last_name: string | null;
  email: string;
};

export type ParsedRoster = {
  valid: RosterRow[];
  /** Rows dropped before dedupe, with a human reason (bad/blank email). */
  invalid: { line: string; reason: string }[];
  /** Emails that appeared more than once in the upload (kept once in `valid`). */
  duplicatesInFile: string[];
};

// Pragmatic email check — good enough to catch typos, not RFC-perfect.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split a single CSV line, honouring double-quoted fields with commas. */
function splitCsvLine(line: string): string[] {
  const out: string[] = [];
  let cur = "";
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (line[i + 1] === '"') {
          cur += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        cur += ch;
      }
    } else if (ch === '"') {
      inQuotes = true;
    } else if (ch === ",") {
      out.push(cur);
      cur = "";
    } else {
      cur += ch;
    }
  }
  out.push(cur);
  return out.map((c) => c.trim());
}

function looksLikeHeader(cells: string[]): boolean {
  const joined = cells.join(" ").toLowerCase();
  return (
    joined.includes("email") ||
    joined.includes("first") ||
    joined.includes("last") ||
    joined.includes("name")
  );
}

/**
 * Map header cells -> column indexes. Falls back to positional
 * (first, last, email) when there's no recognisable header.
 */
function columnMap(header: string[] | null): {
  first: number;
  last: number;
  email: number;
} {
  if (!header) return { first: 0, last: 1, email: 2 };
  const find = (...names: string[]) =>
    header.findIndex((h) => names.some((n) => h.toLowerCase().includes(n)));
  const email = find("email", "e-mail");
  const first = find("first");
  const last = find("last");
  const fullName = find("name");
  return {
    first: first !== -1 ? first : fullName !== -1 ? fullName : 0,
    last,
    email: email !== -1 ? email : header.length - 1,
  };
}

export function parseRoster(input: string): ParsedRoster {
  const lines = input
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const valid: RosterRow[] = [];
  const invalid: { line: string; reason: string }[] = [];
  const seen = new Set<string>();
  const duplicatesInFile = new Set<string>();

  if (lines.length === 0) {
    return { valid, invalid, duplicatesInFile: [] };
  }

  // Detect + consume a header row.
  const firstCells = splitCsvLine(lines[0]);
  const hasHeader = looksLikeHeader(firstCells) && firstCells.length > 1;
  const cols = columnMap(hasHeader ? firstCells : null);
  const dataLines = hasHeader ? lines.slice(1) : lines;

  for (const line of dataLines) {
    const cells = splitCsvLine(line);
    // Plain email list: a single cell that is itself an email.
    const rawEmail =
      cells.length === 1 ? cells[0] : (cells[cols.email] ?? "").trim();
    const email = rawEmail.toLowerCase();

    if (!email) {
      invalid.push({ line, reason: "no email" });
      continue;
    }
    if (!EMAIL_RE.test(email)) {
      invalid.push({ line, reason: "invalid email" });
      continue;
    }
    if (seen.has(email)) {
      duplicatesInFile.add(email);
      continue;
    }
    seen.add(email);

    const first =
      cells.length === 1 ? null : nullify(cells[cols.first]);
    const last =
      cells.length === 1 || cols.last === -1 ? null : nullify(cells[cols.last]);

    valid.push({ first_name: first, last_name: last, email });
  }

  return {
    valid,
    invalid,
    duplicatesInFile: [...duplicatesInFile],
  };
}

function nullify(v: string | undefined): string | null {
  const t = (v ?? "").trim();
  return t.length ? t : null;
}
