/**
 * lib/bridge-settings.ts — the Drive bridge pairing the dashboard stores.
 *
 * STUB (drive-v2 contract). The bridge workstream implements this file; the
 * exported names and signatures below are frozen so the other workstreams can
 * build against them in parallel.
 */
import { resolveBridgeConfig, type ResolvedBridgeConfig, type StoredPairing } from "./drive.ts";

/** The pairing saved by "Connect Google Drive", or null when there is none. */
export async function loadBridgePairing(): Promise<StoredPairing | null> {
  return null;
}

/** Save (or overwrite) the pairing. */
export async function saveBridgePairing(_pairing: StoredPairing): Promise<void> {
  throw new Error("saveBridgePairing: not implemented yet (drive-v2 stub)");
}

/** Forget the pairing, so the next Connect starts fresh. */
export async function clearBridgePairing(): Promise<void> {
  throw new Error("clearBridgePairing: not implemented yet (drive-v2 stub)");
}

/** The config every route uses: env first, then the stored pairing. */
export async function liveBridgeConfig(): Promise<ResolvedBridgeConfig> {
  return resolveBridgeConfig(loadBridgePairing);
}
