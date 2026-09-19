import Script from "next/script";
import { inlineHostGuard } from "@/lib/tracking-host";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-P3S5BXQB";
// Stape server-side GTM container URL — routes browser events through sGTM for CAPI
export const SGTM_URL = process.env.NEXT_PUBLIC_SGTM_URL || "https://lime.swapnilumbarkarfitness.in";

/**
 * GTM, gated to the production host.
 *
 * Both constants above fall back to production LITERALS, so a deployment with
 * no env vars set — every Vercel preview — still loaded the live container from
 * the live sGTM host and fired the live Meta pixel. That is how three
 * *.vercel.app domains ended up in Meta's Events Manager on 19-Sep-2026.
 *
 * The guard is inside the injected script rather than around the component on
 * purpose. Deciding at render time would mean reading headers(), which in
 * Next 16 is async AND opts the route into dynamic rendering — every static
 * page in the app would lose its static generation to fix a tracking bug.
 * Reading location.hostname at run time costs nothing and is exact.
 */
export function GTMScript() {
  return (
    <Script
      id="gtm-script"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        __html: `(function(){${inlineHostGuard()}(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src='${SGTM_URL}/gtm.js?id='+i+dl;f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');})();`,
      }}
    />
  );
}

/**
 * The no-JS fallback iframe.
 *
 * KNOWN RESIDUAL: this cannot carry the host guard. A <noscript> body only
 * renders when JavaScript is off, which is precisely when an inline guard
 * cannot run, and gating it at render time needs headers() — see GTMScript for
 * why that is not worth the cost. So on a non-production host, a visitor with
 * JavaScript disabled still loads this iframe.
 *
 * Left as-is deliberately. It requires a JS-disabled client to land on a
 * preview URL, and the fix for that is upstream: disconnecting the Vercel Git
 * integration removes the preview hosts entirely. Making this a client
 * component would render nothing on the production host either, trading a real
 * regression for a hypothetical one.
 */
export function GTMNoScript() {
  return (
    <noscript
      dangerouslySetInnerHTML={{
        __html: `<iframe src="${SGTM_URL}/ns.html?id=${GTM_ID}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
      }}
    />
  );
}
