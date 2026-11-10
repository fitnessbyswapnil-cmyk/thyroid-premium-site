/**
 * The thank-you after her consultation call, every rule run against fakes:
 * the window decides session text or template, a shut window without an
 * approved template answers "send from your phone", nothing is sent twice for
 * one call or to test data, and the automatic path does nothing at all while
 * its switch is off. The two hooks are held to being additive: the routes'
 * replies are exactly what they were.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import {
  AUTO_MAX_AGE_MS, SAME_CALL_SLACK_MS, THANK_YOU_BODY, THANK_YOU_TEMPLATE,
  autoThankYou, blockedAsTest, channelFor, isOwnerNumber, isWindowClosedError, markForThisCall, recipientOf,
  sendThankYou, thankYouReply, thankYouText,
  type Marks, type ThankYouDeps, type ThankYouOutcome,
} from "./thank-you.ts";
import { defaultFlags, type Flags } from "./automation-flags.ts";
import type { WhatsAppResult } from "./whatsapp.ts";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");

const NOW = Date.parse("2026-11-10T14:00:00Z");
const CALL = "2026-11-10T12:30:00Z"; // ninety minutes ago
const CALL_MS = Date.parse(CALL);
const PHONE = "9812345678";
const E164 = "919812345678";
const HOUR = 3_600_000;
const SHUT_WINDOW_TEXT = "Her 24-hour reply window has closed — send an approved template instead.";

type Fake = {
  flags?: Partial<Flags>;
  marks?: Marks | Error;
  /** How long ago she last wrote to us; null = never. */
  inboundAgo?: number | null;
  /** Whose number that inbound message came from (default: hers). */
  inboundFrom?: string;
  messagesFail?: boolean;
  text?: WhatsAppResult;
  template?: WhatsAppResult;
  flagsThrow?: boolean;
};

function fake(o: Fake = {}) {
  const calls = {
    flags: 0,
    marks: [] as string[],
    messages: 0,
    sendText: [] as [string, string][],
    sendTemplate: [] as [string, string][],
    record: [] as string[],
    logOut: [] as { phone: string; text: string; messageId: string }[],
    deferred: 0,
  };
  const deps: ThankYouDeps = {
    now: () => NOW,
    flags: async () => {
      calls.flags++;
      if (o.flagsThrow) throw new Error("D1 exploded");
      return { ...defaultFlags(), ...o.flags };
    },
    marks: async (p) => {
      calls.marks.push(p);
      if (o.marks instanceof Error) throw o.marks;
      return o.marks ?? {};
    },
    messages: async () => {
      calls.messages++;
      if (o.messagesFail) throw new Error("Sheets down");
      const ago = o.inboundAgo === undefined ? 2 * HOUR : o.inboundAgo;
      return ago === null ? [] : [{ phone: o.inboundFrom ?? E164, direction: "in" as const, ts: new Date(NOW - ago).toISOString() }];
    },
    sendText: async (to, text) => {
      calls.sendText.push([to, text]);
      return o.text ?? { sent: true, messageId: "wamid.TEXT" };
    },
    sendTemplate: async (to, first) => {
      calls.sendTemplate.push([to, first]);
      return o.template ?? { sent: true, messageId: "wamid.TPL" };
    },
    record: async (p) => {
      calls.record.push(p);
    },
    logOut: async (e) => {
      calls.logOut.push(e);
    },
    defer: (work) => {
      calls.deferred++;
      return work();
    },
  };
  return { deps, calls };
}

const sentNothing = (c: ReturnType<typeof fake>["calls"]) => {
  assert.equal(c.sendText.length, 0, "no session message");
  assert.equal(c.sendTemplate.length, 0, "no template");
  assert.equal(c.record.length, 0, "no mark");
  assert.equal(c.logOut.length, 0, "nothing logged");
};

const MEERA = { name: "meera sharma", phone: "+91 98123 45678", when: CALL };
const AUTO = { trigger: "call-outcome" as const, name: "Meera Sharma", email: "meera@gmail.com", phone: PHONE, callStart: CALL, bookingUid: "uid1" };

// ── The words ────────────────────────────────────────────────────────────────

