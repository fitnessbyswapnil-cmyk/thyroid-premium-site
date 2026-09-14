/**
 * lib/journey-source.ts — SERVER ONLY. The journeys every tab reads, built
 * once from the shared dataset (lib/metrics-source) and the stored stages
 * (lib/journey-store). Pure logic lives in lib/journey.
 */
import { loadMetricsDataset, type LoadedDataset } from "./metrics-source.ts";
import { readStoredJourneys } from "./journey-store.ts";
import { clusterPeople } from "./metrics.ts";
import { journeysOf, needsActionOf, pipelineCounts, type Journey, type NeedsAction, type PipelineCounts } from "./journey.ts";

export type LoadedJourneys = {
  loaded: LoadedDataset;
  journeys: Journey[];
  needsAction: NeedsAction;
  pipeline: PipelineCounts;
  now: number;
};

export async function loadJourneys(opts: { force?: boolean; now?: number } = {}): Promise<LoadedJourneys> {
  const loaded = await loadMetricsDataset(!!opts.force);
  const now = opts.now ?? Date.now();
  const keys = clusterPeople(loaded.data).flatMap((p) => p.keys);
  const stored = await readStoredJourneys(keys);
  const journeys = journeysOf(loaded.data, { now, stored });
  return {
    loaded,
    journeys,
    needsAction: needsActionOf(journeys, loaded.data, now),
    pipeline: pipelineCounts(journeys),
    now,
  };
}
