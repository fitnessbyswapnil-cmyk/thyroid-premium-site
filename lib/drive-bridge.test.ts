/**
 * The Apps Script in scripts/drive-bridge.gs runs inside the owner's Google
 * account, where no log reaches this repo. So it is run HERE, in a vm, against
 * a fake Drive — and then wired to the real lib/drive client, because the two
 * halves are written apart and a renamed field would otherwise surface only as
 * a blank Doc on a live call.
 *
 * The fake keeps the real API's sharp edges wherever the script leans on them:
 * search speaks Drive v2 ("title contains"), matches the START of a word, and
 * can lag behind a folder it just made; folder listings include binned files;
 * DocumentApp.create lands in My Drive; an appended paragraph takes the
 * previous one's heading and style; a Doc may not end on a table; the lock
 * must be taken once and given back.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import vm from "node:vm";
import {
  BridgeError, SPENT_COLUMNS, SYMPTOM_COLUMNS, clientFolder, clientFolderName, clientName, ensureNotesDoc, notesTemplate,
  notesTitle, pairBridge, parseNotes, readNotesDoc, saveClientFile, type NotesKey, type NotesTemplate,
  type RawNotesSection,
} from "./drive.ts";

const SRC = readFileSync(new URL("../scripts/drive-bridge.gs", import.meta.url), "utf8");

const GOOGLE_DOCS = "application/vnd.google-apps.document";
const HINT_GREY = "#757575";
const ROOT = "FOLDER";

type Style = { italic: boolean | null; color: string | null; bold: boolean | null };
type ParaNode = Style & { type: "PARAGRAPH"; text: string; heading: string };
type ItemNode = Style & { type: "LIST_ITEM"; text: string; heading: string; glyph: string | null };
type CellNode = Style & { text: string; background: string | null };
type TableNode = { type: "TABLE"; rows: CellNode[][] };
type DocNode = ParaNode | ItemNode | TableNode;
type FakeFolder = { id: string; name: string; parent: string; trashed: boolean; created: number; indexed: boolean };
type FakeFile = {
  id: string; name: string; parent: string; trashed: boolean; mimeType: string;
  description: string | null; created: number; updated: number; bytes?: number[]; body?: DocNode[];
};
type Reply = Record<string, unknown> & { ok?: boolean; error?: string; detail?: string; id?: string };
type HarnessOpts = {
  /** SHARED_SECRET in Script Properties; null = never paired. */
  secret?: string | null;
  failCreate?: boolean;
  /** Drive search does not see a folder made during the test until indexAll(). */
  searchLag?: boolean;
  cacheDown?: boolean;
};

const plain = (): Style => ({ italic: null, color: null, bold: null });

