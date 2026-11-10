/**
 * lib/thank-you.ts — the short WhatsApp thank-you after her consultation call.
 *
 * Two ways in, one set of rules:
 *  - his click on Today (POST /api/admin/thank-you), and
 *  - automatically, ONLY while the switch thank_you_auto is on (default off),
 *    when he marks a call attended (/api/admin/call-outcome) or Fathom hears
 *    her on it (/api/fathom-webhook, the CallHeld path). Both run inside
 *    after(), so neither changes the reply its route already gives.
 *
 * HOW IT REACHES HER
 *  - Her 24-hour window open (she wrote to us in the last 24 hours, computed
 *    the way the inbox computes it, lib/summary replyWindow): a plain session
 *    message, free and needing no approval.
 *  - Window shut: only an approved template can reach her. call_thank_you_v1
 *    is a DRAFT (docs/templates/call_thank_you_v1.md) until Meta approves it
 *    and he turns on thank_you_template_approved. Until then the click answers
 *    window_closed with the words for a wa.me link, and he sends it from his
 *    phone. The automatic path sends nothing in that case: the Thanks step
 *    simply stays open on Today for him.
 *  - A window we could not read counts as SHUT: the template if approved,
 *    else his phone. The summary route lets Meta decide instead, but a send
 *    Meta accepts and only later drops (131047 and the #131049 cap can both
 *    arrive after a message id) would record thank_you_sent for a message
 *    she never got, and "never twice" would then stop the real one.
 *
 * THE RULES THAT CANNOT BREAK
 *  - Never twice for one call. The thank_you_sent mark (lib/journey-marks) is
 *    the record. A mark made from six hours before this call's start onwards is
 *    this call's; with no call time every mark counts. Marks that cannot be
 *    read stop the send.
 *  - Never to test data (lib/metrics isTestIdentity), except his own number,
 *    which is how he tries it.
 *  - Never a price, a link or a promise. The words are THANK_YOU_BODY, the
 *    same for the session message, the wa.me text and the template.
 *  - The automatic path never thanks a call more than two days old: marking
 *    old calls attended (the backlog in "Mark your calls") must not message
 *    women about a call from weeks ago. And it skips a call whose summary has
 *    already gone, since this message says the summary is on its way.
 *  - Every send is logged as an outbound message: the session text through
 *    lib/wa-messages, as /api/admin/messages does, and the template by
 *    sendWhatsAppTemplate's own inbox mirror. Her thread is NOT marked read:
 *    a thank-you is not him reading her messages, and an automatic one must
 *    never hide an unread reply.
 *
 * The I/O is injected (ThankYouDeps), lazily imported like lib/report-save,
 * so the tests run every rule against fakes and never touch Meta or Sheets.
 */
import type { MarkKind } from "./journey-marks.ts";
import type { Flags } from "./automation-flags.ts";
import type { WhatsAppResult } from "./whatsapp.ts";
import { isTestIdentity, looksLikeTestData } from "./metrics.ts";
import { replyWindow } from "./summary.ts";
import { firstName } from "./draft-message.ts";

export const THANK_YOU_TEMPLATE = "call_thank_you_v1";

/**
 * The one wording. {{1}} is her first name. The template body in
 * docs/templates/call_thank_you_v1.md is this string exactly (a test holds
 * them together): change one and the other must change in the same commit,
 * and so must Meta's copy, or the template and the session message drift.
 *
 * Plain ASCII on purpose: the wa.me ?text= fallback corrupts emoji and
 * symbols (lib/draft-message), and no em dashes (copy rules).
 */
export const THANK_YOU_BODY =
  "Hi {{1}}, Swapnil here. Thank you for your time on the consultation call you booked. " +
  "Your written summary of the call is coming to you on this chat. " +
  "If anything we discussed is unclear, just reply here and I will explain.";

/** The session message, the wa.me text and the template's {{1}}, from one name. */
export function thankYouText(name: string): string {
  const first = firstName(name);
  // A function, not a string: a name holding "$&" must not be read as a pattern.
  return THANK_YOU_BODY.replace("{{1}}", () => first);
}

const HOUR = 3_600_000;
/** The automatic path thanks a call up to this long after its start. */
export const AUTO_MAX_AGE_MS = 48 * HOUR;
/** ...and up to this long before it: a call marked attended a little early. */
export const AUTO_EARLY_MS = 1 * HOUR;
/** A mark made this long before a call's start (or later) belongs to that call. */
export const SAME_CALL_SLACK_MS = 6 * HOUR;

