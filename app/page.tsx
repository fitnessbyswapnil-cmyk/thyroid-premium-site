import Hero from "@/app/components/Hero";
import ThyroidStrategySession from "@/app/components/ThyroidStrategySession";
import SocialProof from "@/app/components/SocialProof";

export default function Home() {
  return (
    <main>
      <Hero />

      {/* Premium consultation process */}
      <ThyroidStrategySession />

      <SocialProof />
    </main>
  );
}