function harness(opts: HarnessOpts = {}) {
  let clock = Date.parse("2026-11-09T10:00:00Z");
  const tick = () => (clock += 1000);
  let seq = 0;
  const folders: FakeFolder[] = [
    { id: "MYDRIVE", name: "My Drive", parent: "", trashed: false, created: tick(), indexed: true },
    { id: ROOT, name: "Client Notes", parent: "MYDRIVE", trashed: false, created: tick(), indexed: true },
  ];
  const files: FakeFile[] = [];
  const props = new Map<string, string>();
  if (opts.secret !== null) props.set("SHARED_SECRET", opts.secret ?? SECRET);
  const cache = new Map<string, string>();
  const lock = { waits: 0, releases: 0, held: false };
  const queries: string[] = [];
  /**
   * Flip on mid-test. createFile: Drive refuses the next writes.
   * pairRace: another Connect press stores this secret while the current
   * request waits for the lock.
   */
  const faults: { createFile: boolean; pairRace: string | null } = { createFile: false, pairRace: null };

  const iter = <T,>(xs: T[]) => {
    let i = 0;
    return {
      hasNext: () => i < xs.length,
      next: () => {
        if (i >= xs.length) throw new Error("Cannot retrieve the next object: iterator has reached the end.");
        return xs[i++];
      },
    };
  };
  const folderRec = (id: string) => {
    const f = folders.find((x) => x.id === id);
    if (!f) throw new Error("No item with the given ID could be found, or you do not have permission to access it.");
    return f;
  };
  const fileRec = (id: string) => {
    const f = files.find((x) => x.id === id);
    if (!f) throw new Error("No item with the given ID could be found, or you do not have permission to access it.");
    return f;
  };

  /** Drive v2 query syntax, the subset the script may use. Anything else is refused, as Drive does. */
  const matches = (f: FakeFolder, q: string) =>
    q.split(" and ").every((clause) => {
      let m = clause.match(/^title contains '([^'\\]*)'$/);
      if (m) {
        // Drive matches the start of a word, not any substring.
        const needle = m[1].toLowerCase();
        return f.name.toLowerCase().split(/[^\p{L}\p{N}]+/u).some((w) => w.startsWith(needle));
      }
      m = clause.match(/^trashed = (true|false)$/);
      if (m) return f.trashed === (m[1] === "true");
      throw new Error(`Invalid argument: q (${clause})`);
    });

  const fileApi = (id: string) => {
    const api = {
      getId: () => id,
      getName: () => fileRec(id).name,
      getUrl: () =>
        fileRec(id).mimeType === GOOGLE_DOCS
          ? `https://docs.google.com/document/d/${id}/edit?usp=drivesdk`
          : `https://drive.google.com/file/d/${id}/view?usp=drivesdk`,
      getMimeType: () => fileRec(id).mimeType,
      isTrashed: () => fileRec(id).trashed,
      setTrashed: (b: boolean) => { fileRec(id).trashed = b; fileRec(id).updated = tick(); return api; },
      getDescription: () => fileRec(id).description,
      setDescription: (d: string) => { fileRec(id).description = String(d); return api; },
      getDateCreated: () => new Date(fileRec(id).created),
      getLastUpdated: () => new Date(fileRec(id).updated),
      moveTo: (folder: { getId(): string }) => { folderRec(folder.getId()); fileRec(id).parent = folder.getId(); return api; },
    };
    return api;
  };

  const folderApi = (id: string): Record<string, (...a: never[]) => unknown> => ({
    getId: () => id,
    getName: () => folderRec(id).name,
    getUrl: () => `https://drive.google.com/drive/folders/${id}`,
    isTrashed: () => folderRec(id).trashed,
    getDateCreated: () => new Date(folderRec(id).created),
    getParents: () => iter([folderRec(id).parent].filter((p) => folders.some((f) => f.id === p)).map(folderApi)),
    searchFolders: (q: string) => {
      queries.push(q);
      return iter(folders.filter((f) => f.parent === id && f.indexed && matches(f, q)).map((f) => folderApi(f.id)));
    },
    getFoldersByName: (name: string) => iter(folders.filter((f) => f.parent === id && f.name === name).map((f) => folderApi(f.id))),
    createFolder: (name: string) => {
      folderRec(id);
      const f: FakeFolder = { id: `F${++seq}`, name: String(name), parent: id, trashed: false, created: tick(), indexed: !opts.searchLag };
      folders.push(f);
      return folderApi(f.id);
    },
    // Like DriveApp's, the listings include files he binned.
    getFiles: () => iter(files.filter((f) => f.parent === id).map((f) => fileApi(f.id))),
    getFilesByName: (name: string) => iter(files.filter((f) => f.parent === id && f.name === name).map((f) => fileApi(f.id))),
    getFilesByType: (mime: string) => iter(files.filter((f) => f.parent === id && f.mimeType === mime).map((f) => fileApi(f.id))),
    createFile: (blob: { getBytes(): number[]; getContentType(): string; getName(): string }) => {
      if (faults.createFile) throw new Error("We're sorry, a server error occurred. Please wait a bit and try again.");
      const at = tick();
      const f: FakeFile = {
        id: `FILE${++seq}`, name: blob.getName(), parent: id, trashed: false, mimeType: blob.getContentType(),
        description: null, created: at, updated: at, bytes: Array.from(blob.getBytes()),
      };
      files.push(f);
      return fileApi(f.id);
    },
  });

  const textApi = (n: Style & { text: string }) => {
    const api = {
      getText: () => n.text,
      setItalic: (b: boolean) => { n.italic = b; return api; },
      setForegroundColor: (c: string) => { n.color = c; return api; },
      setBold: (b: boolean) => { n.bold = b; return api; },
      isItalic: () => n.italic,
      isBold: () => n.bold,
      getForegroundColor: () => n.color,
    };
    return api;
  };
  const paraApi = (n: ParaNode | ItemNode) => {
    const api = {
      getType: () => n.type,
      getText: () => n.text,
      setText: (t: string) => { n.text = String(t); return api; },
      getHeading: () => n.heading,
      setHeading: (h: string) => { n.heading = h; return api; },
      editAsText: () => textApi(n),
      setGlyphType: (g: string) => {
        if (n.type !== "LIST_ITEM") throw new TypeError("setGlyphType is not a function");
        n.glyph = g;
        return api;
      },
    };
    return api;
  };
  const tableApi = (n: TableNode) => ({
    getType: () => "TABLE",
    getNumRows: () => n.rows.length,
    getRow: (r: number) => {
      const cells = n.rows[r];
      if (!cells) throw new Error(`Row index (${r}) out of bounds.`);
      return {
        getNumCells: () => cells.length,
        getCell: (c: number) => {
          const cell = cells[c];
          if (!cell) throw new Error(`Cell index (${c}) out of bounds.`);
          const api = {
            getText: () => cell.text,
            setBackgroundColor: (color: string) => { cell.background = color; return api; },
            editAsText: () => textApi(cell),
          };
          return api;
        },
      };
    },
  });
  const elementApi = (n: DocNode) => ({
    getType: () => n.type,
    asParagraph: () => { if (n.type !== "PARAGRAPH") throw new Error("Cannot cast to Paragraph"); return paraApi(n); },
    asListItem: () => { if (n.type !== "LIST_ITEM") throw new Error("Cannot cast to ListItem"); return paraApi(n); },
    asTable: () => { if (n.type !== "TABLE") throw new Error("Cannot cast to Table"); return tableApi(n); },
  });

  const bodyApi = (body: DocNode[]) => {
    // An appended paragraph starts out like the one before it — heading and
    // text style both — which is why the script sets every heading and styles
    // the hints last.
    const carry = (): Style & { heading: string } => {
      const last = body.at(-1);
      return last && last.type !== "TABLE"
        ? { heading: last.heading, italic: last.italic, color: last.color, bold: last.bold }
        : { heading: "NORMAL", ...plain() };
    };
    return {
      getParagraphs: () => body.filter((n): n is ParaNode | ItemNode => n.type !== "TABLE").map(paraApi),
      appendParagraph: (text: string) => {
        const n: ParaNode = { type: "PARAGRAPH", text: String(text), ...carry() };
        body.push(n);
        return paraApi(n);
      },
      appendListItem: (text: string) => {
        const last = body.at(-1);
        const n: ItemNode = { type: "LIST_ITEM", text: String(text), ...carry(), glyph: last?.type === "LIST_ITEM" ? last.glyph : null };
        body.push(n);
        return paraApi(n);
      },
      appendTable: (cells: string[][]) => {
        const n: TableNode = { type: "TABLE", rows: Array.from(cells, (row) => Array.from(row, (c) => ({ text: String(c), background: null, ...plain() }))) };
        body.push(n);
        return tableApi(n);
      },
      getNumChildren: () => body.length,
      getChild: (i: number) => {
        if (!body[i]) throw new Error(`Child index (${i}) must be less than the number of child elements (${body.length}).`);
        return elementApi(body[i]);
      },
    };
  };
  const docApi = (f: FakeFile) => ({
    getId: () => f.id,
    getBody: () => bodyApi(f.body!),
    saveAndClose: () => {
      if (f.body!.at(-1)?.type === "TABLE") throw new Error("A document must end with a paragraph, not a table.");
      f.updated = tick();
    },
  });

  const DocumentApp = {
    ElementType: { PARAGRAPH: "PARAGRAPH", LIST_ITEM: "LIST_ITEM", TABLE: "TABLE" },
    ParagraphHeading: { NORMAL: "NORMAL", TITLE: "TITLE", HEADING1: "HEADING1", HEADING2: "HEADING2", HEADING3: "HEADING3" },
    GlyphType: { NUMBER: "NUMBER", BULLET: "BULLET" },
    create(title: string) {
      if (opts.failCreate) throw new Error("Service invoked too many times for one day: docs create.");
      const at = tick();
      const f: FakeFile = {
        id: `DOC${++seq}`, name: String(title), parent: "MYDRIVE", trashed: false, mimeType: GOOGLE_DOCS,
        description: null, created: at, updated: at, body: [{ type: "PARAGRAPH", text: "", heading: "NORMAL", ...plain() }],
      };
      files.push(f);
      return docApi(f);
    },
    openById(id: string) {
      const f = files.find((x) => x.id === id && x.body);
      if (!f) throw new Error("Document is missing (perhaps it was deleted, or you don't have read access?)");
      return docApi(f);
    },
  };

  const DriveApp = {
    // Lazy, like the real one can be: the failure surfaces on first use.
    getFolderById: (id: string) => folderApi(String(id)),
    getFileById: (id: string) => { fileRec(id); return fileApi(id); },
  };

  const ctx = vm.createContext({
    DriveApp,
    DocumentApp,
    LockService: {
      getScriptLock: () => ({
        waitLock: () => {
          if (lock.held) throw new Error("the lock was taken twice in one request");
          if (faults.pairRace) {
            props.set("SHARED_SECRET", faults.pairRace);
            faults.pairRace = null;
          }
          lock.held = true;
          lock.waits++;
        },
        releaseLock: () => { lock.held = false; lock.releases++; },
      }),
    },
    PropertiesService: {
      getScriptProperties: () => {
        const store = {
          getProperty: (k: string) => props.get(k) ?? null,
          setProperty: (k: string, v: string) => { props.set(k, String(v)); return store; },
        };
        return store;
      },
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => { if (opts.cacheDown) throw new Error("Service unavailable: Cache"); return cache.get(k) ?? null; },
        put: (k: string, v: string, seconds: number) => {
          if (opts.cacheDown) throw new Error("Service unavailable: Cache");
          if (!(seconds > 0 && seconds <= 21600)) throw new Error(`Invalid expiration: ${seconds}`);
          cache.set(k, v);
        },
      }),
    },
    Utilities: {
      base64Decode: (s: string) => {
        if (s.length % 4 || !/^[A-Za-z0-9+/]*={0,2}$/.test(s)) throw new Error("Could not decode string.");
        // Apps Script hands back Java bytes: signed, -128..127.
        return Array.from(Buffer.from(s, "base64"), (b) => (b > 127 ? b - 256 : b));
      },
      newBlob: (bytes: number[], contentType: string, name: string) => ({
        getBytes: () => bytes,
        getContentType: () => contentType,
        getName: () => name,
      }),
    },
    ContentService: {
      MimeType: { JSON: "application/json" },
      createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }),
    },
  });
  vm.runInContext(SRC, ctx);

  const callRaw = (fn: string, arg?: unknown): string => (ctx[fn] as (a?: unknown) => { text: string })(arg).text;
  const postText = (body: string) => callRaw("doPost", { postData: { contents: body } });
  const post = (body: unknown): Reply => JSON.parse(postText(typeof body === "string" ? body : JSON.stringify(body)));

  const addFolder = (name: string, over: Partial<FakeFolder> = {}) => {
    const f: FakeFolder = { id: `F${++seq}`, name, parent: ROOT, trashed: false, created: tick(), indexed: true, ...over };
    folders.push(f);
    return f;
  };
  /** A Doc of his own, made by hand. */
  const addDoc = (parent: string, name: string) => {
    const at = tick();
    const f: FakeFile = {
      id: `DOC${++seq}`, name, parent, trashed: false, mimeType: GOOGLE_DOCS, description: null, created: at, updated: at,
      body: [{ type: "PARAGRAPH", text: name, heading: "NORMAL", ...plain() }],
    };
    files.push(f);
    return f;
  };

  return {
    post,
    postText,
    get: (): Reply => JSON.parse(callRaw("doGet")),
    folders,
    files,
    props,
    cache,
    lock,
    queries,
    faults,
    folder: folderRec,
    file: fileRec,
    foldersIn: (parent: string) => folders.filter((f) => f.parent === parent),
    filesIn: (parent: string) => files.filter((f) => f.parent === parent),
    addFolder,
    addDoc,
    indexAll: () => { for (const f of folders) f.indexed = true; },
  };
}

