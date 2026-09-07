import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/schedule", destination: "/book-session", permanent: false },
      { source: "/assessment", destination: "/book-session", permanent: false },
      // The approved WhatsApp templates deep-link here with ?leadId=. Only paid-
      // funnel leads receive those messages, so this resumes the Rs 299 checkout
      // (query string is preserved by Next redirects).
      { source: "/complete-payment", destination: "/decode/quiz", permanent: false },
      { source: "/payment", destination: "/book-session", permanent: false },
      { source: "/how-it-works", destination: "/book-session", permanent: false },
      { source: "/book", destination: "/book-session", permanent: false },
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