test("one wording: thanks her, says the summary is coming on this chat, invites a reply, and nothing else", () => {
  assert.equal((THANK_YOU_BODY.match(/\{\{\d\}\}/g) ?? []).length, 1);
  assert.match(THANK_YOU_BODY, /^Hi \{\{1\}\}, /);
  assert.match(THANK_YOU_BODY, /Thank you for your time/);
  assert.match(THANK_YOU_BODY, /summary .* on this chat/);
  assert.match(THANK_YOU_BODY, /reply here/);
  const withoutParam = THANK_YOU_BODY.replace("{{1}}", "");
  assert.doesNotMatch(withoutParam, /\d/, "no price, no number of any kind");
  assert.doesNotMatch(THANK_YOU_BODY, /₹|\bRs\b|https?:|www\.|pay|price|cure|guarantee|offer|discount/i);
  assert.doesNotMatch(THANK_YOU_BODY, /[—–]/, "no em or en dash");
  assert.match(THANK_YOU_BODY, /^[\x20-\x7E]+$/, "plain ASCII: the wa.me fallback corrupts symbols");
  assert.ok(THANK_YOU_BODY.length < 300, "short");
});

test("the text greets her by first name, capitalised, and falls back to 'there'", () => {
  assert.equal(thankYouText("meera sharma"), THANK_YOU_BODY.replace("{{1}}", "Meera"));
  assert.ok(thankYouText("").startsWith("Hi there, Swapnil here."));
  assert.ok(thankYouText("  Priya  ").startsWith("Hi Priya, "));
  // A replacement pattern in a name is text, never a pattern.
  assert.ok(thankYouText("$& x").startsWith("Hi $&, "));
});

test("the template doc says DRAFT and carries exactly the code's body", () => {
  const doc = read("docs/templates/call_thank_you_v1.md");
  assert.match(doc, /DRAFT — NOT SUBMITTED/);
  assert.equal(bodyOf(doc), THANK_YOU_BODY, "docs/templates/call_thank_you_v1.md and THANK_YOU_BODY differ");
  assert.match(doc, /\| Name \| `call_thank_you_v1` \|/);
  assert.match(doc, /\| Category \| UTILITY \|/);
  assert.match(doc, /\| Language \| English \(`en`\) \|/);
  assert.match(doc, /\| Body parameters \| 1 \|/);
  assert.match(doc, /\| Header, footer, buttons \| none \|/);
  assert.match(doc, /at most 5 automatic templates/);
  assert.match(doc, /Only `call_thank_you_v1` becomes a new automatic template/);
  assert.match(doc, /not\*\* automatic templates: they are "Send from your\s+phone" actions/);
  assert.equal(THANK_YOU_TEMPLATE, "call_thank_you_v1");
});

/** The fenced block under "## Body (exact)". */
function bodyOf(doc: string): string {
  const m = doc.match(/## Body \(exact\)\s*\n```text\n([\s\S]*?)\n```/);
  assert.ok(m, "no ## Body (exact) block");
  return m[1];
}

test("every drafted template obeys the copy rules and declares its parameters honestly", () => {
  const dir = new URL("../docs/templates/", import.meta.url);
  const files = readdirSync(dir).filter((f) => f.endsWith(".md")).sort();
  assert.deepEqual(files, [
    "call_thank_you_v1.md", "confirm_reminder_v1.md", "followup_day1_v1.md", "followup_day3_v1.md", "followup_day7_v1.md",
  ]);
  const categories: Record<string, string> = {};
  for (const f of files) {
    const doc = readFileSync(new URL(f, dir), "utf8");
    const name = f.replace(/\.md$/, "");
    assert.match(doc, /\*\*DRAFT — NOT SUBMITTED\.\*\*/, `${f}: DRAFT header`);
    assert.match(doc, new RegExp(`\\| Name \\| \`${name}\` \\|`), `${f}: name row`);
    assert.match(doc, /WABA `976081968452524`/, `${f}: names the WABA`);
    const category = doc.match(/\| Category \| (UTILITY|MARKETING) \|/)?.[1];
    assert.ok(category, `${f}: category`);
    categories[name] = category;
    const declared = Number(doc.match(/\| Body parameters \| (\d) \|/)?.[1]);
    const body = bodyOf(doc);
    const params = [...new Set(body.match(/\{\{\d\}\}/g) ?? [])].sort();
    assert.deepEqual(params, Array.from({ length: declared }, (_, i) => `{{${i + 1}}}`), `${f}: parameters are {{1}}..{{${declared}}}`);
    assert.match(body, /^Hi \{\{1\}\}, Swapnil here\./, `${f}: opens with her first name`);
    assert.doesNotMatch(body.trim(), /\}\}$/, `${f}: Meta refuses a body that ends on a parameter`);
    assert.doesNotMatch(body, /[—–]/, `${f}: no em or en dash`);
    assert.match(body, /^[\x20-\x7E\n]+$/, `${f}: plain ASCII`);
    assert.doesNotMatch(body.replace(/\{\{\d\}\}/g, ""), /\d|₹|\bRs\b|https?:/, `${f}: no price and no hard-coded link`);
    assert.doesNotMatch(body, /\b(unlock|elevate|transform|journey|dive into|discount|offer ends|last chance|only \w+ left|cure|guarantee)/i, `${f}: banned words`);
    assert.doesNotMatch(body, /\n{3,}/, `${f}: at most one blank line between paragraphs`);
  }
  assert.deepEqual(categories, {
    call_thank_you_v1: "UTILITY",
    confirm_reminder_v1: "UTILITY",
    followup_day1_v1: "MARKETING",
    followup_day3_v1: "MARKETING",
    followup_day7_v1: "MARKETING",
  });
  // The three follow-ups read differently.
  const bodies = ["followup_day1_v1", "followup_day3_v1", "followup_day7_v1"].map((n) => bodyOf(read(`docs/templates/${n}.md`)));
  assert.equal(new Set(bodies.map((b) => b.split("\n")[0])).size, 3);
  for (const b of bodies) assert.match(b, /\n\{\{2\}\}\n/, "the link sits on its own line");
  assert.match(bodyOf(read("docs/templates/confirm_reminder_v1.md")), /reply YES/);
});

