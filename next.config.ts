import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      { source: "/schedule", destination: "/book-session", permanent: false },
      { source: "/assessment", destination: "/book-session", permanent: false },
      { source: "/complete-payment", destination: "/book-session", permanent: false },
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
