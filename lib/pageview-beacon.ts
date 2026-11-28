/**
 * lib/pageview-beacon.ts — the server leg of Meta's PageView (decision D2).
 *
 * WHY THIS EXISTS
 * PageView had two legs. The browser leg is web GTM tag 75 "Meta Ads PageView"
 * (GTM-P3S5BXQB, trigger Initialization - All Pages), whose Event ID is the GTM
 * variable "JS - Persistent PageView ID". The server leg was Stape tag 49, fed
 * the same id through GA4. Stape was cancelled on purpose (28-Nov-2026), so
 * since then PageView has had no server leg at all: a visitor whose browser
 * drops the pixel (ad blocker, ITP, a locked-down in-app webview) was never
 * seen by Meta.
 *
 * The server leg now comes from the site itself, like every other server event
 * (D2): one beacon per document to /api/events, which sends PageView to the
 * Conversions API with the SAME event_id the browser tag uses, so Meta keeps
 * one of the two.
 *
 * HOW THE TWO LEGS SHARE ONE ID
 * The GTM variable is, verbatim (variable 167 in the container export):
 *
 *   function() {
 *     if (!window._pageViewId) {
 *       window._pageViewId = 'pv_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
 *     }
 *     return window._pageViewId;
 *   }
 *
 * It reuses window._pageViewId when something already set it. So this snippet
 * sets window._pageViewId, in exactly that format, BEFORE gtm.js runs, and
 * sends the same value. It runs from a plain inline <script> at the top of the
 * root layout's <head>, which executes while the HTML is still being parsed;
 * GTM is injected by next/script `afterInteractive`, which only runs after
 * hydration. The order is therefore structural, not a race. If GTM were ever
 * moved into <head> as well, the snippet still comes first in source order.
 *
 * GUARDS, IN ORDER
 *  - inlineHostGuard(): nothing at all happens off the production host or on an
 *    operator page (/admin, /crm, /inbox). No id is minted either, so nothing
 *    downstream can pick one up.
 *  - window.__pvServerLeg: at most one beacon per document, even if the snippet
 *    is somehow included twice. Client-side route changes never re-run an
 *    inline script, and the GTM tag fires once per document too, so the two
 *    legs stay one-to-one.
 *  - document.prerendering: a page the browser renders speculatively, before
 *    anyone has opened it, waits for activation before it counts as a view.
 *    The id is still set at once, so GTM (if it runs during prerender) and the
 *    beacon agree.
 *
 * TRANSPORT
 * navigator.sendBeacon survives the tab closing straight away, which is the
 * whole point for a visitor who bounces. A string body goes as text/plain,
 * which needs no preflight; /api/events parses the body as JSON whatever the
 * content type. If sendBeacon is missing or refuses the payload, a fetch with
 * keepalive does the same job.
 *
 * The snippet is a plain string, not a serialised function, so what the tests
 * run (lib/pageview-beacon.test.ts) is byte for byte what ships in the HTML. It
 * is written in ES5 because it runs before any polyfill, in whatever webview
 * the ad opened.
 */
// Explicit .ts extension: tracking-host.ts imports nothing, so this module
// loads cleanly under the `node --test --experimental-strip-types` runner.
import { inlineHostGuard } from "./tracking-host.ts";

/** Where the beacon goes. The route enforces the production host on both ends. */
export const PAGEVIEW_BEACON_PATH = "/api/events";

/**
 * The shape the GTM variable mints: `pv_` + Date.now() (13 digits) + `_` + up
 * to nine base-36 characters (`toString(36).substr(2, 9)` can come up short).
 * /api/events refuses a PageView id of any other shape, because it could never
 * pair with the browser tag.
 */
export const PAGEVIEW_ID_PATTERN = /^pv_\d{13}_[0-9a-z]{0,9}$/;

export function isPageViewEventId(id: unknown): id is string {
  return typeof id === "string" && PAGEVIEW_ID_PATTERN.test(id);
}

// Kept as ONE literal so the id expression is visibly the GTM variable's own.
const PAGEVIEW_ID_EXPRESSION = "'pv_'+Date.now()+'_'+Math.random().toString(36).substr(2,9)";

const BODY =
  "var w=window,d=document,n=navigator;" +
  "if(w.__pvServerLeg)return;" +
  "w.__pvServerLeg=1;" +
  "var id=w._pageViewId;" +
  `if(!id){id=${PAGEVIEW_ID_EXPRESSION};w._pageViewId=id;}` +
  "var send=function(){" +
  `var body=JSON.stringify({event_name:'PageView',event_id:id,source_url:location.href});` +
  "var ok=false;" +
  `try{ok=!!(n.sendBeacon&&n.sendBeacon(${JSON.stringify(PAGEVIEW_BEACON_PATH)},body));}catch(e){}` +
  "if(!ok&&typeof fetch==='function'){" +
  `try{fetch(${JSON.stringify(PAGEVIEW_BEACON_PATH)},{method:'POST',body:body,keepalive:true,credentials:'same-origin',headers:{'Content-Type':'application/json'}})['catch'](function(){});}catch(e){}` +
  "}" +
  "};" +
  "if(d.prerendering&&d.addEventListener){d.addEventListener('prerenderingchange',send,{once:true});}else{send();}";

/** The inline <head> script: host guard, then the id and the one beacon. */
export function pageViewServerLegSnippet(): string {
  return `(function(){${inlineHostGuard()}try{${BODY}}catch(e){}})();`;
}