type Harness = ReturnType<typeof harness>;

// ── Requests ────────────────────────────────────────────────────────────────

const SECRET = "s3cret"; // set by hand in Script Properties: the manual path has no minimum
const PAIR = "pair-secret-0123456789abcdef";
const OTHER = "another-secret-fedcba9876543210";
const base = { name: "Meera K.", phone: "9876543210", when: "2026-11-09T09:30:00Z" };
const ACTIONS = ["clientFolder", "ensureDoc", "readDoc", "saveFile"];
const PDF = Buffer.from("%PDF-1.4 her TSH report · ©\n").toString("base64");

const envelope = (action: string, over: Record<string, unknown> = {}) => ({ action, secret: SECRET, folderId: ROOT, ...over });
const who = (input: { name: string; phone: string } = base) => ({ name: input.name, phone: input.phone });
const docReq = (input: { name: string; phone: string; when: string } = base, over: Record<string, unknown> = {}) =>
  envelope("ensureDoc", { ...who(input), title: notesTitle(input), ...notesTemplate(input), ...over });
const readReq = (over: Record<string, unknown> = {}) => envelope("readDoc", { ...who(), title: "", ...over });
const fileReq = (over: Record<string, unknown> = {}) =>
  envelope("saveFile", {
    ...who(), fileName: "Report · 2026-11-09 · tsh.pdf", mimeType: "application/pdf", base64: PDF, dedupeKey: "wa:MEDIA1", replace: false,
    ...over,
  });
/** A complete, valid request for any action — so a refusal is about the one thing changed. */
const request = (action: string, over: Record<string, unknown> = {}) =>
  action === "ensureDoc" ? docReq(base, over)
    : action === "readDoc" ? readReq(over)
      : action === "saveFile" ? fileReq(over)
        : envelope(action, { ...who(), ...over });
const pairReq = (secret: unknown, over: Record<string, unknown> = {}) => ({ action: "pair", secret, folderId: ROOT, ...over });

// ── Reading the fake Doc ────────────────────────────────────────────────────

