import test from "node:test";
import assert from "node:assert/strict";
import { draftMessage, draftWaLink, segmentOf, firstName } from "./draft-message";

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
  assert.match(msg, /doing its job on paper/);
  // Her struggle is months old — "for years" would be a lie she would notice.
  assert.doesNotMatch(msg, /for years/);
});

test("no price, no link, no booking ask anywhere in a first message", () => {
  const msg = draftMessage({
    name: "Meena",
    diagnosis: "hypothyroidism",
    challenge: "Severe bloating",
    tried: "Gym / personal trainer",
  });
  assert.doesNotMatch(msg, /299|2,000|₹|http|book|slot|pay/i);
});

test("normal labs gets the reframe that a number can be fine while she is not", () => {
  const msg = draftMessage({
    name: "sayali",
    diagnosis: "My TSH is in the normal range but my body feels anything but normal",
    challenge: "Brain fog",
    duration: "3 to 5 years",
  });
  assert.match(msg, /normal range only tells us/);
  assert.match(msg, /for a few years now/);
});

test("Hashimoto's is detected ahead of a hypothyroid mention and asks about TPO", () => {
  const lead = {
    name: "Ganga",
    diagnosis: "I have Hashimoto's and every diet backfires or plateaus",
    medication: "I am on thyroid medication but still struggling with weight",
  };
  assert.equal(segmentOf(lead), "hashimotos");
  assert.match(draftMessage(lead), /TPO antibody/);
});

test("an undiagnosed woman is never told her medication is working", () => {
  const msg = draftMessage({
    name: "Pinky",
    diagnosis: "No diagnosis yet but something feels deeply wrong with my metabolism",
    challenge: "Clothes not fitting",
  });
  assert.match(msg, /before a report goes abnormal/);
  assert.match(msg, /even an old one/);
});

test("'Nothing structured yet' is dropped, since it is not something she tried", () => {
  const msg = draftMessage({
    name: "Parul",
    challenge: "Bloating / puffiness, Clothes not fitting",
    tried: "Gym / personal trainer, Dieting / calorie cutting, Nothing structured yet",
  });
  assert.doesNotMatch(msg, /nothing structured/i);
  assert.match(msg, /gym/);
});

test("a row with no quiz answers still produces a sendable message", () => {
  const msg = draftMessage({ name: "" });
  assert.match(msg, /^Hi there/);
  assert.ok(msg.split("\n\n").length === 4);
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
