import test from "node:test";
import assert from "node:assert/strict";
import {
  POST_CALL_KINDS, rowTools, reportChip, canSaveToDrive,
  summaryFromReply, afterSend, missingLabels, summaryShareText, summaryWaLink, istClock,
  isAppsScriptExecUrl, appsScriptUrlProblem, newBridgeSecret, connectHint, OLD_SCRIPT_HINT,
  showConnectCard, type SummaryReady, type DriveStatus,
} from "./admin-actions.ts";
import { ACTION_LABEL, type ActionKind } from "./journey.ts";
import { BridgeError, bridgeHint } from "./drive.ts";

const NOW = "2026-11-10T08:37:00.000Z"; // 14:07 IST

// ── Which buttons a row shows ───────────────────────────────────────────────

test("a call row gets Notes, Summary and Drive, and always says whether a report is in", () => {
  assert.deepEqual(rowTools({ type: "call" }), { notes: true, summary: true, drive: true, report: "always" });
});

test("Summary appears on exactly the queue rows whose call has happened", () => {
  const allKinds = Object.keys(ACTION_LABEL) as ActionKind[];
  const withSummary = allKinds.filter((kind) => rowTools({ type: "queue", kind }).summary).sort();
  assert.deepEqual(withSummary, ["agreed_unpaid", "follow_up", "mark_call", "send_price"]);
  // Before a call there is nothing to summarise.
  for (const kind of ["first_message", "hot_abandon", "paid_not_booked", "rebook_cancelled", "rebook_no_show"] as const) {
    assert.equal(rowTools({ type: "queue", kind }).summary, false, kind);
  }
});

test("every post-call kind is a real kind in lib/journey, so a rename cannot drop the button unnoticed", () => {
  for (const kind of POST_CALL_KINDS) assert.ok(kind in ACTION_LABEL, kind);
});

test("a queue row keeps Notes, never gets Drive, and shows the report chip only when there is one", () => {
  const t = rowTools({ type: "queue", kind: "follow_up" });
  assert.equal(t.notes, true);
  assert.equal(t.drive, false);
  assert.equal(t.report, "when_saved");
  // A kind this module has never heard of gets the safe set, not a crash.
  assert.deepEqual(rowTools({ type: "queue", kind: "something_new" }), { notes: true, summary: false, drive: false, report: "when_saved" });
});

test("the report chip links the newest report and counts the rest", () => {
  assert.deepEqual(reportChip(null), { url: "", label: "No report yet", note: "" });
  assert.deepEqual(reportChip(undefined), { url: "", label: "No report yet", note: "" });
  assert.deepEqual(reportChip({ url: "", count: 2 }), { url: "", label: "No report yet", note: "" });
  assert.deepEqual(reportChip({ url: "https://drive.google.com/file/d/x/view", count: 1 }),
    { url: "https://drive.google.com/file/d/x/view", label: "Report in Drive", note: "" });
  assert.equal(reportChip({ url: "https://drive.google.com/file/d/x/view", count: 3 })?.note, "3 saved");
});

test("a queue row shows the chip only when there is a report, a call row always", () => {
  const queue = rowTools({ type: "queue", kind: "follow_up" }).report;
  const call = rowTools({ type: "call" }).report;
  assert.equal(reportChip(null, queue), null);
  assert.equal(reportChip({ url: "https://drive.google.com/file/d/x/view", count: 1 }, queue)?.label, "Report in Drive");
  assert.equal(reportChip(null, call)?.label, "No report yet");
});

test("only her own images and documents can be saved to Drive", () => {
  assert.equal(canSaveToDrive({ direction: "in", mediaId: "123456", mediaType: "image" }), true);
  assert.equal(canSaveToDrive({ direction: "in", mediaId: "123456", mediaType: "document" }), true);
  for (const mediaType of ["audio", "video", "sticker", ""]) {
    assert.equal(canSaveToDrive({ direction: "in", mediaId: "123456", mediaType }), false, mediaType);
  }
  assert.equal(canSaveToDrive({ direction: "out", mediaId: "123456", mediaType: "document" }), false);
  assert.equal(canSaveToDrive({ direction: "in", mediaId: "", mediaType: "image" }), false);
});

// ── The summary, from tap to sent ───────────────────────────────────────────

const ok = {
  pdfUrl: "https://drive.google.com/file/d/pdf/view", fileId: "pdf", notesUrl: "https://docs.google.com/document/d/n/edit",
  warnings: ["No proof card named, so the first one is used."], windowOpen: true, windowMinutesLeft: 300,
};

test("a 200 with a PDF is ready, and keeps the window the server measured", () => {
  const v = summaryFromReply(200, ok, NOW);
  assert.equal(v.phase, "ready");
  if (v.phase !== "ready") return;
  assert.equal(v.pdfUrl, ok.pdfUrl);
  assert.equal(v.notesUrl, ok.notesUrl);
  assert.equal(v.windowOpen, true);
  assert.deepEqual(v.warnings, ok.warnings);
  assert.equal(v.sentAt, "");
  const shut = summaryFromReply(200, { ...ok, windowOpen: false }, NOW) as SummaryReady;
  assert.equal(shut.phase, "ready");
  assert.equal(shut.windowOpen, false);
  // Anything but a literal true is a shut window: a missing field must not
  // offer a send that WhatsApp will refuse.
  const unsaid = summaryFromReply(200, { pdfUrl: ok.pdfUrl }, NOW) as SummaryReady;
  assert.equal(unsaid.phase, "ready");
  assert.equal(unsaid.windowOpen, false);
});