/** One line per element, styling included, so a single deepEqual shows the whole Doc. */
function shape(n: DocNode): string {
  if (n.type === "TABLE") {
    const [head, ...rest] = n.rows;
    const headOk = head.every((c) => c.bold === true && c.background && !c.italic);
    const restPlain = rest.every((row) => row.every((c) => !c.text && !c.bold && !c.italic && !c.background));
    return `table${headOk ? "[bold,shaded]" : "[PLAIN HEADER]"} ${head.map((c) => c.text).join(" | ")} +${rest.length}${restPlain ? "" : " (NOT EMPTY)"}`;
  }
  const grey = n.italic === true && (n.color ?? "").toLowerCase() === HINT_GREY;
  const styled = Boolean(n.italic || n.bold || n.color);
  if (n.type === "LIST_ITEM") return `${n.glyph === "NUMBER" ? "1." : `(${n.glyph})`} ${n.text}${styled ? " (STYLED)" : ""}`;
  if (n.heading === "NORMAL" && grey) return `hint ${n.text}`;
  return `${n.heading} ${n.text}${styled ? " (STYLED)" : ""}`;
}

/** What the template should render to, worked out from the template itself. */
function expectedShape(t: NotesTemplate): string[] {
  const out = [`HEADING1 ${t.heading}`, `NORMAL ${t.preface}`];
  for (const s of t.sections) {
    out.push(`HEADING2 ${s.heading}`, `hint ${s.hint}`);
    if (s.kind === "table") out.push(`table[bold,shaded] ${(s.columns ?? []).join(" | ")} +${s.rows}`, "NORMAL ");
    else if (s.kind === "list") for (let i = 0; i < (s.slots ?? 0); i++) out.push("1. ");
    else out.push("NORMAL ");
  }
  return out;
}

/** The elements between the H2 with this text and the next H2. */
function section(body: DocNode[], heading: string): DocNode[] {
  const start = body.findIndex((n) => n.type === "PARAGRAPH" && n.heading === "HEADING2" && n.text === heading);
  assert.ok(start >= 0, `no section "${heading}"`);
  const rest = body.slice(start + 1);
  const end = rest.findIndex((n) => n.type === "PARAGRAPH" && n.heading === "HEADING2");
  return end < 0 ? rest : rest.slice(0, end);
}

/** He types on the section's empty line, the way the editor would: plain text. */
function typeLine(body: DocNode[], heading: string, text: string) {
  const line = section(body, heading).find((n): n is ParaNode => n.type === "PARAGRAPH" && !n.text);
  assert.ok(line, `no empty line under "${heading}"`);
  line.text = text;
}

function fillList(body: DocNode[], heading: string, items: string[]) {
  const slots = section(body, heading).filter((n): n is ItemNode => n.type === "LIST_ITEM");
  items.forEach((text, i) => { slots[i].text = text; });
}

function fillTable(body: DocNode[], heading: string, rows: string[][]) {
  const table = section(body, heading).find((n): n is TableNode => n.type === "TABLE");
  assert.ok(table, `no table under "${heading}"`);
  // Row one is the header; he types from row two.
  rows.forEach((cells, r) => cells.forEach((text, c) => { table.rows[r + 1][c].text = text; }));
}

function fillNotes(h: Harness, docId: string) {
  const body = h.file(docId).body!;
  typeLine(body, "Her words", "I am tired of being tired");
  fillTable(body, "Symptoms matched to her report", [
    ["Exhausted by 3pm", "TSH", "6.8 (0.4–4.0)", "high"],
    ["Hair fall", "Ferritin", "18 (30–400)", "low"],
  ]);
  fillList(body, "Blockers", ["Skips breakfast", "Asleep after 1am", "Takes her thyroid tablet with tea"]);
  fillTable(body, "Already spent", [["Keto app", "3 months", "4500"]]);
  typeLine(body, "Price quoted", "20000");
  typeLine(body, "Next step", "Reply START on WhatsApp by Friday 8pm");
  typeLine(body, "Objection", "Has to ask her husband. Really the price.");
}

const FILLED: Record<NotesKey, { text: string; items: string[]; rows: string[][] }> = {
  words: { text: "I am tired of being tired", items: [], rows: [] },
  symptoms: {
    text: "", items: [],
    rows: [["Exhausted by 3pm", "TSH", "6.8 (0.4–4.0)", "high"], ["Hair fall", "Ferritin", "18 (30–400)", "low"]],
  },
  blockers: { text: "", items: ["Skips breakfast", "Asleep after 1am", "Takes her thyroid tablet with tea"], rows: [] },
  spent: { text: "", items: [], rows: [["Keto app", "3 months", "4500"]] },
  price: { text: "20000", items: [], rows: [] },
  nextStep: { text: "Reply START on WhatsApp by Friday 8pm", items: [], rows: [] },
  proof: { text: "", items: [], rows: [] },
  objection: { text: "Has to ask her husband. Really the price.", items: [], rows: [] },
};

const herFolder = (h: Harness) => {
  const mine = h.foldersIn(ROOT).filter((f) => f.name.endsWith(base.phone));
  assert.equal(mine.length, 1, `expected one folder for her, found ${mine.length}`);
  return mine[0];
};

// ── The envelope ────────────────────────────────────────────────────────────

test("a GET says the bridge is alive and which version it runs, and nothing else", () => {
  const r = harness().get();
  assert.equal(r.ok, true);
  assert.equal(r.version, "v2");
  assert.deepEqual(r.actions, ["pair", ...ACTIONS]);
  assert.ok(!JSON.stringify(r).includes(SECRET));
});

test("a wrong secret is refused before Drive is touched, whatever the action", () => {
  const h = harness();
  for (const action of ACTIONS) {
    assert.equal(h.post(request(action, { secret: "guess" })).error, "unauthorized", action);
    assert.equal(h.post(request(action, { secret: undefined })).error, "unauthorized", action);
  }
  assert.equal(h.foldersIn(ROOT).length, 0, "a folder was made for a stranger");
  assert.equal(h.files.length, 0);
  assert.equal(h.lock.waits, 0);
});

test("an unpaired script answers every action but pair with script_not_configured", () => {
  // Never "accept anything until a secret is set".
  const h = harness({ secret: null });
  for (const action of [...ACTIONS, "deleteEverything"]) {
    for (const secret of [SECRET, PAIR, "", undefined]) {
      assert.equal(h.post(request(action, { secret })).error, "script_not_configured", `${action} / ${secret}`);
    }
  }
  assert.equal(h.foldersIn(ROOT).length, 0);
  assert.equal(h.files.length, 0);
  assert.equal(h.props.has("SHARED_SECRET"), false);
});

