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
      <article
        className="
          glass-card
          overflow-hidden
          rounded-[32px]
          border
          border-white/[0.06]
          bg-white/[0.02]
          backdrop-blur-xl
        "
      >
        <div className="grid grid-cols-[minmax(140px,170px)_1fr]">
          {/* IMAGE */}
          <div className="relative min-h-[320px] overflow-hidden">
            <Image
              src={story.image}
              alt={`${story.name} transformation`}
              fill
              loading="lazy"
              className="object-cover object-center"
            />

            <div
              className="absolute inset-0 bg-gradient-to-t from-black/65 via-transparent to-transparent"
              aria-hidden="true"
            />

            {/* RESULT CHIP */}
            <div className="absolute bottom-4 left-4">
              <span className="premium-chip">
                <span className="premium-chip-dot" aria-hidden="true" />
                {story.result}
              </span>
            </div>
          </div>

          {/* CONTENT */}
          <div className="flex flex-col justify-center p-6">
            <div className="mb-4 flex flex-wrap gap-2">
              {story.tags.map((tag) => (
                <span key={tag} className="result-badge">
                  {tag}
                </span>
              ))}
            </div>

            <p className="mb-5 text-[15px] font-medium leading-relaxed text-[var(--t2)]">
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
    <article
      className="
        glass-card
        overflow-hidden
        rounded-[32px]
        border
        border-white/[0.06]
        bg-white/[0.02]
        backdrop-blur-xl
      "
    >
      {/* IMAGE SECTION */}
      <div className="relative overflow-hidden">
        {/* FIXED HEIGHT FOR MOBILE */}
        <div className="relative h-[420px] w-full">
          <Image
            src={story.image}
            alt={`${story.name} transformation`}
            fill
            loading="lazy"
            className="object-cover object-top"
          />

          {/* DARK OVERLAY */}
          <div
            className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent"
            aria-hidden="true"
          />

          {/* RESULT CHIP */}
          <div className="absolute bottom-4 left-4">
            <span className="premium-chip">
              <span className="premium-chip-dot" aria-hidden="true" />
              {story.result}
            </span>
          </div>
        </div>
      </div>

      {/* CONTENT SECTION */}
      <div className="bg-[rgba(10,5,25,0.92)] px-4 pb-5 pt-4">
        {/* TAGS */}
        <div className="mb-3 flex flex-wrap gap-2">
          {story.tags.map((tag) => (
            <span key={tag} className="result-badge">
              {tag}
            </span>
          ))}
        </div>

        {/* QUOTE */}
        <p className="mb-3 text-[14px] leading-relaxed text-[var(--t2)]">
          &ldquo;{story.quote}&rdquo;
        </p>

        {/* NAME */}
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
      {/* BACKGROUND GLOW */}
      <div aria-hidden="true" className="section-glow">
        <div className="absolute left-1/2 top-[-12%] h-[220px] w-[220px] -translate-x-1/2 rounded-full bg-[var(--p500)]/[0.07] blur-[80px]" />
      </div>

      <div className="container-default relative z-10">
        <SectionHeader
          label="Real Client Transformations"
          title={
            <>
              More Than Weight Loss.{" "}
              <span className="text-gradient">
                Confidence Returned.
              </span>
            </>
          }
          lead="These women didn't just lose belly fat — they got their energy, confidence, and daily life back."
          titleMaxCh="18ch"
        />

        {/* DESKTOP */}
        <div className="hidden gap-6 md:grid md:grid-cols-2">
          {stories.map((story) => (
            <StoryCard
              key={story.name}
              story={story}
              layout="horizontal"
            />
          ))}
        </div>

        {/* MOBILE */}
        <div className="space-y-5 md:hidden">
          {stories.map((story) => (
            <StoryCard
              key={story.name}
              story={story}
              layout="stacked"
            />
          ))}
        </div>

        {/* CTA */}
        <div className="mt-12">
          <SectionCta
            variant="ghost"
            label="Start Your Thyroid Transformation →"
            trust="200+ Indian women · Premium coaching results"
            ariaLabel="Start your thyroid transformation"
          />
        </div>
      </div>
    </section>
  );
}