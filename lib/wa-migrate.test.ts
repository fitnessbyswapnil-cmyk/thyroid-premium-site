import test from "node:test";
import assert from "node:assert/strict";
import { splitPhone, isValidPin, sameWaba } from "./wa-migrate.ts";

test("a pasted E.164 number splits into country code and national part", () => {
  assert.deepEqual(splitPhone("+91 79784 60386", "91"), { cc: "91", national: "7978460386" });
});

test("an already-national number is passed through untouched", () => {
  assert.deepEqual(splitPhone("7978460386", "91"), { cc: "91", national: "7978460386" });
});

test("a 10-digit number that starts with the country code is NOT stripped", () => {
  // 9178460386 is a valid Indian mobile. Stripping "91" would migrate a
  // different number entirely — the single most dangerous bug in this file.
  assert.deepEqual(splitPhone("9178460386", "91"), { cc: "91", national: "9178460386" });
});

test("punctuation, spaces and a leading 00 dial prefix are all tolerated", () => {
  assert.deepEqual(splitPhone("00-91-(79784) 60386", "91"), { cc: "91", national: "7978460386" });
  assert.deepEqual(splitPhone("+91-79784-60386", "91"), { cc: "91", national: "7978460386" });
});

test("a number far too short is rejected rather than guessed at", () => {
  const r = splitPhone("12345", "91");
  assert.ok("error" in r);
});

test("empty input is rejected on both fields", () => {
  assert.ok("error" in splitPhone("", "91"));
  assert.ok("error" in splitPhone("7978460386", ""));
});

test("a six-digit pin is valid; anything else is not", () => {
  assert.equal(isValidPin("123456"), true);
  assert.equal(isValidPin("12345"), false);
  assert.equal(isValidPin("1234567"), false);
  assert.equal(isValidPin("12345a"), false);
  assert.equal(isValidPin(""), false);
});

test("WABA ids compare on digits, so stray formatting cannot fake a difference", () => {
  assert.equal(sameWaba("864737596644382", " 864737596644382 "), true);
  assert.equal(sameWaba("864737596644382", "976081968452524"), false);
});
