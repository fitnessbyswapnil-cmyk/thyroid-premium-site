/**
 * /api/admin/messages
 *
 *   GET  — every conversation, grouped into threads, newest activity first.
 *   POST — send a free-form reply { phone, text }.
 *
 * Auth: x-admin-key, same as the rest of /api/admin/*.
 *
 * The 24-hour window is the thing to understand here. A reply is free and needs
 * no template only while it is inside 24h of HER last inbound message. The GET
 * computes that per thread so the dashboard can show the remaining time and
 * disable the box when it closes, rather than letting a reply fail after it has
 * been typed.
 */
import { NextRequest, NextResponse } from "next/server";
import { checkAdminKey } from "../_lib";
import { readMessages, appendMessage, markThreadRead, type WaMessage } from "@/lib/wa-messages";
import { sendWhatsAppText, toWhatsAppNumber } from "@/lib/whatsapp";

export const dynamic = "force-dynamic";

const WINDOW_MS = 24 * 60 * 60 * 1000;

export type Thread = {
  phone: string;
  name: string;
  messages: WaMessage[];
  lastTs: string;
  unread: number;
  /** Minutes left to reply free-form; 0 once her window has closed. */
  windowMinutesLeft: number;
};

export async function GET(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  try {
    const all = await readMessages();
    const byPhone = new Map<string, WaMessage[]>();
    for (const m of all) {
      const list = byPhone.get(m.phone) ?? [];
      list.push(m);
      byPhone.set(m.phone, list);
    }

    const now = Date.now();
    const threads: Thread[] = [];
    for (const [phone, msgs] of byPhone) {
      msgs.sort((a, b) => (a.ts < b.ts ? -1 : 1));
      const lastInbound = [...msgs].reverse().find((m) => m.direction === "in");
      const openedAt = lastInbound ? new Date(lastInbound.ts).getTime() : 0;
      const leftMs = openedAt ? Math.max(0, openedAt + WINDOW_MS - now) : 0;
      threads.push({
        phone,
        name: msgs.find((m) => m.name)?.name ?? "",
        messages: msgs,
        lastTs: msgs[msgs.length - 1]?.ts ?? "",
        unread: msgs.filter((m) => m.direction === "in" && !m.read).length,
        windowMinutesLeft: Math.round(leftMs / 60000),
      });
    }
    threads.sort((a, b) => (a.lastTs < b.lastTs ? 1 : -1));
    return NextResponse.json({
      threads,
      totalUnread: threads.reduce((n, t) => n + t.unread, 0),
    });
  } catch (err) {
    console.error("[admin/messages] read failed:", err);
    return NextResponse.json({ threads: [], totalUnread: 0, error: "read_failed" });
  }
}

export async function POST(req: NextRequest) {
  if (!checkAdminKey(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });

  let body: { phone?: string; text?: string; markRead?: boolean };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "bad_json" }, { status: 400 });
  }

  const phone = toWhatsAppNumber(String(body.phone ?? ""));
  if (phone.length < 12) return NextResponse.json({ error: "bad_phone" }, { status: 400 });

  // Opening a thread just marks it read; no message is sent.
  if (body.markRead && !body.text) {
    try {
      await markThreadRead(phone);
    } catch (err) {
      console.error("[admin/messages] markRead failed:", err);
    }
    return NextResponse.json({ ok: true });
  }

  const text = String(body.text ?? "").trim().slice(0, 4000);
  if (!text) return NextResponse.json({ error: "empty_message" }, { status: 400 });

  const result = await sendWhatsAppText(phone, text);
  if (!result.sent) {
    // Surfaced to the UI rather than swallowed: a reply that silently never
    // arrived is worse than one that visibly failed and can be retried.
    return NextResponse.json({ error: result.error || result.skipped || "send_failed" }, { status: 502 });
  }

  // Record our own side so the thread reads as a conversation, not a monologue.
  try {
    await appendMessage({
      ts: new Date().toISOString(),
      phone,
      direction: "out",
      text,
      messageId: result.messageId ?? "",
      name: "",
      read: true,
    });
    await markThreadRead(phone);
  } catch (err) {
    console.error("[admin/messages] sent but failed to log:", err);
  }

  return NextResponse.json({ ok: true, messageId: result.messageId });
}