test("a 200 with nothing to open is a failure, not a ready row with a dead link", () => {
  const v = summaryFromReply(200, { windowOpen: true }, NOW);
  assert.equal(v.phase, "error");
});

test("incomplete notes name the headings he sees in his Doc, whichever form the route used", () => {
  const v = summaryFromReply(422, {
    error: "notes_incomplete", missing: ["words", "Blockers", "symptoms", "words"],
    notesUrl: "https://docs.google.com/document/d/n/edit", hint: "Fill in the notes first.",
  }, NOW);
  assert.equal(v.phase, "fill_notes");
  if (v.phase !== "fill_notes") return;
  assert.deepEqual(v.missing, ["Her words", "Blockers", "Symptoms matched to her report"]);
  assert.equal(v.notesUrl, "https://docs.google.com/document/d/n/edit");
});

test("no notes Doc at all says to press Notes, even when the route sent no hint", () => {
  const v = summaryFromReply(422, { error: "doc_not_found", missing: [] }, NOW);
  assert.equal(v.phase, "fill_notes");
  if (v.phase !== "fill_notes") return;
  assert.deepEqual(v.missing, []);
  assert.match(v.hint, /Press Notes first/);
});

test("missing labels never resolve a key through Object's prototype", () => {
  assert.deepEqual(missingLabels(["constructor", "toString", ""]), ["constructor", "toString"]);
});

test("every other failure carries the route's hint, and survives a body that is not JSON", () => {
  const busy = summaryFromReply(429, { error: "renderer_busy", hint: "The PDF maker is busy. Press Summary again in a minute." }, NOW);
  assert.deepEqual(busy, { phase: "error", code: "renderer_busy", hint: "The PDF maker is busy. Press Summary again in a minute." });
  const html = summaryFromReply(502, null, NOW);
  assert.equal(html.phase, "error");
  if (html.phase === "error") assert.match(html.hint, /HTTP 502/);
});

const ready = summaryFromReply(200, ok, NOW) as SummaryReady;

test("a send that went out stamps the time, and the row keeps its PDF", () => {
  const v = afterSend(ready, 200, { ...ok, sent: true }, NOW);
  assert.equal(v.sentAt, NOW);
  assert.equal(v.pdfUrl, ok.pdfUrl);
  assert.equal(v.sendError, "");
  // A server that answers with its own timestamp is believed.
  assert.equal(afterSend(ready, 200, { ...ok, sent: "2026-11-10T08:40:00.000Z" }, NOW).sentAt, "2026-11-10T08:40:00.000Z");
});

test("a shut window swaps Send for the phone fallback, with the server's words for it", () => {
  const v = afterSend(ready, 409, { error: "window_closed", waText: "Hi Meera, your summary is attached.", hint: "Her window has shut." }, NOW);
  assert.equal(v.windowOpen, false);
  assert.equal(v.waText, "Hi Meera, your summary is attached.");
  assert.equal(v.pdfUrl, ok.pdfUrl, "the PDF is still there to open");
  assert.equal(v.sentAt, "");
});

test("a failed send keeps the ready row and adds the hint under it", () => {
  const v = afterSend(ready, 502, { error: "send_failed", hint: "WhatsApp refused the file." }, NOW);
  assert.equal(v.pdfUrl, ok.pdfUrl);
  assert.equal(v.windowOpen, true);
  assert.equal(v.sendError, "WhatsApp refused the file.");
});

test("a 200 that sent nothing is not shown as sent", () => {
  const v = afterSend(ready, 200, { ...ok, sent: false }, NOW);
  assert.equal(v.sentAt, "");
  assert.equal(v.windowOpen, false, "offers the phone instead");
  assert.ok(v.sendError);
});

test("the wa.me fallback opens her chat with a short note about the PDF", () => {
  const link = summaryWaLink("98765 43210", "meera kulkarni");
  assert.ok(link.startsWith("https://wa.me/919876543210?text="), link);
  const text = decodeURIComponent(link.split("?text=")[1]);
  assert.equal(text, summaryShareText("meera kulkarni"));
  assert.match(text, /^Hi Meera,/);
  assert.match(text, /PDF/);
});

test("the server's own words win over the default, and a row with no number gets no link", () => {
  const link = summaryWaLink("919876543210", "Meera", "Hi Meera, attaching your summary.");
  assert.equal(decodeURIComponent(link.split("?text=")[1]), "Hi Meera, attaching your summary.");
  assert.equal(summaryWaLink("", "Meera"), "");
  assert.equal(summaryWaLink("12345", "Meera"), "");
  // No name on the booking: no invented one either.
  assert.match(summaryShareText(""), /^Hi there,/);
});