// ── Who gets it ──────────────────────────────────────────────────────────────

test("only a plainly Indian number is a recipient: a foreign one is never given a 91", () => {
  for (const ok of ["9812345678", "98123 45678", "+91 98123 45678", "+91-98123-45678", "919812345678", "098123 45678"]) {
    assert.deepEqual(recipientOf(ok), { phone10: PHONE, e164: E164 }, ok);
  }
  for (const bad of ["", "12345", "+1 415 555 1234", "+44 7700 900123", "0091 98123 45678", undefined]) {
    assert.equal(recipientOf(bad), null, String(bad));
  }
});

test("test data is refused, his own number is let through", () => {
  assert.equal(isOwnerNumber("7987880954"), true);
  for (const p of ["9999999999", "9876543210", PHONE]) assert.equal(isOwnerNumber(p), false, p);
  assert.equal(blockedAsTest({ name: "Meera Sharma", email: "meera@gmail.com", phone10: PHONE }), false);
  assert.equal(blockedAsTest({ name: "Test User", phone10: PHONE }), true);
  assert.equal(blockedAsTest({ name: "Meera", phone10: "9999999999" }), true);
  assert.equal(blockedAsTest({ name: "Meera", email: "fitnessbyswapnil+t1@gmail.com", phone10: PHONE }), true);
  // His own number, under his own test name: that is how he tries it.
  assert.equal(blockedAsTest({ name: "Swapnil test", email: "fitnessbyswapnil@gmail.com", phone10: "7987880954" }), false);
  const saved = process.env.OWNER_TEST_PHONES;
  try {
    process.env.OWNER_TEST_PHONES = "9000012345";
    assert.equal(isOwnerNumber("9000012345"), true, "an extra owner phone from the env counts too");
  } finally {
    if (saved === undefined) delete process.env.OWNER_TEST_PHONES;
    else process.env.OWNER_TEST_PHONES = saved;
  }
});

test("a mark belongs to this call from six hours before its start; with no start, every mark counts", () => {
  assert.equal(markForThisCall(undefined, CALL_MS), false);
  assert.equal(markForThisCall({ at: CALL_MS + 5 * 60_000 }, CALL_MS), true);
  assert.equal(markForThisCall({ at: CALL_MS - SAME_CALL_SLACK_MS }, CALL_MS), true);
  assert.equal(markForThisCall({ at: CALL_MS - SAME_CALL_SLACK_MS - 1 }, CALL_MS), false);
  assert.equal(markForThisCall({ at: CALL_MS - 7 * 24 * HOUR }, null), true);
  assert.equal(markForThisCall({ at: Number.NaN }, CALL_MS), true, "an unreadable time is not a licence to send twice");
});

