import type { Metadata, Viewport } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";
import { LIGHT, DARK } from "../admin/tokens";
import InboxClient from "./InboxClient";

export const metadata: Metadata = {
  title: "Inbox",
  // A private operator tool holding client health conversations. It must never
  // reach a search index, and the key gate is not a reason to skip saying so.
  robots: { index: false, follow: false, nocache: true },
  // "default", not "black-translucent". Translucent draws a WHITE clock and
  // battery over the page itself, which suited the old near-black inbox and
  // would vanish into paper. Default gives the status bar a strip of its own,
  // coloured by theme-color below, so it stays readable whatever the page is.
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Inbox" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // The reply bar sits against the gesture area; the app should own that space.
  viewportFit: "cover",
  // The header's own surface, so status bar and header read as one strip. Per
  // scheme, because the inbox follows the phone into dark (InboxClient).
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: LIGHT.card },
    { media: "(prefers-color-scheme: dark)", color: DARK.card },
  ],
};

// The desk's three faces, exactly as app/admin/layout.tsx loads them, so the
// files are the same ones /admin has already cached. /inbox sits outside
// app/admin and inherits none of it: without these the var(--f-*) inside FONT
// is undefined, which voids the whole font-family declaration, so even
// FONT.mono would quietly inherit the marketing site's Inter.
const newsreader = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-serif", display: "swap" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono", display: "swap" });

export default function InboxPage() {
  return (
    <div className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`}>
      {/* The root layout paints the marketing site's cream body. This route
          owns the background outright, or cream shows through under short
          screens and during overscroll. By the phone's setting here, because
          the server cannot read the dashboard's switch; InboxClient repaints
          it once it has. */}
      <style>{`body{background:${LIGHT.paper};margin:0}@media (prefers-color-scheme: dark){body{background:${DARK.paper}}}`}</style>
      <InboxClient />
    </div>
  );
}
