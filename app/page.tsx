import Hero from "./components/Hero";
import SocialProof from "./components/SocialProof";
import VideoTestimonial from "./components/VideoTestimonial";
import ProblemSection from "./components/ProblemSection";
import AuthoritySection from "./components/AuthoritySection";
import FrameworkSection from "./components/FrameworkSection";
import ResultsSection from "./components/ResultsSection";
import FAQSection from "./components/FAQSection";
import FinalCTASection from "./components/FinalCTASection";
import MoreThanFatLossSection from "./components/MoreThanFatLossSection";
import WhatsappProofSection from "./components/WhatsappProofSection";

export default function Home() {
  return (
    <main>

      <Hero />

      <SocialProof />

      <VideoTestimonial />

      <ProblemSection />

      <AuthoritySection />

      <FrameworkSection />
      <ResultsSection />
      <MoreThanFatLossSection/>
      <WhatsappProofSection />

      <FAQSection />
      <FinalCTASection/>

    </main>
  );
}