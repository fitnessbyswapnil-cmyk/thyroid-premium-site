import type { Metadata } from "next";
import { Caveat, Inter, Outfit } from "next/font/google";
import "./globals.css";
import { ScarcityProvider } from "./context/ScarcityProvider";
import { GTMScript, GTMNoScript } from "./components/tracking/GTM";
import { MetaPixelHead } from "./components/tracking/MetaPixel";
import { RouteTracker } from "./components/tracking/RouteTracker";
import { UserIdentityTracker } from "./components/tracking/UserIdentityTracker";
// InputCookieCapture removed — lead data goes to Make webhook in BookingFlow.tsx

// Inter + Outfit. Inter carries every headline and all body copy; Outfit sets
// the small tracked eyebrow labels, where its wider forms hold up at 13px with
// letter-spacing on them.
//
// The variable NAMES are kept (--font-display / --font-body) so nothing
// downstream has to change: every component reads the variable, not the family.
//
// THREE WEIGHTS, and only three. 400 for body, 500 for emphasis and UI labels,
// 700 for headings, CTAs and numbers being emphasised — plus 600, used in
// exactly one place, on uppercase eyebrows, where small caps need the extra
// weight to hold. Seven were in play before, including the `bold` keyword
// mixed in with numeric values, and 800 against 900 is not a distinction
// anybody can see on Outfit at display sizes. Each unused weight was a font
// file downloaded for nothing: dropping 800 and 900 removes two Inter files.
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

const outfit = Outfit({
    subsets: ["latin", "latin-ext"],
    display: "swap",
    variable: "--font-display",
    weight: ["500", "600", "700"],
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
                  className={`${outfit.variable} ${inter.variable} ${caveat.variable} h-full antialiased`}
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
