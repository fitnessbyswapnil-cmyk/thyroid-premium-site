/**
 * POST /api/admin/precall — her pre-call PDF ("Why your weight isn't moving:
 * what your answers and your report show"), saved in her Drive folder and,
 * when asked, sent to her on WhatsApp. The same family as /api/admin/summary,
 * built the same way.
 *
 * Body: { name, phone, when, markers?: MarkerRow[], send? }. `when` is the
 * call's time; it dates the file. MarkerRow = { marker, value, range?, flag? }.
 * Or { phone, sentFromPhone: true, pdfUrl } when he sent it from his own
 * phone: that only records the journey mark, and answers { recorded: true }.
 *
 *   200 { pdfUrl, fileId, warnings[], windowOpen, windowMinutesLeft, markerSource, sent? }
 *   422 { error: "no_markers", hint, warnings[], notesUrl? }  nothing typed and nothing in her notes Doc's table
 *   409 { error: "window_closed", waText, hint, pdfUrl, fileId }  send:true and her 24h window is shut
 *   429 { error: "renderer_busy", hint }                Browser Run's free allowance, try again
 *   503 { error: "not_configured", hint }               Drive not connected
 *   502 bridge, renderer and WhatsApp failures, each with its own error and hint
 *
 * WHERE THE MARKERS COME FROM (lib/precall pickMarkers)
 * Rows he typed on her card, which may have been pre-filled by "Read her
 * report" (POST /api/admin/precall/extract) and then checked by him. When he
 * typed nothing at all, the Marker / Her value (range) / Flag columns of her
 * notes Doc. Nothing else: no value reaches the PDF that is not in one of the
 * two. An AI reading never comes straight here; it only fills his form.
 *
 * THE ORDER IS THE SUMMARY'S, FOR THE SAME REASON
 * Read everything at once (her quiz answers from the Leads sheet, her notes
 * Doc when it is needed, her WhatsApp thread for the reply window), build,
 * print, save, and only then send. The PDF is in her folder before WhatsApp
 * is ever asked, so a refused send never costs him the file. Saving replaces
 * the earlier pre-call PDF for the same call (one per call), so pressing
 * Generate again after fixing a value leaves one current file, not two.
 *
 * The journey card learns about it through recordMark, in after(): a mark is
 * bookkeeping, and must neither slow nor fail the reply.
 *
 * Auth: x-admin-key, like the rest of /api/admin/*.
 */
import { NextRequest, NextResponse, after } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";
import { liveBridgeConfig } from "@/lib/bridge-settings";
import { BridgeError, bridgeHint, digits10, readNotesDoc, saveClientFile, type NotesContent } from "@/lib/drive";
import { factsFromAnswers, replyWindow } from "@/lib/summary";
import {
  buildPrecall,
  cleanMarkerRows,
  pickMarkers,
  precallCaption,
  precallDedupeKey,
  precallFileName,
  quizFactsFromSheet,
  type QuizFacts,
} from "@/lib/precall";
import { precallHtml } from "@/lib/precall-html";
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
  console.error("[admin/precall] bridge:", e.code, e.detail);
  return fail(e.code === "not_configured" ? 503 : 502, { error: e.code, hint: bridgeHint(e) });
};

/** A wait that gives up quietly: the PDF can go without her city, it cannot wait on Cal.com. */
const within = <T>(ms: number, work: Promise<T>): Promise<T | null> =>
  Promise.race([work, new Promise<null>((resolve) => setTimeout(() => resolve(null), ms))]).catch(() => null);

const GAP_FIELDS = ["age", "city", "diagnosis", "stuck"] as const;

/**
 * Her answers. The Leads sheet holds the quiz's; her Cal.com booking fills
 * only a field the quiz left EMPTY (factsFromAnswers keeps an answer only when
 * it reads as that fact). Unlike the summary, an answer she did give is never
 * swapped for the booking's: "Not tested, but I think so" is hers to print.
 * Neither failing stops the PDF; it just says less.
 */
