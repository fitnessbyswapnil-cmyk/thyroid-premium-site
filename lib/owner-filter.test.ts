import { test } from "node:test";
import assert from "node:assert/strict";
import { isOwnerTest, partitionOwnerTests, canonicalEmail } from "./owner-filter.ts";

const OWNERS = ["swapnilumbarkar50@gmail.com", "fitnessbyswapnil@gmail.com", "support@swapnilumbarkarfitness.in"];

test("his own address is caught whatever name is on the booking", () => {
  // This is the real case that a name-only rule leaks: a test booked as "Akash".
  assert.equal(isOwnerTest({ name: "Akash", email: "swapnilumbarkar50@gmail.com" }, OWNERS), true);
  assert.equal(isOwnerTest({ name: "", email: "FitnessBySwapnil@gmail.com" }, OWNERS), true);
});

test("every spelling of his name is caught", () => {
  for (const n of ["Swapnil Umbarkar", "Swapnil ", "swapnil", "SWAPNIL"]) {
    assert.equal(isOwnerTest({ name: n, email: "anything@example.com" }, OWNERS), true, n);
  }
});

test("anything on his own domain is his", () => {
  assert.equal(isOwnerTest({ name: "Reception", email: "hello@swapnilumbarkarfitness.in" }, OWNERS), true);
});

test("real clients are never removed", () => {
  const clients = [
    { name: "Shalini Marwah", email: "marwahshalini07@gmail.com" },
    { name: "SUNITA SHARMA", email: "sharma.sunita110@gmail.com" },
    { name: "Aman Deep", email: "amandeep2087@gmail.com" },
    { name: "Heena Shah", email: "heena.shah293@gmail.com" },
  ];
  for (const c of clients) assert.equal(isOwnerTest(c, OWNERS), false, c.name);
});

test("gmail plus-addressing and dots are the same inbox", () => {
  // The live pipeline had fitnessbyswapnil+test01@gmail.com sitting in it as two
  // separate leads, because an exact-match check does not know about aliases.
  assert.equal(isOwnerTest({ name: "Test Lead One", email: "fitnessbyswapnil+test01@gmail.com" }, OWNERS), true);
  assert.equal(isOwnerTest({ name: "", email: "fitness.by.swapnil@gmail.com" }, OWNERS), true);

  assert.equal(canonicalEmail("A.B+tag@Gmail.com"), "ab@gmail.com");
  // Dots are significant outside Gmail and must be preserved.
  assert.equal(canonicalEmail("a.b+tag@company.co.in"), "a.b@company.co.in");
  assert.equal(canonicalEmail("plain@example.com"), "plain@example.com");
  assert.equal(canonicalEmail(""), "");
});

test("a name that merely contains the letters is not a match", () => {
  // Word-boundary, so a surname like "Swapnilkumar" does not silently vanish.
  assert.equal(isOwnerTest({ name: "Swapnilkumari Devi", email: "x@y.com" }, OWNERS), false);
});

test("empty input is not an owner test", () => {
  assert.equal(isOwnerTest({}, OWNERS), false);
  assert.equal(isOwnerTest({ name: "", email: "" }, OWNERS), false);
});

test("partition reports what it removed rather than hiding it", () => {
  const { real, ownerTests } = partitionOwnerTests([
    { name: "Shalini", email: "a@b.com" },
    { name: "Swapnil", email: "swapnilumbarkar50@gmail.com" },
    { name: "Akash", email: "swapnilumbarkar50@gmail.com" },
  ]);
  assert.equal(real.length, 1);
  assert.equal(ownerTests.length, 2);
  assert.equal(real[0].name, "Shalini");
});
