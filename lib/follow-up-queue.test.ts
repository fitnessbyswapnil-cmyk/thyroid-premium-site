import { test } from "node:test";
import assert from "node:assert/strict";
import { buildQueue, ageTone, contacted, type QueueLead } from "./follow-up-queue.ts";

const NOW = Date.parse("2026-09-14T12:00:00Z");
const hrs = (h: number) => new Date(NOW - h * 3_600_000).toISOString();
const lead = (o: Partial<QueueLead>): QueueLead => ({
  ts: hrs(1), name: "Client", phone: "9000000001", booked: false, cancelled: false, showed: "",
  won: false, isTest: false, sessionAtMs: null, msg1: "", msg2: "", msg3: "", lastOutboundAt: "", ...o,
});

test("the 14-Sep diagnosis: an automated WhatsApp counts as contacted", () => {
  // 28 hours old, welcome + checkout template both went out — NOT waiting.
  const l = lead({ ts: hrs(28), lastOutboundAt: hrs(27.9) });
  assert.equal(contacted(l), true);
  assert.equal(buildQueue([l], NOW).length, 0);
});

test("genuinely unmessaged leads still surface", () => {
  const q = buildQueue([lead({ ts: hrs(9) })], NOW);
  assert.equal(q.length, 1);
  assert.match(q[0].label, /Waiting 9 hr — no WhatsApp has gone out/);
});

test("his own test rows never reach the queue", () => {
  assert.equal(buildQueue([lead({ ts: hrs(32), isTest: true })], NOW).length, 0);
});

test("a message sent BEFORE she became a lead does not count for this lead", () => {
  assert.equal(contacted(lead({ ts: hrs(5), lastOutboundAt: hrs(40) })), false);
});

test("oldest wait first — a 32-hour lead above a 35-minute one", () => {
  const q = buildQueue([lead({ ts: hrs(35 / 60), name: "new" }), lead({ ts: hrs(32), name: "old" }), lead({ ts: hrs(9), name: "mid" })], NOW);
  assert.deepEqual(q.map((x) => x.lead.name), ["old", "mid", "new"]);
});

test("age tones: under 1 hr neutral, 1–6 hr amber, over 6 hr red", () => {
  assert.equal(ageTone(59), "neutral");
  assert.equal(ageTone(60), "amber");
  assert.equal(ageTone(360), "amber");
  assert.equal(ageTone(361), "red");
});

test("won clients and the ticked Msg1 box keep her out", () => {
  assert.equal(buildQueue([lead({ ts: hrs(10), won: true })], NOW).length, 0);
  assert.equal(buildQueue([lead({ ts: hrs(10), msg1: "Y" })], NOW).length, 0);
});

test("a cancellation is still urgent", () => {
  const q = buildQueue([lead({ ts: hrs(2), booked: false, cancelled: true, lastOutboundAt: hrs(1) })], NOW);
  assert.equal(q[0].kind, "Rebook");
  assert.equal(q[0].urgent, true);
});
