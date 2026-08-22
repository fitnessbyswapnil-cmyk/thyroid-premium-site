/**
 * POST /api/quiz-lead
 *
 * Writes a full lead row from the interactive Thyroid Score assessment
 * (/assessment) to the SAME "Leads" sheet the rest of the funnel uses —
 * so the admin dashboard, WhatsApp sequences, and lead scoring all keep
 * working unchanged. Public route (no admin key) — visitors call this.
 *
 * Column positions are resolved by HEADER NAME against the live sheet
 * (same lastIndexOf pattern as /api/admin/dashboard), falling back to the
 * proven positions already used in production. This keeps writer and
 * reader (the admin dashboard) permanently in sync — if a header name
 * isn't found and has no known fallback, that field is simply skipped
 * rather than guessed, so nothing ever gets written to the wrong column.
 *
 * Also forwards to the Make.com Lifecycle webhook (server-side, mirrors
 * BookingFlow.tsx's client-side call) so the Welcome/Nudge/Close email
 * sequence picks up quiz leads exactly like native-form leads.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { getSheetsClient, SHEET_NAME } from "../admin/_lib";
import { sendWelcomeLead, sendWelcomeLeadWithLink, sendTryingLanguages, isTemplateConfigError, sendBookingConfirmation, sendBookingConfirmedFree } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";
// after() work runs inside the route's budget, so give the WhatsApp + Make
// calls room to finish rather than inheriting a short default.
export const maxDuration = 30;

const MAKE_WEBHOOK_URL = "https://hook.us2.make.com/vafr1x6if1eehv2vxhyfw74ihh3b2nz8";

type QuizLeadPayload = {
  // Which entry point wrote this lead. booking-payment sets
  // "calcom_pay_at_end", which selects booking_confirmation over welcome_lead.
  source?: string;
  leadId?: string;
  name?: string;
  phone?: string;
  email?: string;
  city?: string;
  age?: string;
  diagnosis?: string;
  onMedication?: string;
  struggleDuration?: string;
  symptoms?: string; // joined
  biggestChallenge?: string; // MUST match painLine()/PROOF_MAP keywords on the dashboard
  triedBefore?: string; // joined, "Nothing structured yet" when none
  amountSpent?: string;
  goal?: string;
  commitment?: string; // "1".."10"
  timing?: string;
  budget?: string; // what she said she can invest — sales signal, never scored
  decisionMaker?: string; // whether she signs off alone — sales signal, never scored
  leadScore?: number;
  leadTier?: string;
  attribution?: {
    utm_source?: string;
    utm_medium?: string;
    utm_campaign?: string;
    utm_content?: string;
    utm_term?: string;
    fbclid?: string;
    visitor_id?: string;
  };
};

// Proven positions from the live sheet (same block /api/admin/dashboard
// reads) — used only when the header name isn't found in the live row.
const FALLBACK: Record<string, number> = {
  Name: 2, Phone: 3, Email: 4, Age: 5, "Thyroid Condition": 6,
  "Weight Struggles": 7, "Main Goal": 10,
  "UTM Source": 11, "UTM Medium": 12, "UTM Campaign": 13, FBclid: 14, "Visitor ID": 15,
  Status: 16, "Lead Tier": 36, City: 37, Goal: 38, "Biggest Challenge": 39,
  Diagnosis: 40, "On Medication": 41, "Struggle Duration": 42, "Tried Before": 44,
  "Amount Spent": 45, "Commitment (1-10)": 46, Timing: 47, "UTM Content": 50,
  "UTM Term": 51, "Lead Score": 52,
};

const str = (v?: string) => (v ?? "").toString().trim().slice(0, 500);

export async function POST(req: NextRequest) {
  let payload: QuizLeadPayload;
  try {
    payload = (await req.json()) as QuizLeadPayload;
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }
  if (!payload.name || !payload.phone || !payload.email) {
    return NextResponse.json({ error: "missing_contact_fields" }, { status: 400 });
  }

  try {
    const { sheets, sheetId } = await getSheetsClient();
    const hdrRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A1:BC1`,
    });
    const hdr = ((hdrRes.data.values?.[0] as string[]) ?? []).map((h) => (h ?? "").trim());
    const idx = (name: string): number | null => {
      const i = hdr.lastIndexOf(name);
      if (i >= 0) return i;
      return name in FALLBACK ? FALLBACK[name] : null;
    };

    // "Budget" and "Decision Maker" are columns the sheet may not have yet.
    // idx() returns null for headers it has never seen and set() then silently
    // skips the value — so without this, both answers would be collected,
    // scored-out, and quietly dropped.
    //
    // Both are appended past every existing column so they can never collide
    // with the reserved Booking columns (17/18) owned by the Cal.com Make
    // scenario. Written in ONE header update rather than two, so a failure
    // cannot leave the sheet with one new column and not the other.
    let budgetIdx = hdr.lastIndexOf("Budget");
    let decisionIdx = hdr.lastIndexOf("Decision Maker");
    const needBudget = budgetIdx < 0 && !!str(payload.budget);
    const needDecision = decisionIdx < 0 && !!str(payload.decisionMaker);
    if (needBudget || needDecision) {
      if (needBudget) {
        budgetIdx = hdr.length;
        hdr[budgetIdx] = "Budget";
      }
      if (needDecision) {
        decisionIdx = hdr.length;
        hdr[decisionIdx] = "Decision Maker";
      }
      try {
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${SHEET_NAME}!1:1`,
          valueInputOption: "RAW",
          requestBody: { values: [hdr] },
        });
      } catch (hdrErr) {
        console.error("[quiz-lead] could not add sales-signal headers:", hdrErr instanceof Error ? hdrErr.message : String(hdrErr));
        // Fall through: lose these two values, never the lead itself.
        if (needBudget) budgetIdx = -1;
        if (needDecision) decisionIdx = -1;
      }
    }

    const cells = new Map<number, string>();
    const set = (name: string, value: string) => {
      if (!value) return;
      const i = idx(name);
      if (i !== null) cells.set(i, value);
    };

    // Fixed positions (not header-name-dependent, matches /api/leads convention)
    cells.set(0, new Date().toISOString()); // Timestamp
    cells.set(1, str(payload.leadId)); // Lead ID

    set("Name", str(payload.name));
    set("Phone", str(payload.phone));
    set("Email", str(payload.email));
    set("Age", str(payload.age));
    set("Thyroid Condition", str(payload.diagnosis));
    set("Weight Struggles", str(payload.symptoms));
    set("Main Goal", str(payload.goal));
    set("UTM Source", str(payload.attribution?.utm_source));
    set("UTM Medium", str(payload.attribution?.utm_medium));
    set("UTM Campaign", str(payload.attribution?.utm_campaign));
    set("FBclid", str(payload.attribution?.fbclid));
    set("Visitor ID", str(payload.attribution?.visitor_id));
    set("Status", "lead_captured");
    set("Lead Tier", str(payload.leadTier));
    set("City", str(payload.city));
    set("Goal", str(payload.goal));
    set("Biggest Challenge", str(payload.biggestChallenge));
    set("Diagnosis", str(payload.diagnosis));
    set("On Medication", str(payload.onMedication));
    set("Struggle Duration", str(payload.struggleDuration));
    set("Tried Before", str(payload.triedBefore));
    set("Amount Spent", str(payload.amountSpent));
    set("Commitment (1-10)", str(payload.commitment));
    set("Timing", str(payload.timing));
    if (budgetIdx >= 0 && str(payload.budget)) cells.set(budgetIdx, str(payload.budget));
    if (decisionIdx >= 0 && str(payload.decisionMaker)) cells.set(decisionIdx, str(payload.decisionMaker));
    set("UTM Content", str(payload.attribution?.utm_content));
    set("UTM Term", str(payload.attribution?.utm_term));
    if (typeof payload.leadScore === "number") set("Lead Score", String(payload.leadScore));

    const width = cells.size ? Math.max(...cells.keys()) + 1 : 0;
    const row = Array.from({ length: width }, (_, i) => cells.get(i) ?? "");

    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId,
      range: `${SHEET_NAME}!A1`,
      valueInputOption: "USER_ENTERED",
      requestBody: { values: [row] },
    });
  } catch (err) {
    console.error("[quiz-lead] sheet write failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "sheet_write_failed" }, { status: 500 });
  }

  // Best-effort — never blocks the response to the visitor.
  //
  // Wrapped in after() rather than left as a bare un-awaited promise: on
  // Vercel the serverless invocation can freeze the moment the response is
  // returned, killing any still-in-flight fetch. after() is the framework's
  // supported way to keep post-response work alive to completion.
  after(async () => {
    try {
      await fetch(MAKE_WEBHOOK_URL, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: str(payload.name),
          email: str(payload.email),
          phone: str(payload.phone),
          q1: str(payload.diagnosis),
          q2: str(payload.struggleDuration),
          q3: str(payload.goal),
          stage: "qualified_unpaid",
          submitted_at: new Date().toISOString(),
          source: "thyroid_score_quiz",
        }),
      });
    } catch (err) {
      console.error("[quiz-lead] Make webhook failed:", err instanceof Error ? err.message : String(err));
    }
  });

  // First-touch WhatsApp, fired the instant the quiz is finished.
  //
  // This is the fix for the funnel's biggest measured leak: leads were
  // sitting 2-9 hours waiting for a manual WhatsApp, by which point the pain
  // that made them fill the form has faded. sendWelcomeLead is a no-op until
  // WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID exist, so this is inert until
  // billing is live on the WABA.
  //
  // Never allowed to reject: a Meta outage must not fail a submission the
  // visitor already completed, and the lead is already safely in the sheet.
  //
  // 2026-08-18: this was a bare un-awaited promise, which made welcome_lead
  // fire only intermittently in production -- a real end-to-end test got no
  // message at all. On Vercel the serverless invocation can be frozen as soon
  // as the response is returned, so a fetch to Meta's Graph API that takes a
  // few hundred ms often never completed. Nothing logged, because the whole
  // execution context was gone. after() keeps the invocation alive until the
  // send finishes, and the result is now logged either way so a silent
  // failure can never look like a success again.
  if (str(payload.phone)) {
    after(async () => {
      try {
        const phone = str(payload.phone);
        const name = str(payload.name);
        const leadId = str(payload.leadId);

        // A Cal.com booking is not a quiz completion, and /api/booking-payment
        // routes through here to reuse the sheet contract. Without this branch
        // she receives welcome_lead — a quiz follow-up that congratulates her on
        // a Thyroid Score she never took, with a button pointing at
        // /complete-payment, a route that now redirects away.
        //
        // She has already picked a slot, so the right message is the one that
        // confirms it and asks for her thyroid report. booking_confirmation is
        // UTILITY category, which is both cheaper and more deliverable than
        // marketing because it follows an action she just took.
        if (str(payload.source) === "calcom_pay_at_end") {
          // LIVE since 22 Aug 2026. booking_confirmed_free is approved.
          //
          // It replaced booking_confirmation, whose body reads "your payment is
          // confirmed ✅ … Pick your call time below", with a button back to the
          // Cal.com picker. Sending that to a woman who paid nothing and has
          // already chosen a slot is worse than sending nothing: it invents a
          // payment, then invites a duplicate booking.
          //
          // The template cannot currently be rewritten — WhatsApp Manager's
          // editor is inert on this WABA, gated behind "set up a payment
          // configuration", and Meta has separately reclassified it from
          // UTILITY to MARKETING.
          //
          // Cal.com still sends its own confirmation email, so she is not left
          // with nothing. Flip this to true the moment a correct template
          // exists. booking_confirmed_free was created 22 Aug 2026 and is IN
          // REVIEW — flip this the moment Meta approves it.
          const BOOKING_TEMPLATE_READY = true;
          if (!BOOKING_TEMPLATE_READY) {
            console.warn(
              "[quiz-lead] booking confirmation HELD — template still says 'payment confirmed'",
            );
            return;
          }
          const rb = await sendBookingConfirmedFree(phone, name);
          console.log(
            `[quiz-lead] booking_confirmation sent=${rb.sent}` +
              (rb.error ? ` error=${rb.error}` : "") +
              (rb.skipped ? ` skipped=${rb.skipped}` : ""),
          );
          return;
        }

        // Prefer welcome_lead_link. Two things make it better than the
        // original: its button deep-links to /complete-payment?leadId=...
        // rather than /assessment (the original's static button sends her
        // back to the quiz she just finished), and it reads her own answers
        // back to her instead of being a mail-merge.
        //
        // Her symptoms arrive comma-joined ("Tired by 4pm, Hair in the
        // comb"). Only the FIRST is used: it is the one she picked first and
        // reads naturally mid-sentence, where a full list would not.
        const topSymptom = str(payload.symptoms).split(",")[0].trim();
        const score = typeof payload.leadScore === "number" ? String(payload.leadScore) : "";

        // welcome_lead_link declares three body params. If ANY value is
        // missing the count would be wrong and Meta would reject the whole
        // send (132000), so fall straight through to the plain template
        // rather than sending something guaranteed to fail.
        const canPersonalise = !!(leadId && topSymptom && score);
        const personal = {
          score,
          // Lowercase the first letter so it sits inside a sentence: "the one
          // you told me bothers you most is tired by 4pm".
          symptom: topSymptom.charAt(0).toLowerCase() + topSymptom.slice(1),
        };

        let r = canPersonalise
          ? await sendTryingLanguages((language) => sendWelcomeLeadWithLink(phone, name, leadId, personal, language))
          : await sendWelcomeLead(phone, name);
        let usedTemplate = canPersonalise ? "welcome_lead_link" : "welcome_lead";

        // Config-level failure (template absent, or param count wrong) keeps
        // failing until a human intervenes, so fall back to the template that
        // definitely works. A transient failure deliberately does NOT fall
        // back — retrying it here would send the quiz-linked message for a
        // problem that may have resolved by the next attempt.
        if (!r.sent && isTemplateConfigError(r.error)) {
          usedTemplate = "welcome_lead (fallback)";
          r = await sendWelcomeLead(phone, name);
        }

        console.log(
          `[quiz-lead] ${usedTemplate} sent=${r.sent}` +
            (r.skipped ? ` skipped=${r.skipped}` : "") +
            (r.error ? ` error=${r.error}` : ""),
        );
      } catch (err) {
        console.error("[quiz-lead] welcome_lead threw (swallowed):", err instanceof Error ? err.message : String(err));
      }
    });
  }

  return NextResponse.json({ ok: true });
}