test("the channel: known open is the free message; shut or unknown needs the approved template, else his phone", () => {
  assert.equal(channelFor({ open: true, known: true }, false), "session");
  assert.equal(channelFor({ open: true, known: true }, true), "session", "open is free even with the template approved");
  assert.equal(channelFor({ open: false, known: true }, true), "template");
  assert.equal(channelFor({ open: false, known: true }, false), "phone");
  assert.equal(channelFor({ open: false, known: false }, true), "template");
  assert.equal(channelFor({ open: false, known: false }, false), "phone");
});

test("a shut window is recognised in exactly the words lib/whatsapp reports it", () => {
  const src = read("lib/whatsapp.ts");
  assert.ok(src.includes(SHUT_WINDOW_TEXT), "lib/whatsapp changed its 131047 message; update isWindowClosedError");
  assert.equal(isWindowClosedError(SHUT_WINDOW_TEXT), true);
  assert.equal(isWindowClosedError("131047: Re-engagement message"), true);
  assert.equal(isWindowClosedError("131026: undeliverable"), false);
  assert.equal(isWindowClosedError(undefined), false);
});

// ── His tap ──────────────────────────────────────────────────────────────────

test("window open: the session text goes, the mark is recorded, and it is logged as an outbound message", async () => {
  const { deps, calls } = fake({ inboundAgo: 2 * HOUR });
  const o = await sendThankYou(MEERA, deps);
  assert.deepEqual(o, { done: true, via: "session", messageId: "wamid.TEXT" });
  assert.deepEqual(calls.sendText, [[E164, thankYouText("meera")]]);
  assert.equal(calls.sendTemplate.length, 0);
  assert.deepEqual(calls.record, [PHONE]);
  assert.deepEqual(calls.logOut, [{ phone: E164, text: thankYouText("meera"), messageId: "wamid.TEXT" }]);
  assert.equal(calls.deferred, 1, "the log goes after the reply");
  assert.deepEqual(thankYouReply(o), { status: 200, body: { sent: true, via: "session", messageId: "wamid.TEXT" } });
});

test("window shut, template approved: the template goes with her first name, and mirrors itself", async () => {
  const { deps, calls } = fake({ inboundAgo: 30 * HOUR, flags: { thank_you_template_approved: true } });
  const o = await sendThankYou(MEERA, deps);
  assert.deepEqual(o, { done: true, via: "template", messageId: "wamid.TPL" });
  assert.deepEqual(calls.sendTemplate, [[E164, "Meera"]]);
  assert.equal(calls.sendText.length, 0, "a known-shut window is not even tried");
  assert.deepEqual(calls.record, [PHONE]);
  assert.equal(calls.logOut.length, 0, "sendWhatsAppTemplate logs the template itself");
  assert.equal(thankYouReply(o).status, 200);
});

test("window shut, template not approved: window_closed with the words for his phone, and nothing sent", async () => {
  for (const inboundAgo of [30 * HOUR, null]) {
    const { deps, calls } = fake({ inboundAgo });
    const o = await sendThankYou(MEERA, deps);
    assert.deepEqual(o, { done: false, reason: "window_closed", waText: thankYouText("meera") });
    sentNothing(calls);
    const reply = thankYouReply(o);
    assert.equal(reply.status, 409);
    assert.equal(reply.body.error, "window_closed");
    assert.equal(reply.body.waText, thankYouText("meera"));
    assert.match(String(reply.body.hint), /Send this from your phone/);
  }
});

test("Meta says the window is shut after all: the template if approved, else his phone", async () => {
  const shut = { sent: false, error: SHUT_WINDOW_TEXT };
  const a = fake({ inboundAgo: 2 * HOUR, text: shut });
  assert.equal((await sendThankYou(MEERA, a.deps)).done, false);
  assert.equal(a.calls.sendTemplate.length, 0);
  assert.equal(a.calls.record.length, 0);

  const b = fake({ inboundAgo: 2 * HOUR, text: shut, flags: { thank_you_template_approved: true } });
  assert.deepEqual(await sendThankYou(MEERA, b.deps), { done: true, via: "template", messageId: "wamid.TPL" });
  assert.equal(b.calls.sendText.length, 1);
  assert.equal(b.calls.sendTemplate.length, 1);
});

