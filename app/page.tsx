import { ScrollDepthTracker } from "@/app/components/tracking/ScrollDepthTracker";
import Hero from "@/app/components/Hero";
import SymptomChips from "@/app/components/SymptomChips";
import AbsolveBlock from "@/app/components/AbsolveBlock";
import CallAgenda from "@/app/components/CallAgenda";
import CertificationsSection from "@/app/components/CertificationsSection";
import PillarsSection from "@/app/components/PillarsSection";
import TransformationWall from "@/app/components/TransformationWall";
import VideoTestimonial from "@/app/components/VideoTestimonial";
import WhatsappProofSection from "@/app/components/WhatsappProofSection";
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
      <SymptomChips />             {/* interactive: she describes herself before anyone sells to her */}
      <AbsolveBlock />             {/* lifts self-blame before the first real ask */}
      <CallAgenda />               {/* minute-by-minute + "is this a sales call?" */}
      <TransformationWall />       {/* photo wall + verified story lines */}
      <VideoTestimonial />         {/* video proof */}
      <WhatsappProofSection />     {/* WhatsApp proof + the stack CTA */}
      <PillarsSection />           {/* the method: reassurance AFTER she has identified */}
      <CertificationsSection />    {/* supports the decision, does not cause it */}
      {/* SocialProof (named written testimonials) removed: the page already
          carries transformation photos, video testimonials and WhatsApp
          screenshots. A fourth proof block of plain text quotes was the
          weakest of the four and the easiest to cut for length. */}
      <PostTestimonialCta />
      <FitFilter />                {/* for you / not for you + seriousness line */}
      <FAQSection />
      <StickyBookingBar />
    </main>
  );
}
