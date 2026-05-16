"use client";

import Image from "next/image";

import CtaButton from "./CtaButton";

const stories = [
  {
    image: "/MoreThanFatLossSection/heenal.png",
    name: "Heenal S.",
    result: "15 kg Lost",
    tags: ["Belly Fat ↓", "Energy Up"],
    quote:
      "Finally lost the weight thyroid stole from me for 4 years.",
  },
  {
    image: "/MoreThanFatLossSection/surekha.png",
    name: "Surekha M.",
    result: "Bloating Gone",
    tags: ["Flat Stomach", "No Fatigue"],
    quote:
      "My clothes fit again. I finally feel like myself.",
  },
  {
    image: "/MoreThanFatLossSection/ashish.png",
    name: "Priya K.",
    result: "8 kg Lost",
    tags: ["Waist Reduced", "Confidence Back"],
    quote:
      "Belly fat reduced in just 3 weeks. I was shocked.",
  },
  {
    image: "/MoreThanFatLossSection/nitin.png",
    name: "Kavita R.",
    result: "Inches Lost",
    tags: ["Less Bloating", "Better Energy"],
    quote:
      "I stopped hiding in oversized clothes. Everything changed.",
  },
];

export default function MoreThanFatLossSection() {
  return (
    <section className="section-pad overflow-hidden bg-[var(--bg-page)] text-white">

      {/* Softer atmospheric glow */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-x-0 top-0 h-[260px] overflow-hidden"
      >
        <div className="absolute left-1/2 top-[-10%] h-[240px] w-[240px] -translate-x-1/2 rounded-full bg-purple-500/[0.05] blur-[85px] md:h-[420px] md:w-[420px]" />
      </div>

      <div className="container-default relative z-10">

        {/* Header */}
        <div className="mx-auto mb-8 max-w-[640px] text-center">

          <p className="section-label">
            Real Client Transformations
          </p>

          <h2 className="section-title mx-auto max-w-[18ch]">
            More Than Weight Loss.{" "}
            <span className="text-gradient">
              Confidence Returned.
            </span>
          </h2>

          <p className="mx-auto mt-3 max-w-[34ch] text-sm leading-relaxed text-[var(--t3)]">
            These women didn’t just lose belly fat.
            They got their confidence, energy, and life back.
          </p>
        </div>

        {/* Desktop → 2x2 calm layout */}
        <div className="hidden gap-4 md:grid md:grid-cols-2">

          {stories.map((story) => (
            <div
              key={story.name}
              className="glass-card overflow-hidden rounded-[1.5rem]"
            >

              <div className="grid grid-cols-[140px_1fr]">

                {/* Image */}
                <div className="relative h-full min-h-[240px] overflow-hidden">

                  <Image
                    src={story.image}
                    alt={`${story.name} thyroid fat loss transformation`}
                    fill
                    loading="lazy"
                    className="object-cover"
                  />

                  <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />

                  {/* Result chip */}
                  <div className="absolute bottom-3 left-3">

                    <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-black/60 px-3 py-1 backdrop-blur-md">

                      <span className="h-1.5 w-1.5 rounded-full bg-purple-300" />

                      <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-purple-200">
                        {story.result}
                      </span>

                    </span>
                  </div>
                </div>

                {/* Content */}
                <div className="flex flex-col justify-center p-5">

                  {/* Tags */}
                  <div className="mb-3 flex flex-wrap gap-1.5">

                    {story.tags.map((tag) => (
                      <span
                        key={tag}
                        className="result-badge"
                      >
                        {tag}
                      </span>
                    ))}
                  </div>

                  {/* Quote */}
                  <p className="mb-3 text-sm font-medium leading-relaxed text-[var(--t2)]">
                    &ldquo;{story.quote}&rdquo;
                  </p>

                  {/* Name */}
                  <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-[var(--t4)]">
                    {story.name}
                  </p>
                </div>
              </div>
            </div>
          ))}
        </div>

        {/* Mobile → calm stacked cards instead of moving slider */}
        <div className="space-y-4 md:hidden">

          {stories.map((story) => (
            <div
              key={story.name}
              className="glass-card overflow-hidden rounded-[1.4rem]"
            >

              {/* Image */}
              <div className="relative aspect-[4/4.5] overflow-hidden">

                <Image
                  src={story.image}
                  alt={`${story.name} thyroid fat loss transformation`}
                  fill
                  loading="lazy"
                  className="object-cover"
                />

                <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent" />

                {/* Result badge */}
                <div className="absolute bottom-3 left-3">

                  <span className="inline-flex items-center gap-1.5 rounded-full border border-purple-500/20 bg-black/65 px-3 py-1 backdrop-blur-sm">

                    <span className="h-1.5 w-1.5 rounded-full bg-purple-300" />

                    <span className="text-[10px] font-bold uppercase tracking-[0.08em] text-purple-200">
                      {story.result}
                    </span>

                  </span>
                </div>
              </div>

              {/* Content */}
              <div className="p-4">

                {/* Tags */}
                <div className="mb-2.5 flex flex-wrap gap-1.5">

                  {story.tags.map((tag) => (
                    <span
                      key={tag}
                      className="result-badge"
                    >
                      {tag}
                    </span>
                  ))}
                </div>

                {/* Quote */}
                <p className="mb-2 text-sm leading-relaxed text-[var(--t2)]">
                  &ldquo;{story.quote}&rdquo;
                </p>

                {/* Name */}
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--t4)]">
                  {story.name}
                </p>
              </div>
            </div>
          ))}
        </div>

        {/* CTA */}
        <div className="mt-8 text-center">

          <CtaButton
            variant="ghost"
            label="Start Your Thyroid Transformation →"
            ariaLabel="Start your thyroid transformation"
          />

          <p className="mt-2 text-xs text-[var(--t4)]">
            200+ Indian women · Premium coaching results
          </p>
        </div>

      </div>
    </section>
  );
}