test("an unreadable thread counts as shut: the approved template, else his phone, and never a guess", async () => {
  // A guess Meta accepts and later drops would record a thank-you she never got.
  const a = fake({ messagesFail: true });
  const o = await sendThankYou(MEERA, a.deps);
  assert.deepEqual(o, { done: false, reason: "window_closed", waText: thankYouText("meera"), unknownWindow: true });
  sentNothing(a.calls);
  const reply = thankYouReply(o);
  assert.equal(reply.status, 409);
  assert.equal(reply.body.error, "window_closed");
  assert.match(String(reply.body.hint), /could not be read/);

  const b = fake({ messagesFail: true, flags: { thank_you_template_approved: true } });
  assert.deepEqual(await sendThankYou(MEERA, b.deps), { done: true, via: "template", messageId: "wamid.TPL" });
  assert.equal(b.calls.sendText.length, 0);

  const auto = fake({ messagesFail: true, flags: { thank_you_auto: true } });
  assert.deepEqual(await autoThankYou(AUTO, auto.deps), { sent: false, reason: "window_unknown" });
  sentNothing(auto.calls);
});

test("an approved template Meta refuses falls back to his phone, saying why", async () => {
  const { deps, calls } = fake({ inboundAgo: null, flags: { thank_you_template_approved: true }, template: { sent: false, error: "132001: Template name does not exist in the translation" } });
  const o = await sendThankYou(MEERA, deps);
  assert.equal(o.done, false);
  assert.equal(calls.record.length, 0);
  const reply = thankYouReply(o);
  assert.equal(reply.status, 409);
  assert.equal(reply.body.error, "window_closed");
  assert.match(String(reply.body.hint), /132001/);
  assert.equal(reply.body.waText, thankYouText("meera"));
});

test("WhatsApp unconfigured or failing is a 502 that still offers the words", async () => {
  const a = fake({ text: { sent: false, skipped: "whatsapp_not_configured" } });
  const ra = thankYouReply(await sendThankYou(MEERA, a.deps));
  assert.equal(ra.status, 502);
  assert.equal(ra.body.error, "whatsapp_not_configured");
  assert.equal(ra.body.waText, thankYouText("meera"));
  const b = fake({ text: { sent: false, error: "131026: undeliverable" } });
  const rb = thankYouReply(await sendThankYou(MEERA, b.deps));
  assert.equal(rb.status, 502);
  assert.equal(rb.body.error, "send_failed");
  assert.match(String(rb.body.hint), /131026/);
  assert.equal(a.calls.record.length + b.calls.record.length, 0);
});

// ── Never twice ──────────────────────────────────────────────────────────────

test("no double send: a mark for this call stops his tap and the automatic path", async () => {
  const marks: Marks = { thank_you_sent: { at: NOW - 30 * 60_000, url: "" } };
  const m = fake({ marks });
  const o = await sendThankYou(MEERA, m.deps);
  assert.deepEqual(o, { done: false, reason: "already_sent", sentAt: NOW - 30 * 60_000 });
  sentNothing(m.calls);
  const reply = thankYouReply(o);
  assert.equal(reply.status, 409);
  assert.equal(reply.body.error, "already_sent");
  assert.equal(reply.body.sentAt, new Date(NOW - 30 * 60_000).toISOString());
  assert.equal("waText" in reply.body, false, "already sent is never one tap from sending it again by hand");

  const a = fake({ marks, flags: { thank_you_auto: true } });
  assert.deepEqual(await autoThankYou(AUTO, a.deps), { sent: false, reason: "already_sent" });
  sentNothing(a.calls);
});

test("a thank-you from an earlier call does not block this one, when the call's time is known", async () => {
  const marks: Marks = { thank_you_sent: { at: CALL_MS - 7 * 24 * HOUR, url: "" } };
  const withTime = fake({ marks });
  assert.equal((await sendThankYou(MEERA, withTime.deps)).done, true);
  const withoutTime = fake({ marks });
  assert.equal((await sendThankYou({ ...MEERA, when: "" }, withoutTime.deps)).done, false, "no time: any mark counts");
  sentNothing(withoutTime.calls);
});

