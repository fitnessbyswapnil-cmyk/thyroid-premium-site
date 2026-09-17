/**
 * POST /api/webinar-register — a phone number and a medication radio, nothing
 * else. Name is accepted if a caller still sends one, never required.
 *
 * Writes the registrant into the same Leads tab every other entry point uses,
 * so she appears in the CRM, the dashboard and the reminder crons without any
 * of them learning a new shape. Source is "webinar" so she can be told apart
 * from a quiz lead later.
 *
 * Also writes a "Webinar Date" cohort key, which is how the reminder cron
 * (/api/cron/webinar-reminders) knows which class she registered for.
 *
 * Then confirms on WhatsApp. webinar_confirmed_v1 is UTILITY: a registration
 * confirmation is transactional, and utility is not subject to the frequency
 * cap that silently eats marketing templates — the cap that blocked a real
 * customer's welcome message this week.
 *
 * Never blocks the visitor: the sheet write is awaited because losing a
 * registration is unacceptable, but the WhatsApp runs in after() and every
 * failure is swallowed.
 *
 * Attribution: the ads carry utm_campaign={{adset.id}} and utm_content={{ad.id}}.
 * The page sends what it read from the URL; the middleware's cookies fill any
 * gap. UTM Source stays "webinar" — it is how the dashboard tells these rows
 * apart — and the real medium/campaign/content/term go in their own columns.
 *
 * CompleteRegistration, server leg: sent from here in after(), keyed
 * CompleteRegistration_<leadId>. /webinar/confirmed sends the one browser leg
 * with the same id, so Meta pairs them. Sent from here rather than from the
 * thank-you page so it cannot be replayed by reloading that page, and so it
 * still goes if the redirect never loads. The ledger (sendCAPIEvent) makes it
 * exactly-once. Not sent for an unverified registration, same as the WhatsApp:
 * a bot's registration must not teach the ad account what a registrant is.
 */
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { getSheetsClient, SHEET_NAME } from "../admin/_lib";
import { sendWhatsAppTemplate } from "@/lib/whatsapp";
import {
  getClientIp,
  getUserAgent,
  getCookieFromReq,
  buildUserData,
  sendCAPIEvent,
} from "@/lib/server-tracking";
import { cohortKey, SOURCE_PATH_HEADER, WEBINAR_DATE_HEADER } from "@/lib/webinar-reminders";
import { WEBINAR_WHEN_LONG, WEBINAR_START_ISO, checkIndianMobile, registrationEventId, WEBINAR_REGISTRATION_VALUE_INR } from "@/lib/webinar";
import { checkTurnstile, turnstileConfig, findOrAddColumn, BOT_CHECK_HEADER, UNVERIFIED } from "@/lib/turnstile";
import { colLetter, ensureGridColumns } from "@/lib/lead-sheet";

export const dynamic = "force-dynamic";

const str = (v: unknown) => String(v ?? "").trim();