export type Marks = Partial<Record<MarkKind, { at: number; url: string }>>;
export type Recipient = { phone10: string; e164: string };

/**
 * Her number as the senders want it, or null. Only a number that is plainly
 * Indian (10 digits, 91 + 10, or 0 + 10): taking the last ten digits of a
 * foreign number and putting 91 in front would message a stranger.
 */
export function recipientOf(raw: string | undefined): Recipient | null {
  const d = String(raw ?? "").replace(/\D/g, "");
  let p = "";
  if (d.length === 10) p = d;
  else if (d.length === 12 && d.startsWith("91")) p = d.slice(2);
  else if (d.length === 11 && d.startsWith("0")) p = d.slice(1);
  return p.length === 10 ? { phone10: p, e164: `91${p}` } : null;
}

/**
 * His own number, exactly as lib/metrics knows it (built in, or
 * OWNER_TEST_PHONES). On a phone alone isTestIdentity is true for his number
 * and for dummy numbers, and looksLikeTestData for the dummies only, so the
 * difference is his number without a second copy of the list.
 */
export function isOwnerNumber(phone10: string): boolean {
  return phone10.length === 10 && isTestIdentity({ phone: phone10 }) && !looksLikeTestData({ phone: phone10 });
}

/** Test data never gets a message. His own number does: that is how he tries it. */
export function blockedAsTest(who: { name?: string; email?: string; phone10: string }): boolean {
  if (!isTestIdentity({ name: who.name ?? "", email: who.email ?? "", phone: who.phone10 })) return false;
  return !isOwnerNumber(who.phone10);
}

/** A call's start in epoch ms, or null when there is none to read. */
export function parseCallStart(when: string | undefined): number | null {
  const s = String(when ?? "").trim();
  if (!s) return null;
  const t = Date.parse(s);
  return Number.isFinite(t) ? t : null;
}

/**
 * Does this mark belong to this call? With the call's start known, a mark
 * from SAME_CALL_SLACK_MS before it onwards does; an older one is an earlier
 * call's. Without a start (or with a mark whose time cannot be read) every
 * mark counts: "never twice" is the rule that cannot break.
 */
export function markForThisCall(mark: { at: number } | undefined, callStart: number | null): boolean {
  if (!mark) return false;
  if (callStart === null || !Number.isFinite(mark.at)) return true;
  return mark.at >= callStart - SAME_CALL_SLACK_MS;
}

/** Meta's 131047, as lib/whatsapp reports it for a session send. */
export function isWindowClosedError(error: string | undefined): boolean {
  return /131047|reply window has closed/i.test(error ?? "");
}

/** Known open: the free message. Shut, or unknown: the template if approved, else his phone. */
export function channelFor(window: { open: boolean; known: boolean }, templateApproved: boolean): "session" | "template" | "phone" {
  if (window.known && window.open) return "session";
  return templateApproved ? "template" : "phone";
}

// ── The I/O, injected ────────────────────────────────────────────────────────

export type ThankYouDeps = {
  now: () => number;
  flags: () => Promise<Flags>;
  /** Her marks, keyed as lib/journey-marks keys them: her last ten digits. */
  marks: (phone10: string) => Promise<Marks>;
  messages: () => Promise<{ phone: string; direction: "in" | "out"; ts: string }[]>;
  sendText: (to: string, text: string) => Promise<WhatsAppResult>;
  /** call_thank_you_v1 with her first name as {{1}}; logs itself to the inbox. */
  sendTemplate: (to: string, first: string) => Promise<WhatsAppResult>;
  record: (phone10: string) => Promise<void>;
  /** One outbound row in the Messages tab, as /api/admin/messages writes it. */
  logOut: (entry: { phone: string; text: string; messageId: string }) => Promise<void>;
  /** Work after the reply. The route passes after(); the default runs it now. */
  defer: (work: () => Promise<void>) => void | Promise<void>;
};