test("marks that cannot be read stop the send: 'never twice' cannot be checked", async () => {
  const m = fake({ marks: new Error("D1 down") });
  const o = await sendThankYou(MEERA, m.deps);
  assert.deepEqual(o, { done: false, reason: "marks_unavailable" });
  assert.equal(thankYouReply(o).status, 503);
  sentNothing(m.calls);
  const a = fake({ marks: new Error("D1 down"), flags: { thank_you_auto: true } });
  assert.deepEqual(await autoThankYou(AUTO, a.deps), { sent: false, reason: "marks_unavailable" });
  sentNothing(a.calls);
});

test("a double tap sends once", { timeout: 5000 }, async () => {
  let release: () => void = () => {};
  const gate = new Promise<void>((r) => { release = r; });
  const { deps, calls } = fake();
  const slow: ThankYouDeps = { ...deps, sendText: async (to, text) => { await gate; return deps.sendText(to, text); } };
  const first = sendThankYou(MEERA, slow);
  const second = sendThankYou(MEERA, slow);
  // Refused at once, not queued behind the first send.
  const early = await Promise.race([second, new Promise<string>((r) => setTimeout(() => r("still waiting"), 50))]);
  release();
  const [a, b] = await Promise.all([first, second]);
  assert.deepEqual(early, { done: false, reason: "in_progress" }, "the second tap was not refused straight away");
  assert.equal(thankYouReply(b).status, 409);
  assert.equal(a.done, true);
  assert.equal(calls.sendText.length, 1);
  // Once it has finished, the number is free again (the mark is what stops a resend).
  assert.equal((await sendThankYou(MEERA, fake().deps)).done, true);
});

// ── Test data ────────────────────────────────────────────────────────────────

test("test identities are skipped on both paths; his own number goes through", async () => {
  for (const who of [{ name: "Test User", phone: PHONE }, { name: "Meera", phone: "9999999999" }, { name: "Meera", phone: PHONE, email: "fitnessbyswapnil@gmail.com" }]) {
    const m = fake();
    const o = await sendThankYou({ ...who, when: CALL }, m.deps);
    assert.deepEqual(o, { done: false, reason: "test_identity" });
    assert.equal(thankYouReply(o).status, 422);
    sentNothing(m.calls);
    const a = fake({ flags: { thank_you_auto: true } });
    assert.deepEqual(await autoThankYou({ ...AUTO, ...who, email: who.email ?? "" }, a.deps), { sent: false, reason: "test_identity" });
    sentNothing(a.calls);
  }
  const own = fake({ inboundFrom: "917987880954" });
  assert.equal((await sendThankYou({ name: "Swapnil", phone: "7987880954", email: "fitnessbyswapnil@gmail.com", when: CALL }, own.deps)).done, true);
  assert.deepEqual(own.calls.sendText.map(([to]) => to), ["917987880954"]);
});

test("a row with no usable number is a 400, with nothing read", async () => {
  const m = fake();
  const o = await sendThankYou({ name: "Meera", phone: "+1 415 555 1234" }, m.deps);
  assert.deepEqual(o, { done: false, reason: "no_phone" });
  assert.equal(thankYouReply(o).status, 400);
  assert.equal(m.calls.marks.length + m.calls.messages, 0);
});

// ── The automatic path ───────────────────────────────────────────────────────

test("the automatic path does nothing but read the switch while thank_you_auto is off", async () => {
  for (const flags of [{}, { thank_you_template_approved: true }]) {
    const { deps, calls } = fake({ flags, inboundAgo: 2 * HOUR });
    assert.deepEqual(await autoThankYou(AUTO, deps), { sent: false, reason: "flag_off" });
    assert.equal(calls.flags, 1);
    assert.equal(calls.marks.length, 0);
    assert.equal(calls.messages, 0);
    sentNothing(calls);
  }
});

test("switched on: window open sends the session text; shut sends the approved template; shut otherwise sends nothing", async () => {
  const open = fake({ flags: { thank_you_auto: true }, inboundAgo: 2 * HOUR });
  assert.deepEqual(await autoThankYou(AUTO, open.deps), { sent: true, via: "session" });
  assert.deepEqual(open.calls.sendText, [[E164, thankYouText("Meera Sharma")]]);
  assert.deepEqual(open.calls.record, [PHONE]);
  assert.equal(open.calls.logOut.length, 1);
  assert.equal(open.calls.deferred, 0, "already after the response: logged inline");

  const tpl = fake({ flags: { thank_you_auto: true, thank_you_template_approved: true }, inboundAgo: 30 * HOUR });
  assert.deepEqual(await autoThankYou({ ...AUTO, trigger: "fathom" }, tpl.deps), { sent: true, via: "template" });
  assert.deepEqual(tpl.calls.sendTemplate, [[E164, "Meera"]]);

  const shut = fake({ flags: { thank_you_auto: true }, inboundAgo: 30 * HOUR });
  assert.deepEqual(await autoThankYou(AUTO, shut.deps), { sent: false, reason: "window_closed" });
  sentNothing(shut.calls);
});

