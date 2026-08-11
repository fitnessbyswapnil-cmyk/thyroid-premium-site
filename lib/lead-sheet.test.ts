/**
 * Unit tests for the PURE sheet planner (planLeadWrite). No googleapis, no creds.
 * Run: `npm test`
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  planLeadWrite,
  colLetter,
  findLeadRowNumber,
  planPaymentColumns,
  RESERVED_INDEXES,
  type LeadFields,
} from "./lead-sheet.ts";

// A realistic live header: every canonical column present, R/S reserved for
// booking, a lifecycle "Welcomed" flag at the end.
const FULL_HEADER = [
  "Timestamp", // 0  (pin)
  "Lead ID", // 1
  "Name", // 2  (pin)
  "Phone", // 3
  "Email", // 4  (pin)
  "City", // 5
  "Age", // 6
  "Goal", // 7
  "Biggest Challenge", // 8
  "Diagnosis", // 9
  "On Medication", // 10
  "Struggle Duration", // 11
  "Profession", // 12
  "Tried Before", // 13
  "Amount Spent", // 14
  "Commitment (1-10)", // 15
  "Status", // 16 (pin)
  "Booking Status", // 17 RESERVED
  "Booking Date/Time", // 18 RESERVED
  "Timing", // 19
  "Investment Ability", // 20
  "Decision Maker", // 21
  "UTM Source", // 22
  "UTM Medium", // 23
  "UTM Campaign", // 24
  "UTM Content", // 25
  "UTM Term", // 26
  "FBclid", // 27
  "Visitor ID", // 28
  "Lead Score", // 29
  "Lead Tier", // 30
  "Welcomed", // 31 lifecycle flag
];

function sampleFields(email = "asha@example.com"): LeadFields {
  return {
    timestamp: "2026-06-20T10:00:00.000Z",
    leadId: "lead_123",
    name: "Asha",
    phone: "+919812345678",
    email,
    city: "Mumbai",
    age: "",
    goal: "Lose the stubborn weight",
    challenge: "The weight won't move, no matter what I do",
    diagnosis: "Yes — hypothyroidism",
    medication: "Yes — and still struggling",
    duration: "Over a year",
    profession: "Corporate / IT professional",
    tried: "Multiple diets / nutritionists, Gym / personal trainer",
    spent: "More than ₹50,000",
    commitment: "9",
    timing: "This week",
    investment: "I can invest ₹50,000",
    decisionMaker: "I decide for myself",
    utm_source: "facebook",
    utm_medium: "paid",
    utm_campaign: "thyroid_jun",
    utm_content: "creative_a",
    utm_term: "adset_1",
    fbclid: "fb.1.123.abc",
    visitor_id: "v_1",
    leadScore: "100",
    leadTier: "Best",
    status: "lead_captured",
  };
}

test("append: known header → values land on pinned/named columns, reserved untouched", () => {
  const plan = planLeadWrite({ header: FULL_HEADER, fields: sampleFields() });
  assert.equal(plan.action, "append");
  assert.deepEqual(plan.newHeaders, []);
  const row = plan.appendRow!;
  assert.equal(row[0], "2026-06-20T10:00:00.000Z"); // Timestamp pin
  assert.equal(row[2], "Asha"); // Name pin
  assert.equal(row[4], "asha@example.com"); // Email pin
  assert.equal(row[16], "lead_captured"); // Status pin
  assert.equal(row[29], "100"); // Lead Score by name
  assert.equal(row[30], "Best"); // Lead Tier by name
  assert.equal(row[19], "This week"); // Timing by name (after the reserved cols)
  // RESERVED booking columns must stay empty on a fresh lead.
  assert.equal(row[17], "");
  assert.equal(row[18], "");
  // Lifecycle flag column is not touched.
  assert.equal(row[31], "");
});

test("update: by email → only non-createOnly cells, never reserved/createOnly", () => {
  const plan = planLeadWrite({ header: FULL_HEADER, existingRowNumber: 7, fields: sampleFields() });
  assert.equal(plan.action, "update");
  assert.equal(plan.rowNumber, 7);
  const indexes = plan.updateCells!.map((c) => c.index);
  // createOnly (Timestamp 0, Email 4, Status 16) excluded.
  assert.ok(!indexes.includes(0));
  assert.ok(!indexes.includes(4));
  assert.ok(!indexes.includes(16));
  // reserved booking columns never written.
  assert.ok(!indexes.includes(17));
  assert.ok(!indexes.includes(18));
  // real fields are written.
  assert.ok(indexes.includes(2)); // Name
  const tier = plan.updateCells!.find((c) => c.index === 30);
  assert.deepEqual(tier, { index: 30, value: "Best" });
});

test("update: empty values do not blank existing cells", () => {
  const fields = sampleFields();
  fields.utm_content = ""; // missing on a re-submit
  const plan = planLeadWrite({ header: FULL_HEADER, existingRowNumber: 7, fields });
  const indexes = plan.updateCells!.map((c) => c.index);
  assert.ok(!indexes.includes(25)); // UTM Content (empty) skipped
});

test("append: missing Lead Score/Tier headers are appended AFTER the last column", () => {
  // Rename the score/tier headers so they're not found by name.
  const header = [...FULL_HEADER];
  header[29] = "Spare1";
  header[30] = "Spare2";
  const plan = planLeadWrite({ header, fields: sampleFields() });
  assert.equal(plan.action, "append");
  const titles = plan.newHeaders.map((h) => h.title);
  assert.ok(titles.includes("Lead Score"));
  assert.ok(titles.includes("Lead Tier"));
  // New columns land at the end (index >= original width 32), never on reserved.
  for (const h of plan.newHeaders) {
    assert.ok(h.index >= 32);
    assert.ok(h.index !== 17 && h.index !== 18);
  }
  const tierCol = plan.newHeaders.find((h) => h.title === "Lead Tier")!;
  assert.equal(plan.appendRow![tierCol.index], "Best");
});

test("a non-pinned field whose name matches a reserved column is appended, not written to R/S", () => {
  const header = [...FULL_HEADER];
  header[5] = "Town"; // move City's usual header away
  header[17] = "City"; // booby-trap: "City" sitting on reserved col R
  const plan = planLeadWrite({ header, fields: sampleFields() });
  // City must NOT be written to reserved index 17.
  assert.equal(plan.appendRow![17], "");
  assert.ok(plan.newHeaders.some((h) => h.title === "City"));
});

test("uninitialised header (<19 cols) throws rather than risk corruption", () => {
  assert.throws(() => planLeadWrite({ header: ["Timestamp", "Name", "Email"], fields: sampleFields() }), /header has only 3 columns/);
});

test("colLetter maps indexes to A1 letters", () => {
  assert.equal(colLetter(0), "A");
  assert.equal(colLetter(4), "E");
  assert.equal(colLetter(16), "Q");
  assert.equal(colLetter(17), "R");
  assert.equal(colLetter(26), "AA");
});

// ── Payment → lead row matching ───────────────────────────────────────────────
// A payment must UPDATE the lead's row. Appending produced two unlinked rows per
// paying customer and made "who actually paid" unanswerable.

const LEAD_IDS = ["Lead ID", "quiz_1_a", "quiz_2_b", "quiz_3_c"];
const PHONES = ["Phone", "9876543210.0", "9998887776", ""];
const EMAILS = ["Email", "meenal@example.com", "noreply@swapnilumbarkarfitness.in", "kavya@example.com"];

test("findLeadRowNumber matches on Lead ID first", () => {
  const row = findLeadRowNumber({
    leadIds: LEAD_IDS, phones: PHONES, emails: EMAILS,
    leadId: "quiz_2_b", phone: "9876543210", email: "meenal@example.com",
  });
  // Lead ID must win over the phone/email that point at a different row
  assert.equal(row, 3);
});

test("findLeadRowNumber falls back to phone, ignoring sheet float formatting", () => {
  const row = findLeadRowNumber({
    leadIds: LEAD_IDS, phones: PHONES, emails: EMAILS,
    leadId: "", phone: "+91 98765 43210",
  });
  assert.equal(row, 2, "9876543210.0 in the sheet must match +91 98765 43210");
});

test("findLeadRowNumber falls back to email last", () => {
  const row = findLeadRowNumber({
    leadIds: LEAD_IDS, phones: PHONES, emails: EMAILS,
    email: "kavya@example.com",
  });
  assert.equal(row, 4);
});

test("findLeadRowNumber never matches on the placeholder email", () => {
  const row = findLeadRowNumber({
    leadIds: LEAD_IDS, phones: PHONES, emails: EMAILS,
    email: "noreply@swapnilumbarkarfitness.in",
    placeholderEmail: "noreply@swapnilumbarkarfitness.in",
  });
  assert.equal(row, undefined, "the shared placeholder must not attach a payment to a random lead");
});

test("findLeadRowNumber returns undefined when nothing matches", () => {
  assert.equal(
    findLeadRowNumber({ leadIds: LEAD_IDS, phones: PHONES, emails: EMAILS, leadId: "nope", phone: "1112223334" }),
    undefined,
  );
});

test("findLeadRowNumber never matches the header row", () => {
  assert.equal(findLeadRowNumber({ leadIds: LEAD_IDS, phones: PHONES, emails: EMAILS, leadId: "Lead ID" }), undefined);
  assert.equal(findLeadRowNumber({ leadIds: LEAD_IDS, phones: PHONES, emails: EMAILS, email: "Email" }), undefined);
});

test("planPaymentColumns appends missing headers past the reserved booking columns", () => {
  const header = Array.from({ length: 19 }, (_, i) => `Col${i}`);
  const plan = planPaymentColumns(header, ["Paid", "Paid Amount"]);
  assert.equal(plan.indexes["Paid"], 19);
  assert.equal(plan.indexes["Paid Amount"], 20);
  assert.equal(plan.newHeaders.length, 2);
  for (const t of ["Paid", "Paid Amount"]) {
    assert.ok(!RESERVED_INDEXES.has(plan.indexes[t]), `${t} must never land on 17/18`);
  }
});

test("planPaymentColumns reuses an existing column instead of duplicating it", () => {
  const header = [...Array.from({ length: 19 }, (_, i) => `Col${i}`), "Paid"];
  const plan = planPaymentColumns(header, ["Paid"]);
  assert.equal(plan.indexes["Paid"], 19);
  assert.equal(plan.newHeaders.length, 0);
});

test("planPaymentColumns re-appends rather than writing a reserved column", () => {
  const header = Array.from({ length: 19 }, (_, i) => (i === 17 ? "Paid" : `Col${i}`));
  const plan = planPaymentColumns(header, ["Paid"]);
  assert.notEqual(plan.indexes["Paid"], 17);
  assert.ok(!RESERVED_INDEXES.has(plan.indexes["Paid"]));
});
