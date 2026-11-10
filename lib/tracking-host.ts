/**
 * lib/tracking-host.ts — the one place that answers "is this the real site?"
 *
 * WHY THIS EXISTS
 * On 19-Sep-2026 Meta's Events Manager reported three *.vercel.app hosts
 * "recently started sending data" to dataset 1004294955172584, and flagged
 * thyroid-funnel.thyroid-premium-site.workers.dev under its health-data terms
 * with a 22-day deadline. None of that was deliberate. The cause was structural:
 * the pixel id, the GTM container id, the sGTM host and the CAPI credentials
 * are all environment-independent constants, so EVERY deployment of this repo —
 * production, Vercel preview, workers.dev, localhost — fed the same live
 * dataset. Not one line of tracking code ever asked which hostname it was
 * running on.
 *
 * Production has been served by Cloudflare (wrangler.jsonc routes
 * www.swapnilumbarkarfitness.in/*) since 12-Sep. Everything else is an accident.
 *
 * FAILS CLOSED, DELIBERATELY. An unknown, empty or unparseable host returns
 * false and tracking stays off. The cost of a false negative is a missing event
 * on a host that should not have been sending anyway; the cost of a false
 * positive is another domain in Meta's notice and a step closer to a
 * dataset-level block. Those are not symmetric.
 *
 * The apex is NOT a tracking host. custom-worker.js 307-redirects it to www, so
 * it never renders a page, and every server-side event_source_url in the repo
 * is hardcoded to the www form. Allowing the apex here would only widen the
 * surface without ever matching a real request.
 *
 * Imports NOTHING, like app/components/tracking/pixel-core.ts, so the unit test
 * can load it under `node --test` with an explicit .ts extension.
 */

/** The only host permitted to send data to the Meta dataset. */
export const PRODUCTION_HOST = "www.swapnilumbarkarfitness.in";

/**
 * True only for the production host.
 *
 * Accepts a bare hostname ("www.example.com"), a Host header with a port
 * ("www.example.com:443"), or anything else — which is rejected.
 */
export function isTrackingHost(host?: string | null): boolean {
  if (typeof host !== "string") return false;
  const trimmed = host.trim().toLowerCase();
  if (!trimmed) return false;
  // A Host header carries the port; window.location.hostname does not. Strip it
  // so both callers can pass what they naturally have.
  const withoutPort = trimmed.replace(/:\d+$/, "");
  return withoutPort === PRODUCTION_HOST;
}

/**
 * True only when `url` is an absolute URL on the production host.
 *
 * This is the check for `event_source_url`, which /api/events currently accepts
 * from the browser verbatim and never validates. A relative URL has no host to
 * verify, so it is rejected rather than assumed safe.
 */
export function isTrackingUrl(url?: string | null): boolean {
  if (typeof url !== "string" || !url.trim()) return false;
  try {
    return isTrackingHost(new URL(url).hostname);
  } catch {
    return false;
  }
}

/**
 * Operator pages: the dashboard (/admin), the pipeline on a phone (/crm) and
 * the WhatsApp inbox (/inbox). They show client names, phone numbers and
 * health conversations.
 *
 * Found 10-Nov-2026: the GTM container fires Microsoft Clarity's session
 * recorder on every page (custom HTML tag 121, trigger gtm.js) and the Meta
 * pixel on every page (tag 75, gtm.init). Because GTM loaded on these pages
 * too, every dashboard session was recorded for Microsoft and the owner was
 * counted as a site visitor in Meta. No tracking snippet runs here now.
 *
 * A whole path segment matches: /admin and /admin/x are internal, while
 * /administrator would not be. Add a path here whenever a new operator page
 * ships; lib/operator-pages-untracked.test.ts runs the real snippet against
 * each of these paths.
 */
export const INTERNAL_PATHS = ["/admin", "/crm", "/inbox"] as const;

/** True for an operator page's path (see INTERNAL_PATHS). */
export function isInternalPath(pathname?: string | null): boolean {
  if (typeof pathname !== "string") return false;
  return INTERNAL_PATHS.some((path) => pathname === path || pathname.startsWith(`${path}/`));
}

/**
 * A JavaScript statement, for embedding in the inline tracking snippets, that
 * returns early unless the browser is on the production host AND on a page
 * that is not an operator page (see INTERNAL_PATHS).
 *
 * The snippets are injected as raw strings, so they cannot import this module.
 * Generating the literal here keeps PRODUCTION_HOST as the single definition
 * rather than a copy that can drift.
 *
 * Reading the host at RUN time rather than render time matters: the HTML is
 * served from a static cache, and `headers()` would opt every page in the root
 * layout into dynamic rendering, which would cost the whole site its static
 * generation to fix a tracking bug.
 */
export function inlineHostGuard(): string {
  const internal = INTERNAL_PATHS.map((path) => path.slice(1)).join("|");
  return (
    `if(location.hostname!==${JSON.stringify(PRODUCTION_HOST)})return;` +
    // pathname, never href: a query string cannot switch tracking back on.
    `if(/^\\/(?:${internal})(?:\\/|$)/.test(location.pathname))return;`
  );
}
