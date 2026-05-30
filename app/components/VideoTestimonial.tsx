"use client";

import { useRef, useState, useCallback, useEffect } from "react";
import { motion } from "framer-motion";
import CtaButton from "./CtaButton";

// ── Video source paths (emoji filenames must be percent-encoded in URLs) ──────

const SRCS = {
  kshama: `/videos/${encodeURIComponent("✨-From-YEARS-of-Struggle-➤-To-Visible-Results-in-Just-2-WEEKS🌸-Meet-Kshama-Handa-Age-55-—-b.mp4")}`,
  fathima: `/videos/${encodeURIComponent("🌸-Fathimas-2-Week-Thyroid-Fat-Loss-Update.mp4")}`,
  rashmi: `/videos/${encodeURIComponent("🎥-Rashmis-3-Week-Thyroid-Fat-Loss-Transformation.mp4")}`,
};

// ── Poster images ───────────────────────────────────────────────────────────
// Lightweight first-frame stills extracted from each video (keeps the 9:16
// card looking intentional before play and prevents layout shift with
// preload="none").
const POSTERS = {
  kshama: "/videos/posters/kshama.jpg",
  fathima: "/videos/posters/fathima.jpg",
  rashmi: "/videos/posters/rashmi.jpg",
};

// ── Data ──────────────────────────────────────────────────────────────────────

type Story = {
  id: string;
  src: string;
  poster: string;
  featured?: boolean;
  name: string;
  role: string;
  headline: string;
  subtext: string;
  stats: { num: string; label: string }[];
};

const STORIES: Story[] = [
  {
    id: "kshama",
    src: SRCS.kshama,
    poster: POSTERS.kshama,
    featured: true,
    name: "Kshama Handa",
    role: "Age 55 · Partial Thyroidectomy",
    headline: "Half My Thyroid Was Removed. Nothing Worked — Until This.",
    subtext:
      "After years of failed methods and coaches who didn't understand her condition, Kshama finally started seeing real results.",
    stats: [
      { num: "Age 55", label: "Client" },
      { num: "2 Wks", label: "Results" },
      { num: "50%", label: "Thyroid" },
    ],
  },
  {
    id: "fathima",
    src: SRCS.fathima,
    poster: POSTERS.fathima,
    name: "Fathima P.",
    role: "Thyroid Coaching Client",
    headline: "I Thought My Body Was Just Broken.",
    subtext:
      "Within 2 weeks, her energy returned and confidence shifted for the first time in years.",
    stats: [
      { num: "2 Wks", label: "Timeline" },
      { num: "Energy", label: "Restored" },
      { num: "Bloat", label: "Gone" },
    ],
  },
  {
    id: "rashmi",
    src: SRCS.rashmi,
    poster: POSTERS.rashmi,
    name: "Rashmi D.",
    role: "Hypothyroid Client",
    headline: "I Was Trying Everything. My Weight Wouldn't Move.",
    subtext:
      "Then her specific thyroid blockers were finally identified correctly — and everything changed in 3 weeks.",
    stats: [
      { num: "4.2 kg", label: "Lost" },
      { num: "3 Wks", label: "Timeline" },
      { num: "Energy", label: "Back" },
    ],
  },
];

// ── Motion variants ───────────────────────────────────────────────────────────

const fadeUp = {
  hidden: { opacity: 0, y: 28 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.62, ease: [0.16, 1, 0.3, 1] as const },
  },
};

const stagger = {
  hidden: {},
  visible: { transition: { staggerChildren: 0.13 } },
};

// ── VideoCard ─────────────────────────────────────────────────────────────────

