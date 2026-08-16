import type { Metadata } from "next";
import { Caveat, Lora, Source_Sans_3 } from "next/font/google";
import "./globals.css";
import { ScarcityProvider } from "./context/ScarcityProvider";
import { GTMScript, GTMNoScript } from "./components/tracking/GTM";
import { RouteTracker } from "./components/tracking/RouteTracker";
import { UserIdentityTracker } from "./components/tracking/UserIdentityTracker";
// InputCookieCapture removed — lead data goes to Make webhook in BookingFlow.tsx

// Lora replaces Fraunces: the display-cut Fraunces read as fashion-Didot
// (hairline strokes vanish on a 40-year-old's phone). Lora is the warm,
// moderate-contrast serif of premium wellness editorial — same authority,
// double the legibility. Italic loads for the hero accent phrase.
const lora = Lora({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-display",
    style: ["normal", "italic"],
});

// Source Sans 3 replaces Inter for body: open apertures + tall x-height,
// one of the most legible humanist sans faces for aging eyes, and warmer
// than Inter's neutral-tech voice.
const sourceSans = Source_Sans_3({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-body",
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
          "On thyroid medication but the weight won't move? Your weight isn't stuck. It's blocked. Free 60-second quiz, then a private 1-on-1 consultation to find your blocker and get your 90-day plan. Real Indian food, no starving. Works alongside your doctor.",
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
                  className={`${lora.variable} ${sourceSans.variable} ${caveat.variable} h-full antialiased`}
                >
                <head>
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
