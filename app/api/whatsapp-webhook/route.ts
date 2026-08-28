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
import { routeReply } from "@/lib/wa-autoreply";

export const dynamic = "force-dynamic";

/**
 * Her inbound message opens a 24-hour window in which replies need no template,
 * no Meta approval and cost nothing. Until now that window opened and nobody
 * was watching it — the message landed in the sheet and waited for a human.
 *
 * WHY THIS CHANNEL CARRIES THE LOAD RIGHT NOW: the WABA holding the sending
 * number has no usable payment method (an orphaned BSP credit line blocks it),
 * so TEMPLATE sends are accepted by Meta and then silently dropped. Free-form
 * service-window replies are the only messages actually reaching leads today.
 *
 * DORMANT BY DEFAULT. Nothing is auto-sent unless WHATSAPP_AUTOREPLY is set —
 * its value is no longer the reply text, only the on/off switch, because the
 * reply itself is now chosen per message by lib/wa-autoreply (price, booking,
 * medication, opt-out, …). Set it to "on" to enable.
 * WHATSAPP_AUTOREPLY_COOLDOWN_HOURS (default 12) stops the bot interrupting a
 * conversation a human is already having.
 */
const AUTOREPLY_DEFAULT_COOLDOWN_HOURS = 12;

/** Marker written into the log when a lead opts out or asks for a human. From
 *  then on the bot stays silent for that number, forever — re-engaging someone
 *  who said stop is a Meta-policy problem, not just a rude one. */
const SILENCE_MARKER = "[auto-reply disabled for this contact]";

async function maybeAutoReply(phone: string, inbound: string): Promise<void> {
  if (!(process.env.WHATSAPP_AUTOREPLY || "").trim()) return; // feature off

  const cooldownHours = Number(process.env.WHATSAPP_AUTOREPLY_COOLDOWN_HOURS) || AUTOREPLY_DEFAULT_COOLDOWN_HOURS;
  const cutoff = Date.now() - cooldownHours * 3600000;

  const history = await readMessages();
  const digits = phone.replace(/\D/g, "").slice(-10);
  const mine = history.filter((m) => m.phone.slice(-10) === digits);

  // Permanent silence beats any cooldown: honour it before anything else.
  if (mine.some((m) => m.direction === "out" && m.text.includes(SILENCE_MARKER))) {
    console.log(`[wa-webhook] auto-reply suppressed for ***${digits.slice(-4)} — contact opted out or was handed off`);
    return;
  }

  // If anything has already gone out to her recently — an auto-reply, or you
  // typing in the admin inbox — say nothing. A bot talking over a live
  // conversation is worse than no bot.
  const repliedRecently = mine.some(
    (m) => m.direction === "out" && (Date.parse(m.ts) || 0) > cutoff,
  );
  if (repliedRecently) {
    console.log(`[wa-webhook] auto-reply skipped for ***${digits.slice(-4)} — already replied within ${cooldownHours}h`);
    return;
  }

  const { intent, reply, terminal } = routeReply(inbound);
  console.log(`[wa-webhook] auto-reply intent=${intent} terminal=${terminal} → ***${digits.slice(-4)}`);

  // SEND the reply exactly as written. The silence marker is a LOG-ONLY flag —
  // appending it to the outbound text would show the lead our internal state.
  const result = await sendWhatsAppText(phone, reply);
  if (!result.sent) {
    console.error(`[wa-webhook] auto-reply failed for ***${digits.slice(-4)}: ${result.error || result.skipped}`);
    return;
  }
  await appendMessage({
    ts: new Date().toISOString(),
    phone: phone.replace(/\D/g, ""),
    direction: "out",
    text: terminal ? `${reply}\n\n${SILENCE_MARKER}` : reply,
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

type WaMedia = { id?: string; mime_type?: string; filename?: string; caption?: string };

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
          // Media arrives as an id, never as bytes. Clients send their thyroid
          // reports this way, so the id is what makes them openable later.
          image?: WaMedia;
          document?: WaMedia;
          audio?: WaMedia;
          video?: WaMedia;
          sticker?: WaMedia;
        }[];
        statuses?: {
          id?: string;
          status?: string;
          timestamp?: string;
          recipient_id?: string;
          errors?: { code?: number; title?: string; message?: string; error_data?: { details?: string } }[];
        }[];
      };
    }[];
  }[];
};

