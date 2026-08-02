import type { Metadata } from "next";
import { Caveat, Fraunces, Inter } from "next/font/google";
import "./globals.css";
import { ScarcityProvider } from "./context/ScarcityProvider";
import { GTMScript, GTMNoScript } from "./components/tracking/GTM";
import { RouteTracker } from "./components/tracking/RouteTracker";
import { UserIdentityTracker } from "./components/tracking/UserIdentityTracker";
// InputCookieCapture removed — lead data goes to Make webhook in BookingFlow.tsx

const fraunces = Fraunces({
    subsets: ["latin"],
    display: "swap",
    variable: "--font-display",
    axes: ["opsz", "SOFT"],
});

const inter = Inter({
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
          "Book a free private 60-minute thyroid strategy session with Swapnil Umbarkar. Specialized fat-loss coaching for Indian women with hypothyroidism and Hashimoto's. Free, no card needed.",
    openGraph: {
          title: "Private Thyroid Strategy Session · Swapnil Umbarkar",
          description:
                  "Free 60-minute private thyroid session for Indian women. Understand why nothing worked — and what changes next. Free · No card needed.",
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
                  "Free 60-minute private thyroid session for Indian women. Free · No card needed.",
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
                  className={`${fraunces.variable} ${inter.variable} ${caveat.variable} h-full antialiased`}
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
