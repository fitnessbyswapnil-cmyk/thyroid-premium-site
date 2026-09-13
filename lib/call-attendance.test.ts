import { test } from "node:test";
import assert from "node:assert/strict";
import { inferAttendance, toSeconds, MIN_CLIENT_WORDS } from "./call-attendance.ts";

const say = (n: number) => Array.from({ length: n }, (_, i) => `w${i}`).join(" ");

test("a real consultation: she talks, so she attended", () => {
  const t = [
    `[00:00:05] Swapnil Umbarkar: ${say(30)}`,
    `[00:01:10] Priya Sharma: ${say(60)}`,
    `[00:58:40] Swapnil Umbarkar: ${say(30)}`,
  ].join("\n");
  const a = inferAttendance(t);
  assert.equal(a.attended, true);
  assert.equal(a.basis, "speakers");
  assert.equal(a.clientWords, 60);
  assert.deepEqual(a.otherSpeakers, ["Priya Sharma"]);
  assert.equal(a.coachTalkPct, 50);
  assert.equal(a.durationMin, 59);
});

test("a no-show: the coach waits and talks to an empty room", () => {
  const t = [
    "[00:00:04] Swapnil Umbarkar: hello can you hear me",
    `[00:03:00] Swapnil Umbarkar: ${say(80)}`,
    "[00:09:30] Swapnil Umbarkar: okay I will message you",
  ].join("\n");
  const a = inferAttendance(t);
  assert.equal(a.attended, false, "a monologue must never be sent to Meta as CallHeld");
  assert.equal(a.clientWords, 0);
});

test("she joined and dropped after a few words — not a held call", () => {
  const t = [`Swapnil Umbarkar: ${say(50)}`, "Priya: hello sir one second", `Swapnil Umbarkar: ${say(20)}`].join("\n");
  assert.equal(inferAttendance(t).attended, false);
});

test("exactly the threshold counts", () => {
  const t = [`Swapnil: ${say(10)}`, `Her: ${say(MIN_CLIENT_WORDS)}`].join("\n");
  assert.equal(inferAttendance(t).attended, true);
});

test("husband on the call: two non-coach voices is a partner present", () => {
  const t = [`Swapnil Umbarkar: ${say(40)}`, `Priya: ${say(50)}`, `Rahul: ${say(25)}`].join("\n");
  const a = inferAttendance(t);
  assert.equal(a.attended, true);
  assert.equal(a.partnerPresent, true);
});

test("a one-word 'hi' from a second voice is not a partner", () => {
  const t = [`Swapnil: ${say(40)}`, `Priya: ${say(50)}`, "Rahul: hi"].join("\n");
  assert.equal(inferAttendance(t).partnerPresent, false);
});

test("generic labels: two people who each talked is a conversation", () => {
  const t = [`Speaker 1: ${say(50)}`, `Speaker 2: ${say(45)}`].join("\n");
  const a = inferAttendance(t);
  assert.equal(a.attended, true);
  assert.equal(a.basis, "unidentified-speakers");
  assert.equal(a.coachTalkPct, null, "talk share is unknowable without knowing who the coach is");
});

test("generic labels: one voice alone is not, however long", () => {
  assert.equal(inferAttendance(`Speaker 1: ${say(900)}`).attended, false);
});

test("no labels at all: a long transcript is a real call, a short one is not", () => {
  assert.equal(inferAttendance(say(400)).attended, true);
  assert.equal(inferAttendance(say(80)).attended, false);
  assert.equal(inferAttendance(say(400)).basis, "length");
});

test("empty and whitespace transcripts are a no, never a crash", () => {
  assert.equal(inferAttendance("").attended, false);
  assert.equal(inferAttendance("   \n  ").basis, "empty");
});

test("timestamps in every format Fathom might send", () => {
  assert.equal(toSeconds("01:02:03"), 3723);
  assert.equal(toSeconds("12:34"), 754);
  assert.equal(toSeconds("754.5"), 754.5);
  assert.equal(toSeconds("soon"), null);
});
