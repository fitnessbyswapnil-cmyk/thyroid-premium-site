/**
 * PURE. Did she attend? Read from the Fathom transcript, with no AI.
 *
 * WHY THIS EXISTS. CallHeld tells Meta which bookings turned into a real
 * conversation — the difference between a woman who books and a woman who
 * shows up, which matters in a funnel where 45 bookings never reached the
 * call. It used to fire only after Claude had read the whole transcript, so
 * with no ANTHROPIC_API_KEY on the worker it never fired at all. Knowing she
 * attended does not need a model: it needs to know whether anyone other than
 * the coach actually spoke. That is in the transcript already.
 *
 * THE RULE.
 *  - Fathom labels lines "Speaker: text" (optionally "[00:12:04] Speaker: …").
 *  - When the coach's own label is present, she attended if the OTHER speakers
 *    between them said at least MIN_CLIENT_WORDS words. A no-show call is the
 *    coach waiting, saying "hello, can you hear me?" into an empty room — a
 *    handful of words, all his.
 *  - When the coach cannot be told apart (generic "Speaker 1 / Speaker 2"
 *    labels), it takes two distinct speakers who each said MIN_CLIENT_WORDS —
 *    a monologue cannot pass that.
 *  - With no speaker labels at all, a long transcript is taken as a real call.
 *
 * Deliberately conservative: a false "attended" sends Meta a conversion that
 * did not happen, which is worse than a missed one.
 *
 * Also returned because it costs nothing: call duration from the timestamps,
 * the coach's share of the words, and whether a second non-coach speaker —
 * usually the husband — was on the call.
 */

export const MIN_CLIENT_WORDS = 40;
export const MIN_UNLABELLED_WORDS = 300;
/** A second non-coach voice counts as a partner only if they said this much. */
export const MIN_PARTNER_WORDS = 20;

const COACH = /\bswapnil\b/i;

export type Attendance = {
  attended: boolean;
  basis: "speakers" | "unidentified-speakers" | "length" | "empty";
  totalWords: number;
  clientWords: number;
  /** Distinct non-coach speaker labels that said anything. */
  otherSpeakers: string[];
  partnerPresent: boolean;
  /** Coach's share of all words, 0-100, only when the coach was identified. */
  coachTalkPct: number | null;
  /** Minutes between the first and last timestamps, when they exist. */
  durationMin: number | null;
};

const LINE = /^(?:\[([^\]]{1,20})\]\s*)?([^:\n\[\]]{1,40}):\s+(.+)$/;

const words = (s: string) => (s.match(/\S+/g) ?? []).length;

/** "01:02:03", "12:34", "754" or "754.5" → seconds. */
export function toSeconds(ts: string): number | null {
  const t = ts.trim();
  if (/^\d+(\.\d+)?$/.test(t)) return Number(t);
  const parts = t.split(":").map((p) => Number(p));
  if (parts.length < 2 || parts.length > 3 || parts.some((n) => !Number.isFinite(n))) return null;
  return parts.reduce((acc, n) => acc * 60 + n, 0);
}

export function inferAttendance(transcript: string, coach: RegExp = COACH): Attendance {
  const text = (transcript ?? "").trim();
  const empty: Attendance = {
    attended: false, basis: "empty", totalWords: 0, clientWords: 0,
    otherSpeakers: [], partnerPresent: false, coachTalkPct: null, durationMin: null,
  };
  if (!text) return empty;

  const bySpeaker = new Map<string, number>();
  const stamps: number[] = [];
  let labelled = 0;
  let totalWords = 0;

  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line) continue;
    const m = line.match(LINE);
    if (m) {
      labelled++;
      const n = words(m[3]);
      totalWords += n;
      const speaker = m[2].trim();
      bySpeaker.set(speaker, (bySpeaker.get(speaker) ?? 0) + n);
      if (m[1]) {
        const s = toSeconds(m[1]);
        if (s !== null) stamps.push(s);
      }
    } else {
      totalWords += words(line);
    }
  }

  const durationMin = stamps.length >= 2 ? Math.round((Math.max(...stamps) - Math.min(...stamps)) / 60) : null;

  // No speaker labels anywhere: length is all there is to go on.
  if (labelled === 0) {
    return { ...empty, attended: totalWords >= MIN_UNLABELLED_WORDS, basis: "length", totalWords, durationMin };
  }

  const speakers = [...bySpeaker.entries()].filter(([, n]) => n > 0);
  const coachEntries = speakers.filter(([name]) => coach.test(name));
  const others = speakers.filter(([name]) => !coach.test(name));

  if (coachEntries.length > 0) {
    const coachWords = coachEntries.reduce((s, [, n]) => s + n, 0);
    const clientWords = others.reduce((s, [, n]) => s + n, 0);
    const attended = clientWords >= MIN_CLIENT_WORDS;
    return {
      attended,
      basis: "speakers",
      totalWords,
      clientWords,
      otherSpeakers: others.map(([name]) => name),
      partnerPresent: attended && others.filter(([, n]) => n >= MIN_PARTNER_WORDS).length >= 2,
      coachTalkPct: totalWords > 0 ? Math.round((coachWords / totalWords) * 100) : null,
      durationMin,
    };
  }

  // The coach cannot be picked out, so every voice is a candidate. Two people
  // who each actually talked is a conversation; one is not.
  const people = speakers.filter(([, n]) => n >= MIN_CLIENT_WORDS);
  return {
    attended: people.length >= 2,
    basis: "unidentified-speakers",
    totalWords,
    clientWords: 0,
    otherSpeakers: speakers.map(([name]) => name),
    partnerPresent: people.length >= 3,
    coachTalkPct: null,
    durationMin,
  };
}
