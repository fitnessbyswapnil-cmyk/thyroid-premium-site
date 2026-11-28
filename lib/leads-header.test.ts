/**
 * Row 1 of the Leads tab: read whole, grown one cell at a time, never rewritten.
 *
 * /api/quiz-lead read the header as A1:BC1 (55 columns) on a sheet that runs
 * to CS (97). "Budget" is in BD, so on every quiz carrying a budget it decided
 * the column was missing and wrote the WHOLE of row 1 back with what it had
 * read, re-stamping a stray "Q85" in A1 and "count=2 total=167" in Z1.
 *
 * These tests run the real helpers against an in-memory sheet that behaves
 * like Google's (row 1 comes back trimmed of trailing blanks, a write past the
 * grid fails). No network, no credentials, nothing touches the live sheet.
 * Run: `npm test`
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import {
  colLetter,
  headerCellRange,
  headerCellWrites,
  headerRowRange,
  planLeadWrite,
  type SheetsClient,
} from "./lead-sheet.ts";
import { BLOCKERS_HEADER, THYROID_SCORE_HEADER, columnPlacer, readHeaderRow } from "./leads-header.ts";
import { BOT_CHECK_HEADER } from "./turnstile.ts";
import { PARTNER_ON_CALL_HEADER } from "./decode-commitment.ts";
import { GATE_OUTCOME_HEADER } from "./decode-gate.ts";
import { QUIZ_TIER_HEADER } from "./lead-scoring.ts";

// The live Leads header as read on 28-Nov-2026 (audit/sheets.md), A..CS.
// The two stray values are kept on purpose: this code must leave them alone.
const LIVE: [string, string][] = [
  ["A", "Q85"], ["B", "Lead ID"], ["C", "Name"], ["D", "Phone"], ["E", "Email"], ["F", "Age"],
  ["G", "Thyroid Condition"], ["H", "Weight Struggles"], ["I", "Energy Level"], ["J", "Biggest Frustration"],
  ["K", "Main Goal"], ["L", "UTM Source"], ["M", "UTM Medium"], ["N", "UTM Campaign"], ["O", "FBclid"],
  ["P", "Visitor ID"], ["Q", "Status"], ["R", "Payment Date"], ["S", "Booking Status"], ["T", "Session Date"],
  ["U", ""], ["V", ""], ["W", ""], ["X", ""], ["Y", ""], ["Z", "count=2 total=167"],
  ["AA", ""], ["AB", ""], ["AC", ""], ["AD", ""], ["AE", ""], ["AF", ""], ["AG", ""], ["AH", ""], ["AI", ""],
  ["AJ", "Lead Score (/100)"], ["AK", "Lead Tier"], ["AL", "City"], ["AM", "Goal"], ["AN", "Biggest Challenge"],
  ["AO", "Diagnosis"], ["AP", "On Medication"], ["AQ", "Struggle Duration"], ["AR", "Profession"],
  ["AS", "Tried Before"], ["AT", "Amount Spent"], ["AU", "Commitment (1-10)"], ["AV", "Timing"],
  ["AW", "Investment Ability"], ["AX", "Decision Maker"], ["AY", "UTM Content"], ["AZ", "UTM Term"],
  ["BA", "Lead Score"], ["BB", "Paid"], ["BC", "Paid Amount"], ["BD", "Budget"], ["BE", "Msg1 Sent"],
  ["BF", "Reminder Sent"], ["BG", "Reminder At"], ["BH", "Paid At"], ["BI", "Payment Ref"],
  ["BJ", "Booking Nudge Sent"], ["BK", "Booking Nudge At"], ["BL", "Tpl blocker_video"],
  ["BM", "Tpl payment_reminder"], ["BN", "Showed"], ["BO", "Reminder 2 Sent"], ["BP", "Reminder 2 At"],
  ["BQ", "Booking Nudge 2 Sent"], ["BR", "Booking Nudge 2 At"], ["BS", "Call Reminder 24h Sent"],
  ["BT", "Call Reminder 24h At"], ["BU", "Call Reminder 1h Sent"], ["BV", "Call Reminder 1h At"],
  ["BW", "Msg2 Sent"], ["BX", "Msg3 Sent"], ["BY", "Partner On Call"], ["BZ", "Gate Outcome"],
  ["CA", "Quiz Tier"], ["CB", "Source Path"], ["CC", "Webinar Date"], ["CD", "Amount Agreed"], ["CE", "Rail"],
  ["CF", "Programme Value"], ["CG", "Programme Collected"], ["CH", "DM Present"], ["CI", "Payment Plan"],
  ["CJ", "Meta Sent"], ["CK", "Tpl webinar_reminder_day"], ["CL", "Free Booking Nudge Sent"],
  ["CM", "Free Booking Nudge At"], ["CN", "Free Booking Nudge 2 Sent"], ["CO", "Free Booking Nudge 2 At"],
  ["CP", "Tpl webinar_reminder_1h"], ["CQ", "Tpl webinar_live_now"], ["CR", "Tpl webinar_replay"],
  ["CS", "Bot Check"],
];
const LIVE_HEADER = LIVE.map(([, h]) => h);

/** Column letters back to a 0-based index (the inverse of colLetter). */
function colIndex(letters: string): number {
  return [...letters].reduce((n, ch) => n * 26 + (ch.charCodeAt(0) - 64), 0) - 1;
}