test("garbage and unknown actions are named, not crashed on", () => {
  const h = harness();
  assert.equal(h.post("{not json").error, "bad_json");
  assert.equal(h.post("null").error, "bad_json");
  assert.equal(h.post(envelope("deleteEverything")).error, "unknown_action");
  // Names every object has are still not actions.
  assert.equal(h.post(envelope("toString")).error, "unknown_action");
  assert.equal(h.post(envelope("constructor")).error, "unknown_action");
  assert.equal(h.post(envelope("")).error, "unknown_action");
});

test("an unknown or binned root folder is reported as such, whatever the action", () => {
  const h = harness();
  for (const action of ACTIONS) {
    assert.equal(h.post(request(action, { folderId: "NOPE" })).error, "folder_not_found", action);
    assert.equal(h.post(request(action, { folderId: "" })).error, "folder_not_found", action);
  }
  h.folder(ROOT).trashed = true;
  assert.equal(h.post(request("clientFolder")).error, "folder_not_found");
  assert.equal(h.files.length, 0);
});

// ── Pairing (trust on first use) ────────────────────────────────────────────

test("pairing: the first secret is adopted, the same one again changes nothing, another is refused", () => {
  const h = harness({ secret: null });
  assert.deepEqual(h.post(pairReq(PAIR)), { ok: true, paired: true });
  assert.equal(h.props.get("SHARED_SECRET"), PAIR);
  assert.deepEqual(h.post(pairReq(PAIR)), { ok: true, paired: false });
  assert.equal(h.post(pairReq(OTHER)).error, "already_paired");
  assert.equal(h.props.get("SHARED_SECRET"), PAIR, "a second Connect must not take the script over");

  // From then on the adopted secret is the key to everything else.
  assert.equal(h.post(request("clientFolder", { secret: PAIR })).ok, true);
  assert.equal(h.post(request("clientFolder", { secret: OTHER })).error, "unauthorized");
  assert.equal(h.lock.waits, h.lock.releases);
});

test("two Connect presses at once: whichever gets the lock second is refused, not adopted", () => {
  // Both saw no secret on the way in; the other press stored its secret
  // while this one waited for the lock.
  const h = harness({ secret: null });
  h.faults.pairRace = OTHER;
  assert.equal(h.post(pairReq(PAIR)).error, "already_paired");
  assert.equal(h.props.get("SHARED_SECRET"), OTHER);
  assert.equal(h.lock.waits, h.lock.releases);
  // The same secret arriving twice is still a no-op, not a refusal.
  const again = harness({ secret: null });
  again.faults.pairRace = PAIR;
  assert.deepEqual(again.post(pairReq(PAIR)), { ok: true, paired: false });
});

test("pairing proves the folder before adopting anything", () => {
  // Otherwise a wrong folder id would leave the script holding a secret the
  // site threw away, and every later Connect would answer already_paired.
  const h = harness({ secret: null });
  assert.equal(h.post(pairReq(PAIR, { folderId: "NOPE" })).error, "folder_not_found");
  assert.equal(h.props.has("SHARED_SECRET"), false);
  assert.equal(h.post(pairReq(OTHER)).paired, true);
  assert.equal(h.props.get("SHARED_SECRET"), OTHER);
});

test("pairing refuses a short or missing secret rather than adopting it", () => {
  const h = harness({ secret: null });
  for (const secret of ["", "short", undefined, null, 1234567890123456789]) {
    assert.equal(h.post(pairReq(secret)).error, "bad_secret", String(secret));
  }
  assert.equal(h.props.has("SHARED_SECRET"), false);
});

test("a paired script tells a stranger only that it is paired, without touching Drive", () => {
  // already_paired comes before the folder check, so pair cannot be used to
  // test whether a folder id exists in his Drive.
  const h = harness();
  assert.equal(h.post(pairReq(OTHER, { folderId: "NOPE" })).error, "already_paired");
  assert.equal(h.post(pairReq(SECRET, { folderId: "NOPE" })).error, "folder_not_found");
  assert.deepEqual(h.post(pairReq(SECRET)), { ok: true, paired: false });
});

// ── Her folder ──────────────────────────────────────────────────────────────

test("her folder is made once, named for him to read, and found again", () => {
  const h = harness();
  const a = h.post(request("clientFolder"));
  assert.equal(a.created, true);
  assert.equal(a.url, `https://drive.google.com/drive/folders/${a.id}`);
  const f = h.folder(String(a.id));
  assert.equal(f.name, clientFolderName(base));
  assert.equal(f.parent, ROOT);
  const b = h.post(request("clientFolder"));
  assert.deepEqual([b.id, b.created], [a.id, false]);
  assert.equal(h.foldersIn(ROOT).length, 1);
  assert.equal(h.lock.waits, 2);
  assert.equal(h.lock.releases, 2);
});

test("her folder is found by her digits even when her name is spelled differently", () => {
  const h = harness();
  const existing = h.addFolder("Meera Kulkarni · 9876543210");
  const r = h.post(request("clientFolder", { name: "meera k", phone: "+91 98765 43210" }));
  assert.deepEqual(r, { ok: true, id: existing.id, url: `https://drive.google.com/drive/folders/${existing.id}`, created: false });
  assert.equal(existing.name, "Meera Kulkarni · 9876543210", "her folder must not be renamed");
  assert.equal(h.foldersIn(ROOT).length, 1);
  // Searched the way the contract says, in Drive v2's syntax.
  assert.deepEqual(h.queries, ["title contains '9876543210' and trashed = false"]);
});

test("a number that merely starts with hers is someone else's folder", () => {
  // Drive's "contains" is a word-prefix match, so this folder comes back.
  const h = harness();
  const other = h.addFolder("Asha · 98765432101");
  const r = h.post(request("clientFolder"));
  assert.equal(r.created, true);
  assert.notEqual(r.id, other.id);
});

test("with two folders for her, the older one, already holding her files, wins", () => {
  const h = harness();
  const older = h.addFolder("Meera · 9876543210");
  h.addFolder("Meera K. · 9876543210");
  assert.equal(h.post(request("clientFolder")).id, older.id);
});

