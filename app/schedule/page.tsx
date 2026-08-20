import type { Metadata } from "next";
import ScheduleClient from "./ScheduleClient";

export const metadata: Metadata = {
  title: "Schedule your 1-1 thyroid fat loss session",
  description:
    "60 minutes, one to one with Swapnil Umbarkar. Find what is actually blocking your thyroid fat loss.",
  robots: { index: false, follow: false },
};

export default function SchedulePage() {
  return <ScheduleClient />;
}
