/**
 * lib/precall-extract.ts — "Read her report". Every test here stands in for
 * D1, WhatsApp and Claude, so nothing touches the network. They hold: no key
 * means nothing else is even tried, a photo goes as an image and a PDF as a
 * document, only what the report printed comes back (and only what the PDF can
 * use), an unreadable report is an empty list, and the key never leaks.
 */
import test from "node:test";
import assert from "node:assert/strict";
import {
  MAX_IMAGE_BYTES,
  REPORT_MODEL,
  extractPrecallMarkers,
  readerParams,
  reportBlock,
  rowsFromRead,
  type ExtractDeps,
  type ReaderClient,
  type ReportRead,
} from "./precall-extract.ts";
import type { MediaDownload } from "./wa-media.ts";

const KEY = "sk-ant-test-0000-NEVER-PRINT-ME";
const PHONE = "+91 98765 43210";
const JPEG = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3, 4]);
const PDF = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 1, 2, 3]);
const REPORT = { mediaId: "880011223344", url: "https://drive.google.com/file/d/R1/view", savedAt: 1, count: 1 };

const READ: ReportRead = {
  document: "blood_report",
  results: [
    { marker: "TSH", value: "5.8", unit: "µIU/mL", range: "0.4-4.0", flag: "H" },
    { marker: "Free T3", value: "2.1 pg/mL", unit: "pg/mL", range: "2.0 - 4.4", flag: "" },
    { marker: "Vitamin D, 25-Hydroxy", value: "14", unit: "ng/mL", range: "30-100", flag: "L" },
    { marker: "Creatinine", value: "0.8", unit: "mg/dL", range: "0.6-1.1", flag: "" },
    { marker: "Uric Acid", value: "6.4", unit: "mg/dL", range: "2.4-5.7", flag: "H" },
    { marker: "TSH", value: "5.8", unit: "µIU/mL", range: "0.4-4.0", flag: "H" },
    { marker: "Ferritin", value: "", unit: "ng/mL", range: "30-200", flag: "" },
  ],
};

type Captured = { params: ReturnType<typeof readerParams> | null; calls: string[] };

/** A stand-in for the SDK client: records what it was sent and answers as told. */
function fakeClient(answer: { parsed_output?: unknown; stop_reason?: string | null; model?: string } | Error, cap: Captured): ReaderClient {
  return {
    beta: {
      messages: {
        async parse(params) {
          cap.calls.push("parse");
          cap.params = params;
          if (answer instanceof Error) throw answer;
          return { parsed_output: answer.parsed_output ?? null, stop_reason: answer.stop_reason ?? "end_turn", model: answer.model ?? REPORT_MODEL };
        },
      },
    },
  };
}

function deps(o: {
  key?: string | undefined;
  report?: typeof REPORT | null | Error;
  download?: MediaDownload;
  token?: string | undefined;
  answer?: Parameters<typeof fakeClient>[0];
} = {}): { deps: Partial<ExtractDeps>; cap: Captured } {
  const cap: Captured = { params: null, calls: [] };
  return {
    cap,
    deps: {
      apiKey: () => ("key" in o ? o.key : KEY),
      newest: async () => {
        cap.calls.push("newest");
        if (o.report instanceof Error) throw o.report;
        return o.report === undefined ? REPORT : o.report;
      },
      token: () => ("token" in o ? o.token : "EAA-token"),
      download: async () => {
        cap.calls.push("download");
        return o.download ?? { ok: true, bytes: JPEG, mimeType: "image/jpeg" };
      },
      client: async (apiKey) => {
        cap.calls.push(`client:${apiKey === KEY ? "key" : "other"}`);
        return fakeClient(o.answer ?? { parsed_output: READ }, cap);
      },
    },
  };
}

// ── The key ──────────────────────────────────────────────────────────────────

test("no AI key: 412 no_ai_key, and nothing else is even tried", async () => {
  for (const key of [undefined, ""]) {
    const { deps: d, cap } = deps({ key });
    const out = await extractPrecallMarkers({ phone: PHONE }, d);
    assert.equal(out.status, 412);
    assert.deepEqual(out.body, { error: "no_ai_key", hint: "Add the AI key" });
    assert.deepEqual(cap.calls, [], "no D1 read, no download, no client");
  }
});

test("a bad phone is refused before the key is looked at", async () => {
  const { deps: d, cap } = deps();
  const out = await extractPrecallMarkers({ phone: "12345" }, d);
  assert.equal(out.status, 400);
  assert.equal(out.body.error, "need_phone");
  assert.deepEqual(cap.calls, []);
});

// ── Structured parse ─────────────────────────────────────────────────────────

