import type { Metadata } from "next";
import { Caveat, Inter, Outfit } from "next/font/google";
import "./globals.css";
import { ScarcityProvider } from "./context/ScarcityProvider";
import { GTMScript, GTMNoScript } from "./components/tracking/GTM";
import { RouteTracker } from "./components/tracking/RouteTracker";
import { UserIdentityTracker } from "./components/tracking/UserIdentityTracker";
// InputCookieCapture removed — lead data goes to Make webhook in BookingFlow.tsx

// Inter + Outfit, matching the reference direct-response build the owner asked
// this page to be restyled after. Inter carries every headline and all body
// copy at 400/600/700/800/900; Outfit sets only the small tracked eyebrow
// labels, where its wider forms hold up at 12px with 2px of letter-spacing.
//
// This replaces the previous Lora + Source Sans 3 pairing. The variable NAMES
// are kept (--font-display / --font-body) so nothing downstream has to change:
// every component reads the variable, not the family.
const inter = Inter({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-body",
    weight: ["400", "600", "700", "800", "900"],
});

const outfit = Outfit({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-display",
    weight: ["600", "700"],
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
