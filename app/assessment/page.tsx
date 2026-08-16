import type { Metadata } from "next";
import QuizFunnel from "./QuizFunnel";

export const metadata: Metadata = {
  title: "Thyroid Score Assessment · Swapnil Umbarkar",
  description:
    "6 questions, 60 seconds. Find out what's really blocking your thyroid weight loss and get your personalised Thyroid Score.",
};

export default function AssessmentPage() {
  return <QuizFunnel />;
}
