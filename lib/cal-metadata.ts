/**
 * lib/cal-metadata.ts — the ONE way to put metadata on a Cal.com embed.
 *
 * Cal.com's embed serialises its `config` object into the booking iframe's
 * query string, so any NESTED value is String()-ed on the way out:
 *
 *     config={{ "metadata[fbc]": "fb.1…" }}    -> payload.metadata.fbc   ✅
 *     config={{ metadata: { fbc: "fb.1…" } }}  -> {"a":"[object Object]"} ❌
 *
 * The object form has now shipped twice. It was found on 29-Aug-2026 after 100
 * bookings were checked through the Cal API and not one carried fbc, fbp or
 * visitor_id — every one held the literal corrupt pair {"a":"[object Object]"},
 * which is why Cal.com filled up while Ads Manager reported zero results. The
 * correct form went into /book-session, that route was then retired behind a
 * redirect, and on 13-Sep the object form was written again on the live page.
 *
 * So the knowledge lived in dead code while the bug ran in production. This
 * module exists so the flattening is written once, used by every embed, and
 * covered by a test that fails if a nested `metadata` key ever comes back.
 *
 * Ref: https://cal.com/help/embedding/prefill-booking-form-embed
 */

/** The key Cal.com reads back as `payload.metadata.<name>` in its webhook. */
export function calMetadataKey(name: string): string {
  return `metadata[${name}]`;
}

/**
 * Flattens `{ fbc: "x", fbp: "" }` to `{ "metadata[fbc]": "x" }`, ready to
 * spread straight into a Cal embed's `config`.
 *
 * Empty, null and undefined values are dropped rather than sent blank: Cal.com
 * stores metadata verbatim, so an empty string arrives as a real key holding
 * nothing, and `metaValue()` in the webhook cannot tell that apart from a
 * signal that was genuinely absent.
 */
export function calMetadataConfig(
  entries: Record<string, string | number | null | undefined>,
): Record<string, string> {
  const out: Record<string, string> = {};
  for (const [name, value] of Object.entries(entries)) {
    if (value === null || value === undefined) continue;
    const str = String(value);
    if (!str) continue;
    out[calMetadataKey(name)] = str;
  }
  return out;
}
