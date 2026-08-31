import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

// Same three faces as /admin — /crm renders the same component and would fall
// back to system fonts without them.
const newsreader = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-serif", display: "swap" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono", display: "swap" });

// Private pipeline view. Holds client health answers and call contents — it must
// never reach a search index, and the admin-key gate is not a reason to skip
// saying so.
export const metadata: Metadata = {
  title: "Pipeline",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#F6F4F0",
};

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return <div className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`}>{children}</div>;
}
