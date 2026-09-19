import { META_PIXEL_ID, directPixelSnippet, isFlagOn } from "./pixel-core";
import { inlineHostGuard } from "@/lib/tracking-host";

// Read at build time: NEXT_PUBLIC_ values are inlined when the app is built,
// so switching this needs a rebuild + deploy, not a runtime variable.
const DIRECT_PIXEL = isFlagOn(process.env.NEXT_PUBLIC_DIRECT_PIXEL);

/**
 * Meta pixel, initialised straight from the document <head>.
 *
 * OFF by default, and then this renders nothing: the pixel keeps loading the
 * way it always has, through GTM (page → gtm.js via Stape → fbevents.js), which
 * is why PageView reaches Meta ~1.5 s after navigation.
 *
 * ON, it is a plain inline <script>, deliberately NOT next/script: in the App
 * Router even `beforeInteractive` inline scripts are queued on self.__next_s
 * and only run once Next's bootstrap chunk has loaded. A plain <script> in
 * <head> runs while the HTML is still being parsed. It only defines the fbq
 * queue and adds fbevents.js as an async script, so it never blocks render.
 *
 * Turning this on WITHOUT the GTM changes in docs/tracking-cutover-plan.md
 * sends every PageView twice (this one and GTM's "Meta Ads PageView" tag).
 *
 * The flag is not the only gate: the snippet is wrapped in a host check so that
 * if it is ever switched on, it still cannot fire from a Vercel preview or a
 * workers.dev address. pixel-core.ts deliberately imports nothing, so the guard
 * is applied here, at the only place that injects the snippet.
 */
export function MetaPixelHead() {
  if (!DIRECT_PIXEL) return null;
  return (
    <>
      <link rel="preconnect" href="https://connect.facebook.net" />
      <link rel="preconnect" href="https://www.facebook.com" />
      <script
        id="meta-pixel-direct"
        dangerouslySetInnerHTML={{
          __html: `(function(){${inlineHostGuard()}${directPixelSnippet(META_PIXEL_ID)}})();`,
        }}
      />
    </>
  );
}
