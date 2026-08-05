/**
 * Shared helpers for the /api/admin/* routes (not a route itself).
 * Auth is a single shared key: ADMIN_DASH_KEY env var, with a baked-in
 * fallback so the dashboard works before the env var is set. Override it
 * in Vercel → Settings → Environment Variables for a private passcode.
 */
import { NextRequest } from "next/server";
import { google } from "googleapis";

export const SHEET_NAME = "Leads";
const FALLBACK_KEY = "SWAP-THYROID-2026";

export function checkAdminKey(req: NextRequest): boolean {
  const expected = process.env.ADMIN_DASH_KEY || FALLBACK_KEY;
  const got = req.headers.get("x-admin-key") || "";
  return got.length > 0 && got === expected;
}

export async function getSheetsClient() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const key = process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, "\n");
  const sheetId = process.env.GOOGLE_SHEETS_ID;
  if (!email || !key || !sheetId) throw new Error("Missing Google Sheets env vars");
  const auth = new google.auth.GoogleAuth({
    credentials: { client_email: email, private_key: key },
    scopes: ["https://www.googleapis.com/auth/spreadsheets"],
  });
  return { sheets: google.sheets({ version: "v4", auth }), sheetId };
}

export type LeadRow = {
  row: number; // 1-based sheet row, used by /api/admin/mark
  ts: string;
  name: string;
  phone: string;
  email: string;
  source: string;
  adId: string;
  booked: boolean;
  sessionDate: string;
  tier: string;
  city: string;
  commitment: number | null;
  amountSpent: string;
  triedBefore: string;
  challenge: string;
  score: number | null;
  showed: string; // "Y" | "N" | ""
  closedAmt: number | null;
};
