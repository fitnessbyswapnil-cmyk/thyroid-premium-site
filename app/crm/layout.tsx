import type { Metadata } from "next";

// Private pipeline view. Holds client health answers and call contents — it must
// never reach a search index, and the admin-key gate is not a reason to skip
// saying so.
export const metadata: Metadata = {
  title: "Pipeline",
  robots: { index: false, follow: false, nocache: true },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#0e0e11",
};

export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return children;
}
