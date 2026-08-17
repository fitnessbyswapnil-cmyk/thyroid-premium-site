import Script from "next/script";

const GTM_ID = process.env.NEXT_PUBLIC_GTM_ID || "GTM-P3S5BXQB";
// Stape server-side GTM container URL — routes browser events through sGTM for CAPI.
// Kept for reference / any other consumers; the loader + noscript now use the
// Custom Loader URLs below.
export const SGTM_URL = process.env.NEXT_PUBLIC_SGTM_URL || "https://lime.swapnilumbarkarfitness.in";

// Stape Custom Loader (first-party, ad-blocker-resistant). Stape generates a
// randomized path on the `load.` subdomain instead of the predictable
// `/gtm.js`. Both are env-overridable so the path can change (or a new
// randomization be issued) WITHOUT a code edit.
//
// NOTE: if Stape's raw Custom Loader head snippet appends a runtime `kp=`
// randomization param, paste that exact snippet and we'll replicate it verbatim
// here; today the env URL is used as-is (the `9vonfsvef.js` path is the loader).
const SGTM_LOADER_URL =
  process.env.NEXT_PUBLIC_SGTM_LOADER_URL ||
  "https://load.lime.swapnilumbarkarfitness.in/9vonfsvef.js";
const SGTM_NS_URL =
  process.env.NEXT_PUBLIC_SGTM_NS_URL ||
  "https://load.lime.swapnilumbarkarfitness.in/ns.html?id=GTM-P3S5BXQB";

export function GTMScript() {
  return (
    <Script
      id="gtm-script"
      strategy="afterInteractive"
      dangerouslySetInnerHTML={{
        // dataLayer init + gtm.start push + container id (GTM-P3S5BXQB) are
        // UNCHANGED. Only the script src is swapped to the Custom Loader URL.
        __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],j=d.createElement(s);j.async=true;j.src='${SGTM_LOADER_URL}';f.parentNode.insertBefore(j,f);})(window,document,'script','dataLayer','${GTM_ID}');`,
      }}
    />
  );
}

export function GTMNoScript() {
  return (
    <noscript
      dangerouslySetInnerHTML={{
        __html: `<iframe src="${SGTM_NS_URL}" height="0" width="0" style="display:none;visibility:hidden"></iframe>`,
      }}
    />
  );
}