test("a photo: read into rows exactly as printed, kept only when the PDF can use them, once each", async () => {
  const { deps: d, cap } = deps();
  const out = await extractPrecallMarkers({ phone: PHONE }, d);
  assert.equal(out.status, 200);
  assert.deepEqual(cap.calls, ["newest", "download", "client:key", "parse"]);
  assert.deepEqual(out.body.markers, [
    { marker: "TSH", value: "5.8 µIU/mL", range: "0.4–4.0", flag: "high" },
    { marker: "Free T3", value: "2.1 pg/mL", range: "2.0–4.4", flag: "" },
    { marker: "Vitamin D, 25-Hydroxy", value: "14 ng/mL", range: "30–100", flag: "low" },
    { marker: "Uric Acid", value: "6.4 mg/dL", range: "2.4–5.7", flag: "high" },
  ]);
  assert.equal(out.body.source, "ai");
  assert.equal(out.body.model, REPORT_MODEL);
  assert.equal(out.body.reportUrl, REPORT.url);
  assert.equal(out.body.reportCount, 1);
  assert.equal(out.body.document, "blood_report");
  assert.equal(out.body.hint, "Check every value against her report before you generate.");
  assert.deepEqual(out.body.warnings, []);
});

test("rowsFromRead: an unflagged test the library does not know, a repeat, and a row with no value are all left out", () => {
  const { rows } = rowsFromRead(READ);
  const names = rows.map((r) => r.marker);
  assert.ok(!names.includes("Creatinine"), "normal and not a library marker");
  assert.equal(names.filter((n) => n === "TSH").length, 1, "printed twice, returned once");
  assert.ok(!names.includes("Ferritin"), "no value printed: nothing is filled in");
});

test("the request: claude-opus-5-5, adaptive thinking, structured output, the file before the ask", async () => {
  const { deps: d, cap } = deps();
  await extractPrecallMarkers({ phone: PHONE }, d);
  const p = cap.params;
  assert.ok(p);
  assert.equal(p.model, "claude-opus-5-5");
  assert.deepEqual(p.thinking, { type: "adaptive" });
  assert.equal(p.output_config.effort, "medium");
  assert.equal(p.output_config.format.type, "json_schema");
  assert.equal(p.fallbacks, "default");
  assert.deepEqual(p.betas, ["server-side-fallback-2026-07-01"]);
  assert.match(p.system, /Never estimate, calculate, convert units/);
  assert.match(p.system, /Never decide a flag yourself/);
  const content = p.messages[0].content;
  assert.equal(content.length, 2);
  assert.equal(content[1].type, "text");
});

// ── Image vs PDF ─────────────────────────────────────────────────────────────

test("a photo goes as an image block, a PDF as a document block, the bytes as base64", async () => {
  const photo = deps({ download: { ok: true, bytes: JPEG, mimeType: "image/jpeg" } });
  await extractPrecallMarkers({ phone: PHONE }, photo.deps);
  assert.deepEqual(photo.cap.params?.messages[0].content[0], {
    type: "image",
    source: { type: "base64", media_type: "image/jpeg", data: Buffer.from(JPEG).toString("base64") },
  });

  const pdf = deps({ download: { ok: true, bytes: PDF, mimeType: "application/pdf; charset=binary" } });
  await extractPrecallMarkers({ phone: PHONE }, pdf.deps);
  assert.deepEqual(pdf.cap.params?.messages[0].content[0], {
    type: "document",
    source: { type: "base64", media_type: "application/pdf", data: Buffer.from(PDF).toString("base64") },
  });
});

test("reportBlock: png, webp and gif are images; HEIC, Word and unknown are nothing", () => {
  for (const m of ["image/png", "image/webp", "image/gif", "IMAGE/JPEG"]) assert.equal(reportBlock({ bytes: JPEG, mimeType: m })?.type, "image", m);
  for (const m of ["image/heic", "application/msword", "text/plain", ""]) assert.equal(reportBlock({ bytes: JPEG, mimeType: m }), null, m);
});

test("a file the reader cannot open is 415 with the Drive link, and Claude is never called", async () => {
  const { deps: d, cap } = deps({ download: { ok: true, bytes: JPEG, mimeType: "image/heic" } });
  const out = await extractPrecallMarkers({ phone: PHONE }, d);
  assert.equal(out.status, 415);
  assert.equal(out.body.error, "unsupported_report");
  assert.match(String(out.body.hint), /an iPhone HEIC photo, which the reader cannot open/);
  assert.equal(out.body.reportUrl, REPORT.url);
  assert.ok(!cap.calls.some((c) => c.startsWith("client")));
});

test("a photo over Claude's 5 MB image limit is 413 before any call", async () => {
  const big = new Uint8Array(MAX_IMAGE_BYTES + 1);
  const { deps: d, cap } = deps({ download: { ok: true, bytes: big, mimeType: "image/jpeg" } });
  const out = await extractPrecallMarkers({ phone: PHONE }, d);
  assert.equal(out.status, 413);
  assert.ok(!cap.calls.some((c) => c.startsWith("client")));
});

