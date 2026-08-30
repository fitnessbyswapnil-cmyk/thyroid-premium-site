/**
 * lib/fathom.ts — Fathom public API client + webhook verification.
 *
 * SERVER ONLY. Reads FATHOM_API_KEY and FATHOM_WEBHOOK_SECRET.
 *
 * Contract (developers.fathom.ai):
 *   Base URL   https://api.fathom.ai/external/v1
 *   Auth       X-Api-Key: <key>
 *   Meetings   GET /meetings
 *   Transcript GET /recordings/{recording_id}/transcript
 *   Webhook    event "new-meeting-content-ready"
 *              headers webhook-id, webhook-timestamp, webhook-signature
 *              HMAC-SHA256 over `${webhook-id}.${webhook-timestamp}.${rawBody}`
 *
 * DELIBERATELY SHAPE-TOLERANT. Fathom publishes the endpoints and the signing
 * scheme, but not the field names inside the payload. Rather than hard-code a
 * guess that fails silently on the first real call, every field is read through
 * `pick()`, which tries a list of plausible paths — and the route logs the
 * payload's top-level keys the first time one arrives, so the exact shape can be
 * pinned once instead of guessed forever.
 */
import crypto from "crypto";

const BASE = "https://api.fathom.ai/external/v1";

function apiKey(): string {
  const k = process.env.FATHOM_API_KEY;
  if (!k) throw new Error("FATHOM_API_KEY not configured");
  return k;
}

async function get<T>(path: string): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { "X-Api-Key": apiKey(), accept: "application/json" },
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`fathom_${res.status}: ${(await res.text()).slice(0, 300)}`);
  return (await res.json()) as T;
}

/**
 * Verify a Fathom webhook. Returns 'unconfigured' when no secret is set so the
 * route can decide (we accept-and-log in that case rather than 401, matching how
 * /api/cal-webhook behaves — a misconfigured secret must never look like a
 * hostile request).
 */
export function verifyFathomSignature(
  rawBody: string,
  headers: { id: string; timestamp: string; signature: string },
  secret = process.env.FATHOM_WEBHOOK_SECRET,
): "valid" | "mismatch" | "unconfigured" {
  if (!secret) return "unconfigured";
  if (!headers.id || !headers.timestamp || !headers.signature) return "mismatch";

  const signed = `${headers.id}.${headers.timestamp}.${rawBody}`;
  const expected = crypto.createHmac("sha256", secret).update(signed, "utf8").digest("base64");

  // The header may carry several space-separated versioned signatures
  // ("v1,<sig> v1,<sig>"). Accept if ANY entry matches, comparing in constant
  // time — a plain === here would leak timing on a secret.
  const candidates = headers.signature
    .split(/\s+/)
    .map((s) => (s.includes(",") ? s.slice(s.indexOf(",") + 1) : s))
    .filter(Boolean);

  const exp = Buffer.from(expected, "utf8");
  for (const c of candidates) {
    const got = Buffer.from(c, "utf8");
    if (got.length === exp.length && crypto.timingSafeEqual(got, exp)) return "valid";
  }
  return "mismatch";
}

type Json = Record<string, unknown>;

/** Reads the first path that yields a non-empty value. Paths use dots. */
export function pick(obj: unknown, paths: string[]): string {
  for (const p of paths) {
    let cur: unknown = obj;
    for (const seg of p.split(".")) {
      if (cur && typeof cur === "object" && seg in (cur as Json)) cur = (cur as Json)[seg];
      else {
        cur = undefined;
        break;
      }
    }
    if (typeof cur === "string" && cur.trim()) return cur.trim();
    if (typeof cur === "number") return String(cur);
  }
  return "";
}

/** Collects every email found anywhere in the payload, lowercased and unique. */
export function collectEmails(obj: unknown, depth = 0): string[] {
  const out = new Set<string>();
  const walk = (v: unknown, d: number) => {
    if (d > 6 || v == null) return;
    if (typeof v === "string") {
      const m = v.match(/[\w.+-]+@[\w-]+\.[\w.-]+/g);
      m?.forEach((e) => out.add(e.toLowerCase()));
      return;
    }
    if (Array.isArray(v)) return v.forEach((x) => walk(x, d + 1));
    if (typeof v === "object") return Object.values(v as Json).forEach((x) => walk(x, d + 1));
  };
  walk(obj, depth);
  return [...out];
}