type Op = { kind: "get" | "update" | "meta" | "widen"; range?: string; values?: unknown[][]; by?: number };

/** An in-memory Leads tab that answers the four calls the header code makes. */
function fakeSheet(header: string[], gridColumns = header.length) {
  const row1 = [...header];
  let width = gridColumns;
  const ops: Op[] = [];
  const client = {
    spreadsheets: {
      get: async () => {
        ops.push({ kind: "meta" });
        return { data: { sheets: [{ properties: { title: "Leads", sheetId: 7, gridProperties: { columnCount: width } } }] } };
      },
      batchUpdate: async ({ requestBody }: { requestBody: { requests: { appendDimension: { length: number } }[] } }) => {
        const by = requestBody.requests[0].appendDimension.length;
        width += by;
        ops.push({ kind: "widen", by });
        return { data: {} };
      },
      values: {
        get: async ({ range }: { range: string }) => {
          ops.push({ kind: "get", range });
          if (range !== "Leads!1:1") {
            // A bounded read, e.g. the old Leads!A1:BC1.
            const m = /^Leads!A1:([A-Z]+)1$/.exec(range);
            if (!m) throw new Error(`fake sheet: unexpected read ${range}`);
            return { data: { values: [row1.slice(0, colIndex(m[1]) + 1)] } };
          }
          // Google drops trailing blank cells from a row read.
          let end = row1.length;
          while (end > 0 && !row1[end - 1]) end--;
          return { data: { values: [row1.slice(0, end)] } };
        },
        update: async ({ range, requestBody }: { range: string; requestBody: { values: unknown[][] } }) => {
          ops.push({ kind: "update", range, values: requestBody.values });
          const m = /^Leads!([A-Z]+)1$/.exec(range);
          if (!m || requestBody.values.length !== 1 || requestBody.values[0].length !== 1) {
            throw new Error(`fake sheet: header write is not a single cell: ${range}`);
          }
          const at = colIndex(m[1]);
          if (at >= width) throw new Error(`Range (${range}) exceeds grid limits`);
          while (row1.length < at) row1.push("");
          row1[at] = String(requestBody.values[0][0]);
          return { data: {} };
        },
      },
    },
  };
  return { sheets: client as unknown as SheetsClient, row1, ops, width: () => width };
}

const writes = (ops: Op[]) => ops.filter((o) => o.kind === "update");

test("the live header fixture is the real A..CS layout, 97 columns", () => {
  assert.equal(LIVE.length, 97);
  LIVE.forEach(([letter], i) => assert.equal(colLetter(i), letter, `fixture row ${i}`));
  assert.equal(colIndex("BD"), 55);
  assert.equal(colIndex("CS"), 96);
});

