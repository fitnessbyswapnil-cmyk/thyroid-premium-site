/**
 * lib/ledger.ts — SERVER-ONLY. The Cloudflare D1 ledger (database
 * `thyroid-ledger`, binding LEDGER) for Meta Conversions API events and
 * Cashfree payments. Schema: migrations/0001_init.sql.
 *
 * WHY THIS EXISTS
 * Until now the Leads sheet was the only record, and a Meta send that failed
 * was logged once and lost. The ledger gives every server event one row keyed
 * on its event_id, which buys three things:
 *   - exactly-once: an id already recorded as 'sent' is not sent again;
 *   - retries: a failed send is resent by /api/cron/meta-retry with its
 *     ORIGINAL event_id and event_time, on a capped exponential backoff;
 *   - a payments record that does not depend on a Sheets write landing.
 *
 * DEGRADES TO A NO-OP
 * Only the Cloudflare worker has the binding. On the Vercel rollback copy, in
 * `next dev` and under `node --test`, getLedgerDb() returns null and every
 * caller behaves exactly as it did before the ledger existed. Nothing exported
 * here throws: a ledger error is logged and swallowed, because bookkeeping
 * must never cost a Purchase event or a webhook's 200.
 *
 * PRIVACY (the repo is public; the database is not, but it still gets no raw
 * personal data)
 *   - Never a raw name, phone or email. user_data arrives hashed; any of
 *     Meta's hashed keys that is somehow NOT a SHA-256 hex digest is dropped
 *     from the stored copy.
 *   - An event whose event_id embeds a phone number is kept out of the ledger
 *     entirely and sent exactly as before. Today that is ReportReceived, whose
 *     id is `report_<phone>_<day>` (app/api/whatsapp-webhook).
 *   - event_source_url keeps only fbclid / utm_* query params. The browser
 *     relays send window.location.href, which may carry anything.
 *   - client_ip_address is kept only while a row can still be retried.
 *
 * The pure half (backoff, retry eligibility, the duplicate decision,
 * redaction) is unit-tested in ledger.test.ts and needs no binding.
 */
import type { CAPIEvent, CAPIResult } from './server-tracking.ts'

// ── Tunables ─────────────────────────────────────────────────────────────────

/** Total sends per event, the first live one included, before it goes 'dead'. */
export const MAX_ATTEMPTS = 5

/** One cron tick. After attempt n the wait is BASE × 2^(n-1): 15m, 30m, 1h, 2h. */
export const BACKOFF_BASE_MS = 15 * 60 * 1000
/** Ceiling on a single wait. Unreached at MAX_ATTEMPTS = 5; there if it is raised. */
export const BACKOFF_CAP_MS = 6 * 60 * 60 * 1000

/**
 * Meta's event_time window, from the Conversions API "Server Event parameters"
 * reference (checked 2026-09-12): event_time may be at most 7 days in the
 * past, and a single event older than that fails the WHOLE request. No
 * action_source is exempted there. Same figure as lib/meta-conversion.ts.
 */
export const META_MAX_EVENT_AGE_S = 7 * 24 * 60 * 60
/** Give up an hour before the edge so a retry never lands a second too late. */
export const EXPIRY_MARGIN_S = 60 * 60

/** Rows resent per cron run. 20 sequential sends fit easily in one invocation. */
export const RETRY_BATCH_SIZE = 20
/** How long a cron run holds a row it is resending, so an overlapping run skips it. */
export const RETRY_LEASE_MS = 10 * 60 * 1000

/** A D1 call that has not answered by now is abandoned (the send goes on without it). */
const D1_TIMEOUT_MS = 2000
const MAX_ERROR_LENGTH = 500

// ── Types ────────────────────────────────────────────────────────────────────

export type MetaEventStatus = 'sent' | 'failed' | 'dead'

/** What the send path needs to know about an event_id before sending it. */
export type LedgerState = {
  status: MetaEventStatus
  test_code: string | null
  attempts: number
}

export type MetaEventRow = LedgerState & {
  event_id: string
  event_name: string
  last_error: string | null
  payload_json: string
  created_at: number
  sent_at: number | null
  next_retry_at: number | null
}

/**
 * The slice of Cloudflare's D1 API used here. @cloudflare/workers-types is not
 * installed, and a whole types package for six methods is not worth it.
 */
