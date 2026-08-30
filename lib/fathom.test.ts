import { test } from "node:test";
import assert from "node:assert/strict";
import crypto from "node:crypto";
import {
  verifyFathomSignature,
  pick,
  collectEmails,
  normaliseTranscript,
  normaliseMeeting,
  matchBooking,
  type BookingCandidate,
} from "./fathom.ts";

const SECRET = "whsec_test_123";
const sign = (id: string, ts: string, body: string) =>
  crypto.createHmac("sha256", SECRET).update(`${id}.${ts}.${body}`, "utf8").digest("base64");

test("signature verifies over id.timestamp.rawBody", () => {
  const body = JSON.stringify({ a: 1 });
  const sig = sign("msg_1", "1788000000", body);
  assert.equal(
    verifyFathomSignature(body, { id: "msg_1", timestamp: "1788000000", signature: sig }, SECRET),
    "valid",
  );
});

test("a tampered body fails, and the raw bytes matter", () => {
  const body = JSON.stringify({ a: 1 });
  const sig = sign("msg_1", "1788000000", body);
  // Re-serialised JSON changes whitespace/key order → different HMAC. This is
  // why the route must sign req.text(), never JSON.stringify(JSON.parse(body)).
  const reserialised = JSON.stringify(JSON.parse(body) as object, null, 2);
  assert.equal(
    verifyFathomSignature(reserialised, { id: "msg_1", timestamp: "1788000000", signature: sig }, SECRET),
    "mismatch",
  );
});

test("versioned 'v1,<sig>' entries are accepted, and any one may match", () => {
  const body = "{}";
  const good = sign("m", "1", body);
  const header = `v1,${crypto.randomBytes(32).toString("base64")} v1,${good}`;
  assert.equal(verifyFathomSignature(body, { id: "m", timestamp: "1", signature: header }, SECRET), "valid");
});

test("missing headers are a mismatch; missing secret is unconfigured", () => {
  assert.equal(verifyFathomSignature("{}", { id: "", timestamp: "", signature: "" }, SECRET), "mismatch");
  assert.equal(verifyFathomSignature("{}", { id: "a", timestamp: "1", signature: "x" }, undefined), "unconfigured");
});

test("a wrong-length signature does not throw (timingSafeEqual would)", () => {
  assert.equal(verifyFathomSignature("{}", { id: "m", timestamp: "1", signature: "short" }, SECRET), "mismatch");
});

test("pick walks dotted paths and falls through empties", () => {
  const o = { a: { b: "" }, c: { d: "found" }, n: 42 };
  assert.equal(pick(o, ["a.b", "c.d"]), "found");
  assert.equal(pick(o, ["n"]), "42");
  assert.equal(pick(o, ["missing.path"]), "");
});

test("collectEmails finds addresses at any depth, deduped and lowercased", () => {
  const payload = {
    invitees: [{ email: "Heena@Example.com" }, { email: "coach@site.in" }],
    nested: { deep: { note: "cc Heena@example.com again" } },
  };
  const found = collectEmails(payload).sort();
  assert.deepEqual(found, ["coach@site.in", "heena@example.com"]);
});

test("transcripts normalise from plain text and from segment objects", () => {
  assert.equal(normaliseTranscript("  hello  "), "hello");

  const segs = [
    { speaker: "Swapnil", text: "So the investment is 30,000.", timestamp: "1:11:02" },
    { speaker_name: "Heena", transcript: "Okay." },
    { text: "no speaker line" },
  ];
  const out = normaliseTranscript(segs);
  assert.match(out, /\[1:11:02\] Swapnil: So the investment is 30,000\./);
  assert.match(out, /Heena: Okay\./);
  assert.match(out, /^no speaker line$/m);
});

test("normaliseMeeting tolerates different envelope shapes", () => {
  const a = normaliseMeeting({ meeting: { recording_id: "r1", title: "Call", started_at: "2026-08-30T10:00:00Z" } });
  assert.equal(a.recordingId, "r1");
  assert.equal(a.title, "Call");

  const b = normaliseMeeting({ data: { id: "r2", topic: "Strategy", start_time: "2026-08-30T11:00:00Z" } });
  assert.equal(b.recordingId, "r2");
  assert.equal(b.title, "Strategy");
});

const bookings: BookingCandidate[] = [
  { uid: "u_heena", email: "heena@example.com", name: "Heena", startIso: "2026-08-30T16:30:00Z" },
  { uid: "u_other", email: "other@example.com", name: "Other", startIso: "2026-08-30T16:35:00Z" },
];

test("email match beats time proximity", () => {
  // The other booking starts closer to the recording, but the email is decisive.
  const m = { emails: ["heena@example.com"], startedAt: "2026-08-30T16:34:00Z" };
  assert.equal(matchBooking(m, bookings)?.uid, "u_heena");
});

test("with no email, the nearest booking inside the window wins", () => {
  const m = { emails: [], startedAt: "2026-08-30T16:36:00Z" };
  assert.equal(matchBooking(m, bookings)?.uid, "u_other");
});

test("nothing matches outside the window rather than guessing wildly", () => {
  const m = { emails: [], startedAt: "2026-09-05T16:30:00Z" };
  assert.equal(matchBooking(m, bookings), null);
});

test("an unparseable recording time with no email match yields null", () => {
  assert.equal(matchBooking({ emails: [], startedAt: "not-a-date" }, bookings), null);
});
