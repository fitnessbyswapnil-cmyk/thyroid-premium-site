import test from "node:test";
import assert from "node:assert/strict";
import { notesTitle, notesTemplateHtml } from "./drive.ts";

const base = { name: "Meera K.", phone: "9876543210", when: "2026-11-09T09:30:00Z" };

test("the title puts the date first and the phone last", () => {
  // Date first so the folder sorts chronologically; phone last because that is
  // the half a lookup can rely on. The name sits in the middle for him to read.
  assert.equal(notesTitle(base), "2026-11-09 · Meera K. · 9876543210");
});

test("the date is IST, not UTC", () => {
  // 20:00 UTC is 01:30 the NEXT day in Kolkata. A doc filed under the wrong day
  // is a doc he scrolls past while the call is starting.
  assert.equal(
    notesTitle({ ...base, when: "2026-11-09T20:00:00Z" }).slice(0, 10),
    "2026-11-10",
  );
});

test("any phone format reduces to the same ten digits", () => {
  for (const p of ["+91 98765 43210", "09876543210", "919876543210", "98765-43210"]) {
    assert.equal(notesTitle({ ...base, phone: p }), notesTitle(base), p);
  }
});

test("a missing name or phone still produces a usable, unique title", () => {
  assert.equal(notesTitle({ ...base, name: "" }), "2026-11-09 · Unnamed · 9876543210");
  assert.equal(notesTitle({ ...base, phone: "" }), "2026-11-09 · Meera K. · nophone");
});

test("slashes and newlines never reach a Drive file name", () => {
  const t = notesTitle({ ...base, name: "Meera\n/ K" });
  assert.ok(!t.includes("\n") && !t.includes("/"), t);
});

test("an unparseable booking time is marked, not silently dated today", () => {
  // Guessing a date would file it under a day the call did not happen on.
  assert.ok(notesTitle({ ...base, when: "not a date" }).startsWith("undated"));
});

test("the template carries every section the summary is built from", () => {
  const html = notesTemplateHtml(base);
  for (const h of ["Her words", "Symptoms", "Markers", "Blockers", "Already spent", "Objection", "Next step"]) {
    assert.ok(html.includes(`<h2>${h}</h2>`), `missing ${h}`);
  }
});

test("a name with angle brackets cannot inject markup into the doc", () => {
  const html = notesTemplateHtml({ ...base, name: "<script>x</script>" });
  assert.ok(!html.includes("<script>"), "raw tag reached the document");
  assert.ok(html.includes("&lt;script&gt;"));
});

test("the markers heading tells him not to type a value from memory", () => {
  // The one rule in this document that protects a real woman's report: a marker
  // that was never on her bloodwork must not appear in her summary.
  assert.match(notesTemplateHtml(base), /report actually shows/i);
});