export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<{ meta?: { changes?: number } }>
}
export interface D1Database {
  prepare(query: string): D1PreparedStatement
  batch<T = Record<string, unknown>>(statements: D1PreparedStatement[]): Promise<{ results: T[] }[]>
}

// ── Pure helpers (unit-tested) ───────────────────────────────────────────────

/** Wait before the next attempt, given how many attempts have been made so far. */
export function backoffMs(attempts: number): number {
  const n = Number.isFinite(attempts) && attempts >= 1 ? Math.floor(attempts) : 1
  return Math.min(BACKOFF_CAP_MS, BACKOFF_BASE_MS * 2 ** Math.min(n - 1, 20))
}

/**
 * True when Meta would reject an event with this event_time (Unix SECONDS) if
 * it were sent at `atMs`. A missing or garbage time counts as too old: there
 * is no safe way to send it.
 */
export function isTooOldForMeta(eventTimeS: number, atMs: number): boolean {
  if (!Number.isFinite(eventTimeS) || eventTimeS <= 0) return true
  return atMs / 1000 - eventTimeS > META_MAX_EVENT_AGE_S - EXPIRY_MARGIN_S
}

export type FailurePlan = {
  status: 'failed' | 'dead'
  nextRetryAt: number | null
  /** Why it went dead, appended to last_error. */
  reason?: string
}

/**
 * What a failed send becomes. `attempts` counts the attempt that just failed.
 *
 * A Test Events send is recorded as 'failed' with no retry time: the cron must
 * never resend it, because a resend carries no test code and would land in
 * production as a real conversion.
 */
export function planAfterFailure(o: {
  attempts: number
  nowMs: number
  eventTimeS: number
  testCode?: string | null
}): FailurePlan {
  if (o.testCode) return { status: 'failed', nextRetryAt: null }
  if (o.attempts >= MAX_ATTEMPTS) {
    return { status: 'dead', nextRetryAt: null, reason: `gave up after ${o.attempts} attempts` }
  }
  const next = o.nowMs + backoffMs(o.attempts)
  if (isTooOldForMeta(o.eventTimeS, next)) {
    return { status: 'dead', nextRetryAt: null, reason: "past Meta's 7-day event_time window" }
  }
  return { status: 'failed', nextRetryAt: next }
}

export type RetryDecision = 'retry' | 'wait' | 'expire' | 'ineligible'

/**
 * What the cron does with a row. The SQL already selects due, real, failed
 * rows; this is the second check, and the one that retires rows it can no
 * longer send.
 */
export function retryDecision(
  row: Pick<MetaEventRow, 'status' | 'attempts' | 'test_code' | 'next_retry_at'>,
  eventTimeS: number,
  nowMs: number,
): RetryDecision {
  if (row.status !== 'failed' || row.test_code) return 'ineligible'
  if (row.attempts >= MAX_ATTEMPTS) return 'expire'
  if (isTooOldForMeta(eventTimeS, nowMs)) return 'expire'
  if (row.next_retry_at == null) return 'ineligible'
  return row.next_retry_at <= nowMs ? 'retry' : 'wait'
}

/**
 * Skip the network call? Only when this id already REACHED Meta.
 *
 * A real event that landed suppresses every later send of its id, real or
 * test. A test event that landed suppresses only another test send: Test
 * Events do not count in production, so they must never stop the real one.
 * 'failed' and 'dead' never suppress anything; sending again is the point.
 */
export function isDuplicateSend(
  existing: Pick<LedgerState, 'status' | 'test_code'> | null | undefined,
  testCode?: string | null,
): boolean {
  if (!existing || existing.status !== 'sent') return false
  if (!existing.test_code) return true
  return !!testCode
}

/**
 * A bare Indian mobile number anywhere in the string: 10 digits starting 6–9,
 * optionally prefixed 91 or 0, not part of a longer digit run. That boundary
 * is what keeps the 13-digit millisecond timestamps inside lead ids and order
 * refs (`quiz_1786000000000_ab12cd`) from matching.
 */
const PHONE_IN_TEXT = /(?:^|\D)(?:91|0)?[6-9]\d{9}(?!\d)/

export function containsPhoneNumber(s: string): boolean {
  return PHONE_IN_TEXT.test(String(s ?? ''))
}

/** May this event_id be stored as a ledger key? */
export function isLedgerable(eventId: string): boolean {
  return typeof eventId === 'string' && eventId.length > 0 && eventId.length <= 256 && !containsPhoneNumber(eventId)
}

