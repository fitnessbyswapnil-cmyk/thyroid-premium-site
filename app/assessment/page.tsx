import type { Metadata } from "next";
import QuizFunnel from "./QuizFunnel";

export const metadata: Metadata = {
  title: "Thyroid Score Assessment · Swapnil Umbarkar",
  description:
    "11 questions, 90 seconds — find out what's really blocking your thyroid weight loss and get your personalised Thyroid Score.",
};

export default function AssessmentPage() {
  return <QuizFunnel />;
}
