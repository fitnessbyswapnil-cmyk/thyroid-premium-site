import type { Metadata } from "next";
import CompletePaymentClient from "./CompletePaymentClient";

export const metadata: Metadata = {
  title: "Complete Your Consultation Booking · Swapnil Umbarkar",
  robots: { index: false }, // private, lead-specific link — not for search
};

export default function CompletePaymentPage() {
  return <CompletePaymentClient />;
}
