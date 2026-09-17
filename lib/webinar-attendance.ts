/**
 * lib/webinar-attendance.ts — PURE matching for the class attendance import.
 *
 * After the class, the meeting platform gives a participants export: a name, an
 * email sometimes, and minutes in the room. The registration only ever asked
 * for a WhatsApp number, so matching is best-effort and, deliberately, in this
 * order of confidence:
 *
 *   1. PHONE   a 10-digit Indian mobile found anywhere in the row (she typed it
 *              into the join form, a registration field, or her display name).
 *              Exact, and the only one that cannot match the wrong woman.
 *   2. EMAIL   exact, lowercased. Only if the sheet holds an email for her.
 *   3. NAME    normalised (lowercase, letters and digits only) and only when it
 *              matches EXACTLY ONE registrant. Two "Priya"s match nobody: a
 *              wrong match would send Meta a false attendance and tell the
 *              coach to follow up the wrong person.
 *
 * Everything unmatched is reported, never guessed. The route does the sheet
 * writes and the CAPI sends.
 */

export const PITCH_MINUTES = 55;

export type AttendanceInput = {
  /** Display name from the export, may be empty. */
  name: string;
  email: string;
  /** Minutes in the room. Several rows for one person are added up. */
  minutes: number;
  /** Any other cells, searched for a phone number. */
  extra?: string[];
};

export type AttendanceRegistrant = {
  rowNumber: number;
  phone: string;
  email: string;
  name: string;
};

export type AttendanceMatch = {
  rowNumber: number;
  phone: string;
  minutes: number;
  stayedToPitch: boolean;
  by: "phone" | "email" | "name";
};

export type AttendanceResult = {
  matched: AttendanceMatch[];
  /** Rows from the export that matched nobody, or matched ambiguously. */
  unmatched: { name: string; email: string; minutes: number; reason: "no_match" | "ambiguous_name" }[];
  attended: number;
  stayedToPitch: number;
};

const digits = (s: string) => s.replace(/\D/g, "");
const norm = (s: string) => s.toLowerCase().replace(/[^a-z0-9]/g, "");
const tenDigit = (s: string) => {
  const d = digits(s);
  // From the END: "+91 98765 43210" must read as 9876543210, not 9198765432.
  for (let i = d.length - 10; i >= 0; i--) {
    const slice = d.slice(i, i + 10);
    if (/^[6-9]\d{9}$/.test(slice)) return slice;
  }
  return "";
};

/** The 10-digit mobile in any cell of the row, or "". */
export function phoneInRow(row: AttendanceInput): string {
  for (const field of [row.name, row.email, ...(row.extra ?? [])]) {
    const found = tenDigit(String(field ?? ""));
    if (found) return found;
  }
  return "";
}

export function matchAttendance(
  rows: AttendanceInput[],
  registrants: AttendanceRegistrant[],
  pitchMinutes = PITCH_MINUTES,
): AttendanceResult {
  const byPhone = new Map<string, AttendanceRegistrant>();
  const byEmail = new Map<string, AttendanceRegistrant>();
  const byName = new Map<string, AttendanceRegistrant[]>();
  for (const r of registrants) {
    const p = digits(r.phone).slice(-10);
    if (/^[6-9]\d{9}$/.test(p) && !byPhone.has(p)) byPhone.set(p, r);
    const e = r.email.trim().toLowerCase();
    if (e && !byEmail.has(e)) byEmail.set(e, r);
    const n = norm(r.name);
    if (n) byName.set(n, [...(byName.get(n) ?? []), r]);
  }

  // One person can appear several times in an export (she rejoined).
  const minutesFor = new Map<number, { minutes: number; by: AttendanceMatch["by"]; phone: string }>();
  const unmatched: AttendanceResult["unmatched"] = [];

  for (const row of rows) {
    const minutes = Number.isFinite(row.minutes) && row.minutes > 0 ? row.minutes : 0;
    let hit: AttendanceRegistrant | undefined;
    let by: AttendanceMatch["by"] = "phone";

    const p = phoneInRow(row);
    if (p) hit = byPhone.get(p);
    if (!hit) {
      const e = row.email.trim().toLowerCase();
      if (e && byEmail.has(e)) { hit = byEmail.get(e); by = "email"; }
    }
    if (!hit) {
      const n = norm(row.name);
      const candidates = n ? byName.get(n) ?? [] : [];
      if (candidates.length === 1) { hit = candidates[0]; by = "name"; }
      else if (candidates.length > 1) {
        unmatched.push({ name: row.name, email: row.email, minutes, reason: "ambiguous_name" });
        continue;
      }
    }
    if (!hit) {
      unmatched.push({ name: row.name, email: row.email, minutes, reason: "no_match" });
      continue;
    }

    const prev = minutesFor.get(hit.rowNumber);
    minutesFor.set(hit.rowNumber, {
      minutes: (prev?.minutes ?? 0) + minutes,
      // Keep the most confident match reason seen for her.
      by: prev && prev.by === "phone" ? "phone" : by,
      phone: digits(hit.phone).slice(-10),
    });
  }

  const matched: AttendanceMatch[] = [...minutesFor.entries()]
    .map(([rowNumber, v]) => ({
      rowNumber,
      phone: v.phone,
      minutes: v.minutes,
      stayedToPitch: v.minutes >= pitchMinutes,
      by: v.by,
    }))
    .sort((a, b) => a.rowNumber - b.rowNumber);

  return {
    matched,
    unmatched,
    attended: matched.length,
    stayedToPitch: matched.filter((m) => m.stayedToPitch).length,
  };
}

/** Minimal CSV reader for the platform export: quoted fields, commas, CRLF. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let quoted = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (quoted) {
      if (c === '"') {
        if (text[i + 1] === '"') { field += '"'; i++; }
        else quoted = false;
      } else field += c;
      continue;
    }
    if (c === '"') { quoted = true; continue; }
    if (c === ",") { row.push(field); field = ""; continue; }
    if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      row.push(field);
      field = "";
      if (row.some((f) => f.trim())) rows.push(row);
      row = [];
      continue;
    }
    field += c;
  }
  row.push(field);
  if (row.some((f) => f.trim())) rows.push(row);
  return rows;
}

/**
 * The export's own header row decides which column is which. Zoom writes "Name
 * (original name)", "User Email" and "Duration (minutes)"; Meet and others
 * differ, so each is matched by what the title contains.
 */
export function readAttendanceCsv(text: string): AttendanceInput[] {
  const rows = parseCsv(text);
  if (!rows.length) return [];
  const header = rows[0].map((h) => h.trim().toLowerCase());
  const find = (...needles: string[]) =>
    header.findIndex((h) => needles.some((n) => h.includes(n)));
  const nameCol = find("name", "participant");
  const emailCol = find("email");
  const minutesCol = find("duration", "minutes", "time in session");

  return rows.slice(1).map((r) => {
    const cell = (i: number) => String(r[i] ?? "").trim();
    return {
      name: nameCol >= 0 ? cell(nameCol) : "",
      email: emailCol >= 0 ? cell(emailCol) : "",
      minutes: minutesCol >= 0 ? Math.round(Number(digits(cell(minutesCol)) || 0)) : 0,
      extra: r.map((c) => String(c ?? "")),
    };
  });
}
