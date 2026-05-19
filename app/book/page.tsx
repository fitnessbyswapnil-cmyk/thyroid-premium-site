import type { Metadata } from "next";
import BookPageClient from "./BookPageClient";

export const metadata: Metadata = {
  title: "Book Your Thyroid Strategy Session | Swapnil Umbarkar",
  description:
    "Reserve your private 60-minute thyroid strategy session with Swapnil Umbarkar. Only ₹299. Limited spots for Indian women ready to address the root cause of thyroid weight.",
  openGraph: {
    title: "Book Your Thyroid Strategy Session",
    description:
      "Only ₹299. 60 minutes. Finally understand why your thyroid weight won't move — and what to do about it.",
    type: "website",
  },
};

export default function BookPage() {
  return <BookPageClient />;
}