test("the header is read as all of row 1, so a 97-column sheet comes back 97 wide", async () => {
  const s = fakeSheet(LIVE_HEADER);
  const hdr = await readHeaderRow(s.sheets, "sheet-id", "Leads");
  assert.equal(headerRowRange("Leads"), "Leads!1:1");
  assert.deepEqual(s.ops, [{ kind: "get", range: "Leads!1:1" }]);
  assert.ok(hdr.length >= 97, `read ${hdr.length} columns`);
  assert.equal(hdr.length, 97);
  assert.equal(hdr.lastIndexOf("Budget"), 55, "Budget is BD");
  assert.equal(hdr.lastIndexOf("Bot Check"), 96, "Bot Check is CS");
});

test("the old A1:BC1 read could not see Budget, which is why row 1 kept being rewritten", async () => {
  const s = fakeSheet(LIVE_HEADER);
  const r = await s.sheets.spreadsheets.values.get({ spreadsheetId: "sheet-id", range: "Leads!A1:BC1" });
  const old = (r.data.values?.[0] ?? []) as string[];
  assert.equal(old.length, 55);
  assert.equal(old.lastIndexOf("Budget"), -1);
});

test("reading past BC moves no column the quiz resolves by name", () => {
  // Every name /api/quiz-lead looks up with lastIndexOf. A duplicate past BC
  // would silently move one of them once the whole row is read.
  const names = [
    "Name", "Phone", "Email", "Age", "Thyroid Condition", "Weight Struggles", "Main Goal",
    "UTM Source", "UTM Medium", "UTM Campaign", "FBclid", "Visitor ID", "Status", "Lead Tier",
    "City", "Goal", "Biggest Challenge", "Diagnosis", "On Medication", "Struggle Duration",
    "Tried Before", "Amount Spent", "Commitment (1-10)", "Timing", "UTM Content", "UTM Term",
    "Lead Score", "Decision Maker",
  ];
  const first55 = LIVE_HEADER.slice(0, 55);
  for (const n of names) {
    assert.ok(first55.includes(n), `${n} is in A..BC`);
    assert.equal(LIVE_HEADER.lastIndexOf(n), first55.lastIndexOf(n), `${n} resolves to the same column`);
  }
  // And no filled header in A..BC appears again in BD..CS.
  const tail = new Set(LIVE_HEADER.slice(55));
  for (const h of first55) if (h) assert.ok(!tail.has(h), `${h} is duplicated past BC`);
});

test("every column the quiz already has is found where it is, with no header write at all", async () => {
  const s = fakeSheet(LIVE_HEADER);
  const hdr = await readHeaderRow(s.sheets, "sheet-id", "Leads");
  const place = columnPlacer({ sheets: s.sheets, spreadsheetId: "sheet-id", sheetName: "Leads", header: hdr });
  const expected: [string, string][] = [
    ["Budget", "BD"],
    ["Decision Maker", "AX"],
    [BOT_CHECK_HEADER, "CS"],
    [PARTNER_ON_CALL_HEADER, "BY"],
    [QUIZ_TIER_HEADER, "CA"],
    [GATE_OUTCOME_HEADER, "BZ"],
  ];
  for (const [title, letter] of expected) {
    assert.equal(colLetter(await place(title)), letter, title);
  }
  assert.deepEqual(writes(s.ops), [], "nothing is written to row 1");
  assert.equal(s.ops.filter((o) => o.kind === "get").length, 1, "found in the row already read, no second read");
  assert.deepEqual(s.row1, LIVE_HEADER);
});

