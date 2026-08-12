/**
 * GET /api/admin/whatsapp-status
 *
 * One place to answer "is my WhatsApp automation actually working?".
 *
 * The failure that prompted this was invisible from every dashboard: sending
 * worked perfectly while RECEIVING was dead, because the Meta webhook had
 * never been pointed at this site. Templates went out, women replied, and the
 * replies landed nowhere — Cloud API delivers inbound messages to a webhook
 * and nowhere else. Nothing in Meta's UI says "your webhook is unsubscribed",
 * so the only symptom was an inbox that stayed empty.
 *
 * This route checks each link of the chain independently and reports which one
 * is broken, so the next outage is diagnosed in a page refresh.
 *
 * Auth: x-admin-key, same as the rest of /api/admin/*.
 * Secrets are NEVER returned — only whether they are present.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { readMessages } from "@/lib/wa-messages";
import { isWhatsAppConfigured } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const APP_URL = process.env.NEXT_PUBLIC_APP_URL || "https://www.swapnilumbarkarfitness.in";

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const hasToken = !!(process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN);
  const hasPhoneId = !!process.env.WHATSAPP_PHONE_NUMBER_ID;
  const hasVerifyToken = !!process.env.WHATSAPP_VERIFY_TOKEN;

  // Inbound state. A missing Messages tab is the specific signature of a
  // webhook that has never fired even once.
  let inboxReadable = false;
  let totalMessages = 0;
  let inbound = 0;
  let outbound = 0;
  let lastInboundAt = "";
  let lastOutboundAt = "";
  let inboxError = "";
  // Per-automation activity: outbound templates are mirrored into the tab as
  // "[template_name] …", so the label doubles as the classifier. Anything
  // outbound without that prefix is a human (or auto-) reply typed as text.
  const byTemplate = new Map<string, { count: number; lastAt: string }>();

  try {
    // Note: readMessages() resolves to [] when the Messages tab does not exist
    // yet, so "readable but empty" and "tab absent" are indistinguishable here
    // — and mean the same thing operationally: nothing has ever arrived.
    const msgs = await readMessages();
    inboxReadable = true;
    totalMessages = msgs.length;
    for (const m of msgs) {
      if (m.direction === "in") {
        inbound++;
        if (m.ts > lastInboundAt) lastInboundAt = m.ts;
      } else {
        outbound++;
        if (m.ts > lastOutboundAt) lastOutboundAt = m.ts;
        const name = m.text.match(/^\[([a-z0-9_]+)\]/i)?.[1] ?? "free-form reply";
        const entry = byTemplate.get(name) ?? { count: 0, lastAt: "" };
        entry.count++;
        if (m.ts > entry.lastAt) entry.lastAt = m.ts;
        byTemplate.set(name, entry);
      }
    }
  } catch (err) {
    inboxError = err instanceof Error ? err.message : String(err);
  }

  const automations = [...byTemplate.entries()]
    .map(([name, v]) => ({ name, count: v.count, lastAt: v.lastAt }))
    .sort((a, b) => (a.lastAt < b.lastAt ? 1 : -1));

  const sending: "ok" | "not_configured" = isWhatsAppConfigured() ? "ok" : "not_configured";

  // Receiving cannot be proven without an inbound message, so say exactly that
  // rather than implying health we have not observed.
  const receiving: "ok" | "never_received" | "not_configured" | "unknown" = !hasVerifyToken
    ? "not_configured"
    : !inboxReadable
    ? "unknown"
    : inbound > 0
    ? "ok"
    : "never_received";

  const actions: string[] = [];
  if (!hasToken) actions.push("Set WHATSAPP_TOKEN in Vercel (System User token).");
  if (!hasPhoneId) actions.push("Set WHATSAPP_PHONE_NUMBER_ID in Vercel.");
  if (!hasVerifyToken) actions.push("Set WHATSAPP_VERIFY_TOKEN in Vercel, then use the same value in Meta.");
  if (receiving === "never_received") {
    actions.push(
      `No inbound message has EVER arrived. In Meta → your app → WhatsApp → Configuration, set the Callback URL to ${APP_URL}/api/whatsapp-webhook, use your WHATSAPP_VERIFY_TOKEN as the verify token, and tick the "messages" subscription. Then WhatsApp your business number from your own phone to confirm.`,
    );
  }
  if (inboxError) actions.push(`Inbox unreadable — check Google Sheets env vars. (${inboxError})`);

  return NextResponse.json({
    sending,
    receiving,
    autoReply: process.env.WHATSAPP_AUTOREPLY ? "on" : "off",
    templateLanguage: process.env.WHATSAPP_TEMPLATE_LANG || "en",
    env: {
      token: hasToken,
      phoneNumberId: hasPhoneId,
      verifyToken: hasVerifyToken,
    },
    webhook: {
      callbackUrl: `${APP_URL}/api/whatsapp-webhook`,
      subscribeTo: "messages",
    },
    inbox: {
      readable: inboxReadable,
      totalMessages,
      inbound,
      outbound,
      lastInboundAt,
      lastOutboundAt,
    },
    // What the automation has actually sent, per template, newest first.
    // Counting starts when this deploy went live — earlier sends predate the
    // inbox mirror and exist only in Vercel logs / the Leads-tab stamp columns.
    automations,
    actions,
  });
}
