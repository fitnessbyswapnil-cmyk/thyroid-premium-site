/**
 * PURE. The follow-up queue — who needs a human touch, oldest wait first.
 *
 * One definition, used by the Analytics tab and the daily digest.
 *
 * WHAT WAS WRONG (diagnosed 14-Sep-2026). The queue said eight women were
 * "waiting for first message", two of them for 28 and 32 hours, and the brief
 * reasonably asked whether the WhatsApp automation had broken. It had not.
 * Every one of the 16 leads flagged in the last 72 hours HAD received an
 * automated message — welcome_lead_score_v2, usually followed by
 * checkout_pending_v2. Three separate faults made them look untouched:
 *
 *  1. "First message" was read from the Msg1 Sent column, a checkbox only
 *     ever ticked by hand. The automation logs to the Messages sheet and never
 *     touches it, so every lead looked unmessaged for three days.
 *  2. The Analytics queue never excluded his own test rows — 10 of the 16.
 *     The 32-hour one was his own test.
 *  3. It sorted by "urgent or not" only, so a 35-minute item sat above a
 *     32-hour one.
 *
 * Now: a message has gone out if the WhatsApp log shows any outbound message
 * to her after she became a lead (automated or sent by hand), OR Msg1 Sent is
 * ticked; test identities are excluded; items sort by wait, oldest first; and
 * each carries an age tone — under 1 hour neutral, 1 to 6 hours amber, over
 * 6 hours red.
 *
 * A real problem the diagnosis turned up, reported and NOT changed here: a
 * paid lead's welcome_lead_score_v2 failed with Meta error #131049 — the
 * per-user cap on MARKETING-category templates. That is a template-category
 * decision, not a queue bug.
 */

export type QueueLead = {
  ts: string;
  name: string;
  phone: string;
  booked: boolean;
  cancelled: boolean;
  showed: string; // "Y" | "N" | ""
  won: boolean;
  isTest: boolean;
  /** When her call is, if she has one. */
  sessionAtMs: number | null;
  msg1: string;
  msg2: string;
  msg3: string;
  /** Latest outbound WhatsApp to her number, automated or manual. "" if none. */
  lastOutboundAt: string;
};

export type QueueKind = "Confirm" | "Nudge" | "Reports" | "Proof" | "Rebook" | "Follow-up";
export type AgeTone = "neutral" | "amber" | "red";

export type QueueItem<L extends QueueLead = QueueLead> = {
  lead: L;
  label: string;
  kind: QueueKind;
  urgent: boolean;
  /** Minutes she has been waiting — since she became a lead. */
  waitMin: number;
  tone: AgeTone;
};

const HOUR = 60;

export function ageTone(waitMin: number): AgeTone {
  if (waitMin < HOUR) return "neutral";
  if (waitMin <= 6 * HOUR) return "amber";
  return "red";
}

export const waitLabel = (mins: number) =>
  mins >= 120 ? `${Math.round(mins / 60)} hr` : `${Math.max(0, Math.round(mins))} min`;

/** Has anything gone out to her since she became a lead? */
export function contacted(l: QueueLead): boolean {
  if (l.msg1) return true;
  const out = Date.parse(l.lastOutboundAt);
  const lead = Date.parse(l.ts);
  return Number.isFinite(out) && (!Number.isFinite(lead) || out >= lead - 60_000);
}

export function buildQueue<L extends QueueLead>(leads: L[], now: number): QueueItem<L>[] {
  const out: QueueItem<L>[] = [];
  const push = (lead: L, label: string, kind: QueueKind, urgent: boolean) => {
    const waitMin = Math.max(0, (now - Date.parse(lead.ts)) / 60000);
    out.push({ lead, label, kind, urgent, waitMin: Number.isFinite(waitMin) ? waitMin : 0, tone: ageTone(waitMin) });
  };

  for (const l of leads) {
    if (l.isTest || l.won) continue;
    const ageMin = (now - Date.parse(l.ts)) / 60000;
    const hrsToSession = l.sessionAtMs !== null ? (l.sessionAtMs - now) / 3_600_000 : null;

    // Cancellation outranks every other state: she paid, then took the call off
    // the calendar. Left alone that is a refund request or a silent write-off.
    if (l.cancelled && l.showed === "") {
      push(l, "Cancelled her call — win the slot back", "Rebook", true);
      continue;
    }
    if (l.showed === "N") {
      if (ageMin < 14 * 1440) push(l, "No-show — invite to rebook", "Rebook", false);
      continue;
    }
    if (l.showed === "Y") {
      if (l.sessionAtMs !== null && now - l.sessionAtMs > 2 * 86_400_000 && now - l.sessionAtMs < 14 * 86_400_000)
        push(l, "Showed but not closed — follow up", "Follow-up", false);
      continue;
    }
    if (!contacted(l) && ageMin < 3 * 1440) {
      push(
        l,
        ageMin > 30 ? `Waiting ${waitLabel(ageMin)} — no WhatsApp has gone out` : "New lead — send first message",
        l.booked ? "Confirm" : "Nudge",
        ageMin > 30,
      );
      continue;
    }
    if (l.booked && hrsToSession !== null && hrsToSession > 0 && hrsToSession <= 24) {
      if (!l.msg2) push(l, "Session in <24h — ask for reports", "Reports", true);
      else if (!l.msg3) push(l, "Session in <24h — send proof story", "Proof", false);
    }
  }

  // Oldest wait first. The old sort put every "urgent" item above every other,
  // which left a 35-minute lead above one who had waited 32 hours.
  return out.sort((a, b) => b.waitMin - a.waitMin);
}

/** "15 Sep 2026 4:00 PM" (the Make scenario's format) → ms, or null. */
export function parseSessionDate(sessionDate: string): number | null {
  const m = String(sessionDate ?? "").match(/^(\d{1,2}) (\w{3}) (\d{4}) (\d{1,2}):(\d{2}) ([AP]M)/);
  if (!m) return null;
  const [, d, mon, y, h, min, ap] = m;
  let hour = parseInt(h, 10) % 12;
  if (ap === "PM") hour += 12;
  const t = new Date(`${mon} ${d}, ${y} ${String(hour).padStart(2, "0")}:${min}:00`).getTime();
  return Number.isNaN(t) ? null : t;
}
