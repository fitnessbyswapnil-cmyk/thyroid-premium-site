import Hero from "@/app/components/Hero";
import ThyroidStrategySession from "@/app/components/ThyroidStrategySession";
import SocialProof from "@/app/components/SocialProof";
import PostTestimonialCta from "@/app/components/PostTestimonialCta";
import ResultsSection from "@/app/components/ResultsSection";
import VideoTestimonial from "@/app/components/VideoTestimonial";
import ProblemSection from "@/app/components/ProblemSection";
import WhatsappProofSection from "@/app/components/WhatsappProofSection";
import AuthoritySection from "@/app/components/AuthoritySection";
import FrameworkSection from "@/app/components/FrameworkSection";
import MoreThanFatLossSection from "@/app/components/MoreThanFatLossSection";
import FAQSection from "@/app/components/FAQSection";
import FinalCTASection from "@/app/components/FinalCTASection";
import StickyBookingBar from "@/app/components/StickyBookingBar";

export default function Home() {
  return (
    <main>
      <Hero />
      <ThyroidStrategySession />
      <SocialProof />
      <PostTestimonialCta />
      <ResultsSection />
      <VideoTestimonial />
      <ProblemSection />
      <WhatsappProofSection />
      <AuthoritySection />
      <FrameworkSection />
      <MoreThanFatLossSection />
      <FAQSection />
      <FinalCTASection />
      <StickyBookingBar />
    </main>
  );
}