test("a folder he binned stays in the bin; she gets a fresh one", () => {
  const h = harness();
  const binned = h.addFolder("Meera K. · 9876543210", { trashed: true });
  const r = h.post(request("clientFolder"));
  assert.equal(r.created, true);
  assert.notEqual(r.id, binned.id);
});

test("pages sent together land in one folder, even before Drive's search can see it", () => {
  // Three report pages arrive as three requests a second apart. If the second
  // one searched before Drive indexed the first one's folder, her files would
  // be split across two.
  const h = harness({ searchLag: true });
  const a = h.post(request("saveFile", { dedupeKey: "wa:PAGE1" }));
  const b = h.post(request("saveFile", { dedupeKey: "wa:PAGE2" }));
  const c = h.post(request("ensureDoc"));
  assert.equal(h.foldersIn(ROOT).length, 1, "her files were split across folders");
  const parents = new Set([a.id, b.id, c.id].map((id) => h.file(String(id)).parent));
  assert.equal(parents.size, 1);
});

test("a remembered folder he has since binned is not written into", () => {
  const h = harness();
  const a = h.post(request("clientFolder"));
  h.folder(String(a.id)).trashed = true;
  const b = h.post(request("clientFolder"));
  assert.equal(b.created, true);
  assert.notEqual(b.id, a.id);
});

test("a remembered folder he moved out of Client Notes, or renamed for someone else, is not used", () => {
  const h = harness();
  const moved = h.post(request("clientFolder"));
  h.folder(String(moved.id)).parent = "MYDRIVE";
  const second = h.post(request("clientFolder"));
  assert.equal(second.created, true);
  assert.notEqual(second.id, moved.id);
  h.folder(String(second.id)).name = "Asha · 9123456789";
  const third = h.post(request("clientFolder"));
  assert.equal(third.created, true);
  assert.notEqual(third.id, second.id);
});

test("the script names her folder exactly as lib/drive does, from her raw name or the worker's", () => {
  // The worker sends clientName(name); the script normalises again. Both
  // must come out at clientFolderName(), or a new folder gets a name that
  // drifts from the Doc titles beside it.
  const names = ["Meera K.", "  Meera\n/ Kulkarni  ", `${"A".repeat(39)} Kulkarni`, "D'Souza \\ Rao", "///", ""];
  for (const name of names) {
    const input = { name, phone: "9123456789" };
    for (const sent of [name, clientName(name)]) {
      const h = harness();
      const r = h.post(request("clientFolder", { name: sent, phone: input.phone }));
      assert.equal(h.folder(String(r.id)).name, clientFolderName(input), JSON.stringify(sent));
    }
  }
  // No usable name, but a phone: still filed, under "Unnamed".
  assert.equal(clientFolderName({ name: "///", phone: "9123456789" }), "Unnamed · 9123456789");
});

test("with the cache down, her folder is still found by search", () => {
  const h = harness({ cacheDown: true });
  const a = h.post(request("clientFolder"));
  const b = h.post(request("clientFolder"));
  assert.equal(a.ok, true);
  assert.deepEqual([b.id, b.created], [a.id, false]);
});

test("a client with no phone is filed by her exact name, and only her name", () => {
  const h = harness();
  const a = h.post(request("clientFolder", { phone: "" }));
  assert.equal(h.folder(String(a.id)).name, "Meera K. · nophone");
  assert.equal(h.post(request("clientFolder", { phone: "" })).id, a.id);
  assert.notEqual(h.post(request("clientFolder", { phone: "", name: "Asha" })).id, a.id);
});

test("a request naming nobody is refused rather than filed under Unnamed", () => {
  const h = harness();
  for (const action of ["clientFolder", "readDoc", "saveFile"]) {
    assert.equal(h.post(request(action, { phone: "", name: "  " })).error, "no_client", action);
  }
  assert.equal(h.foldersIn(ROOT).length, 0);
});

// ── ensureDoc ───────────────────────────────────────────────────────────────

test("the Doc is made in HER folder: H1, preface, then each section's heading, hint and place to type", () => {
  const h = harness();
  const r = h.post(docReq());
  assert.equal(r.ok, true);
  assert.equal(r.created, true);
  const f = h.file(String(r.id));
  assert.equal(f.parent, herFolder(h).id, "left in My Drive or the root instead of her folder");
  assert.equal(herFolder(h).name, clientFolderName(base));
  assert.equal(f.name, notesTitle(base));
  // The H1 reuses the Doc's first paragraph (no blank line above it); every
  // hint is grey italic and nothing else is; tables carry a shaded bold
  // header and a line below; the list is numbered.
  assert.deepEqual(f.body!.map(shape), expectedShape(notesTemplate(base)));
  assert.equal(h.lock.waits, 1);
  assert.equal(h.lock.releases, 1);
});

test("the template really has a table, a list and plain lines, so the render test covers all three", () => {
  const kinds = new Set(notesTemplate(base).sections.map((s) => s.kind));
  assert.deepEqual([...kinds].sort(), ["list", "table", "text"]);
});

test("pressing twice opens the same Doc rather than making a second", () => {
  const h = harness();
  const a = h.post(docReq());
  const b = h.post(docReq());
  assert.equal(b.created, false);
  assert.equal(b.id, a.id);
  assert.equal(h.files.length, 1);
});

test("the same call's Doc is found again when her name is spelled differently that day", () => {
  // The call row and the queue row can carry two spellings of one woman.
  // Date and digits are the parts of the title that do not depend on it.
  const h = harness();
  const a = h.post(docReq());
  const kulkarni = { ...base, name: "Meera Kulkarni" };
  const b = h.post(docReq(kulkarni));
  assert.deepEqual([b.id, b.created, b.title], [a.id, false, notesTitle(base)]);
  // Another day is another call, and another Doc.
  const later = { ...base, when: "2026-11-16T09:30:00Z" };
  const c = h.post(docReq(later));
  assert.equal(c.created, true);
  assert.equal(h.filesIn(herFolder(h).id).length, 2);
});

test("a Doc he trashed is not resurrected; a fresh one is made", () => {
  const h = harness();
  const a = h.post(docReq());
  h.file(String(a.id)).trashed = true;
  const b = h.post(docReq());
  assert.equal(b.created, true);
  assert.notEqual(b.id, a.id);
});

