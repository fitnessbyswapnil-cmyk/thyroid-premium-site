/**
 * POST /api/admin/webinar-attendance — the class attendance import.
 *
 * The meeting platform's participants export decides who actually turned up.
 * This matches it against that cohort's registrations (lib/webinar-attendance,
 * pure and tested), writes the minutes into the sheet, and sends Meta:
 *
 *   WebinarAttended       wbatt_<leadId>     everyone matched
 *   WebinarStayedToPitch  wbpitch_<leadId>   minutes >= 55
 *
 * Custom event names on purpose: Lead, Schedule and Purchase belong to the
 * /decode funnel and must never move because of a webinar. The D1 ledger makes
 * each id exactly-once, so re-running the same export sends nothing twice.
 *
 * Body: {
 *   csv: string,          // the export, pasted whole
 *   cohort?: string,      // defaults to this class (cohortKey of WEBINAR_START_ISO)
 *   dryRun?: boolean,     // report the matching, write and send nothing
 *   pitchMinutes?: number // default 55
 * }
 *
 * Auth: x-admin-key, or Bearer CRON_SECRET.
 */
import { NextRequest, NextResponse } from "next/server";
import { after } from "next/server";
import { checkAdminKey, getSheetsClient, SHEET_NAME } from "../_lib";
import { colLetter, ensureGridColumns, RESERVED_INDEXES } from "@/lib/lead-sheet";
import { buildUserData, sendCAPIEvent } from "@/lib/server-tracking";
import { WEBINAR_START_ISO } from "@/lib/webinar";
import { cohortKey, REGISTERED_STATUS, WEBINAR_DATE_HEADER } from "@/lib/webinar-reminders";
import {
  PITCH_MINUTES,
  matchAttendance,
  readAttendanceCsv,
  type AttendanceRegistrant,
} from "@/lib/webinar-attendance";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const ATTENDED_HEADER = "Attended Min";
const LEAD_ID_COL = 1;
const PHONE_COL = 3;

const findCol = (header: string[], title: string) =>
  header.findIndex((h) => String(h ?? "").trim().toLowerCase() === title.toLowerCase());