function liveDeps(): ThankYouDeps {
  return {
    now: () => Date.now(),
    flags: async () => (await import("@/lib/automation-flags")).readFlags(),
    marks: async (phone10) => (await (await import("@/lib/journey-marks")).readMarks([phone10])).get(phone10) ?? {},
    messages: async () => (await import("@/lib/wa-messages")).readMessages(),
    sendText: async (to, text) => (await import("@/lib/whatsapp")).sendWhatsAppText(to, text),
    sendTemplate: async (to, first) => {
      const wa = await import("@/lib/whatsapp");
      // Meta matches a template on name AND language, and "English" may be stored as en, en_US or en_GB.
      return wa.sendTryingLanguages((language) => wa.sendWhatsAppTemplate(to, THANK_YOU_TEMPLATE, [first], language));
    },
    record: async (phone10) => (await import("@/lib/journey-marks")).recordMark(phone10, "thank_you_sent"),
    logOut: async (e) =>
      (await import("@/lib/wa-messages")).appendMessage({
        ts: new Date().toISOString(),
        phone: e.phone,
        direction: "out",
        text: e.text,
        messageId: e.messageId,
        name: "",
        read: true,
      }),
    defer: (work) => work(),
  };
}

const errText = (err: unknown) => (err instanceof Error ? err.message : String(err));
const masked = (phone10: string) => `***${phone10.slice(-4)}`;

/** One send in progress per number, so a double tap cannot thank her twice. */
const inFlight = new Set<string>();

export type SkipReason =
  | "no_phone"
  | "test_identity"
  | "flag_off"
  | "no_call_time"
  | "call_too_old"
  | "call_not_yet"
  | "in_progress"
  | "marks_unavailable"
  | "already_sent"
  | "summary_already_sent";

export type ThankYouOutcome =
  | { done: true; via: "session" | "template"; messageId?: string }
  | { done: false; reason: SkipReason; sentAt?: number }
  | { done: false; reason: "window_closed"; waText: string; templateError?: string; unknownWindow?: true }
  | { done: false; reason: "whatsapp_not_configured" | "send_failed"; waText: string; detail: string };

type Delivered =
  | { sent: true; via: "session" | "template"; messageId?: string }
  | { sent: false; windowClosed: true; templateError?: string }
  | { sent: false; windowClosed: false; notConfigured: boolean; detail: string };

/**
 * Send by the first channel that can reach her. A session message refused
 * with 131047 means the window was shut after all, so it falls through to the
 * template (when approved) or to his phone, exactly as a known-shut window would.
 */
async function deliver(r: Recipient, text: string, first: string, channel: "session" | "template", templateApproved: boolean, d: ThankYouDeps): Promise<Delivered> {
  if (channel === "session") {
    const s = await d.sendText(r.e164, text);
    if (s.sent) return { sent: true, via: "session", messageId: s.messageId };
    if (s.skipped === "whatsapp_not_configured") return { sent: false, windowClosed: false, notConfigured: true, detail: s.skipped };
    if (!isWindowClosedError(s.error)) {
      return { sent: false, windowClosed: false, notConfigured: false, detail: s.error || s.skipped || "no reason given" };
    }
    if (!templateApproved) return { sent: false, windowClosed: true };
  }
  const t = await d.sendTemplate(r.e164, first);
  if (t.sent) return { sent: true, via: "template", messageId: t.messageId };
  if (t.skipped === "whatsapp_not_configured") return { sent: false, windowClosed: false, notConfigured: true, detail: t.skipped };
  // Shut window and a template that did not go: his phone is the way that works.
  return { sent: false, windowClosed: true, templateError: t.error || t.skipped || "no reason given" };
}

/** Her window, or unknown when the Messages tab could not be read (treated as shut). */
async function windowOf(phone10: string, d: ThankYouDeps): Promise<{ open: boolean; known: boolean }> {
  try {
    const w = replyWindow(await d.messages(), phone10, d.now());
    return { open: w.open, known: true };
  } catch (err) {
    console.error("[thank-you] Messages read failed (window treated as shut):", errText(err));
    return { open: false, known: false };
  }
}

/** The bookkeeping after a send that went: the mark first, so a second press sees it. */
async function afterSent(r: Recipient, text: string, sent: { via: "session" | "template"; messageId?: string }, d: ThankYouDeps, inline: boolean) {
  await d.record(r.phone10);
  if (sent.via !== "session") return; // the template mirrors itself into the inbox
  const log = async () => {
    try {
      await d.logOut({ phone: r.e164, text, messageId: sent.messageId ?? "" });
    } catch (err) {
      console.error("[thank-you] sent but failed to log:", errText(err));
    }
  };
  if (inline) await log();
  else await d.defer(log);
}

export type ManualInput = { name?: string; phone?: string; email?: string; bookingUid?: string; when?: string };

/**
 * His click. Never throws. The outcome maps to the HTTP reply in
 * thankYouReply, so the route is a few lines and the mapping is tested here.
 */
