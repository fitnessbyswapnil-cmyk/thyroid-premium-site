/**
 * The Apps Script in scripts/drive-bridge.gs runs inside the owner's Google
 * account, where no log reaches this repo. So it is run HERE, in a vm, against
 * a fake Drive — and then wired to the real lib/drive client, because the two
 * halves are written apart and a renamed field would otherwise surface only as
 * a blank Doc on a live call.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import { ensureNotesDoc, notesTemplate, notesTitle } from "./drive.ts";

const SRC = readFileSync(new URL("../scripts/drive-bridge.gs", import.meta.url), "utf8");

type Para = { text: string; heading: string };
type FakeFile = { id: string; name: string; trashed: boolean; parent: string; doc?: Para[] };

function harness(opts: { secret?: string | null; failCreate?: boolean } = {}) {
  const secret = opts.secret === undefined ? "s3cret" : opts.secret;
  const files: FakeFile[] = [];
  const folders = new Set(["FOLDER"]);
  const lock = { waits: 0, releases: 0 };
  let n = 0;

  const fileApi = (f: FakeFile) => ({
    getId: () => f.id,
    getUrl: () => `https://docs.google.com/document/d/${f.id}/edit`,
    isTrashed: () => f.trashed,
    moveTo: (folder: { id: string }) => { f.parent = folder.id; },
  });

  const DriveApp = {
    getFolderById(id: string) {
      // Lazy, like the real one can be: the failure surfaces on first use.
      return {
        id,
        getName() { if (!folders.has(id)) throw new Error("No item with the given ID"); return "Client Notes"; },
        getFilesByName(name: string) {
          const hits = files.filter((f) => f.parent === id && f.name === name);
          let i = 0;
          return { hasNext: () => i < hits.length, next: () => fileApi(hits[i++]) };
        },
      };
    },
    getFileById(id: string) {
      const f = files.find((x) => x.id === id);
      if (!f) throw new Error("no file");
      return fileApi(f);
    },
  };

  const DocumentApp = {
    ParagraphHeading: { HEADING1: "H1", HEADING2: "H2", NORMAL: "P" },
    create(title: string) {
      if (opts.failCreate) throw new Error("Service invoked too many times");
      const paras: Para[] = [{ text: "", heading: "P" }];
      const f: FakeFile = { id: `DOC${++n}`, name: title, trashed: false, parent: "ROOT", doc: paras };
      files.push(f);
      const para = (p: Para) => {
        const api = {
          setText: (t: string) => { p.text = t; return api; },
          setHeading: (h: string) => { p.heading = h; return api; },
        };
        return api;
      };
      return {
        getId: () => f.id,
        saveAndClose() {},
        getBody: () => ({
          getParagraphs: () => paras.map(para),
          appendParagraph(t: string) { const p = { text: t, heading: "P" }; paras.push(p); return para(p); },
        }),
      };
    },
  };

  const ctx = vm.createContext({
    DriveApp,
    DocumentApp,
    LockService: { getScriptLock: () => ({ waitLock: () => { lock.waits++; }, releaseLock: () => { lock.releases++; } }) },
    PropertiesService: { getScriptProperties: () => ({ getProperty: (k: string) => (k === "SHARED_SECRET" ? secret : null) }) },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }),
    },
  });
  vm.runInContext(SRC, ctx);

  const call = (fn: string, arg?: unknown) =>
    JSON.parse((ctx as Record<string, (a?: unknown) => { text: string }>)[fn](arg).text);
  const post = (body: unknown) =>
    call("doPost", { postData: { contents: typeof body === "string" ? body : JSON.stringify(body) } });

  return { post, get: () => call("doGet"), files, lock };
}

const base = { name: "Meera K.", phone: "9876543210", when: "2026-11-09T09:30:00Z" };
const req = (over: Record<string, unknown> = {}) => ({
  action: "ensureDoc", secret: "s3cret", folderId: "FOLDER", title: notesTitle(base), ...notesTemplate(base), ...over,
});

test("a GET answers that the bridge is alive, and nothing else", () => {
  const h = harness();
  const r = h.get();
  assert.equal(r.ok, true);
  assert.ok(!JSON.stringify(r).includes("s3cret"));
});

test("a wrong secret is refused before Drive is touched", () => {
  const h = harness();
  assert.equal(h.post(req({ secret: "guess" })).error, "unauthorized");
  assert.equal(h.files.length, 0);
});

test("an unset SHARED_SECRET refuses everything rather than accepting anything", () => {
  const h = harness({ secret: null });
  assert.equal(h.post(req({ secret: "" })).error, "script_not_configured");
  assert.equal(h.post(req({ secret: undefined })).error, "script_not_configured");
});

test("garbage and unknown actions are named, not crashed on", () => {
  const h = harness();
  assert.equal(h.post("{not json").error, "bad_json");
  assert.equal(h.post(req({ action: "deleteEverything" })).error, "unknown_action");
});

test("an unknown folder is reported as such", () => {
  assert.equal(harness().post(req({ folderId: "NOPE" })).error, "folder_not_found");
});

test("the Doc is made in the folder, with every section as a real heading in order", () => {
  const h = harness();
  const r = h.post(req());
  assert.equal(r.ok, true);
  assert.equal(r.created, true);
  const f = h.files[0];
  assert.equal(f.parent, "FOLDER", "left in My Drive instead of moved");
  assert.equal(f.name, notesTitle(base));
  const doc = f.doc ?? [];
  assert.deepEqual(doc[0], { text: "Meera K.", heading: "H1" });
  const h2s = doc.filter((p) => p.heading === "H2").map((p) => p.text);
  assert.deepEqual(h2s, notesTemplate(base).sections.map((s) => s.heading));
  // Every section ends on an empty line to type on.
  const idx = doc.findIndex((p) => p.text === "Next step");
  assert.deepEqual(doc.slice(idx + 1).at(-1), { text: "", heading: "P" });
  assert.equal(h.lock.waits, 1);
  assert.equal(h.lock.releases, 1);
});

test("pressing twice opens the same Doc rather than making a second", () => {
  const h = harness();
  const a = h.post(req());
  const b = h.post(req());
  assert.equal(b.created, false);
  assert.equal(b.id, a.id);
  assert.equal(h.files.length, 1);
});

test("a Doc he trashed is not resurrected; a fresh one is made", () => {
  const h = harness();
  const a = h.post(req());
  h.files[0].trashed = true;
  const b = h.post(req());
  assert.equal(b.created, true);
  assert.notEqual(b.id, a.id);
});

test("a Google failure mid-create comes back as script_error, and the lock is still released", () => {
  const h = harness({ failCreate: true });
  const r = h.post(req());
  assert.equal(r.error, "script_error");
  assert.match(r.detail, /too many times/);
  assert.equal(h.lock.releases, h.lock.waits);
});

test("the worker client and the script agree on every field, end to end", async () => {
  // The real lib/drive client, posting into the real script, through a fetch
  // that does what Apps Script's web app does with a POST body.
  const h = harness();
  const fetchIntoScript = (async (_url: string, init: RequestInit) =>
    new Response(JSON.stringify(h.post(String(init.body))))) as typeof fetch;
  const cfg = { url: "https://script.example/exec", secret: "s3cret", folderId: "FOLDER" };

  const doc = await ensureNotesDoc(base, cfg, fetchIntoScript);
  assert.equal(doc.created, true);
  assert.equal(doc.title, notesTitle(base));
  const paras = h.files[0].doc ?? [];
  assert.equal(paras[0].text, "Meera K.");
  assert.ok(paras.some((p) => p.text === "Markers" && p.heading === "H2"));

  const again = await ensureNotesDoc(base, cfg, fetchIntoScript);
  assert.equal(again.id, doc.id);
  assert.equal(again.created, false);
});