type WaInbound = NonNullable<
  NonNullable<NonNullable<WaWebhook["entry"]>[0]["changes"]>[0]["value"]
>["messages"] extends (infer T)[] | undefined
  ? T
  : never;

/** The media attachment on a message, if it carries one. */
function mediaOf(m: WaInbound): { media: WaMedia; kind: string } | null {
  for (const kind of ["image", "document", "audio", "video", "sticker"] as const) {
    const media = m[kind];
    if (media?.id) return { media, kind };
  }
  return null;
}

/** Render non-text messages as something a human can act on, never as blank. */
function describe(m: WaInbound): string {
  if (m.text?.body) return m.text.body;
  if (m.button?.text) return `[tapped: ${m.button.text}]`;
  if (m.interactive?.button_reply?.title) return `[tapped: ${m.interactive.button_reply.title}]`;
  if (m.interactive?.list_reply?.title) return `[chose: ${m.interactive.list_reply.title}]`;
  // A caption is her own words about the file she sent — always better than a
  // generic label. The attachment travels alongside on the media columns.
  const found = mediaOf(m);
  if (found) {
    const label = found.media.filename || `${found.kind} attachment`;
    return found.media.caption ? `${found.media.caption}` : `[${label}]`;
  }
  return `[${m.type || "unsupported"} message]`;
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

        // Delivery outcomes. The send API returning ok/messageId only means
        // Meta ACCEPTED the message — it says nothing about whether the phone
        // ever received it. A template that is accepted and then silently
        // dropped (recipient not on WhatsApp, marketing opt-out, per-user
        // marketing cap) is indistinguishable from a delivered one unless the
        // failure is recorded here. Failures are written into the inbox so a
        // dropped message is visible next to the thread it belongs to.
        for (const s of value?.statuses ?? []) {
          const phone = (s.recipient_id ?? "").replace(/\D/g, "");
          const state = s.status ?? "unknown";
          if (state !== "failed") {
            console.log(`[wa-webhook] status ${state} → ***${phone.slice(-4)} id=${s.id ?? "(none)"}`);
            continue;
          }
          const e = s.errors?.[0];
          const reason = [e?.code ? `(#${e.code})` : "", e?.title, e?.error_data?.details || e?.message]
            .filter(Boolean)
            .join(" ")
            .trim();
          console.error(`[wa-webhook] DELIVERY FAILED → ***${phone.slice(-4)}: ${reason || "no reason given"}`);
          if (!phone) continue;
          try {
            await appendMessage({
              ts: s.timestamp ? new Date(Number(s.timestamp) * 1000).toISOString() : new Date().toISOString(),
              phone,
              direction: "out",
              text: `[delivery failed] ${reason || "no reason given"}`,
              messageId: s.id ?? "",
              name: "",
            });
          } catch (logErr) {
            console.error("[wa-webhook] could not record failure:", logErr instanceof Error ? logErr.message : String(logErr));
          }
        }

        const messages = value?.messages ?? [];
        if (!messages.length) continue;

        const name = value?.contacts?.[0]?.profile?.name ?? "";
        for (const m of messages) {
          const phone = (m.from ?? "").replace(/\D/g, "");
          if (!phone) continue;
          const ts = m.timestamp ? new Date(Number(m.timestamp) * 1000).toISOString() : new Date().toISOString();
          const text = describe(m);
          const found = mediaOf(m);
          await appendMessage({
            ts, phone, direction: "in", text, messageId: m.id ?? "", name,
            mediaId: found?.media.id ?? "",
            mediaType: found?.kind ?? "",
            mediaMime: found?.media.mime_type ?? "",
            mediaName: found?.media.filename ?? "",
          });
          console.log(`[wa-webhook] inbound from ***${phone.slice(-4)} (${name || "unknown"}): ${text.slice(0, 80)}`);

          // Isolated: storing her message is the job that must not fail. An
          // auto-reply is a bonus, and a Meta hiccup on the way out must never
          // cost us the inbound record we just wrote.
          try {
            await maybeAutoReply(phone, text);
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