export async function sendThankYou(input: ManualInput, deps: Partial<ThankYouDeps> = {}): Promise<ThankYouOutcome> {
  const d: ThankYouDeps = { ...liveDeps(), ...deps };
  const r = recipientOf(input.phone);
  if (!r) return { done: false, reason: "no_phone" };
  if (blockedAsTest({ name: input.name, email: input.email, phone10: r.phone10 })) return { done: false, reason: "test_identity" };
  if (inFlight.has(r.phone10)) return { done: false, reason: "in_progress" };
  inFlight.add(r.phone10);
  const text = thankYouText(input.name ?? "");
  try {
    const callStart = parseCallStart(input.when);
    const [flags, marks, window] = await Promise.all([
      d.flags(),
      d.marks(r.phone10).then((m) => m ?? {}, (err) => {
        console.error("[thank-you] marks read failed (nothing sent):", errText(err));
        return null;
      }),
      windowOf(r.phone10, d),
    ]);
    if (!marks) return { done: false, reason: "marks_unavailable" };
    const prior = marks.thank_you_sent;
    if (markForThisCall(prior, callStart)) return { done: false, reason: "already_sent", sentAt: prior?.at };

    const channel = channelFor(window, flags.thank_you_template_approved);
    if (channel === "phone") {
      return { done: false, reason: "window_closed", waText: text, ...(window.known ? {} : { unknownWindow: true as const }) };
    }

    const sent = await deliver(r, text, firstName(input.name ?? ""), channel, flags.thank_you_template_approved, d);
    if (sent.sent) {
      await afterSent(r, text, sent, d, false);
      console.log(`[thank-you] sent via=${sent.via} trigger=manual to=${masked(r.phone10)} uid=${input.bookingUid || "-"}`);
      return { done: true, via: sent.via, ...(sent.messageId ? { messageId: sent.messageId } : {}) };
    }
    if (sent.windowClosed) {
      return { done: false, reason: "window_closed", waText: text, ...(sent.templateError ? { templateError: sent.templateError } : {}) };
    }
    return { done: false, reason: sent.notConfigured ? "whatsapp_not_configured" : "send_failed", waText: text, detail: sent.detail };
  } catch (err) {
    console.error("[thank-you] manual send failed:", errText(err));
    return { done: false, reason: "send_failed", waText: text, detail: errText(err) };
  } finally {
    inFlight.delete(r.phone10);
  }
}

export type AutoInput = {
  trigger: "call-outcome" | "fathom";
  name: string;
  email?: string;
  phone: string;
  /** The call's start, ISO. Without one there is nothing to judge freshness by, so nothing is sent. */
  callStart?: string;
  bookingUid?: string;
};
export type AutoResult = { sent: true; via: "session" | "template" } | { sent: false; reason: string };

/**
 * The automatic thank-you. Does NOTHING but read one switch while
 * thank_you_auto is off. Never throws, so a hook can await it or hand it to
 * after() without a guard of its own.
 */
export async function autoThankYou(input: AutoInput, deps: Partial<ThankYouDeps> = {}): Promise<AutoResult> {
  const skip = (reason: string): AutoResult => {
    if (reason !== "flag_off") console.log(`[thank-you] auto skipped reason=${reason} trigger=${input.trigger} uid=${input.bookingUid || "-"}`);
    return { sent: false, reason };
  };
  try {
    const d: ThankYouDeps = { ...liveDeps(), ...deps };
    const flags = await d.flags();
    if (!flags.thank_you_auto) return skip("flag_off");

    const r = recipientOf(input.phone);
    if (!r) return skip("no_phone");
    if (blockedAsTest({ name: input.name, email: input.email, phone10: r.phone10 })) return skip("test_identity");
    const callStart = parseCallStart(input.callStart);
    if (callStart === null) return skip("no_call_time");
    const now = d.now();
    if (now - callStart > AUTO_MAX_AGE_MS) return skip("call_too_old");
    if (callStart - now > AUTO_EARLY_MS) return skip("call_not_yet");

    if (inFlight.has(r.phone10)) return skip("in_progress");
    inFlight.add(r.phone10);
    try {
      let marks: Marks;
      try {
        marks = (await d.marks(r.phone10)) ?? {};
      } catch (err) {
        console.error("[thank-you] marks read failed (nothing sent):", errText(err));
        return skip("marks_unavailable");
      }
      if (markForThisCall(marks.thank_you_sent, callStart)) return skip("already_sent");
      if (markForThisCall(marks.summary_sent, callStart)) return skip("summary_already_sent");

      const window = await windowOf(r.phone10, d);
      const channel = channelFor(window, flags.thank_you_template_approved);
      if (channel === "phone") return skip(window.known ? "window_closed" : "window_unknown");

      const text = thankYouText(input.name);
      const sent = await deliver(r, text, firstName(input.name), channel, flags.thank_you_template_approved, d);
      if (!sent.sent) {
        if (sent.windowClosed) return skip(sent.templateError ? `template_failed: ${sent.templateError}` : "window_closed");
        return skip(sent.notConfigured ? "whatsapp_not_configured" : `send_failed: ${sent.detail}`);
      }
      await afterSent(r, text, sent, d, true);
      console.log(`[thank-you] sent via=${sent.via} trigger=${input.trigger} to=${masked(r.phone10)} uid=${input.bookingUid || "-"}`);
      return { sent: true, via: sent.via };
    } finally {
      inFlight.delete(r.phone10);
    }
  } catch (err) {
    console.error(`[thank-you] auto failed (swallowed) trigger=${input.trigger}:`, errText(err));
    return { sent: false, reason: "error" };
  }
}

