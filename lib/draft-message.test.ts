import test from "node:test";
import assert from "node:assert/strict";
import { draftMessage, draftWaLink, segmentOf, firstName, GUIDE_URL } from "./draft-message.ts";

test("a woman on medication who is still stuck is not told her labs are normal", () => {
  const msg = draftMessage({
    name: "Kantimati Iyer",
    diagnosis: "I've been diagnosed with hypothyroidism and still can't lose weight",
    medication: "I am on thyroid medication but still struggling with weight",
    challenge: "Hair fall, Mood swings",
    duration: "6 months to 1 year",
    tried: "Dieting / calorie cutting, Nutritionists / diet plans",
  });
  assert.match(msg, /^Hi Kantimati/);
  assert.match(msg, /hair fall and mood swings/);
  assert.match(msg, /does not touch the thing/);
  // Her struggle is months old — "for years" would be a lie she would notice.
  assert.doesNotMatch(msg, /for years/);
});

test("no price and no payment link — the guide is the only URL offered", () => {
  const msg = draftMessage({
    name: "Meena",
    diagnosis: "hypothyroidism",
    challenge: "Severe bloating",
    tried: "Gym / personal trainer",
  });
  assert.doesNotMatch(msg, /299|2,000|₹|cashfree|book your|slot|refund/i);
  assert.ok(msg.includes(GUIDE_URL));
  // Exactly one link: a second URL splits the tap and halves the click-through.
  assert.equal((msg.match(/https?:\/\//g) ?? []).length, 1);
});

test("the loop stays open — the message names 3 reasons and explains none", () => {
  const msg = draftMessage({
    name: "Pinky",
    diagnosis: "My TSH is in the normal range but my body feels anything but normal",
    challenge: "Brain fog",
  });
  assert.match(msg, /3 reasons/);
  assert.match(msg, /Which one sounds like you\?$/);
  // Curiosity dies the moment the mechanism is given away in the message.
  assert.doesNotMatch(msg, /cortisol|metabolism|T3|T4/i);
});

test("it stays short enough to read without scrolling on a phone", () => {
  const msg = draftMessage({
    name: "Divya",
    diagnosis: "hypothyroidism",
    medication: "on medication but still struggling",
    challenge: "Hair fall, Mood swings",
    tried: "Dieting / calorie cutting, Nutritionists / diet plans",
  });
  assert.ok(msg.length < 520, `too long: ${msg.length} chars`);
});

test("normal labs gets the hook that a normal report is not a normal body", () => {
  const msg = draftMessage({
    name: "sayali",
    diagnosis: "My TSH is in the normal range but my body feels anything but normal",
    challenge: "Brain fog",
    duration: "3 to 5 years",
  });
  assert.match(msg, /A normal report does not mean a normal body/);
});

test("Hashimoto's is detected ahead of a hypothyroid mention and asks about TPO", () => {
  const lead = {
    name: "Ganga",
    diagnosis: "I have Hashimoto's and every diet backfires or plateaus",
    medication: "I am on thyroid medication but still struggling with weight",
  };
  assert.equal(segmentOf(lead), "hashimotos");
  assert.match(draftMessage(lead), /every plan backfires/);
});

test("an undiagnosed woman is never told her medication is working", () => {
  const msg = draftMessage({
    name: "Pinky",
    diagnosis: "No diagnosis yet but something feels deeply wrong with my metabolism",
    challenge: "Clothes not fitting",
  });
  assert.match(msg, /long before a report ever goes abnormal/);
});

test("'Nothing structured yet' is dropped, since it is not something she tried", () => {
  // No symptoms on this row, so "tried before" is what the opener leans on.
  const msg = draftMessage({
    name: "Parul",
    tried: "Gym / personal trainer, Dieting / calorie cutting, Nothing structured yet",
  });
  assert.doesNotMatch(msg, /nothing structured/i);
  assert.match(msg, /gym/);
});

test("symptoms outrank what she tried — only one detail is quoted back", () => {
  const msg = draftMessage({
    name: "Parul",
    challenge: "Bloating / puffiness, Clothes not fitting",
    tried: "Gym / personal trainer, Dieting / calorie cutting",
  });
  assert.match(msg, /the bloating and puffiness stood out/);
  assert.doesNotMatch(msg, /gym/i);
});

test("a row with no quiz answers still produces a sendable message", () => {
  const msg = draftMessage({ name: "" });
  assert.match(msg, /^Hi there/);
  assert.ok(msg.includes(GUIDE_URL));
});

test("wa link normalises a 10-digit Indian number and encodes the body", () => {
  const link = draftWaLink("9820652734", "Hi Kantimati — quick one");
  assert.match(link, /^https:\/\/wa\.me\/919820652734\?text=/);
  assert.ok(link.includes(encodeURIComponent("—")));
});

test("the message body is emoji-free — the wa.me pipeline corrupts symbols", () => {
  const msg = draftMessage({
    name: "Divya",
    diagnosis: "hypothyroidism",
    medication: "on medication but still struggling",
    challenge: "Hair fall",
    duration: "1 to 3 years",
    tried: "Dieting",
  });
  // Everything outside ASCII must be the em-dash, the one symbol proven safe.
  assert.equal(msg.replace(/—/g, "").split("").every((ch) => ch.charCodeAt(0) < 128), true);
});

test("an unusable phone yields no link rather than a broken one", () => {
  assert.equal(draftWaLink("12345", "hi"), "");
});

test("firstName capitalises the lowercase names the form collects", () => {
  assert.equal(firstName("sayali"), "Sayali");
  assert.equal(firstName("Kavya ravi"), "Kavya");
});