test("the automatic path only thanks a fresh call, and never one whose summary has already gone", async () => {
  const on = { flags: { thank_you_auto: true } };
  const cases: [Partial<typeof AUTO>, string][] = [
    [{ callStart: "" }, "no_call_time"],
    [{ callStart: "not a date" }, "no_call_time"],
    [{ callStart: new Date(NOW - AUTO_MAX_AGE_MS - 60_000).toISOString() }, "call_too_old"],
    [{ callStart: new Date(NOW + 5 * HOUR).toISOString() }, "call_not_yet"],
  ];
  for (const [patch, reason] of cases) {
    const { deps, calls } = fake(on);
    assert.deepEqual(await autoThankYou({ ...AUTO, ...patch }, deps), { sent: false, reason }, reason);
    sentNothing(calls);
  }
  const summarised = fake({ ...on, marks: { summary_sent: { at: NOW - 10 * 60_000, url: "https://drive/x" } } });
  assert.deepEqual(await autoThankYou(AUTO, summarised.deps), { sent: false, reason: "summary_already_sent" });
  sentNothing(summarised.calls);
  // A summary from an earlier call is not this call's.
  const earlier = fake({ ...on, marks: { summary_sent: { at: CALL_MS - 9 * 24 * HOUR, url: "" } } });
  assert.deepEqual(await autoThankYou(AUTO, earlier.deps), { sent: true, via: "session" });
});

test("the automatic path never throws, whatever breaks", async () => {
  const broken = fake({ flagsThrow: true });
  assert.deepEqual(await autoThankYou(AUTO, broken.deps), { sent: false, reason: "error" });
  const failing: Partial<ThankYouDeps> = {
    ...fake({ flags: { thank_you_auto: true } }).deps,
    sendText: async () => { throw new Error("socket hang up"); },
  };
  assert.deepEqual(await autoThankYou(AUTO, failing), { sent: false, reason: "error" });
});

test("every outcome of his tap maps to the reply the route documents", () => {
  const cases: [ThankYouOutcome, number, string | undefined][] = [
    [{ done: true, via: "template" }, 200, undefined],
    [{ done: false, reason: "window_closed", waText: "x" }, 409, "window_closed"],
    [{ done: false, reason: "already_sent", sentAt: NOW }, 409, "already_sent"],
    [{ done: false, reason: "in_progress" }, 409, "in_progress"],
    [{ done: false, reason: "test_identity" }, 422, "test_identity"],
    [{ done: false, reason: "no_phone" }, 400, "need_phone"],
    [{ done: false, reason: "marks_unavailable" }, 503, "marks_unavailable"],
    [{ done: false, reason: "whatsapp_not_configured", waText: "x", detail: "" }, 502, "whatsapp_not_configured"],
    [{ done: false, reason: "send_failed", waText: "x", detail: "boom" }, 502, "send_failed"],
  ];
  for (const [o, status, error] of cases) {
    const r = thankYouReply(o);
    assert.equal(r.status, status, JSON.stringify(o));
    assert.equal(r.body.error, error);
    if (status !== 200) assert.ok(String(r.body.hint ?? "").length > 10, "every refusal says why");
    for (const v of Object.values(r.body)) assert.doesNotMatch(String(v), /[—–]/);
  }
  assert.deepEqual(thankYouReply({ done: true, via: "session" }).body, { sent: true, via: "session" });
});

// ── The hooks stay additive ──────────────────────────────────────────────────