// ── The reply the route gives ────────────────────────────────────────────────

/** "10 Nov, 14:07" on the coach's clock. */
function istWhen(at: number | undefined): string {
  if (at === undefined || !Number.isFinite(at)) return "earlier";
  return new Date(at).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hour12: false,
  });
}

/**
 * POST /api/admin/thank-you, outcome to HTTP:
 *   200 { sent: true, via: "session" | "template", messageId? }
 *   409 { error: "window_closed", waText, hint }   send from his phone
 *   409 { error: "already_sent", sentAt, hint }    never twice for one call
 *   409 { error: "in_progress", hint }             a double tap
 *   422 { error: "test_identity", hint }
 *   400 { error: "need_phone", hint }
 *   503 { error: "marks_unavailable", hint }       cannot check "never twice", so nothing sent
 *   502 { error: "whatsapp_not_configured" | "send_failed", waText, hint }
 * Only window_closed carries waText among the 409s: "already sent" must never
 * be one tap away from sending it again by hand.
 */
export function thankYouReply(o: ThankYouOutcome): { status: number; body: Record<string, unknown> } {
  if (o.done) return { status: 200, body: { sent: true, via: o.via, ...(o.messageId ? { messageId: o.messageId } : {}) } };
  switch (o.reason) {
    case "window_closed":
      return {
        status: 409,
        body: {
          error: "window_closed",
          waText: o.waText,
          hint: o.templateError
            ? `Her 24-hour WhatsApp window is shut and the thank-you template did not go through (${o.templateError}). Send this from your phone.`
            : o.unknownWindow
              ? "Her WhatsApp thread could not be read, so her 24-hour window is treated as shut, and the thank-you template is not approved yet. Send this from your phone."
              : "Her 24-hour WhatsApp window is shut, and the thank-you template is not approved yet, so the business number cannot message her. Send this from your phone.",
        },
      };
    case "already_sent":
      return {
        status: 409,
        body: {
          error: "already_sent",
          sentAt: o.sentAt !== undefined && Number.isFinite(o.sentAt) ? new Date(o.sentAt).toISOString() : null,
          hint: `She was already thanked for this call (${istWhen(o.sentAt)}). Nothing was sent again.`,
        },
      };
    case "in_progress":
      return { status: 409, body: { error: "in_progress", hint: "Her thank-you is already being sent. Give it a moment." } };
    case "test_identity":
      return { status: 422, body: { error: "test_identity", hint: "This looks like test data, not a client, so nothing was sent. Only your own number gets through, for trying it." } };
    case "no_phone":
      return { status: 400, body: { error: "need_phone", hint: "This row has no 10-digit Indian mobile number, so nothing was sent." } };
    case "marks_unavailable":
      return { status: 503, body: { error: "marks_unavailable", hint: "Could not check whether she was already thanked, so nothing was sent. Press again in a moment." } };
    case "whatsapp_not_configured":
      return { status: 502, body: { error: "whatsapp_not_configured", waText: o.waText, hint: "WhatsApp is not set up on the worker, so nothing was sent. Send this from your phone." } };
    case "send_failed":
      return { status: 502, body: { error: "send_failed", waText: o.waText, hint: `WhatsApp did not take it (${o.detail}). Press again, or send this from your phone.` } };
    default:
      // The automatic-only reasons never come out of sendThankYou.
      return { status: 500, body: { error: o.reason, hint: "Nothing was sent." } };
  }
}
