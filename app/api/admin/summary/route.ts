/**
 * POST /api/admin/summary — his notes Doc becomes her two-page consultation
 * summary PDF, saved in her Drive folder and, when asked, sent to her on
 * WhatsApp.
 *
 * Body: { name, phone, when, send? } — straight off the Today row. `when` is
 * the call's time; it dates the PDF and its file name, and a missing one means
 * today.
 *
 *   200 { pdfUrl, fileId, notesUrl, warnings[], windowOpen, windowMinutesLeft, sent? }
 *   422 { error: "doc_not_found" | "notes_incomplete", missing[], notesUrl?, hint }
 *   409 { error: "window_closed", waText, hint }      send:true and her 24h window is shut
 *   429 { error: "renderer_busy", hint }               Browser Run's free allowance, try again
 *   503 { error: "not_configured", hint }              Drive not connected
 *   502 bridge, renderer and WhatsApp failures, each with its own error and hint
 *
 * THE ORDER IS DELIBERATE
 * Read everything at once (her notes through the Drive bridge, her quiz
 * answers from the Leads sheet, her WhatsApp thread for the reply window),
 * build the summary, print it, save it, and only then send. The PDF is in her
 * folder before WhatsApp is ever asked, so a failed or refused send never
 * costs him the file: every error after the save still carries its link.
 *
 * Saving replaces the earlier summary for the same call (one per call, keyed
 * on her digits and the call's date), so pressing Summary again after fixing
 * the notes leaves one current PDF, not two that disagree.
 *
 * Auth: x-admin-key, like the rest of /api/admin/*.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";
import { liveBridgeConfig } from "@/lib/bridge-settings";
import { BridgeError, bridgeHint, digits10, readNotesDoc, saveClientFile, type NotesContent } from "@/lib/drive";
import {
  buildSummary,
  factsFromAnswers,
  leadFactsFromSheet,
  mergeFacts,
  missingFacts,
  replyWindow,
  summaryCaption,
  summaryDedupeKey,
  summaryFileName,
  type LeadFacts,
} from "@/lib/summary";
import { summaryHtml } from "@/lib/summary-html";
import { PdfRenderError, pdfHint, renderPdf } from "@/lib/pdf-render";
import { appendMessage, markThreadRead, readMessages } from "@/lib/wa-messages";
import { sendWhatsAppDocument, toWhatsAppNumber } from "@/lib/whatsapp";
import { fetchBookings } from "@/lib/cal-bookings";
import { recordMark } from "@/lib/journey-marks";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const fail = (status: number, body: Record<string, unknown>) => NextResponse.json(body, { status });

const bridgeFailure = (err: unknown) => {
  const e = err instanceof BridgeError ? err : new BridgeError("failed", err instanceof Error ? err.message : String(err));
  console.error("[admin/summary] bridge:", e.code, e.detail);
  return fail(e.code === "not_configured" ? 503 : 502, { error: e.code, hint: bridgeHint(e) });
};

/** A wait that gives up quietly: the header can go without her city, the PDF cannot wait on Cal.com. */
const within = <T>(ms: number, work: Promise<T>): Promise<T | null> =>
  Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]).catch(() => null);

/**
 * Her age, city, diagnosis and how long she has been stuck. The Leads sheet
 * holds her quiz answers; her Cal.com booking holds the booking form's, and
 * fills only what the quiz left blank. Neither failing stops the summary:
 * the header just says less.
 */
