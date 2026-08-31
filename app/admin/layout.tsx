import type { Metadata } from "next";
import { Newsreader, IBM_Plex_Sans, IBM_Plex_Mono } from "next/font/google";

// Private operations dashboard — never indexed, never linked from the site.
export const metadata: Metadata = {
  title: "Practice — operations",
  robots: { index: false, follow: false, nocache: true },
};

/**
 * Three faces, three jobs — this is a clinical case file, not a console.
 *
 *  Newsreader  a text serif for headings and prose. It slows reading down and
 *              makes the screen read as a document, which is right for a tool
 *              that shows real women's names, weights and blood reports.
 *  Plex Sans   UI labels, deliberately plain and unfashionable.
 *  Plex Mono   every rupee, percentage and timestamp, with tabular figures, so
 *              numbers stack into columns that can be compared down the page
 *              without being read.
 */
const newsreader = Newsreader({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-serif", display: "swap" });
const plexSans = IBM_Plex_Sans({ subsets: ["latin"], weight: ["400", "500", "600"], variable: "--f-sans", display: "swap" });
const plexMono = IBM_Plex_Mono({ subsets: ["latin"], weight: ["400", "500"], variable: "--f-mono", display: "swap" });

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className={`${newsreader.variable} ${plexSans.variable} ${plexMono.variable}`}>{children}</div>
  );
}
