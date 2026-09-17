import type { Metadata } from "next";
import { Bricolage_Grotesque, Instrument_Sans } from "next/font/google";
import ConfirmedClient from "./ConfirmedClient";

// Same pairing as /webinar. next/font dedupes the files between the two routes.
const display = Bricolage_Grotesque({ subsets: ["latin"], weight: ["800"], variable: "--webinar-display", display: "swap" });
const body = Instrument_Sans({ subsets: ["latin"], weight: ["400", "600"], variable: "--webinar-body", display: "swap" });

export const metadata: Metadata = {
  title: "Your seat is saved | Swapnil Umbarkar",
  robots: { index: false, follow: false },
};

export default function WebinarConfirmedPage() {
  return (
    <div className={`${display.variable} ${body.variable}`}>
      <ConfirmedClient />
    </div>
  );
}
