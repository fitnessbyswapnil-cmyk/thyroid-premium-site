"use client";

import Image from "next/image";

import SectionCta from "./SectionCta";
import SectionHeader from "./SectionHeader";

const stories = [
  {
    image: "/MoreThanFatLossSection/heenal.png",
    name: "Heenal S.",
    result: "15 kg Lost",
    tags: ["Belly Fat ↓", "Energy Up"],
    quote: "Finally lost the weight thyroid stole from me for 4 years.",
  },
  {
    image: "/MoreThanFatLossSection/surekha.png",
    name: "Surekha M.",
    result: "Bloating Gone",
    tags: ["Flat Stomach", "No Fatigue"],
    quote: "My clothes fit again. I finally feel like myself.",
  },
  {
    image: "/MoreThanFatLossSection/ashish.png",
    name: "Priya K.",
    result: "8 kg Lost",
    tags: ["Waist Reduced", "Confidence Back"],
    quote: "Belly fat reduced in just 3 weeks. I was shocked.",
  },
  {
    image: "/MoreThanFatLossSection/nitin.png",
    name: "Kavita R.",
    result: "Inches Lost",
    tags: ["Less Bloating", "Better Energy"],
    quote: "I stopped hiding in oversized clothes. Everything changed.",
  },
];

function StoryCard({
  story,
  layout,
}: {
  story: (typeof stories)[0];
  layout: "horizontal" | "stacked";
}) {
  if (layout === "horizontal") {
    return (
      <article className="glass-card overflow-hidden rounded-[var(--r-xl)]">
        <div className="grid grid-cols-[minmax(120px,140px)_1fr]">
          <div className="relative min-h-[220px] overflow-hidden">
            <Image
              src={story.image}
              alt={`${story.name} transformation`}
              fill
              loading="lazy"
              className="object-cover"
            />
            <div
              className="absolute inset-0 bg-gradient-to-t from-black/50 to-transparent"
              aria-hidden="true"
            />
            <div className="absolute bottom-3 left-3">
              <span className="premium-chip">
                <span className="premium-chip-dot" aria-hidden="true" />
                {story.result}
              </span>
            </div>
          </div>
          <div className="flex flex-col justify-center p-5">
            <div className="mb-3 flex flex-wrap gap-1.5">
              {story.tags.map((tag) => (
                <span key={tag} className="result-badge">
                  {tag}
                </span>
              ))}
            </div>
            <p className="mb-3 text-sm font-medium leading-relaxed text-[var(--t2)]">
              &ldquo;{story.quote}&rdquo;
            </p>
            <p className="text-[11px] font-semibold uppercase tracking-[0.12em] text-[var(--t4)]">
              {story.name}
            </p>
          </div>
        </div>
      </article>
    );
  }

  return (
    <article className="glass-card overflow-hidden rounded-[var(--r-xl)]">
      <div className="relative aspect-[4/4.2] overflow-hidden">
        <Image
          src={story.image}
          alt={`${story.name} transformation`}
          fill
          loading="lazy"
          className="object-cover"
        />
        <div
          className="absolute inset-0 bg-gradient-to-t from-black/75 via-black/15 to-transparent"
          aria-hidden="true"
        />
        <div className="absolute bottom-3 left-3">
          <span className="premium-chip">
            <span className="premium-chip-dot" aria-hidden="true" />
            {story.result}
          </span>
        </div>
      </div>
      <div className="p-4">
        <div className="mb-2.5 flex flex-wrap gap-1.5">
          {story.tags.map((tag) => (
            <span key={tag} className="result-badge">
              {tag}
            </span>
          ))}
        </div>
        <p className="mb-2 text-sm leading-relaxed text-[var(--t2)]">
          &ldquo;{story.quote}&rdquo;
        </p>
        <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-[var(--t4)]">
          {story.name}
        </p>
      </div>
    </article>
  );
}

export default function MoreThanFatLossSection() {
  return (
    <section className="section-pad relative overflow-hidden bg-[var(--bg-page)] text-white">
      <div aria-hidden="true" className="section-glow">
        <div className="absolute left-1/2 top-[-12%] h-[220px] w-[220px] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.07] blur-[80px]" />
      </div>

      <div className="container-default relative z-10">
        <SectionHeader
          label="Real Client Transformations"
          title={
            <>
              More Than Weight Loss.{" "}
              <span className="text-gradient">Confidence Returned.</span>
            </>
          }
          lead="These women didn't just lose belly fat — they got their energy, confidence, and daily life back."
          titleMaxCh="18ch"
        />

        <div className="hidden gap-4 md:grid md:grid-cols-2">
          {stories.map((story) => (
            <StoryCard key={story.name} story={story} layout="horizontal" />
          ))}
        </div>

        <div className="space-y-3 md:hidden">
          {stories.map((story) => (
            <StoryCard key={story.name} story={story} layout="stacked" />
          ))}
        </div>

        <SectionCta
          variant="ghost"
          label="Start Your Thyroid Transformation →"
          trust="200+ Indian women · Premium coaching results"
          ariaLabel="Start your thyroid transformation"
        />
      </div>
    </section>
  );
}
