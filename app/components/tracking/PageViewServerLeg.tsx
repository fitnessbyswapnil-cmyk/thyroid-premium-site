import { pageViewServerLegSnippet } from "@/lib/pageview-beacon";

/**
 * The server leg of Meta's PageView: sets window._pageViewId before GTM loads,
 * so web GTM tag 75 reuses it, and sends one beacon per document to
 * /api/events with that same id. See lib/pageview-beacon.ts for the why.
 *
 * A plain inline <script>, deliberately NOT next/script. In the App Router even
 * `beforeInteractive` inline scripts are queued on self.__next_s and only run
 * once Next's bootstrap chunk has loaded; a plain <script> in <head> runs while
 * the HTML is still being parsed, which is what guarantees it beats GTM (see
 * the same reasoning in MetaPixel.tsx). It must stay ABOVE <GTMScript /> in
 * app/layout.tsx; lib/pageview-beacon.test.ts checks that.
 *
 * The host and operator-page guard is inside the script, read at run time:
 * deciding at render time would need headers(), which would cost every page
 * its static generation.
 */
export function PageViewServerLeg() {
  return (
    <script
      id="meta-pageview-server-leg"
      dangerouslySetInnerHTML={{ __html: pageViewServerLegSnippet() }}
    />
  );
}
