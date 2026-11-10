/**
 * lib/payment-links.ts — SERVER ONLY. His Cashfree payment link for each
 * programme price, pasted once on the dashboard and stored in D1 (table
 * settings, keys "paylink:<amount>").
 *
 * The follow-ups after a call where he quoted a price carry the link for
 * THAT price (payLinkFor). Exact tier only: a woman quoted ₹20,000 is never
 * sent the ₹25,000 link because it was the nearest one saved. No link for
 * her price means the draft goes without one and the card asks for it.
 *
 * WHAT IS ACCEPTED (paymentLinkProblem says why anything else is not)
 *  - https only, on payments.cashfree.com, cashfree.com or the cfre.in short
 *    links, with a path: the domain alone is not a link to pay.
 *  - NOT a Cashfree payment FORM (/forms). lib/cashfree-payload normalises
 *    form webhooks to payment:null, so money paid through a form is never
 *    recorded here (docs/whatsapp-automation-session-2026-08.md §2).
 *  - NOT a test or sandbox link, and NOT the merchant dashboard's own address:
 *    both are easy to copy by mistake and neither takes her money.
 *  - Stored values are checked again on the way out, so a bad row can never
 *    reach a message.
 *
 * KNOWN, NOT HANDLED HERE: /api/cashfree-webhook (a Meta sender, untouched)
 * treats any LINK payment as the ₹299 consultation fee: MicroPurchase with
 * content_name thyroid_session_fee at the full amount, and payment_receipt_v2
 * (the slot-picker message) to her. Decide that before these links go out.
 *
 * Client components must not import this file (it reaches the D1 binding
 * through lib/ledger); they take the tiers from GET /api/admin/payment-links.
 */
import { getLedgerDb, type D1Database } from "./ledger.ts";
import { SETTINGS_TABLE_SQL } from "./bridge-settings.ts";

export const PRICE_TIERS = [15000, 20000, 25000, 30000] as const;
export type PriceTier = (typeof PRICE_TIERS)[number];
export type TierKey = "15000" | "20000" | "25000" | "30000";
export type PaymentLinks = Partial<Record<TierKey, string>>;

export const PAYLINK_PREFIX = "paylink:";
const MAX_LEN = 500;

const ALLOWED_HOSTS = new Set(["payments.cashfree.com", "cashfree.com", "www.cashfree.com", "cfre.in", "www.cfre.in"]);
const DASHBOARD_HOSTS = new Set(["merchant.cashfree.com", "dashboard.cashfree.com"]);

const NO_DB =
  "There is no D1 database here (the LEDGER binding exists only on the Cloudflare worker), so a link cannot be stored. Save it on the live dashboard.";
export const NO_DATABASE_HINT = NO_DB;

export class PaymentLinkError extends Error {
  code: "unknown_price" | "invalid_link" | "no_database";
  constructor(code: "unknown_price" | "invalid_link" | "no_database", message: string) {
    super(message);
    this.name = "PaymentLinkError";
    this.code = code;
  }
}

export function isPriceTier(n: unknown): n is PriceTier {
  return typeof n === "number" && (PRICE_TIERS as readonly number[]).includes(n);
}

/** "₹20,000" */
export const tierLabel = (n: number) => `₹${n.toLocaleString("en-IN")}`;

/**
 * Why a pasted link will not do, in words he can act on, or null when it
 * will. Only for a non-empty value: an empty one means "remove the link".
 */
export function paymentLinkProblem(raw: string): string | null {
  const s = String(raw ?? "").trim();
  if (!s) return "Paste the link first.";
  if (s.length > MAX_LEN) return "That is too long to be a payment link. Paste just the link.";
  if (/\s/.test(s)) return "A link has no spaces in it. Paste just the link, nothing around it.";
  let u: URL;
  try {
    u = new URL(s);
  } catch {
    return "That is not a whole link. Copy it again from Cashfree; it starts with https://";
  }
  if (u.protocol !== "https:") return "A payment link must start with https://";
  if (u.username || u.password || u.port) return "That link carries a login or a port. Copy the plain share link from Cashfree.";
  const host = u.hostname.toLowerCase();
  if (host.endsWith(".cashfree.com") && /test|sandbox/.test(host)) {
    return "That is a Cashfree TEST link, which takes no real money. Copy the live link.";
  }
  if (DASHBOARD_HOSTS.has(host)) {
    return "That is your Cashfree dashboard's own address, which asks her to log in. Open the link in Cashfree and copy its share link.";
  }
  if (!ALLOWED_HOSTS.has(host)) return "That is not a Cashfree link. It should be on payments.cashfree.com or cfre.in.";
  if (/^\/forms(\/|$)/i.test(u.pathname)) {
    return "That is a Cashfree payment FORM, and form payments are never recorded here. Make a Payment Link in Cashfree (Payment Links, Create Link) and paste that.";
  }
  if ((u.pathname === "/" || u.pathname === "") && !u.search) return "That is Cashfree's home page, not a link to pay. Paste the link itself.";
  return null;
}