function VideoCard({
  story,
  setVideoRef,
  onPlay,
}: {
  story: Story;
  setVideoRef: (el: HTMLVideoElement | null) => void;
  onPlay: () => void;
}) {
  const localRef = useRef<HTMLVideoElement | null>(null);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const [playing, setPlaying] = useState(false);
  const [buffering, setBuffering] = useState(false);
  const [muted, setMuted] = useState(false);
  // Defer the source until the card is about to scroll into view, so the
  // browser does no network work for this section on initial mobile load.
  const [nearViewport, setNearViewport] = useState(false);

  useEffect(() => {
    if (nearViewport) return;
    const el = containerRef.current;
    if (!el) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setNearViewport(true);
          io.disconnect();
        }
      },
      { rootMargin: "300px" },
    );
    io.observe(el);
    return () => io.disconnect();
  }, [nearViewport]);

  const refCallback = useCallback(
    (el: HTMLVideoElement | null) => {
      localRef.current = el;
      setVideoRef(el);
    },
    // setVideoRef is a stable inline arrow — intentionally omitted
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Toggle sound without pausing/restarting playback. The actual `muted`
  // state is driven by the video's volumechange event so it always reflects
  // reality (e.g. when sound-on play is blocked and falls back to muted).
  const toggleMute = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    const v = localRef.current;
    if (!v) return;
    v.muted = !v.muted;
  }, []);

  const handleClick = useCallback(() => {
    const v = localRef.current;
    if (!v) return;

    if (playing) {
      v.pause();
      return;
    }

    // Attempt to play with sound; fall back to muted if browser blocks it
    v.muted = false;
    v
      .play()
      .then(() => {
        onPlay();
        setPlaying(true);
      })
      .catch(() => {
        if (!localRef.current) return;
        localRef.current.muted = true;
        localRef.current
          .play()
          .then(() => {
            onPlay();
            setPlaying(true);
          })
          .catch(() => {});
      });
  }, [playing, onPlay]);

  return (
    <motion.article
      variants={fadeUp}
      whileHover={{ y: -4, transition: { duration: 0.3, ease: "easeOut" } }}
      className="group relative flex flex-col overflow-hidden rounded-[28px]"
      style={{
        background: story.featured
          ? "linear-gradient(155deg, rgba(168,85,247,0.1) 0%, rgba(255,255,255,0.03) 55%, rgba(255,255,255,0.015) 100%)"
          : "linear-gradient(155deg, rgba(255,255,255,0.055) 0%, rgba(255,255,255,0.02) 100%)",
        border: story.featured
          ? "1px solid rgba(168,85,247,0.30)"
          : "1px solid rgba(255,255,255,0.08)",
        boxShadow: story.featured
          ? "0 0 0 1px rgba(168,85,247,0.10), 0 0 60px rgba(168,85,247,0.14), 0 24px 80px rgba(0,0,0,0.65)"
          : "0 0 0 1px rgba(255,255,255,0.04), 0 16px 60px rgba(0,0,0,0.55)",
      }}
    >
      {/* Featured badge */}
      {story.featured && (
        <div
          className="absolute left-3 top-3 z-20 flex items-center gap-1.5 rounded-full px-3 py-1.5"
          style={{
            background: "rgba(0,0,0,0.65)",
            border: "1px solid rgba(168,85,247,0.30)",
            backdropFilter: "blur(12px)",
          }}
        >
          <span
            className="h-1.5 w-1.5 animate-pulse rounded-full bg-purple-300"
            style={{ boxShadow: "0 0 6px rgba(196,181,253,0.85)" }}
          />
          <span className="text-[0.56rem] font-bold uppercase tracking-[0.2em] text-purple-200/90">
            Featured Story
          </span>
        </div>
      )}

      {/* ── Video container — strict 9:16 ── */}
      <div
        ref={containerRef}
        className="relative w-full cursor-pointer overflow-hidden"
        style={{ aspectRatio: "9 / 16", background: "#08070f" }}
        onClick={handleClick}
        role="button"
        aria-label={`Play story: ${story.name}`}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleClick();
          }
        }}
      >
        <video
          ref={refCallback}
          src={nearViewport ? story.src : undefined}
          poster={story.poster}
          preload="none"
          playsInline
          onPause={() => setPlaying(false)}
          onEnded={() => {
            setPlaying(false);
            if (localRef.current) localRef.current.currentTime = 0;
          }}
          onWaiting={() => setBuffering(true)}
          onCanPlay={() => setBuffering(false)}
          onPlaying={() => setBuffering(false)}
          onVolumeChange={() => {
            if (localRef.current) setMuted(localRef.current.muted);
          }}
          className="absolute inset-0 h-full w-full"
          style={{ objectFit: "contain" }}
          aria-label={`Transformation video: ${story.name}`}
        />

        {/* Bottom cinematic gradient */}
        <div
          className="pointer-events-none absolute inset-x-0 bottom-0 h-2/5"
          style={{
            background:
              "linear-gradient(to top, rgba(8,7,15,0.92) 0%, rgba(8,7,15,0.45) 50%, transparent 100%)",
          }}
          aria-hidden
        />

        {/* Play / pause overlay */}
        {!playing && !buffering && (
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <motion.div
              initial={{ scale: 0.88, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
              className="flex h-[68px] w-[68px] items-center justify-center rounded-full transition-transform duration-200 group-hover:scale-110 active:scale-95"
              style={{
                background: "rgba(168,85,247,0.20)",
                border: "1.5px solid rgba(168,85,247,0.52)",
                boxShadow: "0 0 48px rgba(168,85,247,0.32), inset 0 1px 0 rgba(255,255,255,0.12)",
                backdropFilter: "blur(12px)",
              }}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path d="M7.5 4.5l11 7.5-11 7.5V4.5z" fill="rgba(255,255,255,0.92)" />
              </svg>
            </motion.div>
            <p className="mt-3 text-[0.6rem] font-semibold uppercase tracking-[0.22em] text-white/45">
              Watch Story
            </p>
          </div>
        )}

        {/* Mute / unmute toggle — appears once playing, toggles sound only */}
        {playing && (
          <button
            type="button"
            onClick={toggleMute}
            onKeyDown={(e) => {
              // Prevent Enter/Space from bubbling to the card's play handler
              if (e.key === "Enter" || e.key === " ") e.stopPropagation();
            }}
            aria-label={muted ? "Unmute video" : "Mute video"}
            className="absolute right-3 top-3 z-20 flex h-9 w-9 items-center justify-center rounded-full transition-transform duration-200 hover:scale-110 active:scale-95"
            style={{
              background: "rgba(0,0,0,0.55)",
              border: "1px solid rgba(168,85,247,0.30)",
              backdropFilter: "blur(8px)",
            }}
          >
            {muted ? (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M11 5 6 9H3v6h3l5 4V5z"
                  fill="rgba(255,255,255,0.92)"
                />
                <path
                  d="m16 9 5 6m0-6-5 6"
                  stroke="rgba(255,255,255,0.92)"
                  strokeWidth="2"
                  strokeLinecap="round"
                />
              </svg>
            ) : (
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
                <path
                  d="M11 5 6 9H3v6h3l5 4V5z"
                  fill="rgba(255,255,255,0.92)"
                />
                <path
                  d="M15.5 8.5a5 5 0 0 1 0 7M18 6a8.5 8.5 0 0 1 0 12"
                  stroke="rgba(255,255,255,0.92)"
                  strokeWidth="2"
                  strokeLinecap="round"
                  fill="none"
                />
              </svg>
            )}
          </button>
        )}

        {/* Buffering spinner */}
        {buffering && (
          <div className="absolute inset-0 flex items-center justify-center" aria-hidden>
            <div
              className="h-10 w-10 rounded-full border-2"
              style={{
                borderColor: "rgba(255,255,255,0.08)",
                borderTopColor: "rgba(168,85,247,0.7)",
                animation: "vt-spin 0.8s linear infinite",
              }}
            />
          </div>
        )}

        {/* "Real Client Story" floating label */}
        <div
          className="absolute bottom-3 left-3 flex items-center gap-1.5 rounded-full px-2.5 py-1"
          style={{
            background: "rgba(0,0,0,0.55)",
            border: "1px solid rgba(255,255,255,0.08)",
            backdropFilter: "blur(8px)",
          }}
          aria-hidden
        >
          <span
            className="h-1 w-1 rounded-full bg-emerald-400"
            style={{ boxShadow: "0 0 5px rgba(52,211,153,0.9)" }}
          />
          <span className="text-[0.55rem] font-semibold uppercase tracking-[0.15em] text-white/55">
            Real Client Story
          </span>
        </div>
      </div>

      {/* ── Stats bar ── */}
      <div
        className="flex"
        style={{ borderBottom: "1px solid rgba(255,255,255,0.06)" }}
      >
        {story.stats.map((s, i) => (
          <div
            key={s.label}
            className="flex flex-1 flex-col items-center py-3.5"
            style={{
              borderRight:
                i < story.stats.length - 1 ? "1px solid rgba(255,255,255,0.06)" : "none",
            }}
          >
            <span
              className="text-[0.8rem] font-extrabold leading-none"
              style={{
                background: "linear-gradient(135deg, #e0c6ff, #a855f7)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              {s.num}
            </span>
            <span className="mt-1 text-[0.58rem] font-semibold uppercase tracking-[0.15em] text-white/32">
              {s.label}
            </span>
          </div>
        ))}
      </div>

      {/* ── Text content ── */}
      <div className="flex flex-1 flex-col p-5 pb-6">
        <h3 className="mb-2.5 text-[0.98rem] font-extrabold leading-snug tracking-[-0.025em] text-[var(--t1)]">
          &ldquo;{story.headline}&rdquo;
        </h3>
        <p className="mb-5 flex-1 text-[0.78rem] leading-relaxed text-[var(--t3)]">
          {story.subtext}
        </p>

        {/* Client identity */}
        <div className="flex items-center gap-3">
          <div
            className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-[0.72rem] font-bold text-white"
            style={{
              background: "linear-gradient(135deg, var(--p400), #7c3aed)",
              boxShadow: "0 0 12px rgba(168,85,247,0.25)",
            }}
          >
            {story.name.charAt(0)}
          </div>
          <div>
            <p className="text-[0.8rem] font-semibold leading-tight text-white/88">
              {story.name}
            </p>
            <p className="mt-0.5 text-[0.65rem] text-white/38">{story.role}</p>
          </div>
        </div>
      </div>
    </motion.article>
  );
}

// ── Main section ──────────────────────────────────────────────────────────────

export default function VideoTestimonial() {
  const videoRefs = useRef<(HTMLVideoElement | null)[]>([]);

  const handlePlay = useCallback((playedIdx: number) => {
    videoRefs.current.forEach((v, i) => {
      if (v && i !== playedIdx) v.pause();
    });
  }, []);

  return (
    <section
      className="section-pad relative overflow-hidden"
      style={{ background: "var(--bg-section)" }}
      aria-labelledby="testimonial-heading"
    >
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute inset-0" aria-hidden>
        <div className="absolute left-1/2 top-0 h-[560px] w-[900px] -translate-x-1/2 rounded-full bg-purple-700/[0.06] blur-[150px]" />
        <div className="absolute bottom-0 left-[-5%] h-[380px] w-[440px] rounded-full bg-violet-900/[0.05] blur-[110px]" />
        <div className="absolute bottom-0 right-[-5%] h-[380px] w-[440px] rounded-full bg-purple-900/[0.05] blur-[110px]" />
      </div>

      <div className="container-default relative z-10">

        {/* ── Section header ── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-80px" }}
          variants={stagger}
          className="mb-12 text-center sm:mb-14"
        >
          <motion.p variants={fadeUp} className="section-label">
            Client Stories
          </motion.p>
          <motion.h2
            id="testimonial-heading"
            variants={fadeUp}
            className="section-title mx-auto"
            style={{ maxWidth: "22ch" }}
          >
            They Thought Their Thyroid Would{" "}
            <span className="text-gradient">Never Let Them Lose Weight.</span>
          </motion.h2>
          <motion.p
            variants={fadeUp}
            className="section-lead mx-auto mt-4"
            style={{ maxWidth: "48ch" }}
          >
            Real Indian women. Real thyroid diagnoses. Real results — finally,
            with a method built for how a thyroid body actually works.
          </motion.p>

          {/* Social proof pill */}
          <motion.div variants={fadeUp} className="mt-6 flex justify-center">
            <div
              className="inline-flex items-center gap-2 rounded-full px-4 py-2"
              style={{
                background: "rgba(168,85,247,0.07)",
                border: "1px solid rgba(168,85,247,0.18)",
              }}
            >
              <span className="text-[0.72rem] text-[var(--p300)]" aria-hidden>★★★★★</span>
              <span className="text-[0.68rem] font-semibold text-white/50">
                200+ women transformed across India
              </span>
            </div>
          </motion.div>
        </motion.div>

        {/* ── Video grid ── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true, margin: "-50px" }}
          variants={stagger}
          className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-3"
        >
          {STORIES.map((story, i) => (
            <VideoCard
              key={story.id}
              story={story}
              setVideoRef={(el) => {
                videoRefs.current[i] = el;
              }}
              onPlay={() => handlePlay(i)}
            />
          ))}
        </motion.div>

        {/* ── CTA block ── */}
        <motion.div
          initial="hidden"
          whileInView="visible"
          viewport={{ once: true }}
          variants={fadeUp}
          className="mx-auto mt-14 max-w-[min(100%,22rem)]"
        >
          <div
            className="cta-wrap section-cta rounded-[28px] p-5"
            style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.07)",
              backdropFilter: "blur(16px)",
            }}
          >
            <p className="mb-4 text-center text-[0.7rem] text-[var(--t5)]">
              No pressure · Personalised fit review
            </p>
            <CtaButton
              variant="primary"
              className="w-full"
              label="Book My ₹299 Thyroid Session"
              sublabel="60-min private 1-on-1 · Full refund if you don't get clarity"
              ariaLabel="Apply for private thyroid coaching"
              location="video_testimonial"
            />
          </div>
        </motion.div>
      </div>

      <style>{`@keyframes vt-spin { to { transform: rotate(360deg); } }`}</style>
    </section>
  );
}
