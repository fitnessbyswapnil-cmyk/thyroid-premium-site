import test from "node:test";
import assert from "node:assert/strict";
import { routeReply, normalise, RULES, FALLBACK_REPLY, QUIZ_URL, CONSULT_PRICE } from "./wa-autoreply.ts";
import { GUIDE_URL } from "./draft-message.ts";

test("normalise lowercases, strips punctuation and collapses whitespace", () => {
  assert.equal(normalise("How   MUCH?!!"), "how much");
});

test("normalise strips emoji rather than leaving stray bytes behind", () => {
  assert.equal(normalise("price 💰 please"), "price please");
});

test("a Hinglish price question gets the price and the refund promise", () => {
  const r = routeReply("kitna charge hai?");
  assert.equal(r.intent, "price");
  assert.match(r.reply, new RegExp(`Rs ${CONSULT_PRICE}`));
  assert.match(r.reply, /back/i);
});

test("English price wording routes to the same intent", () => {
  assert.equal(routeReply("What is the cost of the call").intent, "price");
});

test("a scheduling question sends her to the quiz, which opens booking", () => {
  const r = routeReply("how do I book a slot");
  assert.equal(r.intent, "booking");
  assert.ok(r.reply.includes(QUIZ_URL));
});

test("asking for the pdf returns the guide link", () => {
  const r = routeReply("please send the pdf");
  assert.equal(r.intent, "guide");
  assert.ok(r.reply.includes(GUIDE_URL));
});

test("a woman on medication is reassured, never told to stop taking it", () => {
  const r = routeReply("I am already taking thyronorm daily");
  assert.equal(r.intent, "medication");
  assert.match(r.reply, /alongside your medication/);
  // Health-policy guardrail — this line must never appear in any form.
  assert.doesNotMatch(r.reply.toLowerCase(), /stop (taking|your) (it|medicine|tablet)/);
  assert.doesNotMatch(r.reply.toLowerCase(), /without medicine/);
});

test("scepticism is answered with named results and a variance note", () => {
  const r = routeReply("is this genuine or scam");
  assert.equal(r.intent, "results");
  assert.match(r.reply, /Heenal/);
  assert.match(r.reply, /Individual results vary/);
});

test("diet and workout questions share one intent", () => {
  assert.equal(routeReply("what diet plan do you give").intent, "diet");
  assert.equal(routeReply("koi workout batao").intent, "diet");
});

test("opt-out is honoured and marked terminal", () => {
  const r = routeReply("STOP");
  assert.equal(r.intent, "optout");
  assert.equal(r.terminal, true);
});

test("a request for a human hands off and silences the bot", () => {
  const r = routeReply("I want to talk to swapnil");
  assert.equal(r.intent, "handoff");
  assert.equal(r.terminal, true);
});

test("opt-out wins even when the message also mentions price", () => {
  assert.equal(routeReply("stop sending me price messages").intent, "optout");
});

test("ordinary intents are never terminal", () => {
  assert.equal(routeReply("kitna hai").terminal, false);
  assert.equal(routeReply("hello").terminal, false);
});

test("an unmatched message gets the fallback hook, never silence", () => {
  const r = routeReply("hi");
  assert.equal(r.intent, "greeting");
  assert.equal(r.reply, FALLBACK_REPLY);
});

test("empty and whitespace input still fall back safely", () => {
  assert.equal(routeReply("").intent, "greeting");
  assert.equal(routeReply("   ").intent, "greeting");
});

test("the fallback leads with the blocker hook and the guide", () => {
  assert.ok(FALLBACK_REPLY.includes(GUIDE_URL));
  assert.match(FALLBACK_REPLY.toLowerCase(), /blocker/);
});

test("every reply is ASCII — this pipeline has mangled non-ASCII before", () => {
  for (const reply of [...RULES.map((r) => r.reply), FALLBACK_REPLY]) {
    // eslint-disable-next-line no-control-regex
    assert.match(reply, /^[\x00-\x7F]*$/, `non-ASCII in: ${reply.slice(0, 40)}`);
  }
});

test("no reply promises a guaranteed weight-loss number", () => {
  for (const reply of [...RULES.map((r) => r.reply), FALLBACK_REPLY]) {
    assert.doesNotMatch(reply.toLowerCase(), /guaranteed \d+ ?kg/);
  }
});

test("every reply stays short enough to read on a phone", () => {
  for (const reply of [...RULES.map((r) => r.reply), FALLBACK_REPLY]) {
    assert.ok(reply.length < 700, `too long: ${reply.slice(0, 40)}`);
  }
});

test("intents are unique — a duplicate would be unreachable", () => {
  const intents = RULES.map((r) => r.intent);
  assert.equal(new Set(intents).size, intents.length);
});
