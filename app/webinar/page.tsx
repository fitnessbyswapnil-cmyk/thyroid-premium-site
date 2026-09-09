import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import WebinarClient from "./WebinarClient";
import { WEBINAR_WHEN_LONG } from "@/lib/webinar";

// The design's own pairing, and the reason it reads the way it does: a
// high-contrast display face for the headlines against a plain, wide-aperture
// text face. Loaded here rather than in the root layout so no other page pays
// for two extra families it never renders.
const display = Bricolage_Grotesque({
  subsets: ["latin"],
  weight: ["800"],
  variable: "--webinar-display",
  display: "swap",
});
const body = Instrument_Sans({
  subsets: ["latin"],
  weight: ["400", "500", "600", "700"],
  variable: "--webinar-body",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Free Thyroid Masterclass | Swapnil Umbarkar",
  description: `Your report says normal and you still cannot lose weight. A free 90-minute live class for women with a slow thyroid. ${WEBINAR_WHEN_LONG}.`,
  robots: { index: false, follow: false },
};

export default function WebinarPage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <WebinarClient />
    </div>
  );
}