export async function POST(req: NextRequest) {
  let body: {
    name?: string;
    phone?: string;
    medication?: string;
    attribution?: Record<string, unknown>;
    sourceUrl?: string;
    turnstileToken?: unknown;
  };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  // The page says registration closes when the session goes live. Make that
  // true here too, so a stale tab cannot book a seat for a session that has
  // started. Moving the date in lib/webinar.ts reopens it.
  if (Date.now() >= Date.parse(WEBINAR_START_ISO)) {
    return NextResponse.json({ error: "registration_closed" }, { status: 410 });
  }

  const name = str(body.name).slice(0, 80);
  const checked = checkIndianMobile(str(body.phone));
  if (!checked.ok) {
    return NextResponse.json({ error: "invalid_phone", message: checked.error }, { status: 400 });
  }
  const phone = checked.phone;
  const medication = ["Yes", "No", "Not sure"].includes(str(body.medication)) ? str(body.medication) : "";

  // URL value first (what this visit's ad said), cookie second.
  const utm = (k: string) => str(body.attribution?.[k]).slice(0, 120) || getCookieFromReq(req, k).slice(0, 120);
  const utmMedium = utm("utm_medium");
  const utmCampaign = utm("utm_campaign");
  const utmContent = utm("utm_content");
  const utmTerm = utm("utm_term");
  const fbclid = str(body.attribution?.fbclid).slice(0, 300) || getCookieFromReq(req, "_fbclid_raw");
  // Ours, not Meta's: "decode_nurture" means the /decode gate sent her here, so
  // the webinar's own cost per registration must not count her.
  const src = str(body.attribution?.src).slice(0, 40);
  const visitorId = getCookieFromReq(req, "_visitor_id");

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
      spreadsheetId: sheetId, range: `${SHEET_NAME}!1:1`,
    });
    const hdr = ((hdrRes.data.values?.[0] as string[]) ?? []).map((h) => String(h ?? "").trim());
    const at = (title: string) => hdr.lastIndexOf(title);

    const cells = new Map<number, string>();
    cells.set(0, new Date().toISOString());
    cells.set(1, leadId);
    if (name) cells.set(2, name);
    cells.set(3, phone);
    const put = (title: string, v: string) => { const i = at(title); if (i >= 0 && v) cells.set(i, v); };
    put("Status", "webinar_registered");
    put("On Medication", medication);
    put("Diagnosis", medication);
    put("UTM Source", "webinar");
    put("UTM Medium", utmMedium);
    put("UTM Campaign", utmCampaign);
    put("UTM Content", utmContent);
    put("UTM Term", utmTerm);
    put("FBclid", fbclid);
    put("Visitor ID", visitorId);

    const addColumn = (title: string) => findOrAddColumn({
      known: hdr,
      title,
      readFullHeader: async () => {
        const r = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: `${SHEET_NAME}!1:1` });
        return ((r.data.values?.[0] as string[]) ?? []).map((h) => String(h ?? ""));
      },
      writeHeaderCell: async (i, t) => {
        // The Leads grid is fixed-width; widen it first or the write fails.
        await ensureGridColumns(sheets, sheetId, SHEET_NAME, i);
        await sheets.spreadsheets.values.update({
          spreadsheetId: sheetId,
          range: `${SHEET_NAME}!${colLetter(i)}1`,
          valueInputOption: "RAW",
          requestBody: { values: [[t]] },
        });
        // Later lookups in this request must see the new column too.
        hdr[i] = t;
      },
    });

    // Which class she registered for, so the reminder cron reaches only this
    // class's registrants. A cohort key, not a date: see lib/webinar-reminders.
    if (src) {
      const srcIdx = await addColumn(SOURCE_PATH_HEADER);
      if (srcIdx >= 0) cells.set(srcIdx, src);
    }

    const dateIdx = await addColumn(WEBINAR_DATE_HEADER);
    if (dateIdx >= 0) cells.set(dateIdx, cohortKey(WEBINAR_START_ISO));
    else console.error("[webinar-register] could not place the Webinar Date column; she will get no reminders");

    // Bot check marker, only on an unverified registration. Same column and
    // value the quiz uses, so one filter covers both.
    if (unverified) {
      const botIdx = await addColumn(BOT_CHECK_HEADER);
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

  // Which confirmation to send. webinar_registered_v2 carries the class-group
  // and Starter Kit buttons; switch to it with a Worker variable once Meta has
  // approved it. The two take different body parameters.
  const template = (process.env.WEBINAR_CONFIRM_TEMPLATE ?? "").trim() || "webinar_confirmed_v1";
  const params = template === "webinar_confirmed_v1"
    ? [name.split(/\s+/)[0] || "there", WEBINAR_WHEN_LONG]
    : [WEBINAR_WHEN_LONG];

  // Unverified: no paid WhatsApp. The coach can still reach her from the sheet.
  if (!unverified) after(async () => {
    try {
      const r = await sendWhatsAppTemplate(phone, template, params);
      console.log(`[webinar-register] confirmation sent=${r.sent}` + (r.error ? ` error=${r.error}` : ""));
    } catch (e) {
      console.error("[webinar-register] confirmation threw (swallowed):", e instanceof Error ? e.message : String(e));
    }
  });

  const eventId = registrationEventId(leadId);
  if (!unverified) {
    const userData = buildUserData({
      phone,
      externalId: visitorId,
      clientIp: getClientIp(req),
      userAgent: getUserAgent(req),
      fbc: getCookieFromReq(req, "_fbc"),
      fbp: getCookieFromReq(req, "_fbp"),
      country: "in",
    });
    const sourceUrl = /^https:\/\/(www\.)?swapnilumbarkarfitness\.in\//.test(str(body.sourceUrl))
      ? str(body.sourceUrl).slice(0, 500)
      : "https://www.swapnilumbarkarfitness.in/webinar";
    after(async () => {
      try {
        const r = await sendCAPIEvent("CompleteRegistration", {
          eventId,
          sourceUrl,
          userData,
          customData: {
            value: WEBINAR_REGISTRATION_VALUE_INR,
            currency: "INR",
            content_name: "thyroid_masterclass",
            status: "registered",
          },
        });
        console.log(`[webinar-register] CompleteRegistration CAPI event_id=${eventId} success=${r.success}` + (r.error ? ` error=${r.error}` : ""));
      } catch (e) {
        console.error("[webinar-register] CompleteRegistration CAPI threw (swallowed):", e instanceof Error ? e.message : String(e));
      }
    });
  }

  // eventId goes back only when the server leg was sent: the thank-you page
  // fires the browser leg only when it has one to pair with.
  return NextResponse.json(unverified ? { ok: true, leadId, botCheck: UNVERIFIED } : { ok: true, leadId, eventId });
}
