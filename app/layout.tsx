import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ScarcityProvider } from "./context/ScarcityProvider";
import { GTMScript, GTMNoScript } from "./components/tracking/GTM";
import { RouteTracker } from "./components/tracking/RouteTracker";
import { UserIdentityTracker } from "./components/tracking/UserIdentityTracker";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Private Thyroid Strategy Session · Swapnil Umbarkar",
  description:
    "Book a private 60-minute thyroid strategy session with Swapnil Umbarkar. Specialized fat-loss coaching for Indian women with hypothyroidism and Hashimoto's. ₹299 with full refund guarantee.",
  openGraph: {
    title: "Private Thyroid Strategy Session · Swapnil Umbarkar",
    description:
      "60-minute private thyroid session for Indian women. Understand why nothing worked — and what changes next. ₹299 · Full refund guarantee.",
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
      "60-minute private thyroid session for Indian women. ₹299 · Full refund guarantee.",
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
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
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
