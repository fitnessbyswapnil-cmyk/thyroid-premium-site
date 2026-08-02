import { ScrollDepthTracker } from "@/app/components/tracking/ScrollDepthTracker";
import Hero from "@/app/components/Hero";
import CertificationsSection from "@/app/components/CertificationsSection";
import TransformationWall from "@/app/components/TransformationWall";
import VideoTestimonial from "@/app/components/VideoTestimonial";
import WhatsappProofSection from "@/app/components/WhatsappProofSection";
import MoreThanFatLossSection from "@/app/components/MoreThanFatLossSection";
import SocialProof from "@/app/components/SocialProof";
import PostTestimonialCta from "@/app/components/PostTestimonialCta";
import FAQSection from "@/app/components/FAQSection";
import StickyBookingBar from "@/app/components/StickyBookingBar";

// VSL-first strip-down: hero carries the pitch, proof carries the argument,
// FAQ is the sole remaining objection-handler. The explanatory sections
// (problem framing, method, session walkthrough, qualification, coach bio)
// live in app/components/_archived/ — see its README for restore commands.
export default function Home() {
  return (
    <main>
      <ScrollDepthTracker />
      <Hero />                     {/* hero + VSL, one block, per mockup */}
      <CertificationsSection />
      <TransformationWall />       {/* wordless photo wall */}
      <VideoTestimonial />         {/* video proof */}
      <WhatsappProofSection />     {/* WhatsApp proof */}
      <MoreThanFatLossSection />   {/* non-scale proof + the stack CTA */}
      <SocialProof />              {/* named written testimonials */}
      <PostTestimonialCta />
      <FAQSection />
      <StickyBookingBar />
    </main>
  );
}