test("a missing header is added as exactly ONE cell, in the first column after the last one in use", async () => {
  const s = fakeSheet(LIVE_HEADER, 120);
  const hdr = await readHeaderRow(s.sheets, "sheet-id", "Leads");
  const place = columnPlacer({ sheets: s.sheets, spreadsheetId: "sheet-id", sheetName: "Leads", header: hdr });

  const score = await place(THYROID_SCORE_HEADER);
  assert.equal(colLetter(score), "CT");
  assert.deepEqual(writes(s.ops), [{ kind: "update", range: "Leads!CT1", values: [["Thyroid Score"]] }]);

  const blockers = await place(BLOCKERS_HEADER);
  assert.equal(colLetter(blockers), "CU", "the second new column goes after the first, not on top of it");
  assert.deepEqual(
    writes(s.ops).map((o) => o.range),
    ["Leads!CT1", "Leads!CU1"],
  );

  // Placing them again finds them; nothing more is written.
  assert.equal(await place(THYROID_SCORE_HEADER), score);
  assert.equal(await place(BLOCKERS_HEADER), blockers);
  assert.equal(writes(s.ops).length, 2);

  // Existing columns are untouched and unshifted, stray values included.
  assert.deepEqual(s.row1.slice(0, 97), LIVE_HEADER);
  assert.equal(s.row1[0], "Q85", "A1 is left as found: repairing it is the owner's call");
  assert.equal(s.row1[25], "count=2 total=167", "Z1 is left as found");
  assert.deepEqual(s.row1.slice(97), ["Thyroid Score", "Blockers"]);
  // And the caller's own copy now resolves both by name.
  assert.equal(hdr.lastIndexOf("Thyroid Score"), 97);
  assert.equal(hdr.lastIndexOf("Blockers"), 98);
});

test("row 1 is never written wholesale: every header write is one cell in row 1", async () => {
  const s = fakeSheet(LIVE_HEADER, 120);
  const hdr = await readHeaderRow(s.sheets, "sheet-id", "Leads");
  const place = columnPlacer({ sheets: s.sheets, spreadsheetId: "sheet-id", sheetName: "Leads", header: hdr });
  for (const t of ["Budget", "Decision Maker", THYROID_SCORE_HEADER, BLOCKERS_HEADER, BOT_CHECK_HEADER, "Closed ₹"]) {
    await place(t);
  }
  const w = writes(s.ops);
  assert.equal(w.length, 3, "only the three missing titles were written");
  for (const o of w) {
    assert.match(o.range ?? "", /^Leads![A-Z]+1$/, `${o.range} is a single cell`);
    assert.notEqual(o.range, "Leads!1:1");
    assert.equal(o.values?.length, 1);
    assert.equal(o.values?.[0].length, 1);
    assert.ok(colIndex((o.range ?? "").slice(6, -1)) >= 97, `${o.range} is past CS`);
  }
});

test("the grid is widened before a header is written past its last column", async () => {
  const s = fakeSheet(LIVE_HEADER, 97); // grid ends exactly at CS
  const hdr = await readHeaderRow(s.sheets, "sheet-id", "Leads");
  const place = columnPlacer({ sheets: s.sheets, spreadsheetId: "sheet-id", sheetName: "Leads", header: hdr });
  assert.equal(await place(THYROID_SCORE_HEADER), 97);
  const kinds = s.ops.map((o) => o.kind);
  assert.ok(kinds.indexOf("widen") >= 0 && kinds.indexOf("widen") < kinds.indexOf("update"), kinds.join(","));
  assert.ok(s.width() > 97);
});

test("a header another request added a moment ago is reused, never added twice", async () => {
  const s = fakeSheet([...LIVE_HEADER, "Thyroid Score"], 120);
  // This request read the header just before the other one wrote CT1.
  const stale = [...LIVE_HEADER];
  const place = columnPlacer({ sheets: s.sheets, spreadsheetId: "sheet-id", sheetName: "Leads", header: stale });
  assert.equal(await place(THYROID_SCORE_HEADER), 97);
  assert.deepEqual(writes(s.ops), []);
});

test("a header that cannot be written loses that one value, never the lead", async () => {
  const s = fakeSheet(LIVE_HEADER, 120);
  s.sheets.spreadsheets.values.update = (async () => {
    throw new Error("quota");
  }) as unknown as SheetsClient["spreadsheets"]["values"]["update"];
  const hdr = await readHeaderRow(s.sheets, "sheet-id", "Leads");
  const place = columnPlacer({ sheets: s.sheets, spreadsheetId: "sheet-id", sheetName: "Leads", header: hdr });
  assert.equal(await place(BLOCKERS_HEADER), -1);
  assert.equal(hdr.length, 97, "the caller's header is not grown on failure");
});

// ── lib/lead-sheet.ts writeLeadRow (dormant: /api/lead) ─────────────────────

