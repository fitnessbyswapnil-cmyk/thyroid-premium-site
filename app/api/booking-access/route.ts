/**
 * GET /api/booking-access?orderId=…&leadId=…
 *
 * Answers one question for /session-booked: is this person entitled to see the
 * booking calendar?
 *
 * WHY SERVER-SIDE. The Cal.com embed used to render for anyone who opened
 * /session-booked, so the URL alone was a free consultation — the page even
 * told them "Payment received". Any check the browser can do, a visitor can
 * skip, so entitlement is decided here and the client only renders what this
 * route allows.
 *
 * TWO WAYS TO QUALIFY
 *   orderId → asked directly of Cashfree; PAID is the strongest possible proof.
 *   leadId  → her Leads row shows Paid = Y (or a payment_received status).
 *             Covers a payer whose order id was lost — a different device, or
 *             cleared storage — which used to be a silent dead end.
 *
 * FAILURE POLICY, chosen deliberately because ads are running.
 * A wrongly blocked payer costs a booked consultation; a wrongly admitted
 * stranger costs a calendar slot. So:
 *   • no order id and no paid lead        → DENY (the freeloader case)
 *   • an order id present but Cashfree or Sheets errored → ALLOW, flagged
 *     "degraded". Only someone who actually went through checkout has an order
 *     id, so an outage can never lock a real customer out of her call.
 */
import { NextRequest, NextResponse } from "next/server";
import { google } from "googleapis";

export const dynamic = "force-dynamic";

const CF_BASE =
  process.env.NODE_ENV === "production" ? "https://api.cashfree.com" : "https://sandbox.cashfree.com";
const LEADS_SHEET = "Leads";

type Verdict = {
  allowed: boolean;
  /** How the decision was reached — surfaced for support and log triage. */
  via: "order_paid" | "lead_paid" | "degraded" | "none";
  detail?: string;
};

/** Ask Cashfree whether this order is actually paid. null = could not tell. */
async function orderIsPaid(orderId: string): Promise<boolean | null> {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  if (!appId || !secretKey) return null;
  try {
    const res = await fetch(`${CF_BASE}/pg/orders/${encodeURIComponent(orderId)}`, {
      headers: {
        "x-api-version": "2023-08-01",
        "x-client-id": appId,
        "x-client-secret": secretKey,
      },
      cache: "no-store",
    });
    if (!res.ok) return null;
    const order = (await res.json()) as { order_status?: string };
    return order.order_status === "PAID";
  } catch {
    return null;
  }
}

/** Does this lead's row show a completed payment? null = could not tell. */
async function leadIsPaid(leadId: string): Promise<boolean | null> {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!email || !key || !sheetId) return null;
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: { client_email: email, private_key: key },
      scopes: ["https://www.googleapis.com/auth/spreadsheets.readonly"],
    });
    const sheets = google.sheets({ version: "v4", auth });
    const res = await sheets.spreadsheets.values.get({
      spreadsheetId: sheetId,
      range: `${LEADS_SHEET}!A1:CZ`,
    });
    const rows = (res.data.values as string[][]) ?? [];
    if (rows.length < 2) return false;
    const header = (rows[0] ?? []).map((h) => String(h ?? "").trim().toLowerCase());
    const paidCol = header.lastIndexOf("paid");
    const statusCol = 16; // Status is pinned at column Q by the sheet contract.
    const row = rows.slice(1).find((r) => String(r?.[1] ?? "").trim() === leadId);
    if (!row) return false;
    const paid = paidCol >= 0 ? String(row[paidCol] ?? "").trim().toUpperCase() === "Y" : false;
    const status = String(row[statusCol] ?? "").toLowerCase();
    return paid || status.includes("payment_received");
  } catch {
    return null;
  }
}

export async function GET(req: NextRequest) {
  const p = new URL(req.url).searchParams;
  const orderId = (p.get("orderId") || p.get("order_id") || "").trim();
  const leadId = (p.get("leadId") || "").trim();

  let sawError = false;

  if (orderId) {
    const paid = await orderIsPaid(orderId);
    if (paid === true) {
      return NextResponse.json({ allowed: true, via: "order_paid" } satisfies Verdict);
    }
    if (paid === null) sawError = true;
  }

  if (leadId) {
    const paid = await leadIsPaid(leadId);
    if (paid === true) {
      return NextResponse.json({ allowed: true, via: "lead_paid" } satisfies Verdict);
    }
    if (paid === null) sawError = true;
  }

  // Only someone who reached checkout has an order id, so when we genuinely
  // could not verify, let her through rather than lose a paid consultation.
  if (orderId && sawError) {
    console.warn(`[booking-access] verification unavailable — allowing order ${orderId}`);
    return NextResponse.json({
      allowed: true,
      via: "degraded",
      detail: "verification unavailable; allowed on order id",
    } satisfies Verdict);
  }

  console.log(`[booking-access] denied (orderId=${orderId || "none"} leadId=${leadId || "none"})`);
  return NextResponse.json({ allowed: false, via: "none" } satisfies Verdict);
}