// ── Empty and unreadable ─────────────────────────────────────────────────────

test("an unreadable report is an empty list and a plain sentence, never a guess", async () => {
  const cases: [ReportRead["document"], RegExp][] = [
    ["unreadable", /too blurred or cropped to read/],
    ["not_a_report", /does not look like a blood report/],
    ["blood_report", /No thyroid, vitamin, sugar or lipid values were found/],
  ];
  for (const [document, hint] of cases) {
    const { deps: d } = deps({ answer: { parsed_output: { document, results: [] } } });
    const out = await extractPrecallMarkers({ phone: PHONE }, d);
    assert.equal(out.status, 200, document);
    assert.deepEqual(out.body.markers, [], document);
    assert.match(String(out.body.hint), hint, document);
  }
});

test("no structured output, a refusal, or the SDK throwing: 502 ai_failed, the Drive link kept", async () => {
  const answers: Parameters<typeof fakeClient>[0][] = [
    { parsed_output: null, stop_reason: "max_tokens" },
    { parsed_output: { document: "blood_report" } },
    { parsed_output: null, stop_reason: "refusal" },
    new Error("socket hang up"),
  ];
  const original = console.error;
  console.error = () => {};
  try {
    for (const answer of answers) {
      const { deps: d } = deps({ answer });
      const out = await extractPrecallMarkers({ phone: PHONE }, d);
      assert.equal(out.status, 502);
      assert.equal(out.body.error, "ai_failed");
      assert.equal(out.body.reportUrl, REPORT.url);
    }
  } finally {
    console.error = original;
  }
});

test("a refused key says so, and the key itself appears nowhere: not in the reply, not in the log", async () => {
  const err = Object.assign(new Error(`401 invalid x-api-key ${KEY}`), { status: 401 });
  const { deps: d } = deps({ answer: err });
  const logged: string[] = [];
  const original = console.error;
  console.error = (...args: unknown[]) => { logged.push(args.map(String).join(" ")); };
  let out;
  try {
    out = await extractPrecallMarkers({ phone: PHONE }, d);
  } finally {
    console.error = original;
  }
  assert.equal(out.status, 502);
  assert.match(String(out.body.hint), /The AI key on the worker was refused/);
  assert.ok(!JSON.stringify(out.body).includes(KEY), "the key in the reply");
  assert.ok(!logged.join("\n").includes(KEY), "the key in the log");
  assert.ok(!logged.join("\n").includes("9876543210"), "her number in the log");
});

// ── Finding her report ───────────────────────────────────────────────────────

test("no saved report: 404 no_report, nothing downloaded", async () => {
  const { deps: d, cap } = deps({ report: null });
  const out = await extractPrecallMarkers({ phone: PHONE }, d);
  assert.equal(out.status, 404);
  assert.equal(out.body.error, "no_report");
  assert.deepEqual(cap.calls, ["newest"]);
});

test("WhatsApp no longer has the file: 404 no_report, with the Drive link to type from", async () => {
  const { deps: d, cap } = deps({ download: { ok: false, reason: "media_expired", status: 404 } });
  const out = await extractPrecallMarkers({ phone: PHONE }, d);
  assert.equal(out.status, 404);
  assert.equal(out.body.error, "no_report");
  assert.equal(out.body.reason, "media_expired");
  assert.equal(out.body.reportUrl, REPORT.url);
  assert.ok(!cap.calls.some((c) => c.startsWith("client")));
});

test("the lookup breaking is not the same as having no report", async () => {
  const { deps: d } = deps({ report: new Error("D1 unavailable") });
  const original = console.error;
  console.error = () => {};
  try {
    const out = await extractPrecallMarkers({ phone: PHONE }, d);
    assert.equal(out.status, 502);
    assert.equal(out.body.error, "report_lookup_failed");
  } finally {
    console.error = original;
  }
});

test("no WhatsApp token, or a download that fails: named, with the Drive link", async () => {
  const noToken = await extractPrecallMarkers({ phone: PHONE }, deps({ token: undefined }).deps);
  assert.equal(noToken.status, 503);
  assert.equal(noToken.body.error, "whatsapp_not_configured");
  const failed = await extractPrecallMarkers({ phone: PHONE }, deps({ download: { ok: false, reason: "media_download_failed", status: 500 } }).deps);
  assert.equal(failed.status, 502);
  assert.equal(failed.body.error, "report_fetch_failed");
  assert.match(String(failed.body.hint), /HTTP 500/);
});

test("she has several reports: the newest is read, and the card is told so", async () => {
  const { deps: d } = deps({ report: { ...REPORT, count: 3 } });
  const out = await extractPrecallMarkers({ phone: PHONE }, d);
  assert.equal(out.body.reportCount, 3);
  assert.deepEqual(out.body.warnings, ["She has 3 reports saved; this read only the newest. Check the others in her folder."]);
});
