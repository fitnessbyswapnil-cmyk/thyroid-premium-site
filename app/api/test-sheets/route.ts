/**
 * GET /api/test-sheets
 *
 * Diagnostic endpoint — call this from your browser or curl to verify
 * Google Sheets connectivity before going to production.
 *
 * Usage:
 *   curl https://swapnilumbarkarfitness.in/api/test-sheets
 *
 * Returns:
 *   - env var presence checks
 *   - private key sanity (length, PEM header)
 *   - live auth attempt
 *   - list of tabs in your spreadsheet
 *
 * DELETE or restrict this route after debugging.
 */
import { NextResponse } from 'next/server'
import { google } from 'googleapis'

export async function GET() {
  const email = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL
  const rawKey = process.env.GOOGLE_PRIVATE_KEY
  const key = rawKey?.replace(/\\n/g, '\n')
  const sheetId = process.env.GOOGLE_SHEETS_ID

  const checks = {
    hasEmail: !!email,
    emailPreview: email ? `${email.slice(0, 20)}...` : null,
    hasRawKey: !!rawKey,
    rawKeyLength: rawKey?.length ?? 0,
    keyAfterReplace: key?.length ?? 0,
    keyStartsCorrectly: key?.startsWith('-----BEGIN') ?? false,
    keyEndsCorrectly: key?.trimEnd().endsWith('-----') ?? false,
    hasSheetId: !!sheetId,
    sheetIdPreview: sheetId ? `${sheetId.slice(0, 10)}...` : null,
  }

  if (!email || !key || !sheetId) {
    return NextResponse.json(
      { ok: false, checks, error: 'One or more env vars missing' },
      { status: 500 },
    )
  }

  try {
    const auth = new google.auth.JWT({
      email,
      key,
      scopes: ['https://www.googleapis.com/auth/spreadsheets'],
    })

    const sheets = google.sheets({ version: 'v4', auth })

    const meta = await sheets.spreadsheets.get({ spreadsheetId: sheetId })
    const tabs = meta.data.sheets?.map(s => s.properties?.title) ?? []

    return NextResponse.json({
      ok: true,
      checks,
      spreadsheetTitle: meta.data.properties?.title,
      tabs,
      note: tabs.includes('Leads')
        ? '"Leads" tab found — ready to append'
        : '⚠ "Leads" tab NOT found — check your tab name',
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err)
    return NextResponse.json(
      { ok: false, checks, error: msg },
      { status: 500 },
    )
  }
}
