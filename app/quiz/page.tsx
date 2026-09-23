import type { Metadata } from "next";
import { Playfair_Display } from "next/font/google";
import QuizClient from "./QuizClient";

// Playfair drives the signature display moments (score number, band name,
// question headlines). Inter-equivalent body text uses the site's global Geist.
const playfair = Playfair_Display({
  subsets: ["latin"],
  weight: ["500", "600", "700"],
  variable: "--font-playfair",
  display: "swap",
});

export const metadata: Metadata = {
  title: "Thyroid Fat-Loss Blocker Score Quiz · Swapnil Umbarkar",
  description:
    "Answer 14 quick questions to reveal your personal Thyroid Blocker Score, the exact things quietly stalling your fat loss. 90 seconds · 100% free.",
  openGraph: {
    title: "What's really blocking your thyroid fat loss?",
    description:
      "Take the 90-second Blocker Score quiz built for Indian women with hypothyroidism & Hashimoto's.",
    url: "https://swapnilumbarkarfitness.in/quiz",
    type: "website",
  },
  robots: { index: true, follow: true },
};

export default function QuizPage() {
  return (
    <main className={`${playfair.variable} quiz-page`}>
      <QuizClient />
    </main>
  );
}