test("call-outcome: every reply is the one it gave before, and the hook only runs after an attended outcome is recorded", () => {
  const src = read("app/api/admin/call-outcome/route.ts");
  const BEFORE = [
    `if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });`,
    `return NextResponse.json({ error: "invalid json" }, { status: 400 });`,
    `if (!uid) return NextResponse.json({ error: "bookingUid required" }, { status: 400 });`,
    `if (typeof body.attended !== "boolean") return NextResponse.json({ error: "attended must be true or false" }, { status: 400 });`,
    `return NextResponse.json({ ok: false, reason: plan.skipReason ?? "row already reviewed" }, { status: 409 });`,
    `return NextResponse.json({ ok: true, action: plan.action });`,
    `return NextResponse.json({ error: err instanceof Error ? err.message : String(err) }, { status: 500 });`,
  ];
  for (const line of BEFORE) assert.ok(src.includes(line), `reply changed or gone: ${line}`);
  assert.equal(src.match(/NextResponse\.json\(/g)?.length, BEFORE.length, "a reply was added");
  assert.match(src, /import \{ NextRequest, NextResponse, after \} from "next\/server";/);
  assert.match(src, /import \{ autoThankYou \} from "@\/lib\/thank-you";/);
  // Exactly one call, inside after(), inside `if (body.attended)`, between the skip reply and the ok reply.
  assert.equal(src.match(/autoThankYou\(/g)?.length, 1);
  const skipAt = src.indexOf(BEFORE[4]);
  const hookAt = src.indexOf("autoThankYou({");
  const okAt = src.indexOf(BEFORE[5]);
  assert.ok(skipAt < hookAt && hookAt < okAt, "the hook runs only after the outcome was written, before the ok reply");
  const block = src.slice(src.lastIndexOf("if (body.attended) {", hookAt), okAt);
  assert.match(block, /^if \(body\.attended\) \{\s*after\(\(\) =>\s*autoThankYou\(\{/);
  assert.match(block, /trigger: "call-outcome"/);
  assert.match(block, /callStart: fields\.occurredAt/);
  assert.doesNotMatch(block, /await/, "never awaited on the request path");
});

test("fathom-webhook: the delivery contract and CallHeld are untouched; the hook runs in after(), after CallHeld, only when she attended", () => {
  const src = read("app/api/fathom-webhook/route.ts");
  const BEFORE = [
    `return NextResponse.json({ ok: true, skipped: "unreadable body" });`,
    `return NextResponse.json({ error: "invalid signature" }, { status: 401 });`,
    `return NextResponse.json({ ok: true, skipped: "invalid json" });`,
    `return NextResponse.json({ received: true, recordingId: meeting.recordingId });`,
  ];
  for (const line of BEFORE) assert.ok(src.includes(line), `reply changed or gone: ${line}`);
  assert.equal(src.match(/NextResponse\.json\(/g)?.length, BEFORE.length, "a reply was added");
  const post = src.slice(src.indexOf("export async function POST"), src.indexOf("async function fireCallHeld"));
  assert.doesNotMatch(post, /autoThankYou/, "nothing new on the request path");
  assert.match(post, /after\(async \(\) => \{\s*try \{\s*await processMeeting\(meeting\);/);
  const callHeld = "await fireCallHeld({ uid: match.uid, name: fields.name ?? \"\", email: fields.email ?? \"\", phone: fields.phone ?? \"\", attended, emails: meeting.emails, startedAt: meeting.startedAt, partnerBySpeakers: heard.partnerPresent });";
  assert.ok(src.includes(callHeld), "the CallHeld call changed");
  const tail = src.slice(src.indexOf(callHeld) + callHeld.length);
  assert.match(tail, /^\s*if \(attended\) \{\s*await autoThankYou\(\{\s*trigger: "fathom",/);
  assert.match(tail, /callStart: meeting\.startedAt \|\| booking\?\.startIso \|\| ""/);
  assert.equal(src.match(/autoThankYou\(/g)?.length, 1);
  assert.match(src, /import \{ autoThankYou \} from "@\/lib\/thank-you";/);
});

test("the thank-you route is the documented one: admin key, after() for the log, nothing to Meta's tracking", () => {
  const src = read("app/api/admin/thank-you/route.ts");
  assert.match(src, /checkAdminKey\(req\)/);
  assert.match(src, /sendThankYou\(/);
  assert.match(src, /defer: \(work\) => after\(work\)/);
  assert.doesNotMatch(src, /sendCAPIEvent|server-tracking|dataLayer/);
  const lib = read("lib/thank-you.ts");
  assert.doesNotMatch(lib, /sendCAPIEvent|server-tracking|markThreadRead\(/, "no Meta event, and her thread is never marked read");
});
