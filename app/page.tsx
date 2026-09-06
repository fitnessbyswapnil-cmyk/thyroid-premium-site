import dynamic from "next/dynamic";
import { ScrollDepthTracker } from "@/app/components/tracking/ScrollDepthTracker";
import Hero from "@/app/components/Hero";
import SymptomChips from "@/app/components/SymptomChips";

/**
 * VSL-first strip-down: hero carries the pitch, proof carries the argument,
 * FAQ is the sole remaining objection-handler. The explanatory sections
 * (problem framing, method, session walkthrough, qualification, coach bio)
 * live in app/components/_archived/ — see its README for restore commands.
 *
 * ── Why everything below SymptomChips is dynamically imported ──────────────
 * Measured: 59% of ad clicks reach this page, against 71% on a lighter route.
 * Roughly four in ten people who were paid for never see the page at all, and
 * the route was shipping 803 kB of JS to a mid-range Android on Indian 4G.
 *
 * These eleven sections are all below the fold. ssr:true keeps them in the
 * server-rendered HTML — nothing changes for SEO, for scrapers, or for what
 * the visitor sees before hydration — but their client JS is split out of the
 * initial payload instead of blocking it.
 *
 * Hero and SymptomChips are deliberately NOT lazy: they are the fold, and
 * deferring them would trade a bundle win for an LCP loss.
 */
const AbsolveBlock = dynamic(() => import("@/app/components/AbsolveBlock"));
const CallAgenda = dynamic(() => import("@/app/components/CallAgenda"));
const TransformationWall = dynamic(() => import("@/app/components/TransformationWall"));
const VideoTestimonial = dynamic(() => import("@/app/components/VideoTestimonial"));
const WhatsappProofSection = dynamic(() => import("@/app/components/WhatsappProofSection"));
const PillarsSection = dynamic(() => import("@/app/components/PillarsSection"));
const DeficitDiagram = dynamic(() => import("@/app/components/DeficitDiagram"));
const CertificationsSection = dynamic(() => import("@/app/components/CertificationsSection"));
const PostTestimonialCta = dynamic(() => import("@/app/components/PostTestimonialCta"));
const FitFilter = dynamic(() => import("@/app/components/FitFilter"));
const FAQSection = dynamic(() => import("@/app/components/FAQSection"));
const StickyBookingBar = dynamic(() => import("@/app/components/StickyBookingBar"));

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
      {/* The explanation BEFORE the proof. She is buying the "why", not the
          outcome — she has bought outcomes before and watched them reverse.
          The diagram shows the mechanism; the pillars show what is done about
          it. Proof then lands on a reader who knows what she is looking at. */}
      <div className="band-deep">
        <DeficitDiagram />
        <PillarsSection />
      </div>
      <CallAgenda />               {/* minute-by-minute + "is this a sales call?" */}
      <div className="band-deep">
        <TransformationWall />
      </div>       {/* photo wall + verified story lines */}
      <VideoTestimonial />         {/* video proof */}
      <WhatsappProofSection />     {/* WhatsApp proof + the stack CTA */}
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
