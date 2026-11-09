import test from "node:test";
import assert from "node:assert/strict";
import {
  notesTitle, notesTemplate, ensureNotesDoc, bridgeHint, BridgeError,
  BRIDGE_SECRET_ENV, type BridgeConfig,
} from "./drive.ts";

const base = { name: "Meera K.", phone: "9876543210", when: "2026-11-09T09:30:00Z" };
const cfg: BridgeConfig = { url: "https://script.example/exec", secret: "s3cret", folderId: "FOLDER" };

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

test("the template carries every section the summary is built from, in call order", () => {
  assert.deepEqual(
    notesTemplate(base).sections.map((s) => s.heading),
    ["Her words", "Symptoms", "Markers", "Blockers", "Already spent", "Objection", "Next step"],
  );
});

test("the markers section tells him not to type a value from memory", () => {
  // The one rule in this document that protects a real woman's report: a marker
  // that was never on her bloodwork must not appear in her summary.
  const markers = notesTemplate(base).sections.find((s) => s.heading === "Markers");
  assert.match(markers?.hint ?? "", /report actually shows/i);
});

test("her name is sent as text, never escaped as markup", () => {
  // DocumentApp sets text. An HTML-escaped name would show him "&lt;" literally.
  const t = notesTemplate({ ...base, name: "Meera <K>" });
  assert.equal(t.heading, "Meera <K>");
  assert.ok(!JSON.stringify(t).includes("&lt;"));
});

test("the preface carries the phone and the IST time of the booking", () => {
  const p = notesTemplate(base).preface;
  assert.ok(p.startsWith("9876543210 · "), p);
  assert.ok(p.endsWith(" IST"), p);
});

test("missing config fails before any request, naming what is missing", async () => {
  let called = false;
  const fake = (async () => { called = true; return new Response("{}"); }) as typeof fetch;
  await assert.rejects(
    ensureNotesDoc(base, { ...cfg, url: "", missing: ["DRIVE_BRIDGE_URL"] }, fake),
    (e: unknown) => e instanceof BridgeError && e.code === "not_configured" && e.detail === "DRIVE_BRIDGE_URL",
  );
  assert.equal(called, false);
});

test("it posts one ensureDoc request carrying the secret, folder, title and template", async () => {
  let sent: Record<string, unknown> = {};
  let url = "";
  const fake = (async (u: string, init: RequestInit) => {
    url = u;
    sent = JSON.parse(String(init.body));
    return new Response(JSON.stringify({ ok: true, id: "DOC1", url: "https://docs/DOC1", created: true }));
  }) as typeof fetch;
  const doc = await ensureNotesDoc(base, cfg, fake);
  assert.equal(url, cfg.url);
  assert.equal(sent.action, "ensureDoc");
  assert.equal(sent.secret, "s3cret");
  assert.equal(sent.folderId, "FOLDER");
  assert.equal(sent.title, notesTitle(base));
  assert.deepEqual(sent.sections, notesTemplate(base).sections);
  assert.deepEqual(doc, { id: "DOC1", url: "https://docs/DOC1", title: notesTitle(base), created: true });
});

test("a refusal from the script keeps its code, and the hint names the fix", async () => {
  const fake = (async () => new Response(JSON.stringify({ ok: false, error: "unauthorized" }))) as typeof fetch;
  await assert.rejects(ensureNotesDoc(base, cfg, fake), (e: unknown) => {
    assert.ok(e instanceof BridgeError);
    assert.equal(e.code, "unauthorized");
    assert.match(bridgeHint(e), new RegExp(BRIDGE_SECRET_ENV));
    return true;
  });
});

test("a web page instead of JSON is reported as a deployment problem", async () => {
  // What Google serves when the web app is not deployed for "Anyone".
  const fake = (async () => new Response("<!doctype html><title>Sign in</title>", { status: 200 })) as typeof fetch;
  await assert.rejects(ensureNotesDoc(base, cfg, fake), (e: unknown) => {
    assert.ok(e instanceof BridgeError);
    assert.equal(e.code, "not_json");
    assert.match(bridgeHint(e), /Who has access: Anyone/);
    return true;
  });
});

test("a hung script becomes a timeout, not an unhandled rejection", async () => {
  const fake = (async () => { throw new DOMException("timed out", "TimeoutError"); }) as typeof fetch;
  await assert.rejects(ensureNotesDoc(base, cfg, fake), (e: unknown) => e instanceof BridgeError && e.code === "timeout");
});
