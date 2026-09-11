import { defineCloudflareConfig } from "@opennextjs/cloudflare";
import staticAssetsIncrementalCache from "@opennextjs/cloudflare/overrides/incremental-cache/static-assets-incremental-cache";

// Prerendered pages are served straight from Workers Static Assets instead of
// being re-rendered per request. Re-rendering the landing pages cost more than
// the Free plan's 10 ms CPU and surfaced as intermittent 503s. The cache is
// read-only, so nothing here may rely on ISR `revalidate` — keep such routes
// dynamic.
export default defineCloudflareConfig({
  incrementalCache: staticAssetsIncrementalCache,
  enableCacheInterception: true,
});
