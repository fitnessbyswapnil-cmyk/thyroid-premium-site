import { ScrollDepthTracker } from "@/app/components/tracking/ScrollDepthTracker";
import Hero from "@/app/components/Hero";
import AuthoritySection from "@/app/components/AuthoritySection";
import ThyroidStrategySession from "@/app/components/ThyroidStrategySession";
import SocialProof from "@/app/components/SocialProof";
import WhoIsThisForSection from "@/app/components/WhoIsThisForSection";
import ResultsSection from "@/app/components/ResultsSection";
import VideoTestimonial from "@/app/components/VideoTestimonial";
import ProblemSection from "@/app/components/ProblemSection";
import WhatsappProofSection from "@/app/components/WhatsappProofSection";
import FrameworkSection from "@/app/components/FrameworkSection";
import FAQSection from "@/app/components/FAQSection";
import FinalCTASection from "@/app/components/FinalCTASection";
import StickyBookingBar from "@/app/components/StickyBookingBar";

// Cold-traffic order: problem → mechanism → proof → 90-day picture → fit →
// messenger → objections → close.
export default function Home() {
  return (
    <main>
      <ScrollDepthTracker />
      <Hero />
      <ProblemSection />
      <ThyroidStrategySession />
      <SocialProof />
      <VideoTestimonial />
      <FrameworkSection />
      <WhoIsThisForSection />
      <AuthoritySection />
      <ResultsSection />
      <WhatsappProofSection />
      <FAQSection />
      <FinalCTASection />
      <StickyBookingBar />
    </main>
  );
}
