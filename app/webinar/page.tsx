import type { Metadata } from "next";
import WebinarClient from "./WebinarClient";
import { WEBINAR_WHEN_LONG } from "@/lib/webinar";

export const metadata: Metadata = {
  title: "Free Thyroid Masterclass | Swapnil Umbarkar",
  description: `Your report says normal and you still cannot lose weight. A free 90-minute live class for women with a slow thyroid. ${WEBINAR_WHEN_LONG}.`,
  robots: { index: false, follow: false },
};

export default function WebinarPage() {
  return <WebinarClient />;
}