export type FathomMeeting = {
  recordingId: string;
  title: string;
  startedAt: string;
  url: string;
  emails: string[];
  /** Present when the webhook was configured to include it. */
  transcript: string;
};

/**
 * Normalise a webhook body (or a /meetings entry) into the shape the CRM needs.
 * Every field tries several plausible key paths — see the note at the top.
 */
export function normaliseMeeting(payload: unknown): FathomMeeting {
  const root =
    (payload as Json)?.meeting ??
    (payload as Json)?.recording ??
    (payload as Json)?.data ??
    payload;

  return {
    recordingId: pick(root, [
      "recording_id",
      "recordingId",
      "id",
      "recording.id",
      "meeting.recording_id",
    ]),
    title: pick(root, ["title", "meeting_title", "name", "topic"]),
    startedAt: pick(root, [
      "scheduled_start_time",
      "started_at",
      "start_time",
      "startTime",
      "created_at",
      "recording_start_time",
    ]),
    url: pick(root, ["url", "share_url", "recording_url", "fathom_url", "share_link"]),
    emails: collectEmails(root),
    transcript: normaliseTranscript(
      (root as Json)?.transcript ?? (payload as Json)?.transcript ?? "",
    ),
  };
}

/**
 * Fathom may return a transcript as plain text or as speaker-segmented objects.
 * Both collapse to "Speaker: text" lines, which is what the extractor reads.
 */
export function normaliseTranscript(t: unknown): string {
  if (!t) return "";
  if (typeof t === "string") return t.trim();

  const segments = Array.isArray(t) ? t : (t as Json).segments ?? (t as Json).entries ?? (t as Json).lines;
  if (!Array.isArray(segments)) return "";

  return segments
    .map((s) => {
      if (typeof s === "string") return s;
      const speaker = pick(s, ["speaker", "speaker_name", "name", "speaker.display_name", "speaker.name"]);
      const text = pick(s, ["text", "transcript", "content", "words"]);
      const ts = pick(s, ["timestamp", "start_time", "start"]);
      if (!text) return "";
      const stamp = ts ? `[${ts}] ` : "";
      return speaker ? `${stamp}${speaker}: ${text}` : `${stamp}${text}`;
    })
    .filter(Boolean)
    .join("\n")
    .trim();
}

export async function listMeetings(): Promise<FathomMeeting[]> {
  const json = await get<Json>("/meetings");
  const items = (json.items ?? json.meetings ?? json.data ?? json.results ?? []) as unknown[];
  return (Array.isArray(items) ? items : []).map(normaliseMeeting);
}

export async function fetchTranscript(recordingId: string): Promise<string> {
  if (!recordingId) return "";
  const json = await get<Json>(`/recordings/${encodeURIComponent(recordingId)}/transcript`);
  return normaliseTranscript(json.transcript ?? json.segments ?? json.data ?? json);
}

// ── Joining a Fathom meeting to a Cal.com booking ───────────────────────────

export type BookingCandidate = {
  uid: string;
  email: string;
  name: string;
  /** ISO start time of the Cal.com booking. */
  startIso: string;
};

/**
 * PURE. Matches a recording to a booking, email first and time second.
 *
 * Email is the strong signal: Fathom sees the invitee list, Cal.com knows who
 * booked. Time alone is not enough — two women can book the same slot on
 * different days, and a call can start late. Where the email is absent (she
 * dialled in, or Fathom only captured the host), we fall back to the nearest
 * booking within the window, which is right far more often than it is wrong and
 * is always visible in the CRM for correction.
 */
export function matchBooking(
  meeting: { emails: string[]; startedAt: string },
  bookings: BookingCandidate[],
  windowMinutes = 180,
): BookingCandidate | null {
  const emails = new Set(meeting.emails.map((e) => e.toLowerCase()));
  const byEmail = bookings.filter((b) => b.email && emails.has(b.email.toLowerCase()));

  const start = new Date(meeting.startedAt).getTime();
  const near = (b: BookingCandidate) => {
    const t = new Date(b.startIso).getTime();
    return Number.isNaN(t) || Number.isNaN(start) ? Infinity : Math.abs(t - start) / 60000;
  };

  // Email match wins. If she has several bookings, take the closest in time.
  if (byEmail.length) return byEmail.sort((a, b) => near(a) - near(b))[0];

  if (Number.isNaN(start)) return null;
  const candidates = bookings.filter((b) => near(b) <= windowMinutes);
  if (!candidates.length) return null;
  return candidates.sort((a, b) => near(a) - near(b))[0];
}
