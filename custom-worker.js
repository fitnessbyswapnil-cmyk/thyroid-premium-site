/**
 * Cloudflare Worker entry point.
 *
 * `fetch` is the Next.js app exactly as OpenNext builds it. `scheduled` replaces
 * the two jobs Vercel Cron used to run from vercel.json — same routes, same
 * CRON_SECRET bearer header, so neither route changes.
 *
 * The request is handed straight to the app's own fetch handler rather than
 * sent over the network, so a cron run never depends on DNS or the public URL.
 *
 * Plain JS on purpose: Next's type-check covers **\/*.ts and would reject the
 * Workers-only types this file uses.
 */
import { default as handler } from "./.open-next/worker.js";

/** Cron expression (UTC) → route. Must match `triggers.crons` in wrangler.jsonc. */
const CRON_ROUTES = {
  "30 2 * * *": "/api/admin/digest", // 08:00 IST daily digest
  "50 23 * * *": "/api/cron/payment-reminder", // daily safety net; cron-job.org polls every 5 min
  "*/15 * * * *": "/api/cron/meta-retry", // resend failed Meta CAPI events recorded in the D1 ledger
};

/** The bare domain answers only with a redirect to www, exactly as Vercel did. */
const APEX = "swapnilumbarkarfitness.in";
const CANONICAL = "www.swapnilumbarkarfitness.in";

export default {
  /**
   * 307, not 301: it preserves the method and body, so a webhook or form POST
   * that still targets the bare domain is replayed at www instead of turning
   * into a GET — and browsers do not cache it forever if the rule ever changes.
   */
  fetch(request, env, ctx) {
    const url = new URL(request.url);
    // One hop to https://www — Vercel did both of these for free; here the
    // worker must, or http:// visitors would be served (and pay) unencrypted.
    if (url.hostname === APEX || url.protocol === "http:") {
      if (url.hostname === APEX) url.hostname = CANONICAL;
      url.protocol = "https:";
      return Response.redirect(url.toString(), 307);
    }
    return handler.fetch(request, env, ctx);
  },

  /** @param {{ cron: string }} controller */
  async scheduled(controller, env, ctx) {
    const path = CRON_ROUTES[controller.cron];
    if (!path) {
      console.warn(`[cron] no route for "${controller.cron}"`);
      return;
    }
    const req = new Request(`https://www.swapnilumbarkarfitness.in${path}`, {
      headers: { authorization: `Bearer ${env.CRON_SECRET}` },
    });
    ctx.waitUntil(
      handler
        .fetch(req, env, ctx)
        .then((res) => console.log(`[cron] ${path} → ${res.status}`))
        .catch((err) => console.error(`[cron] ${path} failed:`, err)),
    );
  },
};
