"use client";

import { ScarcityProvider } from "../context/ScarcityProvider";
import Hero from "./Hero";
import SocialProof from "./SocialProof";
import ResultsSection from "./ResultsSection";
import VideoTestimonial from "./VideoTestimonial";
import ProblemSection from "./ProblemSection";
import FrameworkSection from "./FrameworkSection";
import MoreThanFatLossSection from "./MoreThanFatLossSection";
import WhatsappProofSection from "./WhatsappProofSection";
import AuthoritySection from "./AuthoritySection";
import FAQSection from "./FAQSection";
import FinalCTASection from "./FinalCTASection";
import StickyBookingBar from "./StickyBookingBar";

export default function LandingPage() {
  return (
    <ScarcityProvider>
      <Hero />
      <SocialProof />
      <ResultsSection />
      <VideoTestimonial />
      <ProblemSection />
      <FrameworkSection />
      <MoreThanFatLossSection />
      <WhatsappProofSection />
      <AuthoritySection />
      <FAQSection />
      <FinalCTASection />
      <StickyBookingBar />
    </ScarcityProvider>
  );
}
