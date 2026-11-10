/**
 * lib/marker-rows.ts — the pre-call screen's row shape, and the conversion from
 * what the Claude routine reads off a report.
 *
 * Pure and dependency-free on purpose. Client components import it
 * (ReadReportWithClaude), and lib/ai-jobs.ts, which imports node:crypto and
 * zod, must never reach the browser bundle. A value import of toMarkerRows
 * from lib/ai-jobs pulled node:crypto into the client, and the webpack dev
 * build of /admin failed outright.
 */

/** Verbatim from lib/precall.ts (MarkerRow). */
export type MarkerRow = { marker: string; value: string; range?: string; flag?: string };

/** One value as the routine returns it (lib/ai-jobs.ts MarkersResultSchema). */
export type ReadMarker = { name: string; value: string; unit?: string; refRange?: string; flag?: string };

/** The unit rides inside the value ("5.8 µIU/mL"); an empty range or flag is left out. */
export function toMarkerRows(result: { markers: ReadMarker[] }): MarkerRow[] {
  return result.markers.map((m) => ({
    marker: m.name,
    value: m.unit ? `${m.value} ${m.unit}` : m.value,
    ...(m.refRange ? { range: m.refRange } : {}),
    ...(m.flag ? { flag: m.flag } : {}),
  }));
}
