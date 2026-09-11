/**
 * Pure helpers for the Meta pixel, the direct-pixel flag and the Purchase
 * dedup contract.
 *
 * This module deliberately imports NOTHING. App code imports it without an
 * extension; lib/meta-pixel.test.ts imports it under `node --test` with an
 * explicit `.ts` extension, which only resolves for a module with no imports
 * of its own. Keep it that way.
 *
 * See docs/tracking-cutover-plan.md for why each of these exists and the
 * console changes that must accompany NEXT_PUBLIC_DIRECT_PIXEL.
 */

// Public dataset id (already visible in every page's network traffic).
export const META_PIXEL_ID = "1004294955172584";

/**
 * Build-time flags arrive as strings. Anything other than an explicit yes is
 * OFF, so an unset, empty or misspelt value can never switch behaviour on.
 */
export function isFlagOn(raw: string | undefined): boolean {
  if (!raw) return false;
  return ["1", "true", "on", "yes"].includes(raw.trim().toLowerCase());
}

// ── Purchase dedup contract ──────────────────────────────────────────────────
// Every Purchase leg (browser GTM tag, Cashfree webhook CAPI) carries
// `Purchase_<orderId>`. A Purchase with any other id can never pair with the
// webhook's server event, so it is refused rather than sent.
export const PURCHASE_ID_PREFIX = "Purchase_";

export function isPurchaseEventId(id: string | undefined): id is string {
  return (
    typeof id === "string" &&
    id.startsWith(PURCHASE_ID_PREFIX) &&
    id.length > PURCHASE_ID_PREFIX.length
  );
}

type KeyStore = Pick<Storage, "getItem" | "setItem">;

/**
 * Returns true exactly once per key across every store given, false after.
 * A store that throws (private mode, blocked site data) is skipped; the others
 * still record and still block a repeat. With no usable store at all it
 * returns true: the event fires, it just cannot be guarded.
 */
export function claimOnce(key: string, stores: ReadonlyArray<KeyStore | undefined>): boolean {
  const seen = stores.some((s) => {
    try {
      return !!s && !!s.getItem(key);
    } catch {
      return false;
    }
  });
  if (seen) return false;
  for (const s of stores) {
    try {
      if (s) s.setItem(key, "1");
    } catch {
      /* this store is unusable; the others still hold the claim */
    }
  }
  return true;
}

// ── Direct pixel (NEXT_PUBLIC_DIRECT_PIXEL) ─────────────────────────────────

type FbqStub = {
  (...args: unknown[]): void;
  callMethod?: (...args: unknown[]) => void;
  queue: unknown[];
  push: unknown;
  loaded: boolean;
  version: string;
  disablePushState?: boolean;
};

export type PixelWindow = {
  fbq?: FbqStub;
  _fbq?: unknown;
  _fbq_gtm_ids?: string[];
  dataLayer?: unknown[];
  __metaPageViewId?: string;
  localStorage?: Pick<Storage, "getItem">;
};

type ScriptEl = { async: boolean; src: string };
type ParentEl = { insertBefore(el: unknown, ref: unknown): unknown };

export type PixelDocument = {
  cookie: string;
  createElement(tag: "script"): ScriptEl;
  getElementsByTagName(tag: "script"): ArrayLike<{ parentNode: ParentEl | null }>;
  head?: { appendChild(el: unknown): unknown } | null;
};

/**
 * Initialises the Meta pixel and sends this document's PageView, from an
 * inline <head> script, before React or GTM exist.
 *
 * It is serialised with Function.prototype.toString (see directPixelSnippet),
 * so it MUST be self-contained: no imports, no module-level references, no
 * helpers. The unit tests run the serialised string in an empty VM context to
 * prove that. It must also never throw into the page.
 *
 * What it does, in order:
 *  1. The standard fbq stub + async fbevents.js (same as Meta's snippet).
 *  2. disablePushState: fbevents would otherwise fire its own PageView, with no
 *     event_id, on every client-side route change. RouteTracker sends those
 *     instead, each with an id (see trackPageView).
 *  3. init with advanced matching from the identity the site already stores
 *     (meta_user_identity + _visitor_id), normalised exactly as
 *     app/lib/analytics.ts normalises it.
 *  4. Registers the pixel in `_fbq_gtm_ids`, the list GTM's Facebook Pixel
 *     template checks before calling init, so GTM's per-event tags (Lead,
 *     Purchase, Schedule) reuse this pixel instead of initialising it again.
 *  5. PageView with an event_id minted HERE, in the browser. The HTML is served
 *     from a static cache, so an id minted at render time would be shared by
 *     every visitor.
 *  6. Exposes that id to trackPageView (window.__metaPageViewId) and to GTM
 *     (dataLayer key meta_pageview_event_id, pushed before gtm.js loads) so
 *     the server PageView can carry the same id and deduplicate.
 */