/**
 * The link for exactly this price, or null. Never the nearest tier, never a
 * rounded amount, and never a stored value that no longer passes the check.
 */
export function payLinkFor(amountRupees: number, links: PaymentLinks | null | undefined): string | null {
  if (!isPriceTier(amountRupees) || !links) return null;
  const url = links[String(amountRupees) as TierKey];
  return typeof url === "string" && url && !paymentLinkProblem(url) ? url.trim() : null;
}

/** Keyed by the binding, so a test's fresh database gets its table too. */
const tableReady = new WeakMap<D1Database, Promise<void>>();

function ensureTable(db: D1Database): Promise<void> {
  let ready = tableReady.get(db);
  if (!ready) {
    ready = db.prepare(SETTINGS_TABLE_SQL).run().then(() => undefined);
    ready.catch(() => tableReady.delete(db));
    tableReady.set(db, ready);
  }
  return ready;
}

async function linksDb(db: D1Database | null | undefined): Promise<D1Database | null> {
  return db === undefined ? getLedgerDb() : db;
}

/**
 * The saved links, for the admin route. Throws when the database cannot be
 * read, so the card can say so. `stored: false` means there is no database.
 */
export async function loadPaymentLinks(db?: D1Database | null): Promise<{ links: PaymentLinks; stored: boolean }> {
  const links: PaymentLinks = {};
  const d = await linksDb(db);
  if (!d) return { links, stored: false };
  await ensureTable(d);
  const { results } = await d
    .prepare("SELECT key, value FROM settings WHERE key LIKE ?1")
    .bind(`${PAYLINK_PREFIX}%`)
    .all<{ key: string; value: string }>();
  for (const row of results ?? []) {
    const amount = Number(String(row?.key ?? "").slice(PAYLINK_PREFIX.length));
    const url = String(row?.value ?? "").trim();
    if (isPriceTier(amount) && url && !paymentLinkProblem(url)) links[String(amount) as TierKey] = url;
  }
  return { links, stored: true };
}

/** The saved links, for code that drafts a message. NEVER THROWS: a failed read is "no links". */
export async function readPaymentLinks(db?: D1Database | null): Promise<PaymentLinks> {
  try {
    return (await loadPaymentLinks(db)).links;
  } catch (err) {
    console.error("[payment-links] read failed, drafts go without a link:", err instanceof Error ? err.message : String(err));
    return {};
  }
}

/**
 * Save the link for one price, or remove it with an empty string. Throws a
 * PaymentLinkError for an unknown price, a link that fails the check, or
 * nowhere to store it.
 */
export async function setPaymentLink(amount: PriceTier, url: string, db?: D1Database | null): Promise<void> {
  if (!isPriceTier(amount)) {
    throw new PaymentLinkError("unknown_price", `Links are kept for ${PRICE_TIERS.map(tierLabel).join(", ")} only.`);
  }
  const value = String(url ?? "").trim();
  if (value) {
    const problem = paymentLinkProblem(value);
    if (problem) throw new PaymentLinkError("invalid_link", problem);
  }
  const d = await linksDb(db);
  if (!d) throw new PaymentLinkError("no_database", NO_DB);
  await ensureTable(d);
  const key = `${PAYLINK_PREFIX}${amount}`;
  if (!value) {
    await d.prepare("DELETE FROM settings WHERE key = ?1").bind(key).run();
    return;
  }
  await d
    .prepare(
      `INSERT INTO settings (key, value, updated_at) VALUES (?1, ?2, ?3)
       ON CONFLICT(key) DO UPDATE SET value = excluded.value, updated_at = excluded.updated_at`,
    )
    .bind(key, value, Date.now())
    .run();
}
