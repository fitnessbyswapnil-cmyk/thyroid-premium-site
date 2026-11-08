import type { Metadata } from "next";
import { Caveat, Inter, Newsreader } from "next/font/google";
import "./globals.css";
import { ScarcityProvider } from "./context/ScarcityProvider";
import { GTMScript, GTMNoScript } from "./components/tracking/GTM";
import { MetaPixelHead } from "./components/tracking/MetaPixel";
import { RouteTracker } from "./components/tracking/RouteTracker";
import { UserIdentityTracker } from "./components/tracking/UserIdentityTracker";
// InputCookieCapture removed — lead data goes to Make webhook in BookingFlow.tsx

// Inter + Newsreader. Inter carries all body copy, every label, and every
// headline outside /decode; Newsreader carries /decode's headlines only. It
// replaced Outfit on 08-Nov-2026 — see the note on that font below.
//
// The variable NAMES are kept (--font-display / --font-body) so nothing
// downstream has to change: every component reads the variable, not the family.
//
// THREE WEIGHTS, and only three. 400 for body, 500 for emphasis and UI labels,
// 700 for headings, CTAs and numbers being emphasised — plus 600, used in
// exactly one place, on uppercase eyebrows, where small caps need the extra
// weight to hold. Seven were in play before, including the `bold` keyword
// mixed in with numeric values, and 800 against 900 is not a distinction
// anybody can see at display sizes. Each unused weight was a font file
// downloaded for nothing: dropping 800 and 900 removes two Inter files.
//
// `latin` does NOT cover U+20B9. The rupee sign is on every CTA on this site,
// and without latin-ext it falls out of Inter to a system font — at a
// different weight to the digits beside it, mid-price. Do not remove it.
const inter = Inter({
    subsets: ["latin", "latin-ext"],
    display: "swap",
    variable: "--font-body",
    weight: ["400", "500", "700"],
});

// The display face is a SERIF since 08-Nov-2026, and it is the whole of the
// "make it look premium" answer that the button colour was not.
//
// Outfit was here before, and it was a sans next to a sans: Inter set every
// headline and Outfit set only the small tracked eyebrows, so the page had two
// grotesques doing nearly the same job and no voice of its own. A page built
// entirely from one sans reads as a document rather than as something made.
//
// Newsreader carries /decode's headlines only. It is scoped to .theme-decode,
// so `/` and `/webinar` are untouched. Eyebrows move to Inter: uppercase and
// letter-spacing already make a label a label, which is the argument this file
// makes about colour and applies equally to family.
//
// ONE WEIGHT. 600 is where this face has authority without the heaviness a
// serif picks up at 700, and loading a single weight keeps a third family from
// costing three files.
const newsreader = Newsreader({
    subsets: ["latin", "latin-ext"],
    display: "swap",
    variable: "--font-display",
    weight: ["600"],
});

// Handwritten annotation font (hero "Watch 45 Sec Video" note only).
const caveat = Caveat({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-hand",
    weight: ["600"],
});

export const metadata: Metadata = {
    title: "Private Thyroid Strategy Session · Swapnil Umbarkar",
    description:
          "On thyroid medication but the weight won't move? Your weight isn't stuck. It's blocked. A private 1-on-1 consultation to find your blocker and get your 90-day plan. Real Indian food, no starving. Works alongside your doctor.",
    openGraph: {
          title: "Private Thyroid Strategy Session · Swapnil Umbarkar",
          description:
                  "Finally, a thyroid-specific plan: one private 60-minute consultation call to find your root cause and get your 90-day plan. Limited weekly slots.",
          url: "https://swapnilumbarkarfitness.in",
          images: [
            {
                      url: "https://swapnilumbarkarfitness.in/og-image.jpg",
                      width: 1200,
                      height: 630,
                      alt: "Private Thyroid Strategy Session · Swapnil Umbarkar",
            },
                ],
          type: "website",
    },
    twitter: {
          card: "summary_large_image",
          title: "Private Thyroid Strategy Session · Swapnil Umbarkar",
          description:
                  "One private 60-minute consultation call: your root cause found, your 90-day plan mapped. Limited weekly slots.",
          images: ["https://swapnilumbarkarfitness.in/og-image.jpg"],
    },
};

export default function RootLayout({
    children,
}: Readonly<{
    children: React.ReactNode;
}>) {
    return (
          <html
                  lang="en"
                  className={`${newsreader.variable} ${inter.variable} ${caveat.variable} h-full antialiased`}
                >
                <head>
                        {/* Renders nothing unless NEXT_PUBLIC_DIRECT_PIXEL is on — see docs/tracking-cutover-plan.md */}
                        <MetaPixelHead />
                        <GTMScript />
                </head>
                <body className="min-h-full flex flex-col">
                        <GTMNoScript />
                        <RouteTracker />
                        <UserIdentityTracker />
                        <ScarcityProvider>{children}</ScarcityProvider>
                </body>
          </html>
        );
}
