import { ScrollDepthTracker } from "@/app/components/tracking/ScrollDepthTracker";
import Hero from "@/app/components/Hero";
import SymptomChips from "@/app/components/SymptomChips";
import CertificationsSection from "@/app/components/CertificationsSection";
import PillarsSection from "@/app/components/PillarsSection";
import ResultsGrid from "@/app/components/ResultsGrid";
import TransformationWall from "@/app/components/TransformationWall";
import VideoTestimonial from "@/app/components/VideoTestimonial";
import WhatsappProofSection from "@/app/components/WhatsappProofSection";
import SocialProof from "@/app/components/SocialProof";
import PostTestimonialCta from "@/app/components/PostTestimonialCta";
import FitFilter from "@/app/components/FitFilter";
import FAQSection from "@/app/components/FAQSection";
import StickyBookingBar from "@/app/components/StickyBookingBar";

// VSL-first strip-down: hero carries the pitch, proof carries the argument,
// FAQ is the sole remaining objection-handler. The explanatory sections
// (problem framing, method, session walkthrough, qualification, coach bio)
// live in app/components/_archived/ — see its README for restore commands.
export default function Home() {
  return (
    <main>
      {/* LCP: the hero VSL poster is the largest above-the-fold paint — preload
          it so it starts downloading before the component tree hydrates.
          React hoists this <link> into <head>; homepage only (not /book). */}
      <link
        rel="preload"
        as="image"
        href="/videos/posters/vsl-poster.jpg"
        fetchPriority="high"
      />
      <ScrollDepthTracker />
      <Hero />                     {/* hero + VSL: blocked-not-stuck, medicated hyperniche */}
      <SymptomChips />             {/* "still ticking these even on your tablet?" */}
      <CertificationsSection />
      <PillarsSection />           {/* the method revealed; the diagnosis withheld */}
      <ResultsGrid />              {/* the receipt for "one pillar is broken" */}
      <TransformationWall />       {/* photo wall + verified story lines */}
      <VideoTestimonial />         {/* video proof */}
      <WhatsappProofSection />     {/* WhatsApp proof + the stack CTA */}
      <SocialProof />              {/* named written testimonials */}
      <PostTestimonialCta />
      <FitFilter />                {/* for you / not for you + seriousness line */}
      <FAQSection />
      <StickyBookingBar />
    </main>
  );
}