export function directPixelBootstrap(w: PixelWindow, d: PixelDocument, pixelId: string): void {
  try {
    let fbq = w.fbq;
    if (!fbq) {
      // Meta's snippet queues `arguments` objects; fbevents replays each queue
      // item with callMethod.apply, which takes an array just as well.
      const stub = function (...args: unknown[]) {
        if (stub.callMethod) stub.callMethod(...args);
        else stub.queue.push(args);
      } as FbqStub;
      stub.push = stub;
      stub.loaded = true;
      stub.version = "2.0";
      stub.queue = [];
      w.fbq = stub;
      if (!w._fbq) w._fbq = stub;
      fbq = stub;

      const s = d.createElement("script");
      s.async = true;
      s.src = "https://connect.facebook.net/en_US/fbevents.js";
      const first = d.getElementsByTagName("script")[0];
      if (first && first.parentNode) first.parentNode.insertBefore(s, first);
      else if (d.head) d.head.appendChild(s);
    }
    fbq.disablePushState = true;

    const am: Record<string, string> = {};
    try {
      const raw = w.localStorage ? w.localStorage.getItem("meta_user_identity") : null;
      const idn = raw ? JSON.parse(raw) : null;
      if (idn && typeof idn === "object") {
        const text = function (v: unknown): string {
          return typeof v === "string" ? v.trim() : "";
        };
        const em = text(idn.email).toLowerCase();
        let ph = text(idn.phone).replace(/\D/g, "").replace(/^0+/, "");
        if (ph.length === 10) ph = "91" + ph;
        const fn = text(idn.first_name).toLowerCase();
        const ln = text(idn.last_name).toLowerCase();
        if (em) am.em = em;
        if (ph) am.ph = ph;
        if (fn) am.fn = fn;
        if (ln) am.ln = ln;
      }
    } catch {
      /* unreadable identity: initialise without it */
    }
    try {
      const m = d.cookie.match(/(?:^|;\s*)_visitor_id=([^;]+)/);
      const ext = m
        ? decodeURIComponent(m[1])
        : (w.localStorage ? w.localStorage.getItem("meta_external_id") : null) || "";
      if (ext) am.external_id = ext;
    } catch {
      /* no external id: initialise without it */
    }

    if (Object.keys(am).length > 0) fbq("init", pixelId, am);
    else fbq("init", pixelId);

    const ids = w._fbq_gtm_ids || [];
    if (ids.indexOf(pixelId) === -1) ids.push(pixelId);
    w._fbq_gtm_ids = ids;

    // Same shape as generateEventId("page_view") in app/lib/analytics.ts.
    const eventId =
      "page_view_" +
      Math.floor(new Date().getTime() / 1000) +
      "_" +
      Math.random().toString(36).slice(2, 6);
    w.__metaPageViewId = eventId;
    fbq("track", "PageView", {}, { eventID: eventId });
    (w.dataLayer = w.dataLayer || []).push({ meta_pageview_event_id: eventId });
  } catch {
    /* tracking must never break the page */
  }
}

/** The inline <head> script: the bootstrap above, invoked with the pixel id. */
export function directPixelSnippet(pixelId: string): string {
  return `(${directPixelBootstrap.toString()})(window,document,${JSON.stringify(pixelId)});`;
}

/**
 * Hands the head script's PageView id to the FIRST trackPageView of this
 * document, exactly once. Later calls (client-side route changes) get "" and
 * mint their own id.
 */
export function consumeHeadPageViewId(w: Pick<PixelWindow, "__metaPageViewId">): string {
  const id = w.__metaPageViewId || "";
  if (id) w.__metaPageViewId = undefined;
  return id;
}