test("Sent times read on the coach's clock", () => {
  assert.equal(istClock(NOW), "14:07");
  assert.equal(istClock("2026-11-10T20:00:00Z"), "01:30");
  assert.equal(istClock("not a time"), "");
});

// ── Connect Google Drive ────────────────────────────────────────────────────

const GOOD_URL = "https://script.google.com/macros/s/AKfycbx-1_ZqA9/exec";

test("the Web app URL is accepted, with the whitespace a paste brings along", () => {
  assert.equal(isAppsScriptExecUrl(GOOD_URL), true);
  assert.equal(isAppsScriptExecUrl(`  ${GOOD_URL}\n`), true);
  assert.equal(appsScriptUrlProblem(` ${GOOD_URL} `), null);
});

test("anything that is not exactly a Web app URL is refused", () => {
  for (const bad of [
    "http://script.google.com/macros/s/AKfycbx/exec",
    "https://script.google.com/macros/s/AKfycbx/exec/",
    "https://script.google.com/macros/s/AKfycbx/exec?x=1",
    "https://script.google.com.evil.example/macros/s/AKfycbx/exec",
    "https://evil.example/https://script.google.com/macros/s/AKfycbx/exec",
    "https://script.google.com/macros/s/AK fy/exec",
    "https://script.google.com/a/macros/example.com/s/AKfycbx/exec",
    "",
  ]) {
    assert.equal(isAppsScriptExecUrl(bad), false, bad);
    assert.ok(appsScriptUrlProblem(bad), bad);
  }
});

test("the two likely phone mistakes get their own answer", () => {
  assert.match(appsScriptUrlProblem("https://script.google.com/macros/s/AKfycbx/dev") ?? "", /test URL/);
  assert.match(appsScriptUrlProblem("https://script.google.com/home/projects/1abc/edit") ?? "", /editor/);
  assert.match(appsScriptUrlProblem("https://script.google.com/d/1abc/edit") ?? "", /editor/);
  assert.match(appsScriptUrlProblem("") ?? "", /Paste/);
});

test("the pairing secret is 32 random bytes as 64 hex characters", () => {
  const a = newBridgeSecret();
  const b = newBridgeSecret();
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.match(b, /^[0-9a-f]{64}$/);
  assert.notEqual(a, b);
  // Every byte is two characters, zero-padded, in order.
  const fixed = newBridgeSecret((bytes) => bytes.forEach((_, i) => { bytes[i] = i * 8; }));
  assert.equal(fixed.length, 64);
  assert.equal(fixed.slice(0, 8), "00081018");
  assert.equal(fixed.slice(-2), "f8");
});

test("an old script's refusal during pairing says to update the script, not to connect again", () => {
  for (const code of ["unauthorized", "script_not_configured", "unknown_action"]) {
    assert.equal(connectHint(new BridgeError(code)), OLD_SCRIPT_HINT, code);
  }
  // Everything else is bridgeHint's, word for word.
  for (const code of ["already_paired", "folder_not_found", "not_json", "timeout"]) {
    assert.equal(connectHint(new BridgeError(code)), bridgeHint(new BridgeError(code)), code);
  }
});

const status = (over: Partial<DriveStatus>): DriveStatus => ({ connected: true, source: "stored", folderConfigured: true, version: "v2", ...over });

test("the card shows while Drive is not connected, and never on an unknown status", () => {
  assert.equal(showConnectCard(status({ connected: false, source: "none" }), ""), true);
  assert.equal(showConnectCard(status({}), ""), false);
  assert.equal(showConnectCard(null, "unauthorized"), false);
});

test("a stored pairing the script now refuses brings the card back", () => {
  for (const code of ["unauthorized", "script_not_configured", "not_json"]) {
    assert.equal(showConnectCard(status({}), code), true, code);
  }
  assert.equal(showConnectCard(status({}), "timeout"), false);
  // The env set-up is changed on the worker, not from the card.
  assert.equal(showConnectCard(status({ source: "env" }), "unauthorized"), false);
});

test("copy he reads has no exclamation marks and no em dashes", () => {
  const copy = [
    summaryShareText("Meera"), summaryShareText(""), OLD_SCRIPT_HINT,
    appsScriptUrlProblem(""), appsScriptUrlProblem("x"),
    appsScriptUrlProblem("https://script.google.com/macros/s/A/dev"),
    appsScriptUrlProblem("https://script.google.com/d/1/edit"),
    reportChip(null)?.label, reportChip({ url: "u", count: 2 })?.label, reportChip({ url: "u", count: 2 })?.note,
    (summaryFromReply(200, {}, NOW) as { hint: string }).hint,
    (summaryFromReply(422, { error: "doc_not_found" }, NOW) as { hint: string }).hint,
    (summaryFromReply(500, {}, NOW) as { hint: string }).hint,
    afterSend(ready, 200, { ...ok, sent: false }, NOW).sendError,
  ];
  for (const s of copy) {
    assert.ok(s, "every message has words");
    assert.doesNotMatch(String(s), /[!—]/, String(s));
  }
});
