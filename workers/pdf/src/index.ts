/**
 * thyroid-pdf — prints the consultation summary to an A4 PDF.
 *
 * WHY THIS IS A WORKER OF ITS OWN
 * A PDF that looks like the approved design needs a real browser, and the only
 * one a Worker can drive is Cloudflare's Browser Run, through
 * @cloudflare/puppeteer. That library alone would push the site's worker
 * (thyroid-funnel, ~2.3 MB of a 3 MB gzipped ceiling on the Free plan) over
 * its limit. So the browser lives here, and the site reaches it through the
 * PDF_RENDERER service binding (lib/pdf-render.ts) — no public URL, no token.
 *
 * NOBODY ELSE CAN CALL IT
 * No route, workers.dev off, preview URLs off: the service binding is the only
 * way in. That is also why it has no key of its own.
 *
 * THE CONTRACT
 * POST the complete HTML document as the body.
 *   200 application/pdf
 *   429 Browser Run said no: one new browser per 20 s and 10 minutes a day on
 *       Workers Free. The site shows it as "busy", not "broken".
 *   400 / 405 / 413 a bad request; 500 / 502 anything else, with a short reason.
 *
 * The page's own fit script (lib/summary-html.ts) runs after load, once the
 * fonts are in, and marks <html data-fit> when each page fits its sheet. The
 * print waits for that mark.
 *
 * Deploy, from this folder: npm ci && npx wrangler deploy
 * It must exist before thyroid-funnel is deployed with the binding.
 */
import puppeteer, { type Browser, type BrowserWorker } from "@cloudflare/puppeteer";

interface Env {
  BROWSER: BrowserWorker;
}

/** The summary is ~25 KB of HTML. Anything near this is not one. */
const MAX_HTML = 2 * 1024 * 1024;

const reply = (status: number, body: string) =>
  new Response(body, { status, headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" } });

const reason = (err: unknown) => (err instanceof Error ? err.message : String(err)).replace(/\s+/g, " ").slice(0, 300);

/** Browser Run's refusals come back as "Unable to create new browser: code: 429: …". */
const refused = (err: unknown) =>
  (err as { status?: unknown } | null)?.status === 429 || /code:\s*429|\b429\b|time limit exceeded|rate limit/i.test(reason(err));

const sleep = (ms: number) => new Promise<void>((resolve) => setTimeout(resolve, ms));

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    if (request.method !== "POST") return reply(405, "POST the HTML to print.");
    const html = await request.text();
    if (!html.trim()) return reply(400, "Empty body: nothing to print.");
    if (html.length > MAX_HTML) return reply(413, "That HTML is too large to be a summary.");

    let browser: Browser;
    try {
      browser = await puppeteer.launch(env.BROWSER, {
        // The summary loads nothing but its fonts, so the browser may reach
        // nothing else: any other host is answered 403 by Browser Run itself
        // (checked 10-Nov-2026), whatever ends up in the HTML.
        guardrails: { allowedDomains: ["fonts.googleapis.com", "fonts.gstatic.com"] },
      });
    } catch (err) {
      console.error("[thyroid-pdf] launch failed:", reason(err));
      return refused(err) ? reply(429, reason(err)) : reply(502, `Could not start a browser: ${reason(err)}`);
    }

    try {
      const page = await browser.newPage();
      // "load", not "networkidle0". On Browser Run, setContent waiting for
      // networkidle0 never resolved (25 s timeouts, tested 10-Nov-2026, with
      // and without guardrails), while "load" returns in under a second with
      // the Google Fonts stylesheet in. The font files themselves are what
      // document.fonts.ready waits for, next.
      await page.setContent(html, { waitUntil: "load", timeout: 25_000 });
      // Strings, not functions: this file is typed for the Worker, not the page.
      await Promise.race([page.evaluate("document.fonts.ready.then(() => true)"), sleep(8_000)]);
      // The page then fits itself to two sheets and marks <html data-fit>.
      // Usually done by now; a page without the script just costs the wait.
      await page.waitForFunction("document.documentElement.hasAttribute('data-fit')", { timeout: 3_000 }).catch(() => {});
      const pdf = await page.pdf({ format: "A4", printBackground: true, preferCSSPageSize: true });
      return new Response(new Uint8Array(pdf), {
        headers: { "content-type": "application/pdf", "cache-control": "no-store" },
      });
    } catch (err) {
      console.error("[thyroid-pdf] render failed:", reason(err));
      return refused(err) ? reply(429, reason(err)) : reply(500, `Render failed: ${reason(err)}`);
    } finally {
      // Browser time is billed until the browser closes, and the free plan has
      // ten minutes a day.
      await browser.close().catch(() => {});
    }
  },
};
