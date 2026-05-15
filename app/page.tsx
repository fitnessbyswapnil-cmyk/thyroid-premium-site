import Hero from "./components/Hero";
import ProblemSection from "./components/ProblemSection";
import ResultsSection from "./components/ResultsSection";
import VideoTestimonial from "./components/VideoTestimonial";
import FrameworkSection from "./components/FrameworkSection";
import AuthoritySection from "./components/AuthoritySection";
import FAQSection from "./components/FAQSection";
import FinalCTASection from "./components/FinalCTASection";
import SocialProof from "./components/SocialProof";
import MoreThanFatLossSection from "./components/MoreThanFatLossSection";
import WhatsappProofSection from "./components/WhatsappProofSection";

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
      <WhatsappProofSection />
      <FinalCTASection />
    </main>
  );
}