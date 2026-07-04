import { cookies } from "next/headers";

import { ScrollDepthTracker } from "@/app/components/tracking/ScrollDepthTracker";
import Hero, { type HeroVariant } from "@/app/components/Hero";
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

// Message-matched hero: each live ad lands on the H1 it promised.
// Keyed off ?v= (manual override) or utm_content (persisted by middleware),
// so the variant survives client-side navigation within the session.
function resolveHeroVariant(key: string): HeroVariant {
  const k = key.toLowerCase();
  if (k.includes("ad1") || k.includes("eatless")) return "eatless";
  if (k.includes("ad2") || k.includes("labs")) return "labs";
  return "default";
}

export default async function Home({
  searchParams,
}: {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = await searchParams;
  const cookieStore = await cookies();
  const key = String(
    sp.v ?? sp.utm_content ?? cookieStore.get("utm_content")?.value ?? "",
  );
  const heroVariant = resolveHeroVariant(key);

  // Cold-traffic order: problem → mechanism → proof → 90-day picture → fit →
  // messenger → objections → close.
  return (
    <main>
      <ScrollDepthTracker />
      <Hero variant={heroVariant} />
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
