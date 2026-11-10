/**
 * sendWhatsAppDocument — her summary PDF on WhatsApp. Two calls to Meta, in
 * order: upload the bytes, then a document message pointing at the upload.
 * A shut 24-hour window must come back as windowClosed, so the dashboard can
 * offer the wa.me fallback instead of a bare error.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { sendWhatsAppDocument } from "./whatsapp.ts";

const PDF = new TextEncoder().encode("%PDF-1.4\n%fake\n");

type Call = { url: string; init: RequestInit };

async function withMeta(
  answer: (call: Call, n: number) => Response,
  run: (calls: Call[]) => Promise<void>,
  env: Record<string, string | undefined> = { WHATSAPP_TOKEN: "tok", WHATSAPP_PHONE_NUMBER_ID: "PNID" },
) {
  const saved = { fetch: globalThis.fetch, env: { ...process.env } };
  const calls: Call[] = [];
  delete process.env.WHATSAPP_ACCESS_TOKEN;
  for (const [k, v] of Object.entries(env)) {
    if (v === undefined) delete process.env[k];
    else process.env[k] = v;
  }
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    const call = { url: String(url), init: init ?? {} };
    calls.push(call);
    return answer(call, calls.length);
  }) as typeof fetch;
  try {
    await run(calls);
  } finally {
    globalThis.fetch = saved.fetch;
    process.env = saved.env;
  }
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });

test("without WhatsApp configured nothing is attempted", async () => {
  await withMeta(
    () => json({}),
    async (calls) => {
      const r = await sendWhatsAppDocument("9876543210", PDF, "a.pdf", "hi");
      assert.deepEqual(r, { sent: false, skipped: "whatsapp_not_configured" });
      assert.equal(calls.length, 0);
    },
    { WHATSAPP_TOKEN: undefined, WHATSAPP_PHONE_NUMBER_ID: undefined },
  );
});

test("the file is uploaded, then sent as a document with its name and caption", async () => {
  await withMeta(
    (_call, n) => (n === 1 ? json({ id: "MEDIA1" }) : json({ messages: [{ id: "wamid.1" }] })),
    async (calls) => {
      const r = await sendWhatsAppDocument("98765 43210", PDF, "Consultation Summary · Meera K. · 2026-11-09.pdf", "Meera, here it is.");
      assert.deepEqual(r, { sent: true, messageId: "wamid.1", mediaId: "MEDIA1" });
      assert.equal(calls.length, 2);

      const [up, send] = calls;
      assert.equal(up.url, "https://graph.facebook.com/v21.0/PNID/media");
      assert.equal((up.init.headers as Record<string, string>).Authorization, "Bearer tok");
      const form = up.init.body as FormData;
      assert.equal(form.get("messaging_product"), "whatsapp");
      assert.equal(form.get("type"), "application/pdf");
      const file = form.get("file") as File;
      assert.equal(file.name, "Consultation Summary · Meera K. · 2026-11-09.pdf");
      assert.deepEqual(new Uint8Array(await file.arrayBuffer()), PDF);

      assert.equal(send.url, "https://graph.facebook.com/v21.0/PNID/messages");
      assert.deepEqual(JSON.parse(String(send.init.body)), {
        messaging_product: "whatsapp",
        recipient_type: "individual",
        to: "919876543210",
        type: "document",
        document: { id: "MEDIA1", filename: "Consultation Summary · Meera K. · 2026-11-09.pdf", caption: "Meera, here it is." },
      });
    },
  );
});

test("a shut 24-hour window is reported as such, with the upload kept", async () => {
  await withMeta(
    (_call, n) => (n === 1 ? json({ id: "MEDIA1" }) : json({ error: { code: 131047, message: "Re-engagement message" } }, 400)),
    async () => {
      const r = await sendWhatsAppDocument("9876543210", PDF, "a.pdf");
      assert.equal(r.sent, false);
      assert.equal(r.windowClosed, true);
      assert.equal(r.mediaId, "MEDIA1");
    },
  );
});

test("a failed upload stops before any message is sent", async () => {
  await withMeta(
    () => json({ error: { code: 100, message: "Invalid parameter" } }, 400),
    async (calls) => {
      const r = await sendWhatsAppDocument("9876543210", PDF, "a.pdf");
      assert.equal(r.sent, false);
      assert.match(r.error ?? "", /upload 100: Invalid parameter/);
      assert.equal(calls.length, 1);
    },
  );
});

test("a bad number or an empty file never reaches Meta", async () => {
  await withMeta(
    () => json({}),
    async (calls) => {
      assert.equal((await sendWhatsAppDocument("12345", PDF, "a.pdf")).skipped, "invalid_phone");
      assert.equal((await sendWhatsAppDocument("9876543210", new Uint8Array(), "a.pdf")).skipped, "empty_file");
      assert.equal(calls.length, 0);
    },
  );
});