const KEEP_QUERY_PARAM = /^(fbclid|utm_[a-z_]+)$/i

/** event_source_url minus every query param except fbclid / utm_*, and minus the fragment. */
export function redactSourceUrl(url: string): string {
  try {
    const u = new URL(url)
    const kept = new URLSearchParams()
    for (const [k, v] of u.searchParams) if (KEEP_QUERY_PARAM.test(k)) kept.append(k, v)
    u.search = kept.toString()
    u.hash = ''
    return u.toString()
  } catch {
    return String(url ?? '').split(/[?#]/)[0]
  }
}

/** user_data keys Meta requires hashed. buildUserData() hashes all of them. */
const HASHED_KEYS = ['em', 'ph', 'fn', 'ln', 'ct', 'st', 'zp', 'country', 'external_id'] as const
const SHA256_HEX = /^[a-f0-9]{64}$/

function isHashed(v: unknown): boolean {
  if (Array.isArray(v)) return v.length > 0 && v.every(isHashed)
  return typeof v === 'string' && SHA256_HEX.test(v)
}

/**
 * The copy of the event that goes into payload_json: the event object Meta
 * received, with the original event_time, action_source and custom_data, minus
 * anything that must not sit in the database (see PRIVACY above). `keepIp` is
 * true only for a row the cron may still resend.
 */
export function payloadForStorage(event: CAPIEvent, keepIp: boolean): string {
  const userData: Record<string, unknown> = { ...(event.user_data ?? {}) }
  for (const k of HASHED_KEYS) {
    if (k in userData && !isHashed(userData[k])) delete userData[k]
  }
  if (!keepIp) delete userData.client_ip_address
  const stored: Record<string, unknown> = { ...event, user_data: userData }
  if (typeof event.event_source_url === 'string') {
    stored.event_source_url = redactSourceUrl(event.event_source_url)
  }
  return JSON.stringify(stored)
}

/** Strip the IP from a stored payload once its row can no longer be retried. */
export function redactStoredPayload(json: string): string {
  try {
    const parsed = JSON.parse(json) as { user_data?: Record<string, unknown> }
    if (parsed && typeof parsed === 'object' && parsed.user_data && typeof parsed.user_data === 'object') {
      delete parsed.user_data.client_ip_address
    }
    return JSON.stringify(parsed)
  } catch {
    return '{}'
  }
}

/**
 * Rebuild the event a retry resends. Null when the payload is unreadable, or
 * belongs to a different id than its row: then it is marked dead, not guessed at.
 */
export function parseStoredEvent(json: string, expectedEventId: string): CAPIEvent | null {
  try {
    const e = JSON.parse(json) as Partial<CAPIEvent>
    if (!e || typeof e !== 'object') return null
    if (typeof e.event_name !== 'string' || !e.event_name) return null
    if (e.event_id !== expectedEventId) return null
    if (typeof e.event_time !== 'number' || !Number.isFinite(e.event_time)) return null
    if (typeof e.action_source !== 'string') return null
    if (!e.user_data || typeof e.user_data !== 'object') return null
    return e as CAPIEvent
  } catch {
    return null
  }
}

function errText(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

function clip(s: string | undefined | null): string | null {
  if (!s) return null
  return s.length > MAX_ERROR_LENGTH ? `${s.slice(0, MAX_ERROR_LENGTH)}…` : s
}

// ── Binding ──────────────────────────────────────────────────────────────────

type CloudflareModule = typeof import('@opennextjs/cloudflare')
let cloudflareModule: Promise<CloudflareModule | null> | null = null

/**
 * The D1 binding for THIS request, or null anywhere it does not exist.
 *
 * getCloudflareContext() in its default sync mode reads the context the worker
 * sets per request (AsyncLocalStorage, so it also holds inside after()), and
 * throws everywhere else: Vercel, `next dev`, Node. The async mode is avoided on
 * purpose, because in a Node process it boots wrangler to fake a context.
 * The package is imported lazily so unit tests that import this module (through
 * server-tracking.ts) never load it.
 */
export async function getLedgerDb(): Promise<D1Database | null> {
  try {
    cloudflareModule ??= import('@opennextjs/cloudflare').catch(() => null)
    const mod = await cloudflareModule
    if (!mod) return null
    const env = mod.getCloudflareContext().env as unknown as Record<string, unknown>
    const db = env?.LEDGER as D1Database | undefined
    return db && typeof db.prepare === 'function' ? db : null
  } catch {
    return null
  }
}

/** Resolve to null instead of throwing or hanging. */
async function safely<T>(label: string, work: () => Promise<T>): Promise<T | null> {
  let timer: ReturnType<typeof setTimeout> | undefined
  try {
    return await Promise.race([
      work(),
      new Promise<null>((resolve) => {
        timer = setTimeout(() => {
          console.warn(`[ledger] ${label} timed out after ${D1_TIMEOUT_MS}ms`)
          resolve(null)
        }, D1_TIMEOUT_MS)
      }),
    ])
  } catch (err) {
    console.error(`[ledger] ${label} failed:`, errText(err))
    return null
  } finally {
    if (timer) clearTimeout(timer)
  }
}

// ── Meta events: the live send path (lib/server-tracking.ts) ─────────────────

/** The row for an id, or null when there is none OR it could not be read. */
export async function getMetaEventState(db: D1Database, eventId: string): Promise<LedgerState | null> {
  return safely('read', () =>
    db
      .prepare('SELECT status, test_code, attempts FROM meta_events WHERE event_id = ?1')
      .bind(eventId)
      .first<LedgerState>(),
  )
}

/**
 * Upsert the outcome of a live send.
 *
 * The conflict clause carries the two rules that must hold even when two sends
 * race, or when the pre-send read failed and `previous` is unknown:
 *   - a test send never overwrites a real row;
 *   - a real row that reached 'sent' is final.
 * A real send replacing a test row starts the count afresh.
 */
export async function recordMetaSend(
  db: D1Database,
  o: {
    event: CAPIEvent
    testCode?: string | null
    result: CAPIResult
    previous: LedgerState | null
    nowMs?: number
  },
): Promise<void> {
  const now = o.nowMs ?? Date.now()
  const testCode = o.testCode || null
  const sameKind = !!o.previous && !!o.previous.test_code === !!testCode
  const attempts = sameKind ? o.previous!.attempts + 1 : 1

  let status: MetaEventStatus = 'sent'
  let nextRetryAt: number | null = null
  let lastError: string | null = null
  if (!o.result.success) {
    const plan = planAfterFailure({ attempts, nowMs: now, eventTimeS: o.event.event_time, testCode })
    status = plan.status
    nextRetryAt = plan.nextRetryAt
    lastError = clip([o.result.error || 'unknown error', plan.reason].filter(Boolean).join(' · '))
  }
  const payload = payloadForStorage(o.event, status === 'failed' && !testCode)

  await safely('write', () =>
    db
      .prepare(
        `INSERT INTO meta_events
           (event_id, event_name, status, attempts, last_error, payload_json, test_code, created_at, sent_at, next_retry_at)
         VALUES (?1, ?2, ?3, 1, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT (event_id) DO UPDATE SET
           event_name    = excluded.event_name,
           status        = excluded.status,
           attempts      = CASE WHEN meta_events.test_code IS NOT NULL AND excluded.test_code IS NULL
                                THEN 1 ELSE meta_events.attempts + 1 END,
           last_error    = excluded.last_error,
           payload_json  = excluded.payload_json,
           test_code     = excluded.test_code,
           created_at    = CASE WHEN meta_events.test_code IS NOT NULL AND excluded.test_code IS NULL
                                THEN excluded.created_at ELSE meta_events.created_at END,
           sent_at       = excluded.sent_at,
           next_retry_at = excluded.next_retry_at
         WHERE (excluded.test_code IS NULL OR meta_events.test_code IS NOT NULL)
           AND (meta_events.status <> 'sent' OR meta_events.test_code IS NOT NULL)`,
      )
      .bind(
        o.event.event_id,
        o.event.event_name,
        status,
        lastError,
        payload,
        testCode,
        now,
        status === 'sent' ? now : null,
        nextRetryAt,
      )
      .run(),
  )
  if (status !== 'sent') {
    console.warn(
      `[ledger] ${o.event.event_name} ${o.event.event_id} → ${status}` +
        (nextRetryAt ? ` (retry after ${new Date(nextRetryAt).toISOString()})` : '') +
        (testCode ? ' [test event, not retried]' : ''),
    )
  }
}

// ── Meta events: retries (/api/cron/meta-retry) ──────────────────────────────

const ROW_COLUMNS =
  'event_id, event_name, status, attempts, last_error, payload_json, test_code, created_at, sent_at, next_retry_at'

/** Real failed rows whose retry time has come, oldest-due first. */
export async function listDueRetries(db: D1Database, nowMs: number, limit = RETRY_BATCH_SIZE): Promise<MetaEventRow[]> {
  const res = await safely('list due retries', () =>
    db
      .prepare(
        `SELECT ${ROW_COLUMNS} FROM meta_events
         WHERE status = 'failed' AND test_code IS NULL
           AND next_retry_at IS NOT NULL AND next_retry_at <= ?1
         ORDER BY next_retry_at
         LIMIT ?2`,
      )
      .bind(nowMs, limit)
      .all<MetaEventRow>(),
  )
  return res?.results ?? []
}

/**
 * Take a row for this run by pushing its retry time out by a lease. False when
 * another run got there first (or the row changed), in which case skip it.
 */
export async function claimRetry(db: D1Database, row: MetaEventRow, nowMs: number): Promise<boolean> {
  const res = await safely('claim', () =>
    db
      .prepare(
        `UPDATE meta_events SET next_retry_at = ?1
         WHERE event_id = ?2 AND status = 'failed' AND next_retry_at = ?3`,
      )
      .bind(nowMs + RETRY_LEASE_MS, row.event_id, row.next_retry_at)
      .run(),
  )
  return (res?.meta?.changes ?? 0) === 1
}

/** Record a resend's outcome. Returns the row's new status, or null if the write failed. */
export async function recordRetry(
  db: D1Database,
  o: { row: MetaEventRow; event: CAPIEvent; result: CAPIResult; nowMs?: number },
): Promise<MetaEventStatus | null> {
  const now = o.nowMs ?? Date.now()
  const attempts = o.row.attempts + 1

  if (o.result.success) {
    const ok = await safely('retry write', () =>
      db
        .prepare(
          `UPDATE meta_events
           SET status = 'sent', attempts = ?1, last_error = NULL, sent_at = ?2, next_retry_at = NULL, payload_json = ?3
           WHERE event_id = ?4 AND status = 'failed'`,
        )
        .bind(attempts, now, payloadForStorage(o.event, false), o.row.event_id)
        .run(),
    )
    return ok ? 'sent' : null
  }

  const plan = planAfterFailure({ attempts, nowMs: now, eventTimeS: o.event.event_time, testCode: null })
  const lastError = clip([o.result.error || 'unknown error', plan.reason].filter(Boolean).join(' · '))
  const ok = await safely('retry write', () =>
    db
      .prepare(
        `UPDATE meta_events
         SET status = ?1, attempts = ?2, last_error = ?3, next_retry_at = ?4, payload_json = ?5
         WHERE event_id = ?6 AND status = 'failed'`,
      )
      .bind(
        plan.status,
        attempts,
        lastError,
        plan.nextRetryAt,
        payloadForStorage(o.event, plan.status === 'failed'),
        o.row.event_id,
      )
      .run(),
  )
  return ok ? plan.status : null
}

/** Retire a row without sending it (too old, out of attempts, unreadable). */
export async function markDead(db: D1Database, row: MetaEventRow, reason: string): Promise<boolean> {
  const lastError = clip([row.last_error, `dead: ${reason}`].filter(Boolean).join(' · '))
  const ok = await safely('mark dead', () =>
    db
      .prepare(
        `UPDATE meta_events SET status = 'dead', next_retry_at = NULL, last_error = ?1, payload_json = ?2
         WHERE event_id = ?3 AND status = 'failed'`,
      )
      .bind(lastError, redactStoredPayload(row.payload_json), row.event_id)
      .run(),
  )
  return !!ok
}

// ── Payments (app/api/cashfree-webhook) ──────────────────────────────────────

export type PaymentRecord = {
  orderRef: string
  leadId: string
  amount: number
  currency: string
  /** 'duplicate' when the sheet showed the lead already paid under this reference. */
  status: 'paid' | 'duplicate'
  source: string
  sheetResult: string
  paidAtMs: number
}

export type PaymentWrite = 'inserted' | 'exists' | 'skipped' | 'error'

/** Insert once per order_ref; a replayed webhook is a no-op ('exists'). */
export async function recordPayment(db: D1Database, p: PaymentRecord, nowMs: number = Date.now()): Promise<PaymentWrite> {
  if (!p.orderRef || containsPhoneNumber(p.orderRef)) return 'skipped'
  const leadId = p.leadId && !containsPhoneNumber(p.leadId) ? p.leadId : null
  const amount = Number.isFinite(p.amount) ? p.amount : 0
  const res = await safely('payment write', () =>
    db
      .prepare(
        `INSERT INTO payments (order_ref, lead_id, amount, currency, status, source, sheet_result, paid_at, recorded_at)
         VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8, ?9)
         ON CONFLICT (order_ref) DO NOTHING`,
      )
      .bind(p.orderRef, leadId, amount, p.currency || 'INR', p.status, p.source, p.sheetResult || null, p.paidAtMs, nowMs)
      .run(),
  )
  if (!res) return 'error'
  return (res.meta?.changes ?? 0) > 0 ? 'inserted' : 'exists'
}

// ── Admin summary (/api/admin/ledger) ────────────────────────────────────────

type Counts = Record<string, Partial<Record<MetaEventStatus, number>>>

export type LedgerSummary = {
  generatedAt: string
  window: { days: number; since: string }
  /** event_name → status → count, real events created in the window. */
  events: Counts
  /** Same, for Meta Test Events sends. */
  testEvents: Counts
  /** Newest 20 failed/dead rows. Ids and errors only — no user data. */
  latestFailures: {
    event_name: string
    event_id: string
    status: MetaEventStatus
    attempts: number
    last_error: string | null
    created_at: string
    next_retry_at: string | null
    test: boolean
  }[]
  payments: {
    allTime: { status: string; currency: string; count: number; total: number; lastPaidAt: string | null }[]
    window: { currency: string; count: number; total: number }[]
  }
}

const iso = (ms: number | null | undefined) => (ms ? new Date(Number(ms)).toISOString() : null)

export async function ledgerSummary(db: D1Database, nowMs: number, days = 7): Promise<LedgerSummary | null> {
  const since = nowMs - days * 24 * 60 * 60 * 1000
  const res = await safely('summary', () =>
    db.batch([
      db
        .prepare(
          `SELECT event_name, status, (test_code IS NOT NULL) AS is_test, COUNT(*) AS n
           FROM meta_events WHERE created_at >= ?1
           GROUP BY event_name, status, is_test ORDER BY event_name, status`,
        )
        .bind(since),
      db.prepare(
        `SELECT event_name, event_id, status, attempts, last_error, created_at, next_retry_at, (test_code IS NOT NULL) AS is_test
         FROM meta_events WHERE status IN ('failed', 'dead')
         ORDER BY created_at DESC LIMIT 20`,
      ),
      db.prepare(
        `SELECT status, currency, COUNT(*) AS n, SUM(amount) AS total, MAX(paid_at) AS last_paid_at
         FROM payments GROUP BY status, currency ORDER BY status, currency`,
      ),
      db
        .prepare(
          `SELECT currency, COUNT(*) AS n, SUM(amount) AS total
           FROM payments WHERE status = 'paid' AND paid_at >= ?1
           GROUP BY currency ORDER BY currency`,
        )
        .bind(since),
    ]),
  )
  if (!res) return null

  type R = Record<string, unknown>
  const rows = (i: number) => (res[i]?.results ?? []) as R[]
  const events: Counts = {}
  const testEvents: Counts = {}
  for (const r of rows(0)) {
    const target = Number(r.is_test) ? testEvents : events
    const name = String(r.event_name)
    target[name] ??= {}
    target[name][r.status as MetaEventStatus] = Number(r.n)
  }

  return {
    generatedAt: new Date(nowMs).toISOString(),
    window: { days, since: new Date(since).toISOString() },
    events,
    testEvents,
    latestFailures: rows(1).map((r) => ({
      event_name: String(r.event_name),
      event_id: String(r.event_id),
      status: r.status as MetaEventStatus,
      attempts: Number(r.attempts),
      last_error: (r.last_error as string | null) ?? null,
      created_at: iso(r.created_at as number) ?? '',
      next_retry_at: iso(r.next_retry_at as number | null),
      test: !!Number(r.is_test),
    })),
    payments: {
      allTime: rows(2).map((r) => ({
        status: String(r.status),
        currency: String(r.currency),
        count: Number(r.n),
        total: Number(r.total ?? 0),
        lastPaidAt: iso(r.last_paid_at as number | null),
      })),
      window: rows(3).map((r) => ({ currency: String(r.currency), count: Number(r.n), total: Number(r.total ?? 0) })),
    },
  }
}
