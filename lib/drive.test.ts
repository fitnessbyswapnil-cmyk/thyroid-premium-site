import test from "node:test";
import assert from "node:assert/strict";
import {
  notesTitle, notesTemplate, clientName, clientFolderName, ensureNotesDoc, readNotesDoc, saveClientFile, pairBridge, callBridge,
  parseNotes, resolveBridgeConfig, bridgeHint, BridgeError, MAX_FILE_BYTES, SYMPTOM_COLUMNS, SPENT_COLUMNS,
  BRIDGE_SECRET_ENV, BRIDGE_URL_ENV, NOTES_FOLDER_ENV, type BridgeConfig, type RawNotesSection,
} from "./drive.ts";

const base = { name: "Meera K.", phone: "9876543210", when: "2026-11-09T09:30:00Z" };
const cfg: BridgeConfig = { url: "https://script.example/exec", secret: "s3cret", folderId: "FOLDER" };

/** A fetch that records what it was sent and answers with `reply`. */
function recorder(reply: unknown = { ok: true, id: "ID1" }) {
  const sent: { url: string; body: Record<string, unknown> }[] = [];
  const fetchImpl = (async (u: string, init: RequestInit) => {
    sent.push({ url: u, body: JSON.parse(String(init.body)) });
    return new Response(JSON.stringify(reply));
  }) as typeof fetch;
  return { sent, fetchImpl };
}

/** Run with these env vars set (or unset, for undefined), then put them back. */
async function withEnv<T>(vars: Record<string, string | undefined>, fn: () => Promise<T>): Promise<T> {
  const before = Object.fromEntries(Object.keys(vars).map((k) => [k, process.env[k]]));
  const put = (v: Record<string, string | undefined>) => {
    for (const [k, x] of Object.entries(v)) {
      if (x === undefined) delete process.env[k];
      else process.env[k] = x;
    }
  };
  put(vars);
  try {
    return await fn();
  } finally {
    put(before);
  }
}
const NO_ENV = { [BRIDGE_URL_ENV]: undefined, [BRIDGE_SECRET_ENV]: undefined, [NOTES_FOLDER_ENV]: "FOLDER" };

// ── Titles and names ────────────────────────────────────────────────────────

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
    assert.equal(clientFolderName({ ...base, phone: p }), clientFolderName(base), p);
  }
});

test("a missing name or phone still produces a usable, unique title", () => {
  assert.equal(notesTitle({ ...base, name: "" }), "2026-11-09 · Unnamed · 9876543210");
  assert.equal(notesTitle({ ...base, phone: "" }), "2026-11-09 · Meera K. · nophone");
});

test("her folder is named for him to read, with the digits it is found by last", () => {
  assert.equal(clientFolderName(base), "Meera K. · 9876543210");
  assert.equal(clientFolderName({ ...base, phone: "" }), "Meera K. · nophone");
});

test("slashes and newlines never reach a Drive file name", () => {
  const t = notesTitle({ ...base, name: "Meera\n/ K" });
  assert.ok(!t.includes("\n") && !t.includes("/"), t);
});

test("her name never starts or ends on a space, and cleaning it twice changes nothing", () => {
  // The script cleans again what the worker already cleaned; both must land
  // on the same folder name.
  for (const raw of ["  Meera K.  ", "/Meera", `${"A".repeat(39)} Kulkarni`, "Meera\\\r\nK", "///", ""]) {
    const once = clientName(raw);
    assert.equal(clientName(once), once, JSON.stringify(raw));
    assert.equal(once, once.trim(), JSON.stringify(raw));
    assert.ok(once.length <= 40, JSON.stringify(raw));
  }
  assert.equal(clientName("///"), "Unnamed");
  assert.equal(clientName(`${"A".repeat(39)} Kulkarni`), "A".repeat(39));
});

test("an unparseable booking time is marked, not silently dated today", () => {
  // Guessing a date would file it under a day the call did not happen on.
  assert.ok(notesTitle({ ...base, when: "not a date" }).startsWith("undated"));
});

// ── The template ────────────────────────────────────────────────────────────

test("the template carries every section the summary is built from, in call order", () => {
  assert.deepEqual(
    notesTemplate(base).sections.map((s) => [s.key, s.heading, s.kind]),
    [
      ["words", "Her words", "text"],
      ["symptoms", "Symptoms matched to her report", "table"],
      ["blockers", "Blockers", "list"],
      ["spent", "Already spent", "table"],
      ["price", "Price quoted", "text"],
      ["nextStep", "Next step", "text"],
      ["proof", "Proof to show", "text"],
      ["objection", "Objection", "text"],
    ],
  );
});

