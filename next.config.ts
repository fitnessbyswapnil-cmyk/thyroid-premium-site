import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The free consultation is retired. /book-session was its Cal.com page;
      // anyone arriving on an old link (WhatsApp, email, a bookmark) lands on
      // the paid funnel instead of booking a call that no longer exists.
      { source: "/book-session", destination: "/decode", permanent: false },
      { source: "/schedule", destination: "/decode", permanent: false },
      { source: "/assessment", destination: "/decode/quiz", permanent: false },
      // The approved WhatsApp templates deep-link here with ?leadId=. Only paid-
      // funnel leads receive those messages, so this resumes the Rs 299 checkout
      // (query string is preserved by Next redirects).
      { source: "/complete-payment", destination: "/decode/quiz", permanent: false },
      { source: "/payment", destination: "/book-session", permanent: false },
      { source: "/how-it-works", destination: "/decode", permanent: false },
      { source: "/book", destination: "/decode", permanent: false },
      { source: "/payment-success", destination: "/book-session", permanent: false },
    ];
  },
  images: {
    remotePatterns: [
      {
        protocol: "https",
        hostname: "swapnilumbarkarfitness.in",
        pathname: "/wp-content/uploads/**",
      },
    ],
  },
};

export default nextConfig;
