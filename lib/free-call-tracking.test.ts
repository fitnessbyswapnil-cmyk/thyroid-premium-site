/**
 * The call went free on 23-Sep. Nothing charges on the cold /decode path any
 * more, so nothing on that path may report revenue to Meta either: no
 * Purchase, no MicroPurchase, no InitiateCheckout.
 *
 * These are source-shape assertions, not behaviour tests. That is deliberate:
 * the failure they guard against is a future edit quietly reconnecting the
 * paid branch, and the only evidence of that in a real event is a Purchase
 * arriving for a booking nobody paid for — which is exactly the number that
 * must not be wrong.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const SCHEDULE = read("app/schedule/ScheduleClient.tsx");
const SESSION_BOOKED = read("app/session-booked/page.tsx");
const QUIZ = read("app/decode/DecodeQuiz.tsx");
const CASHFREE_ORDER = read("app/api/create-cashfree-order/route.ts");

test("the /decode quiz books free: both result screens pass free to the scheduler", () => {
  const frees = QUIZ.match(/\n\s+free\n/g) ?? [];
  assert.ok(frees.length >= 2, `both ScheduleClient uses on /decode must pass free (found ${frees.length})`);
  assert.ok(!/Pay ₹?299|Pay Rs ?299/i.test(QUIZ), "no pay-first CTA survives on the quiz");
});

test("the free branch returns before anything that costs money", () => {
  // Not indexOf("if (free)"): the first one is the order-id cleanup above.
  const at = SCHEDULE.indexOf('if (free) {\n      pushDL(');
  assert.ok(at > -1, "the free redirect branch is still there");
  const branch = SCHEDULE.slice(at, at + 400);
  assert.ok(branch.includes("/session-booked?leadId="), "free goes straight to /session-booked with her leadId");
  assert.ok(branch.includes("return;"), "and returns before the payment block");
  // The payment block must sit AFTER that return, never before it.
  assert.ok(SCHEDULE.indexOf("trackInitiateCheckout()") > at, "InitiateCheckout stays on the paid side");
  // The call itself, not the header comment that names the route.
  assert.ok(SCHEDULE.indexOf('fetch("/api/create-cashfree-order"') > at, "the Cashfree order stays on the paid side");
});

test("a free booking cannot inherit an order id from an earlier paid attempt", () => {
  // /session-booked reads the order id from the URL, then from this key. A
  // stale one would mint a Purchase for a booking that was never charged.
  assert.match(
    SCHEDULE,
    /if \(free\) \{ delete \(prev as \{ orderId\?: string \}\)\.orderId; delete \(prev as \{ amount\?: number \}\)\.amount; \}/,
    "the free path clears orderId and amount before writing the booking key",
  );
});

test("/session-booked never mints a Purchase without an order id", () => {
  assert.ok(
    /\/\/ No order id → never mint a fake Purchase\.\s*\n\s*if \(!oid\) return;/.test(SESSION_BOOKED),
    "the no-order-id bail is still the line before trackPurchase can run",
  );
  assert.ok(
    SESSION_BOOKED.indexOf("if (!oid) return;") < SESSION_BOOKED.indexOf("trackPurchase("),
    "and it comes first",
  );
});

test("the ₹299 is off the cold path, not deleted from the codebase", () => {
  // /schedule and /complete-payment still collect from anyone who genuinely
  // owes money, so the order route must keep working — and must keep charging
  // the real amount, never ₹1.
  assert.match(CASHFREE_ORDER, /export const IS_TEST_MODE = false;/, "test mode stays off");
  assert.ok(SCHEDULE.includes("free = false"), "paid stays the default for every other caller");
});
