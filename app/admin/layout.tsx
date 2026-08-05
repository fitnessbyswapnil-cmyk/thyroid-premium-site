import type { Metadata } from "next";

// Private operations dashboard — never indexed, never linked from the site.
export const metadata: Metadata = {
  title: "Lead Dashboard",
  robots: { index: false, follow: false, nocache: true },
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  return children;
}
