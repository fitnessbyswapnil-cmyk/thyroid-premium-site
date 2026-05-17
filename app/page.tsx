import HeroSection from "@/app/components/HeroSection";
import ThyroidStrategySession from "@/app/components/ThyroidStrategySession";
import ClientStoriesSection from "@/app/components/ClientStoriesSection";

export default function Home() {
  return (
    <main>
      <HeroSection />

      {/* Premium consultation process */}
      <ThyroidStrategySession />

      <ClientStoriesSection />
    </main>
  );
}