test("a file with the title that is not a Google Doc is not mistaken for the notes", () => {
  const h = harness();
  h.post(request("saveFile", { fileName: notesTitle(base), mimeType: "application/pdf" }));
  const r = h.post(docReq());
  assert.equal(r.created, true);
  assert.equal(h.file(String(r.id)).mimeType, GOOGLE_DOCS);
});

test("a v1 request, with no phone and no name, still gets its Doc in the root as before", () => {
  const h = harness();
  const t = notesTemplate(base);
  const v1 = envelope("ensureDoc", {
    title: notesTitle(base), heading: t.heading, preface: t.preface,
    sections: t.sections.map((s) => ({ heading: s.heading, hint: s.hint })),
  });
  const r = h.post(v1);
  assert.equal(r.created, true);
  assert.equal(h.file(String(r.id)).parent, ROOT);
  assert.equal(h.foldersIn(ROOT).length, 0);
});

test("a Google failure mid-create comes back as script_error, and the lock is still released", () => {
  const h = harness({ failCreate: true });
  const r = h.post(docReq());
  assert.equal(r.error, "script_error");
  assert.match(String(r.detail), /too many times/);
  assert.equal(h.lock.releases, h.lock.waits);
  assert.equal(h.lock.held, false);
});

// ── readDoc ─────────────────────────────────────────────────────────────────

test("readDoc gives back what he typed, section by section, without hints, header rows or empty rows", () => {
  const h = harness();
  const made = h.post(docReq());
  fillNotes(h, String(made.id));
  const r = h.post(readReq());
  assert.equal(r.ok, true);
  assert.equal(r.id, made.id);
  assert.equal(r.title, notesTitle(base));
  assert.equal(r.url, `https://docs.google.com/document/d/${made.id}/edit?usp=drivesdk`);
  assert.ok(!Number.isNaN(Date.parse(String(r.updatedAt))) && String(r.updatedAt).endsWith("Z"), String(r.updatedAt));

  const t = notesTemplate(base);
  const raw = r.sections as RawNotesSection[];
  assert.deepEqual(raw.map((s) => s.heading), t.sections.map((s) => s.heading), "one entry per H2, in order");

  // The script's own half of the contract: paragraphs are body-level typed
  // lines only — never a hint, never a cell, never a list item.
  const hints = new Set(t.sections.map((s) => s.hint));
  const cellsAndItems = new Set(raw.flatMap((s) => [...s.listItems, ...s.tables.flat(2)]));
  for (const s of raw) {
    for (const p of s.paragraphs) {
      assert.ok(!hints.has(p), `hint read as typing: ${p}`);
      assert.ok(!cellsAndItems.has(p), `cell or list item read as a paragraph: ${p}`);
    }
  }
  // Tables come back raw: the header row and every row, empty or not.
  const symptoms = raw.find((s) => s.heading === "Symptoms matched to her report")!;
  assert.deepEqual(symptoms.tables[0][0], SYMPTOM_COLUMNS);
  // Numbered slots come back as list items, the empty ones left out.
  const blockers = raw.find((s) => s.heading === "Blockers")!;
  assert.deepEqual(blockers.listItems, FILLED.blockers.items);
  assert.deepEqual(blockers.paragraphs, []);
  assert.deepEqual(raw.find((s) => s.heading === "Her words")!.paragraphs, [FILLED.words.text]);
  assert.equal(symptoms.tables[0].length, 1 + (t.sections.find((s) => s.key === "symptoms")?.rows ?? 0));

  assert.deepEqual(parseNotes(raw, t), FILLED);
});

test("an untouched Doc reads back as every section present and empty", () => {
  const h = harness();
  h.post(docReq());
  const parsed = parseNotes(h.post(readReq()).sections as RawNotesSection[], notesTemplate(base));
  assert.deepEqual(Object.keys(parsed), notesTemplate(base).sections.map((s) => s.key));
  for (const part of Object.values(parsed)) assert.deepEqual(part, { text: "", items: [], rows: [] });
});

test("a hint is known by its grey italic, so a Doc made from older wording still reads clean", () => {
  // parseNotes can only drop a hint whose words it knows; the script drops
  // the line that LOOKS like a hint, whatever it says.
  const h = harness();
  const t = notesTemplate(base);
  h.post(docReq(base, { sections: t.sections.map((s) => ({ ...s, hint: `Earlier wording. ${s.hint}` })) }));
  const parsed = parseNotes(h.post(readReq()).sections as RawNotesSection[], t);
  for (const [key, part] of Object.entries(parsed)) assert.equal(part.text, "", key);
});

test("with no title, readDoc reads her newest notes Doc", () => {
  const h = harness();
  h.post(docReq({ ...base, when: "2026-11-02T09:30:00Z" }));
  const newest = h.post(docReq());
  // A newer Doc he binned does not count, and nor does a Doc of his own.
  const binned = h.post(docReq({ ...base, when: "2026-11-12T09:30:00Z" }));
  h.file(String(binned.id)).trashed = true;
  h.addDoc(herFolder(h).id, "Meal ideas for Meera");
  assert.equal(h.post(readReq()).id, newest.id);
});

test("with a title, readDoc reads that Doc, under any spelling of her name, and not the newest", () => {
  const h = harness();
  const first = h.post(docReq({ ...base, when: "2026-11-02T09:30:00Z" }));
  h.post(docReq());
  const asTyped = { ...base, name: "Meera Kulkarni", when: "2026-11-02T09:30:00Z" };
  assert.equal(h.post(readReq({ title: notesTitle({ ...base, when: "2026-11-02T09:30:00Z" }) })).id, first.id);
  assert.equal(h.post(readReq({ title: notesTitle(asTyped), name: asTyped.name })).id, first.id);
  assert.equal(h.post(readReq({ title: notesTitle({ ...base, when: "2026-11-05T09:30:00Z" }) })).error, "doc_not_found");
});

test("readDoc answers doc_not_found when she has no notes Doc, and makes no folder finding out", () => {
  const h = harness();
  assert.equal(h.post(readReq()).error, "doc_not_found");
  assert.equal(h.foldersIn(ROOT).length, 0, "reading made a folder");
  // A folder holding only her report still has no notes.
  h.post(request("saveFile"));
  assert.equal(h.post(readReq()).error, "doc_not_found");
  assert.equal(h.lock.waits, 1, "reading took the lock");
});

