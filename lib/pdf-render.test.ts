/**
 * lib/pdf-render.ts — every way the printer can fail arrives as one of three
 * named codes, because the dashboard says something different for each:
 * not connected, busy (wait twenty seconds), or broken (press again).
 */
import test from "node:test";
import assert from "node:assert/strict";
import { PdfRenderError, pdfHint, renderPdf, rendererBinding, type RendererBinding } from "./pdf-render.ts";

const PDF = new TextEncoder().encode("%PDF-1.4\n%fake\n");

const binding = (respond: (init?: RequestInit) => Response | Promise<Response>): RendererBinding & { calls: RequestInit[] } => {
  const calls: RequestInit[] = [];
  return {
    calls,
    async fetch(_url: string, init?: RequestInit) {
      calls.push(init ?? {});
      return respond(init);
    },
  };
};

const rejectsWith = (p: Promise<unknown>, code: string, detail?: RegExp) =>
  assert.rejects(p, (e: unknown) => {
    assert.ok(e instanceof PdfRenderError, String(e));
    assert.equal(e.code, code);
    if (detail) assert.match(e.detail, detail);
    return true;
  });

test("outside the worker there is no binding, and that is renderer_missing, not a crash", async () => {
  assert.equal(await rendererBinding(), null);
  await rejectsWith(renderPdf("<html></html>"), "renderer_missing");
  await rejectsWith(renderPdf("<html></html>", { binding: null }), "renderer_missing");
});

test("the HTML goes over as a POST and the PDF bytes come back", async () => {
  const b = binding(() => new Response(PDF, { headers: { "content-type": "application/pdf" } }));
  const out = await renderPdf("<html>hi</html>", { binding: b });
  assert.deepEqual([...out], [...PDF]);
  assert.equal(b.calls[0].method, "POST");
  assert.equal(b.calls[0].body, "<html>hi</html>");
});

test("Browser Run's 429 is renderer_busy", async () => {
  const b = binding(() => new Response("Unable to create new browser: code: 429: message: Browser time limit exceeded for today", { status: 429 }));
  await rejectsWith(renderPdf("x", { binding: b }), "renderer_busy", /time limit/);
});

test("any other failure is renderer_failed, with what the worker said", async () => {
  await rejectsWith(renderPdf("x", { binding: binding(() => new Response("Render failed: boom", { status: 500 })) }), "renderer_failed", /500 Render failed: boom/);
  await rejectsWith(renderPdf("x", { binding: binding(() => { throw new Error("socket hang up"); }) }), "renderer_failed", /socket hang up/);
});

test("a 200 that is not a PDF is not passed off as one", async () => {
  await rejectsWith(renderPdf("x", { binding: binding(() => new Response("<html>error page</html>")) }), "renderer_failed", /not a PDF/);
});

test("a render that hangs is abandoned", async () => {
  const hang = binding(
    (init) =>
      new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => reject(Object.assign(new Error("aborted"), { name: "TimeoutError" })));
      }),
  );
  await rejectsWith(renderPdf("x", { binding: hang, timeoutMs: 20 }), "renderer_failed", /timed out/);
});

test("each failure tells him what to do, not what broke", () => {
  assert.match(pdfHint(new PdfRenderError("renderer_missing")), /Deploy workers\/pdf/);
  assert.match(pdfHint(new PdfRenderError("renderer_busy", "Browser time limit exceeded for today")), /resets at 5:30am IST/);
  assert.match(pdfHint(new PdfRenderError("renderer_busy", "Rate limit exceeded")), /Wait twenty seconds/);
  assert.match(pdfHint(new PdfRenderError("renderer_failed", "boom")), /boom.*again/);
  for (const code of ["renderer_missing", "renderer_busy", "renderer_failed"] as const) {
    assert.ok(!pdfHint(new PdfRenderError(code)).includes("!"));
  }
});
