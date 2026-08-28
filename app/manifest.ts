import type { MetadataRoute } from "next";

/**
 * PWA manifest so /inbox installs to the Android home screen and opens
 * fullscreen, without a browser bar over the reply box.
 *
 * start_url is /inbox, not /: the installed icon is the inbox, and landing on
 * the marketing site would be a bug every single time it was tapped.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Thyroid Coach Inbox",
    short_name: "Inbox",
    description: "WhatsApp conversations, replies and client tags for the coaching business.",
    start_url: "/inbox",
    scope: "/inbox",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0e0e11",
    theme_color: "#0e0e11",
    icons: [
      { src: "/icons/inbox-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/inbox-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/inbox-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