test("the lead-sheet planner adds nothing on the live sheet, so it writes no header", () => {
  const plan = planLeadWrite({ header: LIVE_HEADER, fields: { name: "Test Priya", phone: "9999900001" } });
  assert.deepEqual(plan.newHeaders, []);
  assert.deepEqual(headerCellWrites("Leads", plan.newHeaders), []);
});

test("a header the planner must add becomes one single-cell write past CS, and nothing else in row 1", () => {
  const header = LIVE_HEADER.map((h) => (h === "Profession" ? "" : h));
  const plan = planLeadWrite({ header, fields: { name: "Test Priya", profession: "Teacher" } });
  assert.deepEqual(plan.newHeaders, [{ index: 97, title: "Profession" }]);
  assert.deepEqual(headerCellWrites("Leads", plan.newHeaders), [{ range: "Leads!CT1", values: [["Profession"]] }]);
  assert.equal(headerCellRange("Leads", 55), "Leads!BD1");
  // The plan's picture of row 1 keeps every existing column where it was.
  assert.deepEqual(plan.header.slice(0, 97), header);
});

// ── Source guards ───────────────────────────────────────────────────────────

const root = join(import.meta.dirname, "..");

function sources(dir: string): string[] {
  const out: string[] = [];
  for (const e of readdirSync(dir, { withFileTypes: true })) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      if (e.name === "node_modules" || e.name.startsWith(".")) continue;
      out.push(...sources(p));
    } else if (/\.(ts|tsx)$/.test(e.name) && !/\.test\.ts$/.test(e.name)) {
      out.push(p);
    }
  }
  return out;
}

/** Every `range:` that names the whole of row 1 inside a write call. */
function wholeRowOneWrites(src: string): string[] {
  const found: string[] = [];
  const rangeRe = /\brange:\s*(`[^`]*!1:1`|"[^"]*!1:1"|'[^']*!1:1'|headerRowRange\([^)]*\))/g;
  const calls = ["values.get(", "values.batchGet(", "values.update(", "values.batchUpdate(", "values.append(", "values.clear("];
  for (const m of src.matchAll(rangeRe)) {
    const before = src.slice(0, m.index);
    let call = "";
    let at = -1;
    for (const c of calls) {
      const i = before.lastIndexOf(c);
      if (i > at) { at = i; call = c; }
    }
    if (call !== "values.get(" && call !== "values.batchGet(") found.push(`${call} ${m[1]}`);
  }
  return found;
}

test("the guard itself catches the write that corrupted row 1", () => {
  const old = 'await sheets.spreadsheets.values.update({\n  spreadsheetId: sheetId,\n  range: `${SHEET_NAME}!1:1`,\n  valueInputOption: "RAW",\n  requestBody: { values: [hdr] },\n});';
  assert.equal(wholeRowOneWrites(old).length, 1);
  const read = "await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!1:1` });";
  assert.deepEqual(wholeRowOneWrites(read), []);
});

test("/api/quiz-lead reads the whole header row and never writes row 1 wholesale", () => {
  const src = readFileSync(join(root, "app/api/quiz-lead/route.ts"), "utf8");
  const bounded = src.match(/range:\s*`[^`]*!A1:[A-Z]+1`/);
  assert.equal(bounded, null, `a bounded header read is back: ${bounded?.[0]}`);
  assert.ok(/readHeaderRow\(sheets, sheetId, SHEET_NAME\)/.test(src), "the header comes from readHeaderRow");
  assert.deepEqual(wholeRowOneWrites(src), []);
});

test("no Leads writer in app/ or lib/ rewrites row 1 wholesale", () => {
  // Owned by another open PR, which is rewriting that webhook. Its header
  // write (planPaymentColumns → Leads!1:1) has the same hazard and should
  // move to headerCellWrites there.
  const elsewhere = new Set(["app/api/cashfree-webhook/route.ts"]);
  const offenders: string[] = [];
  for (const file of [...sources(join(root, "app")), ...sources(join(root, "lib"))]) {
    const rel = relative(root, file);
    if (elsewhere.has(rel)) continue;
    for (const hit of wholeRowOneWrites(readFileSync(file, "utf8"))) offenders.push(`${rel}: ${hit}`);
  }
  assert.deepEqual(offenders, []);
});