async function readFacts(phone: string, when: string): Promise<Partial<LeadFacts>> {
  let facts: Partial<LeadFacts> = {};
  try {
    const { sheets, sheetId } = await getSheetsClient();
    // A1:DZ, never narrower: the sheet is 93 columns wide.
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!A1:DZ` });
    facts = leadFactsFromSheet((res.data.values as unknown[][]) ?? [], phone);
  } catch (err) {
    console.error("[admin/summary] Leads read failed (header degrades):", err instanceof Error ? err.message : String(err));
  }
  if (!missingFacts(facts).length) return facts;

  const found = await within(6000, fetchBookings(50));
  const email = (facts.email ?? "").toLowerCase();
  const callAt = Date.parse(when);
  const mine = (found?.bookings ?? [])
    .filter((b) => digits10(b.phone) === phone || (email && b.email === email))
    .sort((a, b) => Math.abs(Date.parse(a.startIso) - callAt) - Math.abs(Date.parse(b.startIso) - callAt));
  return mine.length ? mergeFacts(facts, factsFromAnswers(mine[0].answers)) : facts;
}

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return fail(401, { error: "unauthorized", hint: "The admin key is missing or wrong." });

  let body: { name?: string; phone?: string; when?: string; send?: boolean };
  try {
    body = await req.json();
  } catch {
    return fail(400, { error: "bad_json", hint: "The request was not JSON." });
  }
  const phone = digits10(String(body.phone ?? ""));
  if (phone.length !== 10) return fail(400, { error: "need_phone", hint: "Her phone number is how her folder is found, and this row has none." });
  const rawWhen = String(body.when ?? "").trim();
  const when = rawWhen && Number.isFinite(Date.parse(rawWhen)) ? rawWhen : new Date().toISOString();
  const send = body.send === true;

  // A missing setting is a setup problem, not a bad request: say which one.
  const cfg = await liveBridgeConfig();
  if (cfg.missing.length) {
    return fail(503, { error: "not_configured", hint: bridgeHint(new BridgeError("not_configured", cfg.missing.join(", "))) });
  }

  const nameIn = String(body.name ?? "").trim();
  const factsP = readFacts(phone, when);
  const threadP = readMessages().then(
    (messages) => replyWindow(messages, phone, Date.now()),
    (err) => {
      console.error("[admin/summary] Messages read failed (window treated as shut):", err instanceof Error ? err.message : String(err));
      return { open: false, minutesLeft: 0, unknown: true };
    },
  );

  let notes: NotesContent | null;
  try {
    // Title "" = the newest notes Doc in her folder, whatever name it was filed under.
    notes = await readNotesDoc({ name: nameIn, phone, when }, cfg);
  } catch (err) {
    return bridgeFailure(err);
  }
  if (!notes) {
    return fail(422, { error: "doc_not_found", missing: [], hint: bridgeHint(new BridgeError("doc_not_found")) });
  }

  const facts = await factsP;
  const name = nameIn || facts.name || "";
  if (!name) return fail(400, { error: "need_name", hint: "Her name is not on this row or in the Leads sheet, and the PDF is addressed to her." });

  const built = buildSummary({ notes, facts, call: { name, phone, when } });
  if (!built.model) {
    return fail(422, {
      error: "notes_incomplete",
      missing: built.missing,
      notesUrl: notes.url,
      hint: `Fill in ${built.missing.map((m) => `“${m}”`).join(" and ")} in her notes Doc, then press Summary again.`,
    });
  }
  const warnings = [...built.warnings];

  let pdf: Uint8Array;
  try {
    pdf = await renderPdf(summaryHtml(built.model));
  } catch (err) {
    const e = err instanceof PdfRenderError ? err : new PdfRenderError("renderer_failed", err instanceof Error ? err.message : String(err));
    console.error("[admin/summary] renderer:", e.code, e.detail);
    return fail(e.code === "renderer_busy" ? 429 : 502, { error: e.code, hint: pdfHint(e) });
  }

  const fileName = summaryFileName(name, when);
  let saved: { id: string; url: string };
  try {
    saved = await saveClientFile(
      {
        name,
        phone,
        fileName,
        mimeType: "application/pdf",
        base64: Buffer.from(pdf).toString("base64"),
        dedupeKey: summaryDedupeKey(phone, when),
        replace: true,
      },
      cfg,
    );
  } catch (err) {
    return bridgeFailure(err);
  }
  // The journey card's "summary made" (lib/journey-marks), with the PDF's link
  // so the card can open it for review. After the reply: the PDF is saved
  // whatever happens to this bookkeeping.
  after(() => recordMark(phone, "summary_made", saved.url));

  const thread = await threadP;
  const windowKnown = !("unknown" in thread);
  if (!windowKnown) warnings.push("Her WhatsApp thread could not be read, so her reply window is shown as shut.");
  const done = {
    pdfUrl: saved.url,
    fileId: saved.id,
    notesUrl: notes.url,
    warnings,
    windowOpen: thread.open,
    windowMinutesLeft: thread.minutesLeft,
  };
  if (!send) return NextResponse.json(done);

  const caption = summaryCaption(name);
  const shut = () =>
    fail(409, {
      error: "window_closed",
      waText: caption,
      hint: "Her 24-hour WhatsApp window is shut, so the business number cannot send her a file. The PDF is saved in her folder: send it from your phone with this message.",
      pdfUrl: saved.url,
      fileId: saved.id,
    });
  // Shut by her own thread: do not even try. Unreadable thread: let Meta
  // decide, since it answers 131047 for a shut window anyway.
  if (windowKnown && !thread.open) return shut();

  const sent = await sendWhatsAppDocument(phone, pdf, fileName, caption);
  if (sent.windowClosed) return shut();
  if (!sent.sent) {
    const notConfigured = sent.skipped === "whatsapp_not_configured";
    return fail(502, {
      error: notConfigured ? "whatsapp_not_configured" : "send_failed",
      hint: notConfigured
        ? "WhatsApp is not set up on the worker, so nothing was sent. The PDF is saved in her folder."
        : `WhatsApp did not take the PDF (${sent.error || sent.skipped || "no reason given"}). It is saved in her folder; press Send again.`,
      pdfUrl: saved.url,
      fileId: saved.id,
    });
  }

  // Sent: her card's Summary step is done and the follow-ups start from here.
  after(() => recordMark(phone, "summary_sent", saved.url));

  // Our side of the conversation, so her thread shows what she was sent. After
  // the response: the send already happened, and logging it must not slow or
  // fail the reply. Same record the inbox's own replies write.
  const to = toWhatsAppNumber(phone);
  after(async () => {
    try {
      await appendMessage({
        ts: new Date().toISOString(),
        phone: to,
        direction: "out",
        text: caption,
        messageId: sent.messageId ?? "",
        name: "",
        read: true,
        mediaId: sent.mediaId ?? "",
        mediaType: "document",
        mediaMime: "application/pdf",
        mediaName: fileName,
      });
      await markThreadRead(to);
    } catch (err) {
      console.error("[admin/summary] sent but failed to log:", err instanceof Error ? err.message : String(err));
    }
  });

  return NextResponse.json({ ...done, sent: true });
}