// ── saveFile ────────────────────────────────────────────────────────────────

test("saveFile writes her file, byte for byte, into HER folder, tagged with its key", () => {
  const h = harness();
  const r = h.post(fileReq());
  assert.equal(r.created, true);
  const f = h.file(String(r.id));
  assert.equal(f.parent, herFolder(h).id);
  assert.equal(f.name, "Report · 2026-11-09 · tsh.pdf");
  assert.equal(f.mimeType, "application/pdf");
  assert.equal(f.description, "dedupe:wa:MEDIA1");
  assert.equal(r.url, `https://drive.google.com/file/d/${r.id}/view?usp=drivesdk`);
  assert.equal(Buffer.from(f.bytes!.map((b) => b & 0xff)).toString("base64"), PDF);
  assert.equal(h.lock.waits, h.lock.releases);
});

test("the same key twice returns the first file and writes nothing", () => {
  const h = harness();
  const a = h.post(fileReq());
  const b = h.post(fileReq({ fileName: "a different name.pdf" }));
  assert.deepEqual([b.id, b.created], [a.id, false]);
  assert.equal(h.files.length, 1);
});

test("replace writes the new file first, then bins the old one", () => {
  const h = harness();
  const a = h.post(fileReq());
  const b = h.post(fileReq({ replace: true, base64: Buffer.from("regenerated").toString("base64") }));
  assert.equal(b.created, true);
  assert.notEqual(b.id, a.id);
  assert.equal(h.file(String(a.id)).trashed, true);
  assert.equal(h.file(String(b.id)).trashed, false);
  assert.equal(h.file(String(b.id)).description, "dedupe:wa:MEDIA1");
  // And the new one is now the one the key finds.
  assert.equal(h.post(fileReq()).id, b.id);
});

test("if writing the replacement fails, the old file stays where it was", () => {
  // New first, old second: a failure in between leaves two copies, never none.
  const h = harness();
  const a = h.post(fileReq());
  h.faults.createFile = true;
  const b = h.post(fileReq({ replace: true }));
  assert.equal(b.error, "script_error");
  assert.equal(h.file(String(a.id)).trashed, false);
  assert.equal(h.lock.held, false);
});

test("only the exact key counts, and a binned file with it does not", () => {
  const h = harness();
  const a = h.post(fileReq());
  assert.equal(h.post(fileReq({ dedupeKey: "wa:MEDIA10" })).created, true);
  h.file(String(a.id)).trashed = true;
  const c = h.post(fileReq());
  assert.equal(c.created, true);
  assert.notEqual(c.id, a.id);
});

test("an unreadable file is refused or reported, and the lock is still released", () => {
  const h = harness();
  assert.equal(h.post(fileReq({ base64: "" })).error, "no_file");
  const bad = h.post(fileReq({ base64: "not base64!" }));
  assert.equal(bad.error, "script_error");
  assert.match(String(bad.detail), /decode/);
  assert.equal(h.lock.held, false);
  assert.equal(h.lock.waits, h.lock.releases);
  assert.equal(h.files.length, 0);
});

// ── End to end, through the real worker client ─────────────────────────────

test("the worker client and the script agree on every field, end to end", async () => {
  // The real lib/drive functions, posting into the real script, through a
  // fetch that does what Apps Script's web app does with a POST body.
  const h = harness({ secret: null });
  const fetchImpl = (async (_url: string, init: RequestInit) => new Response(h.postText(String(init.body)))) as typeof fetch;
  const opts = { fetchImpl };
  const cfg = { url: "https://script.google.com/macros/s/AKfy/exec", secret: PAIR, folderId: ROOT };
  const herInput = { ...base, phone: "+91 98765-43210" }; // any format reaches the same folder

  assert.deepEqual(await pairBridge(cfg, opts), { paired: true });
  assert.deepEqual(await pairBridge(cfg, opts), { paired: false });
  await assert.rejects(pairBridge({ ...cfg, secret: OTHER }, opts), (e: unknown) => e instanceof BridgeError && e.code === "already_paired");

  const folder = await clientFolder(herInput, cfg, opts);
  assert.equal(folder.created, true);
  assert.equal(h.folder(folder.id).name, clientFolderName(herInput));
  assert.equal(folder.url, `https://drive.google.com/drive/folders/${folder.id}`);

  const doc = await ensureNotesDoc(herInput, cfg, fetchImpl);
  assert.equal(doc.created, true);
  assert.equal(doc.title, notesTitle(herInput));
  assert.equal(h.file(doc.id).parent, folder.id);
  assert.deepEqual(h.file(doc.id).body!.map(shape), expectedShape(notesTemplate(herInput)));
  const again = await ensureNotesDoc(herInput, cfg, fetchImpl);
  assert.deepEqual([again.id, again.created], [doc.id, false]);

  fillNotes(h, doc.id);
  const notes = await readNotesDoc({ name: herInput.name, phone: herInput.phone }, cfg, opts);
  assert.ok(notes);
  assert.equal(notes.id, doc.id);
  assert.equal(notes.title, doc.title);
  assert.deepEqual(notes.sections, FILLED);
  assert.deepEqual(notes.sections.spent?.rows[0].length, SPENT_COLUMNS.length);

  const report = { ...herInput, fileName: "Report · 2026-11-09 · tsh.pdf", mimeType: "application/pdf", base64: PDF, dedupeKey: "wa:MEDIA1" };
  const saved = await saveClientFile(report, cfg, opts);
  assert.equal(saved.created, true);
  assert.equal(h.file(saved.id).parent, folder.id);
  const dupe = await saveClientFile(report, cfg, opts);
  assert.deepEqual([dupe.id, dupe.created], [saved.id, false]);
  const replaced = await saveClientFile({ ...report, replace: true }, cfg, opts);
  assert.notEqual(replaced.id, saved.id);
  assert.equal(h.file(saved.id).trashed, true);

  assert.equal(h.foldersIn(ROOT).length, 1, "one folder for everything about her");
  assert.equal(await readNotesDoc({ name: "Asha", phone: "9123456789" }, cfg, opts), null);
  assert.equal(h.lock.held, false);
});
