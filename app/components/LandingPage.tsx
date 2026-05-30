"use client";

import { ScarcityProvider } from "../context/ScarcityProvider";
import Hero from "./Hero";
import AuthoritySection from "./AuthoritySection";
import ThyroidStrategySession from "./ThyroidStrategySession";
import SocialProof from "./SocialProof";
import PostTestimonialCta from "./PostTestimonialCta";
import WhoIsThisForSection from "./WhoIsThisForSection";
import ResultsSection from "./ResultsSection";
import VideoTestimonial from "./VideoTestimonial";
import ProblemSection from "./ProblemSection";
import WhatsappProofSection from "./WhatsappProofSection";
import FrameworkSection from "./FrameworkSection";
import MoreThanFatLossSection from "./MoreThanFatLossSection";
import FAQSection from "./FAQSection";
import FinalCTASection from "./FinalCTASection";
import StickyBookingBar from "./StickyBookingBar";

export default function LandingPage() {
  return (
    <ScarcityProvider>
      <Hero />
      <ProblemSection />
      <WhoIsThisForSection />
      <ThyroidStrategySession />
      <AuthoritySection />
      <VideoTestimonial />
      <ResultsSection />
      <WhatsappProofSection />
      <FrameworkSection />
      <SocialProof />
      <PostTestimonialCta />
      <MoreThanFatLossSection />
      <FAQSection />
      <FinalCTASection />
      <StickyBookingBar />
    </ScarcityProvider>
  );
}
