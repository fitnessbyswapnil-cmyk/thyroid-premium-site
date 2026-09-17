import type { Metadata } from "next";
import { Newsreader, Instrument_Sans } from "next/font/google";
import WebinarClient from "./WebinarClient";
import { WEBINAR_WHEN_LONG } from "@/lib/webinar";

// The "Case Notes" pairing: Newsreader (a text serif, with its italic for the
// section marks) for headings against Instrument Sans for everything else.
// Loaded here rather than in the root layout so no other page pays for two
// extra families it never renders.
const display = Newsreader({
  subsets: ["latin"],
  weight: ["400", "600"],
  style: ["normal", "italic"],
  variable: "--webinar-display",
  display: "swap",
});
const body = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "600"],
  variable: "--webinar-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thyroid Fat Loss Masterclass | Swapnil Umbarkar",
  description: `How to lose weight with a slow thyroid, eating Indian home food. A free 90-minute live class. ${WEBINAR_WHEN_LONG}.`,
  robots: { index: false, follow: false },
};

export default function WebinarPage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <WebinarClient />
    </div>
  );
}
