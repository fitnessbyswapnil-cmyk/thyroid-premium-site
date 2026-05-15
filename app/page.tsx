import Hero from "@/components/Hero";
import SocialProof from "@/components/SocialProof";
import ProblemSection from "@/components/ProblemSection";
import ResultsSection from "@/components/ResultsSection";
import VideoTestimonial from "@/components/VideoTestimonial";
import FrameworkSection from "@/components/FrameworkSection";
import AuthoritySection from "@/components/AuthoritySection";
import FAQSection from "@/components/FAQSection";
import FinalCTASection from "@/components/FinalCTASection";

export default function Home() {
  return (
    <main>
      <Hero />
      <SocialProof />
      <ProblemSection />
      <ResultsSection />
      <VideoTestimonial />
      <FrameworkSection />
      <AuthoritySection />
      <FAQSection />
      <FinalCTASection />
    </main>
  );
}