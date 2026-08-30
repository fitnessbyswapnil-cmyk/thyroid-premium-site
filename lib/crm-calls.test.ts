import { test } from "node:test";
import assert from "node:assert/strict";
import { planCallWrite, parseCallRows, colA1, CALL_HEADER } from "./crm-calls.ts";

test("colA1 handles the wrap past Z", () => {
  assert.equal(colA1(0), "A");
  assert.equal(colA1(25), "Z");
  assert.equal(colA1(26), "AA");
  assert.equal(colA1(27), "AB");
  assert.equal(colA1(51), "AZ");
  assert.equal(colA1(52), "BA");
});

test("an empty sheet gets the full header and an append", () => {
  const plan = planCallWrite({ header: [], fields: { bookingUid: "abc123", pricePitched: "30000" } });
  assert.equal(plan.action, "append");
  assert.deepEqual(plan.header, CALL_HEADER);
  assert.equal(plan.appendRow?.[0], "abc123");
  assert.equal(plan.appendRow?.length, CALL_HEADER.length);
});

test("a reordered existing header is respected, never rewritten", () => {
  // Someone dragged Email to the front. Mapping is by name, so this must work.
  const header = ["Email", "Booking UID", "Price Pitched"];
  const plan = planCallWrite({
    header,
    fields: { bookingUid: "u1", email: "a@b.com", pricePitched: "20000" },
  });
  assert.equal(plan.action, "append");
  assert.equal(plan.header[0], "Email");
  assert.equal(plan.header[1], "Booking UID");
  assert.equal(plan.appendRow?.[0], "a@b.com");
  assert.equal(plan.appendRow?.[1], "u1");
  assert.equal(plan.appendRow?.[2], "20000");
  // Missing columns are appended after the existing ones, never inserted.
  assert.ok(plan.newHeaders.every((h) => h.index >= 3));
});

test("an existing uid updates that row instead of appending a duplicate", () => {
  const plan = planCallWrite({
    header: CALL_HEADER,
    existingRowNumber: 7,
    fields: { bookingUid: "u1", objection: "spouse" },
  });
  assert.equal(plan.action, "update");
  assert.equal(plan.rowNumber, 7);
  const objIdx = CALL_HEADER.indexOf("Objection (real)");
  assert.ok(plan.updateCells?.some((c) => c.index === objIdx && c.value === "spouse"));
});

test("only supplied fields are written — undefined never blanks a cell", () => {
  const plan = planCallWrite({
    header: CALL_HEADER,
    existingRowNumber: 3,
    fields: { objection: "proof" },
  });
  // One field in, one cell out. A re-extract that finds no price must not wipe
  // a price the coach already corrected.
  assert.equal(plan.updateCells?.length, 1);
  assert.equal(plan.updateCells?.[0].value, "proof");
});

test("a hand-reviewed row is never overwritten unless forced", () => {
  const guarded = planCallWrite({
    header: CALL_HEADER,
    existingRowNumber: 4,
    existingReviewed: true,
    fields: { objection: "model guess" },
  });
  assert.equal(guarded.action, "skip");
  assert.match(guarded.skipReason ?? "", /reviewed/i);

  const forced = planCallWrite({
    header: CALL_HEADER,
    existingRowNumber: 4,
    existingReviewed: true,
    force: true,
    fields: { objection: "model guess" },
  });
  assert.equal(forced.action, "update");
});

test("parseCallRows skips blank rows and keeps the 1-based row number", () => {
  const values = [
    CALL_HEADER,
    ["u1", "", "", "Heena", "h@x.com"],
    [], // blank row in the middle of the sheet
    ["u2", "", "", "Sunita", "s@x.com"],
  ];
  const rows = parseCallRows(values);
  assert.equal(rows.length, 2);
  assert.equal(rows[0].bookingUid, "u1");
  assert.equal(rows[0].row, 2);
  assert.equal(rows[1].bookingUid, "u2");
  assert.equal(rows[1].row, 4); // row 3 was blank — numbering must not shift
});

test("parseCallRows tolerates a header missing newer columns", () => {
  const rows = parseCallRows([["Booking UID", "Name"], ["u9", "Sangita"]]);
  assert.equal(rows.length, 1);
  assert.equal(rows[0].name, "Sangita");
  assert.equal(rows[0].objection, ""); // absent column reads empty, never undefined
});