export async function POST(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const auth = req.headers.get("authorization") || "";
  const isCron = !!cronSecret && auth === `Bearer ${cronSecret}`;
  if (!isCron && !checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  let body: { csv?: string; cohort?: string; dryRun?: boolean; pitchMinutes?: number };
  try { body = await req.json(); } catch { return NextResponse.json({ error: "bad_json" }, { status: 400 }); }

  const csv = String(body.csv ?? "");
  if (csv.trim().length < 10) {
    return NextResponse.json({ error: "no_csv", hint: "paste the participants export as `csv`" }, { status: 400 });
  }
  const cohort = String(body.cohort ?? "").trim() || cohortKey(WEBINAR_START_ISO);
  const dryRun = body.dryRun === true;
  const pitchMinutes =
    Number.isFinite(body.pitchMinutes) && (body.pitchMinutes as number) > 0
      ? (body.pitchMinutes as number)
      : PITCH_MINUTES;

  try {
    const { sheets, sheetId } = await getSheetsClient();
    const res = await sheets.spreadsheets.values.get({ spreadsheetId: sheetId, range: SHEET_NAME });
    const all: string[][] = (res.data.values as string[][]) ?? [];
    const header = (all[0] ?? []).map((h) => String(h ?? ""));
    const rows = all.slice(1);

    const statusCol = findCol(header, "Status");
    const dateCol = findCol(header, WEBINAR_DATE_HEADER);
    const emailCol = findCol(header, "Email");
    const nameCol = 2;
    if (statusCol < 0 || dateCol < 0) {
      return NextResponse.json({ error: "missing_columns", statusCol, dateCol }, { status: 500 });
    }
    const cell = (r: string[], i: number) => (i >= 0 ? String(r?.[i] ?? "").trim() : "");

    const registrants: AttendanceRegistrant[] = [];
    const leadIdOf = new Map<number, string>();
    rows.forEach((r, i) => {
      if (cell(r, statusCol) !== REGISTERED_STATUS) return;
      if (cell(r, dateCol) !== cohort) return;
      const rowNumber = i + 2;
      registrants.push({
        rowNumber,
        phone: cell(r, PHONE_COL),
        email: cell(r, emailCol),
        name: cell(r, nameCol),
      });
      leadIdOf.set(rowNumber, cell(r, LEAD_ID_COL));
    });

    const result = matchAttendance(readAttendanceCsv(csv), registrants, pitchMinutes);
    const summary = {
      dryRun,
      cohort,
      pitchMinutes,
      registrants: registrants.length,
      attended: result.attended,
      stayedToPitch: result.stayedToPitch,
      unmatched: result.unmatched.length,
      matchedBy: {
        phone: result.matched.filter((m) => m.by === "phone").length,
        email: result.matched.filter((m) => m.by === "email").length,
        name: result.matched.filter((m) => m.by === "name").length,
      },
    };

    if (dryRun) {
      return NextResponse.json({
        ...summary,
        wouldWrite: result.matched.map((m) => ({ row: m.rowNumber, minutes: m.minutes, by: m.by, stayedToPitch: m.stayedToPitch })),
        unmatchedRows: result.unmatched,
      });
    }
    if (!result.matched.length) return NextResponse.json({ ...summary, written: 0, sent: 0, unmatchedRows: result.unmatched });

    // The minutes column must exist before anything is written into it.
    let attendedCol = findCol(header, ATTENDED_HEADER);
    if (attendedCol < 0 || RESERVED_INDEXES.has(attendedCol)) {
      attendedCol = header.length;
      await ensureGridColumns(sheets, sheetId, SHEET_NAME, attendedCol);
      await sheets.spreadsheets.values.update({
        spreadsheetId: sheetId,
        range: `${SHEET_NAME}!${colLetter(attendedCol)}1`,
        valueInputOption: "RAW",
        requestBody: { values: [[ATTENDED_HEADER]] },
      });
    }

    await sheets.spreadsheets.values.batchUpdate({
      spreadsheetId: sheetId,
      requestBody: {
        valueInputOption: "RAW",
        data: result.matched.map((m) => ({
          range: `${SHEET_NAME}!${colLetter(attendedCol)}${m.rowNumber}`,
          values: [[String(m.minutes)]],
        })),
      },
    });

    // Meta, after the response: the ledger keeps each id to one send, so a
    // re-import of the same export adds nothing.
    const sends = result.matched
      .map((m) => ({ m, leadId: leadIdOf.get(m.rowNumber) ?? "" }))
      .filter((x) => x.leadId);
    after(async () => {
      for (const { m, leadId } of sends) {
        const userData = buildUserData({ phone: m.phone, country: "in" });
        const common = {
          sourceUrl: "https://www.swapnilumbarkarfitness.in/webinar",
          userData,
          // The class happens off the website: this is not a website action.
          actionSource: "other" as const,
          eventTime: Math.floor(Date.parse(WEBINAR_START_ISO) / 1000),
        };
        try {
          await sendCAPIEvent("WebinarAttended", {
            ...common,
            eventId: `wbatt_${leadId}`,
            customData: { content_name: "thyroid_masterclass", minutes: m.minutes },
          });
          if (m.stayedToPitch) {
            await sendCAPIEvent("WebinarStayedToPitch", {
              ...common,
              eventId: `wbpitch_${leadId}`,
              customData: { content_name: "thyroid_masterclass", minutes: m.minutes },
            });
          }
        } catch (e) {
          console.error("[webinar-attendance] CAPI threw (swallowed):", e instanceof Error ? e.message : String(e));
        }
      }
      console.log(`[webinar-attendance] cohort=${cohort} attended=${sends.length} stayed=${result.stayedToPitch}`);
    });

    return NextResponse.json({
      ...summary,
      written: result.matched.length,
      queued: sends.length,
      noLeadId: result.matched.length - sends.length,
      unmatchedRows: result.unmatched,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[webinar-attendance] failed:", message);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
