/**
 * lib/pdf-render.ts — SERVER-ONLY. HTML in, PDF bytes out, by way of the
 * separate `thyroid-pdf` worker (workers/pdf) behind the PDF_RENDERER service
 * binding.
 *
 * WHY A SECOND WORKER
 * Printing a PDF needs a real browser, and the only one a Worker can drive is
 * Cloudflare's Browser Run through @cloudflare/puppeteer. That library is far
 * too large for this app: the main worker is already ~2.3 MB of a 3 MB
 * gzipped ceiling on the Free plan. So the browser lives in a tiny worker of
 * its own with no route and no public address, and this module only POSTs it
 * the HTML over a service binding, which costs nothing and adds no latency.
 *
 * DEGRADES TO A NAMED ERROR
 * Only the Cloudflare worker has the binding. In `next dev`, on the Vercel
 * rollback copy and under `node --test` there is none, and the caller gets
 * renderer_missing rather than a crash. @opennextjs/cloudflare is imported
 * lazily for the same reason lib/ledger.ts does it: a unit test that imports
 * this file must not load it.
 *
 * Browser Run on Workers Free allows ten minutes of browser a day and one new
 * browser every twenty seconds. Past either it answers 429, which arrives here
 * as renderer_busy so the dashboard can say "wait a moment", not "broken".
 */

export type RendererCode = "renderer_missing" | "renderer_busy" | "renderer_failed";

export class PdfRenderError extends Error {
  code: RendererCode;
  detail: string;
  constructor(code: RendererCode, detail = "") {
    super(detail ? `${code}: ${detail}` : code);
    this.name = "PdfRenderError";
    this.code = code;
    this.detail = detail;
  }
}

/** All this module needs of a service binding. */
export type RendererBinding = { fetch(input: string, init?: RequestInit): Promise<Response> };

type CloudflareModule = typeof import("@opennextjs/cloudflare");
let cloudflareModule: Promise<CloudflareModule | null> | null = null;

/** The binding for THIS request, or null anywhere it does not exist. See getLedgerDb in lib/ledger.ts. */
export async function rendererBinding(): Promise<RendererBinding | null> {
  try {
    cloudflareModule ??= import("@opennextjs/cloudflare").catch(() => null);
    const mod = await cloudflareModule;
    if (!mod) return null;
    const env = mod.getCloudflareContext().env as unknown as Record<string, unknown>;
    const binding = env?.PDF_RENDERER as RendererBinding | undefined;
    return binding && typeof binding.fetch === "function" ? binding : null;
  } catch {
    return null;
  }
}

/**
 * Print `html` to an A4 PDF. Throws PdfRenderError, never anything else.
 * `binding` is injected by the tests; the route lets it default.
 */
export async function renderPdf(
  html: string,
  opts: { binding?: RendererBinding | null; timeoutMs?: number } = {},
): Promise<Uint8Array> {
  const binding = opts.binding === undefined ? await rendererBinding() : opts.binding;
  if (!binding) throw new PdfRenderError("renderer_missing");

  let res: Response;
  try {
    // The host is a placeholder: a service binding ignores it and hands the
    // request straight to the thyroid-pdf worker.
    res = await binding.fetch("https://thyroid-pdf/render", {
      method: "POST",
      headers: { "content-type": "text/html; charset=utf-8" },
      body: html,
      // Browser Run closes an idle browser at 60 s. A render that is still
      // going at 55 has hung.
      signal: AbortSignal.timeout(opts.timeoutMs ?? 55_000),
    });
  } catch (err) {
    const name = err instanceof Error ? err.name : "";
    throw new PdfRenderError("renderer_failed", name === "TimeoutError" || name === "AbortError" ? "timed out" : err instanceof Error ? err.message : String(err));
  }

  if (res.status === 429) throw new PdfRenderError("renderer_busy", (await res.text().catch(() => "")).slice(0, 200));
  if (!res.ok) {
    const text = (await res.text().catch(() => "")).replace(/\s+/g, " ").slice(0, 200);
    throw new PdfRenderError("renderer_failed", `HTTP ${res.status} ${text}`.trim());
  }
  const bytes = new Uint8Array(await res.arrayBuffer());
  // "%PDF" — anything else is an error page that happened to answer 200.
  if (bytes.length < 5 || bytes[0] !== 0x25 || bytes[1] !== 0x50 || bytes[2] !== 0x44 || bytes[3] !== 0x46) {
    throw new PdfRenderError("renderer_failed", `not a PDF (${bytes.length} bytes)`);
  }
  return bytes;
}

/** What to tell him for each failure: the fix, not the stack trace. */
export function pdfHint(err: PdfRenderError): string {
  switch (err.code) {
    case "renderer_missing":
      return "The PDF printer (the thyroid-pdf worker) is not connected to this site. Deploy workers/pdf, then redeploy the site.";
    case "renderer_busy":
      return /time limit/i.test(err.detail)
        ? "Today's free PDF printing time is used up. It resets at 5:30am IST."
        : "The PDF printer is busy. Wait twenty seconds and press it again.";
    default:
      return `The PDF printer failed: ${err.detail || "no detail"}. Press it again.`;
  }
}
