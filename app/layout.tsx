/**
 * app/layout.tsx  — ROOT LAYOUT
 *
 * TRACKING DECISIONS:
 *  - GTM loads via next/script strategy="afterInteractive"
 *    This is the correct App Router pattern. Do NOT use strategy="beforeInteractive"
 *    for GTM — it blocks hydration and causes React mismatches.
 *  - afterInteractive = loads after page is interactive, before user interacts
 *  - GTM noscript goes in <body> immediately after opening tag (required by Google)
 *  - TrackingInit fires ViewContent + scroll tracking after mount
 *  - NO inline Pixel code — GTM handles all Pixel firing
 *
 * GTM_ID = GTM-P3S5BXQB (swapnilumbarkarfitness.in container)
 */
import type { Metadata } from 'next'
import { Geist, Geist_Mono } from 'next/font/google'
import Script from 'next/script'
import './globals.css'
import TrackingInit from './components/TrackingInit'

const geistSans = Geist({
  variable: '--font-geist-sans',
  subsets: ['latin'],
})
const geistMono = Geist_Mono({
  variable: '--font-geist-mono',
  subsets: ['latin'],
})

export const metadata: Metadata = {
  title: 'Thyroid Fat Loss Coaching | Swapnil Umbarkar',
  description: 'India\'s #1 thyroid fat-loss coaching. Lose 10–15 kg in 90 days with a program designed for hypothyroidism and Hashimoto\'s.',
  openGraph: {
    title: 'Thyroid Fat Loss Coaching | 200+ Women Transformed',
    description: 'Personalized thyroid coaching for sustainable fat loss. Free strategy call available.',
  },
}

const GTM_ID = 'GTM-P3S5BXQB'

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <head>
        {/*
          GTM Head Script
          strategy="afterInteractive" = safe for App Router, no hydration mismatch.
          The dataLayer initialization MUST happen before GTM loads.
          We initialize it inline to ensure it's ready before GTM script parses.
        */}
        <Script
          id="gtm-datalayer-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `window.dataLayer = window.dataLayer || [];`,
          }}
        />
        <Script
          id="gtm-head"
          strategy="afterInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(w,d,s,l,i){w[l]=w[l]||[];w[l].push({'gtm.start':
new Date().getTime(),event:'gtm.js'});var f=d.getElementsByTagName(s)[0],
j=d.createElement(s),dl=l!='dataLayer'?'&l='+l:'';j.async=true;j.src=
'https://www.googletagmanager.com/gtm.js?id='+i+dl;
f.parentNode.insertBefore(j,f);
})(window,document,'script','dataLayer','${GTM_ID}');`,
          }}
        />
      </head>
      <body className="min-h-full flex flex-col">
        {/* GTM noscript fallback — must be first inside <body> */}
        <noscript>
          <iframe
            src={`https://www.googletagmanager.com/ns.html?id=${GTM_ID}`}
            height="0"
            width="0"
            style={{ display: 'none', visibility: 'hidden' }}
          />
        </noscript>

        {/* Tracking initialization — fires ViewContent, scroll tracking, etc. */}
        <TrackingInit />

        {children}
      </body>
    </html>
  )
}
