/**
 * POST /api/webinar-register — two fields and a radio, nothing else.
 *
 * Writes the registrant into the same Leads tab every other entry point uses,
 * so she appears in the CRM, the dashboard and the reminder crons without any
 * of them learning a new shape. Source is "webinar" so she can be told apart
 * from a quiz lead later.
 *
 * Then confirms on WhatsApp. webinar_confirmed_v1 is UTILITY: a registration
 * confirmation is transactional, and utility is not subject to the frequency
 * cap that silently eats marketing templates — the cap that blocked a real
 * customer's welcome message this week.
 *
 * Never blocks the visitor: the sheet write is awaited because losing a
 * registration is unacceptable, but the WhatsApp runs in after() and every
 * failure is swallowed.
 */
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getSheetsClient, SHEET_NAME } from "../admin/_lib";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import { WEBINAR_WHEN_LONG } from "@/lib/webinar";
import { getClientIp } from "@/lib/server-tracking";
import { checkTurnstile, turnstileConfig, findOrAddColumn, BOT_CHECK_HEADER, UNVERIFIED } from "@/lib/turnstile";
import { colLetter, ensureGridColumns } from "@/lib/lead-sheet";

export const dynamic = "force-dynamic";

const str = (v: unknown) => String(v ?? "").trim();

export async function POST(req: NextRequest) {
  let body: { name?: string; phone?: string; medication?: string; turnstileToken?: unknown };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  const name = str(body.name).slice(0, 80);
  const digits = str(body.phone).replace(/\D/g, "");
  const phone = digits.length === 12 && digits.startsWith("91") ? digits.slice(2) : digits;
  const medication = str(body.medication).slice(0, 40);

  if (!name || phone.length !== 10) {
    return NextResponse.json({ error: "need_name_and_phone" }, { status: 400 });
  }

  // Bot check (Cloudflare Turnstile); the policy lives in lib/turnstile.ts.
  // Off until both keys are set. A refused token writes and sends nothing. A
  // missing one still saves her seat, marked, without the paid WhatsApp.
  const bot = await checkTurnstile({
    config: turnstileConfig(),
    token: body.turnstileToken,
    remoteIp: getClientIp(req),
  });
  if (bot.verdict === "reject") {
    console.warn(`[webinar-register] bot check REJECTED (${bot.reason}): nothing written, nothing sent`);
    return NextResponse.json({ error: "bot_check_failed" }, { status: 403 });
  }
  const unverified = bot.verdict === "unverified";
  // Logged here, before the sheet, so it is visible even if the write fails.
  if (unverified) {
    console.warn(`[webinar-register] bot check UNVERIFIED (${bot.reason}): saving and marking; WhatsApp skipped`);
  }

  const leadId = `web_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;

  try {
    const { sheets, sheetId } = await getSheetsClient();
    const hdrRes = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId, range: `${SHEET_NAME}!A1:BZ1`,
    });
    const hdr = ((hdrRes.data.values?.[0] as string[]) ?? []).map((h) => String(h ?? "").trim());
    const at = (title: string) => hdr.lastIndexOf(title);

    const cells = new Map<number, string>();
    cells.set(0, new Date().toISOString());
    cells.set(1, leadId);
    cells.set(2, name);
    cells.set(3, phone);
    const put = (title: string, v: string) => { const i = at(title); if (i >= 0 && v) cells.set(i, v); };
    put("Status", "webinar_registered");
    put("On Medication", medication);
    put("Diagnosis", medication);
    put("UTM Source", "webinar");

    // Bot check marker, only on an unverified registration. Same column and
    // value the quiz uses, so one filter covers both.
    if (unverified) {
      const botIdx = await findOrAddColumn({
        known: hdr,
        title: BOT_CHECK_HEADER,
        readFullHeader: async () => {
          const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!1:1` });
          return ((r.data.values?.[0] as string[]) ?? []).map((h) => String(h ?? ""));
        },
        writeHeaderCell: async (i, title) => {
          // The Leads grid is fixed-width; widen it first or the write fails.
          await ensureGridColumns(sheets, sheetId, SHEET_NAME, i);
          await sheets.spreadsheets.values.update({
            spreadsheetId: sheetId,
            range: `${SHEET_NAME}!${colLetter(i)}1`,
            valueInputOption: "RAW",
            requestBody: { values: [[title]] },
          });
        },
      });
      if (botIdx >= 0) cells.set(botIdx, UNVERIFIED);
      else console.error("[webinar-register] could not place the Bot Check marker; registration saved unmarked");
    }

    const width = Math.max(...cells.keys()) + 1;
    const row = Array.from({ length: width }, (_, i) => cells.get(i) ?? "");
    await sheets.spreadsheets.values.append({
      spreadsheetId: sheetId, range: `${SHEET_NAME}!A1`,
      valueInputOption: "USER_ENTERED", requestBody: { values: [row] },
    });
  } catch (err) {
    console.error("[webinar-register] sheet write failed:", err instanceof Error ? err.message : String(err));
    return NextResponse.json({ error: "sheet_write_failed" }, { status: 500 });
  }

  // Unverified: no paid WhatsApp. The coach can still reach her from the sheet.
  if (!unverified) after(async () => {
    try {
      const first = name.split(/\s+/)[0] || "there";
      const r = await sendWhatsAppTemplate(phone, "webinar_confirmed_v1", [first, WEBINAR_WHEN_LONG]);
      console.log(`[webinar-register] confirmation sent=${r.sent}` + (r.error ? ` error=${r.error}` : ""));
    } catch (e) {
      console.error("[webinar-register] confirmation threw (swallowed):", e instanceof Error ? e.message : String(e));
    }
  });

  return NextResponse.json(unverified ? { ok: true, leadId, botCheck: UNVERIFIED } : { ok: true, leadId });
}
