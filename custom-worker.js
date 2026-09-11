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
};

export default {
  fetch: handler.fetch,

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