test("the symptoms table is where a marker goes, and it tells him not to type one from memory", () => {
  // The one rule in this document that protects a real woman's report: a
  // marker that was never on her bloodwork must not appear in her summary.
  const s = notesTemplate(base).sections.find((x) => x.key === "symptoms");
  assert.deepEqual(s?.columns, SYMPTOM_COLUMNS);
  assert.ok(SYMPTOM_COLUMNS.includes("Marker"));
  assert.match(s?.hint ?? "", /only from her actual report/i);
  assert.match(s?.hint ?? "", /never from memory/i);
});

test("every table and list starts with somewhere to type", () => {
  for (const s of notesTemplate(base).sections) {
    if (s.kind === "table") assert.ok((s.rows ?? 0) >= 1 && (s.columns ?? []).length >= 1, s.key);
    if (s.kind === "list") assert.ok((s.slots ?? 0) >= 1, s.key);
  }
  assert.deepEqual(notesTemplate(base).sections.find((s) => s.key === "spent")?.columns, SPENT_COLUMNS);
});

test("the objection is marked private, because it never goes on her PDF", () => {
  assert.match(notesTemplate(base).sections.find((s) => s.key === "objection")?.hint ?? "", /private/i);
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

// ── parseNotes ──────────────────────────────────────────────────────────────

const T = notesTemplate(base);
const raw = (heading: string, over: Partial<RawNotesSection> = {}): RawNotesSection => ({
  heading, paragraphs: [], listItems: [], tables: [], ...over,
});

test("headings match whatever their case and spacing; a heading he deleted is simply absent", () => {
  const out = parseNotes([raw("  her   WORDS "), raw("Price quoted", { paragraphs: ["20000"] })], T);
  assert.deepEqual(Object.keys(out), ["words", "price"]);
  assert.equal(out.price?.text, "20000");
});

test("the hint line is dropped, by its words, whatever the script returned", () => {
  const words = T.sections.find((s) => s.key === "words")!;
  const out = parseNotes([raw("Her words", { paragraphs: [words.hint, "  ", "I am tired of being tired"] })], T);
  assert.equal(out.words?.text, "I am tired of being tired");
});

test("a table's header row and its empty rows are dropped, the rest kept in order", () => {
  const out = parseNotes([
    raw("Symptoms matched to her report", {
      tables: [[SYMPTOM_COLUMNS, ["Hair fall", "Ferritin", "18", "low"], ["", " ", "", ""], ["Tired", "TSH", "6.8", "high"]]],
    }),
  ], T);
  assert.deepEqual(out.symptoms?.rows, [["Hair fall", "Ferritin", "18", "low"], ["Tired", "TSH", "6.8", "high"]]);
});

test("a header he retitled is still the header, not a symptom on her PDF", () => {
  const retitled = ["What she feels", "Marker", "Her value", "Flag?"];
  const out = parseNotes([raw("Already spent", { tables: [[["What she tried", "Duration", "Money"], ["Keto app", "3 months", "4500"]]] }),
    raw("Symptoms matched to her report", { tables: [[retitled, ["Tired", "TSH", "6.8", "high"]]] })], T);
  assert.deepEqual(out.symptoms?.rows, [["Tired", "TSH", "6.8", "high"]]);
  assert.deepEqual(out.spent?.rows, [["Keto app", "3 months", "4500"]]);
});

test("with the header row deleted, the first row is data and is kept", () => {
  const out = parseNotes([raw("Already spent", { tables: [[["Keto app", "3 months", "4500"]]] })], T);
  assert.deepEqual(out.spent?.rows, [["Keto app", "3 months", "4500"]]);
});

test("blockers typed as plain lines become the items, and are not also the text", () => {
  // Six empty numbered slots and the blockers typed below them is a real Doc.
  const out = parseNotes([raw("Blockers", { listItems: ["", " "], paragraphs: ["Skips breakfast", "Asleep after 1am"] })], T);
  assert.deepEqual(out.blockers, { text: "", items: ["Skips breakfast", "Asleep after 1am"], rows: [] });
});

test("blockers in the numbered slots are the items, in order, without the empty slots", () => {
  const out = parseNotes([raw("Blockers", { listItems: ["Skips breakfast", "", "Asleep after 1am", ""] })], T);
  assert.deepEqual(out.blockers?.items, ["Skips breakfast", "Asleep after 1am"]);
});

test("a line Docs turned into a list item still counts as that section's text", () => {
  // Typing "- Reply START by Friday" makes Docs start a bulleted list.
  const out = parseNotes([raw("Next step", { listItems: ["Reply START on WhatsApp by Friday 8pm"] })], T);
  assert.equal(out.nextStep?.text, "Reply START on WhatsApp by Friday 8pm");
});

// ── Config ──────────────────────────────────────────────────────────────────

test("the env config wins, and the stored pairing is not even read", async () => {
  await withEnv({ [BRIDGE_URL_ENV]: "https://env.example/exec", [BRIDGE_SECRET_ENV]: "env-secret", [NOTES_FOLDER_ENV]: "FOLDER" }, async () => {
    let loaded = false;
    const r = await resolveBridgeConfig(async () => { loaded = true; return { url: "https://stored/exec", secret: "stored" }; });
    assert.deepEqual(r, { url: "https://env.example/exec", secret: "env-secret", folderId: "FOLDER", missing: [], source: "env" });
    assert.equal(loaded, false);
  });
});

test("without env vars the stored pairing is used, with the folder still from env", async () => {
  await withEnv(NO_ENV, async () => {
    const r = await resolveBridgeConfig(async () => ({ url: "https://stored/exec", secret: "stored" }));
    assert.deepEqual(r, { url: "https://stored/exec", secret: "stored", folderId: "FOLDER", missing: [], source: "stored" });
  });
  await withEnv({ ...NO_ENV, [NOTES_FOLDER_ENV]: undefined }, async () => {
    const r = await resolveBridgeConfig(async () => ({ url: "https://stored/exec", secret: "stored" }));
    assert.deepEqual(r.missing, [NOTES_FOLDER_ENV]);
  });
});

test("with neither, or a pairing that cannot be read, it is not configured and says what is missing", async () => {
  await withEnv(NO_ENV, async () => {
    for (const load of [undefined, async () => null, async () => { throw new Error("D1 is down"); }]) {
      const r = await resolveBridgeConfig(load);
      assert.equal(r.source, "none");
      assert.deepEqual(r.missing, [BRIDGE_URL_ENV, BRIDGE_SECRET_ENV]);
    }
  });
});

// ── The client ──────────────────────────────────────────────────────────────

test("missing config fails before any request, naming what is missing", async () => {
  let called = false;
  const fake = (async () => { called = true; return new Response("{}"); }) as typeof fetch;
  await assert.rejects(
    ensureNotesDoc(base, { ...cfg, url: "", missing: ["DRIVE_BRIDGE_URL"] }, fake),
    (e: unknown) => e instanceof BridgeError && e.code === "not_configured" && e.detail === "DRIVE_BRIDGE_URL",
  );
  assert.equal(called, false);
});

test("it posts one ensureDoc request carrying the secret, folder, her identity, title and template", async () => {
  const { sent, fetchImpl } = recorder({ ok: true, id: "DOC1", url: "https://docs/DOC1", created: true });
  const doc = await ensureNotesDoc({ ...base, phone: "+91 98765 43210" }, cfg, fetchImpl);
  assert.equal(sent.length, 1);
  const [{ url, body }] = sent;
  assert.equal(url, cfg.url);
  assert.equal(body.action, "ensureDoc");
  assert.equal(body.secret, "s3cret");
  assert.equal(body.folderId, "FOLDER");
  assert.equal(body.phone, "9876543210");
  assert.equal(body.name, "Meera K.");
  assert.equal(body.title, notesTitle(base));
  assert.deepEqual(body.sections, notesTemplate(base).sections);
  assert.deepEqual(doc, { id: "DOC1", url: "https://docs/DOC1", title: notesTitle(base), created: true });
});

test("a payload can never override the envelope's action, secret or folder", async () => {
  const { sent, fetchImpl } = recorder({ ok: true });
  await callBridge("readDoc", { action: "pair", secret: "forged", folderId: "ELSEWHERE", phone: "1" }, cfg, { fetchImpl });
  assert.deepEqual(sent[0].body, { action: "readDoc", secret: "s3cret", folderId: "FOLDER", phone: "1" });
});

test("readNotesDoc maps her sections by key, and answers null when she has no notes Doc", async () => {
  const sections: RawNotesSection[] = [raw("Her words", { paragraphs: ["Tired"] })];
  const ok = recorder({ ok: true, id: "DOC1", title: "t", updatedAt: "2026-11-09T10:00:00.000Z", sections });
  const notes = await readNotesDoc(base, cfg, { fetchImpl: ok.fetchImpl });
  assert.deepEqual(ok.sent[0].body, { phone: "9876543210", name: "Meera K.", title: "", action: "readDoc", secret: "s3cret", folderId: "FOLDER" });
  assert.equal(notes?.url, "https://docs.google.com/document/d/DOC1/edit");
  assert.deepEqual(notes?.sections, { words: { text: "Tired", items: [], rows: [] } });

  const none = recorder({ ok: false, error: "doc_not_found" });
  assert.equal(await readNotesDoc(base, cfg, { fetchImpl: none.fetchImpl }), null);
  const broken = recorder({ ok: false, error: "script_error", detail: "boom" });
  await assert.rejects(readNotesDoc(base, cfg, { fetchImpl: broken.fetchImpl }), (e: unknown) => e instanceof BridgeError && e.code === "script_error");
});

test("a file over the limit is refused before anything is sent", async () => {
  const { sent, fetchImpl } = recorder();
  const base64 = "A".repeat(Math.ceil((MAX_FILE_BYTES + 3) / 3) * 4);
  await assert.rejects(
    saveClientFile({ ...base, fileName: "x.pdf", mimeType: "application/pdf", base64, dedupeKey: "k" }, cfg, { fetchImpl }),
    (e: unknown) => e instanceof BridgeError && e.code === "too_large",
  );
  assert.equal(sent.length, 0);
});

test("saveClientFile sends a clean file name, a type, the key and replace", async () => {
  const { sent, fetchImpl } = recorder({ ok: true, id: "FILE1", created: true });
  const r = await saveClientFile({ ...base, fileName: "lab/report\n1.pdf", mimeType: "", base64: "AAAA", dedupeKey: "wa:1" }, cfg, { fetchImpl });
  const body = sent[0].body;
  assert.equal(body.action, "saveFile");
  assert.equal(body.fileName, "lab report 1.pdf");
  assert.equal(body.mimeType, "application/octet-stream");
  assert.equal(body.dedupeKey, "wa:1");
  assert.equal(body.replace, false);
  assert.deepEqual(r, { id: "FILE1", url: "https://drive.google.com/file/d/FILE1/view", created: true });
});

test("pairing sends the new secret and the folder, and needs nothing else configured", async () => {
  const { sent, fetchImpl } = recorder({ ok: true, paired: true });
  assert.deepEqual(await pairBridge({ url: "https://new/exec", secret: "fresh-secret-1234567", folderId: "FOLDER" }, { fetchImpl }), { paired: true });
  assert.deepEqual(sent, [{ url: "https://new/exec", body: { action: "pair", secret: "fresh-secret-1234567", folderId: "FOLDER" } }]);
});

test("a refusal from the script keeps its code, and the hint names the fix", async () => {
  const { fetchImpl } = recorder({ ok: false, error: "unauthorized" });
  await assert.rejects(ensureNotesDoc(base, cfg, fetchImpl), (e: unknown) => {
    assert.ok(e instanceof BridgeError);
    assert.equal(e.code, "unauthorized");
    assert.match(bridgeHint(e), /Connect Google Drive/);
    return true;
  });
});

test("with the secret from the worker's env, the hint points at that env var, not at Connect", async () => {
  // The env var wins over any pairing, so "use Connect Google Drive" would
  // send him round in a circle.
  for (const error of ["unauthorized", "script_not_configured"]) {
    const { fetchImpl } = recorder({ ok: false, error });
    await assert.rejects(ensureNotesDoc(base, { ...cfg, missing: [], source: "env" } as BridgeConfig, fetchImpl), (e: unknown) => {
      assert.ok(e instanceof BridgeError);
      assert.equal(e.code, error);
      assert.match(bridgeHint(e), new RegExp(BRIDGE_SECRET_ENV));
      assert.doesNotMatch(bridgeHint(e), /Connect Google Drive” again|Connect Google Drive” and paste/);
      return true;
    });
  }
});

test("each refusal he can fix himself gets the fix, in plain words", () => {
  const hint = (code: string, detail = "") => bridgeHint(new BridgeError(code, detail));
  assert.match(hint("not_configured", `${BRIDGE_URL_ENV}, ${BRIDGE_SECRET_ENV}`), /Connect Google Drive/);
  assert.match(hint("not_configured", NOTES_FOLDER_ENV), new RegExp(NOTES_FOLDER_ENV));
  assert.match(hint("already_paired"), /delete SHARED_SECRET/);
  assert.match(hint("unknown_action", "saveFile"), /New version/);
  assert.match(hint("doc_not_found"), /Press Notes first/);
  for (const code of ["not_configured", "unauthorized", "script_not_configured", "already_paired", "unknown_action", "doc_not_found", "timeout"]) {
    assert.ok(!hint(code).includes("!"), code);
  }
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

test("a reply that stalls halfway through its body is a timeout too", async () => {
  const stalled = {
    status: 200,
    text: async () => { throw new DOMException("timed out", "TimeoutError"); },
  } as unknown as Response;
  const fake = (async () => stalled) as typeof fetch;
  await assert.rejects(ensureNotesDoc(base, cfg, fake), (e: unknown) => e instanceof BridgeError && e.code === "timeout");
});
