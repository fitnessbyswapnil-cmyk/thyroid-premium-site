import type { Metadata } from "next";
import InboxClient from "./InboxClient";

export const metadata: Metadata = {
  title: "Inbox",
  // A private operator tool holding client health conversations. It must never
  // reach a search index, and the key gate is not a reason to skip saying so.
  robots: { index: false, follow: false, nocache: true },
  appleWebApp: { capable: true, statusBarStyle: "black-translucent", title: "Inbox" },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  // The reply bar sits against the gesture area; the app should own that space.
  viewportFit: "cover" as const,
  themeColor: "#0e0e11",
};

export default function InboxPage() {
  return (
    <>
      {/* The root layout paints the marketing site's cream body. This route is a
          dark chat app on a phone, so it owns the background outright — without
          this, cream shows through under short screens and during overscroll. */}
      <style>{`body{background:#0e0e11;margin:0}`}</style>
      <InboxClient />
    </>
  );
}
