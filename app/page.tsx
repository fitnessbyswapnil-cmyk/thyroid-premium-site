import { ScrollDepthTracker } from "@/app/components/tracking/ScrollDepthTracker";
import Hero from "@/app/components/Hero";
import AuthoritySection from "@/app/components/AuthoritySection";
import ThyroidStrategySession from "@/app/components/ThyroidStrategySession";
import SocialProof from "@/app/components/SocialProof";
import PostTestimonialCta from "@/app/components/PostTestimonialCta";
import WhoIsThisForSection from "@/app/components/WhoIsThisForSection";
import ResultsSection from "@/app/components/ResultsSection";
import VideoTestimonial from "@/app/components/VideoTestimonial";
import ProblemSection from "@/app/components/ProblemSection";
import WhatsappProofSection from "@/app/components/WhatsappProofSection";
import FrameworkSection from "@/app/components/FrameworkSection";
import MoreThanFatLossSection from "@/app/components/MoreThanFatLossSection";
import FAQSection from "@/app/components/FAQSection";
import FinalCTASection from "@/app/components/FinalCTASection";
import StickyBookingBar from "@/app/components/StickyBookingBar";

export default function Home() {
  return (
    <main>
      <ScrollDepthTracker />
      <Hero />
      <AuthoritySection />
      <ThyroidStrategySession />
      <SocialProof />
      <PostTestimonialCta />
      <WhoIsThisForSection />
      <ResultsSection />
      <VideoTestimonial />
      <ProblemSection />
      <WhatsappProofSection />
      <FrameworkSection />
      <MoreThanFatLossSection />
      <FAQSection />
      <FinalCTASection />
      <StickyBookingBar />
    </main>
  );
}
