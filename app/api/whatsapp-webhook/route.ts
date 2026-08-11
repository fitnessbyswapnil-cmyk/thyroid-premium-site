/**
 * app/api/whatsapp-webhook/route.ts
 *
 * Catches inbound WhatsApp messages. Without this they are simply lost:
 * Cloud API delivers to a webhook and nowhere else, so a lead who replies to
 * our template is invisible — no app shows it, no inbox exists. That gap is
 * what a BSP charges ~Rs1,500/month to fill.
 *
 * META SETUP (developers.facebook.com → app → WhatsApp → Configuration):
 *   Callback URL:  https://www.swapnilumbarkarfitness.in/api/whatsapp-webhook
 *   Verify token:  the WHATSAPP_VERIFY_TOKEN env var, verbatim
 *   Subscribe to:  messages
 *
 * DELIVERY CONTRACT: only the GET handshake may return a non-200. Every POST
 * is acknowledged 200 no matter what, because Meta retries failures and can
 * disable a webhook that keeps erroring — losing every future conversation to
 * protect one bad row is a terrible trade.
 */
import { NextRequest, NextResponse } from "next/server";
import { appendMessage, readMessages } from "@/lib/wa-messages";
import { sendWhatsAppText } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

/**
 * Her inbound message opens a 24-hour window in which replies need no template,
 * no Meta approval and cost nothing. Until now that window opened and nobody
 * was watching it — the message landed in the sheet and waited for a human.
 *
 * DORMANT BY DEFAULT. Nothing is auto-sent unless WHATSAPP_AUTOREPLY holds the
 * text to send, so this deploys with no behaviour change and is switched on by
 * setting one env var. WHATSAPP_AUTOREPLY_COOLDOWN_HOURS (default 12) stops it
 * interrupting a conversation you are already having with her.
 */
const AUTOREPLY_DEFAULT_COOLDOWN_HOURS = 12;

async function maybeAutoReply(phone: string): Promise<void> {
  const text = (process.env.WHATSAPP_AUTOREPLY || "").trim();
  if (!text) return; // feature off — the common case, and the cheap one

  const cooldownHours = Number(process.env.WHATSAPP_AUTOREPLY_COOLDOWN_HOURS) || AUTOREPLY_DEFAULT_COOLDOWN_HOURS;
  const cutoff = Date.now() - cooldownHours * 3600000;

  // If anything has already gone out to her recently — an auto-reply, or you
  // typing in the admin inbox — say nothing. A bot talking over a live
  // conversation is worse than no bot.
  const history = await readMessages();
  const digits = phone.replace(/\D/g, "").slice(-10);
  const repliedRecently = history.some(
    (m) =>
      m.direction === "out" &&
      m.phone.slice(-10) === digits &&
      (Date.parse(m.ts) || 0) > cutoff,
  );
  if (repliedRecently) {
    console.log(`[wa-webhook] auto-reply skipped for ***${digits.slice(-4)} — already replied within ${cooldownHours}h`);
    return;
  }

  const result = await sendWhatsAppText(phone, text);
  if (!result.sent) {
    console.error(`[wa-webhook] auto-reply failed for ***${digits.slice(-4)}: ${result.error || result.skipped}`);
    return;
  }
  await appendMessage({
    ts: new Date().toISOString(),
    phone: phone.replace(/\D/g, ""),
    direction: "out",
    text,
    messageId: result.messageId ?? "",
    name: "",
    read: true,
  });
  console.log(`[wa-webhook] auto-replied to ***${digits.slice(-4)}`);
}

/** Meta's one-time subscription handshake: echo hub.challenge if the token matches. */
export async function GET(req: NextRequest) {
  const url = new URL(req.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  const expected = process.env.WHATSAPP_VERIFY_TOKEN;

  if (!expected) {
    console.error("[wa-webhook] WHATSAPP_VERIFY_TOKEN is not set — cannot verify");
    return new NextResponse("not configured", { status: 500 });
  }
  if (mode === "subscribe" && token === expected && challenge) {
    console.log("[wa-webhook] verification handshake OK");
    return new NextResponse(challenge, { status: 200 });
  }
  console.warn("[wa-webhook] verification failed — token mismatch");
  return new NextResponse("forbidden", { status: 403 });
}

type WaWebhook = {
  entry?: {
    changes?: {
      value?: {
        contacts?: { profile?: { name?: string }; wa_id?: string }[];
        messages?: {
          from?: string;
          id?: string;
          timestamp?: string;
          type?: string;
          text?: { body?: string };
          button?: { text?: string };
          interactive?: { button_reply?: { title?: string }; list_reply?: { title?: string } };
        }[];
      };
    }[];
  }[];
};

/** Render non-text messages as something a human can act on, never as blank. */
function describe(m: NonNullable<NonNullable<NonNullable<WaWebhook["entry"]>[0]["changes"]>[0]["value"]>["messages"] extends (infer T)[] | undefined ? T : never): string {
  if (m.text?.body) return m.text.body;
  if (m.button?.text) return `[tapped: ${m.button.text}]`;
  if (m.interactive?.button_reply?.title) return `[tapped: ${m.interactive.button_reply.title}]`;
  if (m.interactive?.list_reply?.title) return `[chose: ${m.interactive.list_reply.title}]`;
  return `[${m.type || "unsupported"} message — open WhatsApp Manager to view]`;
}

export async function POST(req: NextRequest) {
  let body: WaWebhook;
  try {
    body = (await req.json()) as WaWebhook;
  } catch {
    return NextResponse.json({ ok: true, skipped: "invalid json" });
  }

  try {
    for (const entry of body.entry ?? []) {
      for (const change of entry.changes ?? []) {
        const value = change.value;
        const messages = value?.messages ?? [];
        if (!messages.length) continue; // status callbacks (delivered/read) — ignore

        const name = value?.contacts?.[0]?.profile?.name ?? "";
        for (const m of messages) {
          const phone = (m.from ?? "").replace(/\D/g, "");
          if (!phone) continue;
          const ts = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString();
          const text = describe(m);
          await appendMessage({ ts, phone, direction: "in", text, messageId: m.id ?? "", name });
          console.log(`[wa-webhook] inbound from ***${phone.slice(-4)} (${name || "unknown"}): ${text.slice(0, 80)}`);

          // Isolated: storing her message is the job that must not fail. An
          // auto-reply is a bonus, and a Meta hiccup on the way out must never
          // cost us the inbound record we just wrote.
          try {
            await maybeAutoReply(phone);
          } catch (replyErr) {
            console.error("[wa-webhook] auto-reply threw (swallowed):", replyErr instanceof Error ? replyErr.message : String(replyErr));
          }
        }
      }
    }
  } catch (err) {
    // Logged loudly — a dropped inbound message is a lost customer — but still
    // acknowledged, so Meta does not retry-storm or disable the subscription.
    console.error("[wa-webhook] failed to store inbound message:", err instanceof Error ? err.message : String(err));
  }

  return NextResponse.json({ ok: true });
}