async function readFacts(phone: string, when: string): Promise<Partial<QuizFacts>> {
  let facts: Partial<QuizFacts> = {};
  try {
    const { sheets, sheetId } = await getSheetsClient();
    // A1:DZ, never narrower: the sheet is 93 columns wide.
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!A1:DZ` });
    facts = quizFactsFromSheet((res.data.values as unknown[][]) ?? [], phone);
  } catch (err) {
    console.error("[admin/precall] Leads read failed (answers left out):", err instanceof Error ? err.message : String(err));
  }
  if (GAP_FIELDS.every((k) => (facts[k] ?? "").trim())) return facts;

  const found = await within(6000, fetchBookings(50));
  const callAt = Date.parse(when);
  const mine = (found?.bookings ?? [])
    .filter((b) => digits10(b.phone) === phone)
    .sort((a, b) => Math.abs(Date.parse(a.startIso) - callAt) - Math.abs(Date.parse(b.startIso) - callAt));
  if (!mine.length) return facts;
  const fromBooking = factsFromAnswers(mine[0].answers);
  const filled: Partial<QuizFacts> = { ...facts };
  for (const k of GAP_FIELDS) {
    if (!(filled[k] ?? "").trim() && fromBooking[k]) filled[k] = fromBooking[k];
  }
  return filled;
}

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return fail(401, { error: "unauthorized", hint: "The admin key is missing or wrong." });

  let body: { name?: string; phone?: string; when?: string; markers?: unknown; send?: boolean; sentFromPhone?: boolean; pdfUrl?: string };
  try {
    body = await req.json();
  } catch {
    return fail(400, { error: "bad_json", hint: "The request was not JSON." });
  }
  const phone = digits10(String(body.phone ?? ""));
  if (phone.length !== 10) return fail(400, { error: "need_phone", hint: "Her phone number is how her folder is found, and this card has none." });

  // He tapped "Send from your phone" (her window was shut): the file goes from
  // his own WhatsApp, so all this records is that he sent it, for the journey
  // card's Pre-call step. Nothing is made, saved or sent here.
  if (body.sentFromPhone === true) {
    const pdfUrl = String(body.pdfUrl ?? "").trim();
    after(() => recordMark(phone, "precall_sent", /^https:\/\//.test(pdfUrl) ? pdfUrl : undefined));
    return NextResponse.json({ recorded: true });
  }

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
      console.error("[admin/precall] Messages read failed (window treated as shut):", err instanceof Error ? err.message : String(err));
      return { open: false, minutesLeft: 0, unknown: true };
    },
  );

  // Her notes Doc is read only when he typed nothing: typed rows win outright.
  let notes: NotesContent | null = null;
  if (!cleanMarkerRows(body.markers).touched) {
    try {
      notes = await readNotesDoc({ name: nameIn, phone, when }, cfg);
    } catch (err) {
      return bridgeFailure(err);
    }
  }
  const picked = pickMarkers(body.markers, notes);
  if (!picked.rows.length) {
    return fail(422, {
      error: "no_markers",
      warnings: picked.warnings,
      ...(notes ? { notesUrl: notes.url } : {}),
      hint: picked.source === "typed"
        ? "Every marker row needs a marker name and a value."
        : notes
          ? "Her notes Doc has no marker values yet. Type them on the card, or fill the Marker and Her value columns in her notes."
          : "Type her marker values on the card. (She has no notes Doc to read them from.)",
    });
  }

  const facts = await factsP;
  const name = nameIn || facts.name || "";
  if (!name) return fail(400, { error: "need_name", hint: "Her name is not on this card or in the Leads sheet, and the PDF is addressed to her." });

  const built = buildPrecall({ markers: picked.rows, facts, call: { name, phone, when } });
  if (!built.model) return fail(422, { error: "no_markers", warnings: built.warnings, hint: "Every marker row needs a marker name and a value." });
  const warnings = [...picked.warnings, ...built.warnings];

  let pdf: Uint8Array;
  try {
    pdf = await renderPdf(precallHtml(built.model));
  } catch (err) {
    const e = err instanceof PdfRenderError ? err : new PdfRenderError("renderer_failed", err instanceof Error ? err.message : String(err));
    console.error("[admin/precall] renderer:", e.code, e.detail);
    return fail(e.code === "renderer_busy" ? 429 : 502, { error: e.code, hint: pdfHint(e) });
  }

  const fileName = precallFileName(name, when);
  let saved: { id: string; url: string };
  try {
    saved = await saveClientFile(
      {
        name,
        phone,
        fileName,
        mimeType: "application/pdf",
        base64: Buffer.from(pdf).toString("base64"),
        dedupeKey: precallDedupeKey(phone, when),
        replace: true,
      },
      cfg,
    );
  } catch (err) {
    return bridgeFailure(err);
  }
  after(() => recordMark(phone, "precall_made", saved.url));

  const thread = await threadP;
  const windowKnown = !("unknown" in thread);
  if (!windowKnown) warnings.push("Her WhatsApp thread could not be read, so her reply window is shown as shut.");
  const done = {
    pdfUrl: saved.url,
    fileId: saved.id,
    warnings,
    windowOpen: thread.open,
    windowMinutesLeft: thread.minutesLeft,
    markerSource: picked.source,
  };
  if (!send) return NextResponse.json(done);

  const caption = precallCaption(name, built.model.facts.length > 0);
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

  // Our side of the conversation, so her thread shows what she was sent, and
  // the journey card's Pre-call step. After the response: the send already
  // happened, and recording it must not slow or fail the reply.
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
      console.error("[admin/precall] sent but failed to log:", err instanceof Error ? err.message : String(err));
    }
    await recordMark(phone, "precall_sent", saved.url);
  });

  return NextResponse.json({ ...done, sent: true });
}
