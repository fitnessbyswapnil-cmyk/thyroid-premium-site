"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { trackCtaClick, trackVideoEvent } from "../lib/analytics";

// Hero VSL frame, served from Vercel Blob (single plain MP4 — no HLS, no
// rendition switching; one file for mobile and desktop).
//
// Set NEXT_PUBLIC_VSL_URL in Vercel to the Blob object's public URL, i.e.
//   https://<store-id>.public.blob.vercel-storage.com/vsl-<hash>.mp4
// Unset, the component renders the graceful "Video coming soon" state.
// This is a PUBLIC read URL — no token is involved, nothing secret is bundled.
//
// The poster ships from /public (small, edge-cached, loads instantly) and is
// the ONLY video-related byte fetched before the user clicks play.
const VSL_URL = process.env.NEXT_PUBLIC_VSL_URL || "";
const VSL_POSTER = "/videos/posters/vsl-poster.jpg";

// Progress milestones — each fires exactly once per mount (Set guard), so
// scrubbing back and forth can never re-fire one.
const MILESTONES = [
  { pct: 0.25, event: "video_progress_25" },
  { pct: 0.5, event: "video_progress_50" },
  { pct: 0.75, event: "video_progress_75" },
  { pct: 0.95, event: "video_progress_95" },
] as const;

function fmt(t: number): string {
  if (!isFinite(t) || t < 0) t = 0;
  const m = Math.floor(t / 60);
  const s = Math.floor(t % 60);
  return `${m}:${String(s).padStart(2, "0")}`;
}

export default function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [playing, setPlaying] = useState(false);
  const [started, setStarted] = useState(false);
  const [muted, setMuted] = useState(false);
  const [time, setTime] = useState(0);
  const [duration, setDuration] = useState(0);
  // No Blob URL configured yet → show the "coming soon" frame immediately
  // rather than waiting on a load probe. Build-time inlined, so server and
  // client agree and there is no hydration mismatch.
  const [missing, setMissing] = useState(!VSL_URL);
  // Lazy source: null until the first play click, so NOTHING of the video
  // (not even metadata) downloads before the user asks for it. Only the
  // poster image loads up front.
  const [src, setSrc] = useState<string | null>(null);
  const firstPlayTracked = useRef(false);
  const milestonesFired = useRef<Set<string>>(new Set());
  const completeFired = useRef(false);

  // The VSL has BURNED-IN subtitles along the bottom of the frame, so a
  // permanently-visible control bar sits right on top of them. Controls now
  // fade out ~2.5s into playback and come back on tap/hover or pause.
  const [controlsVisible, setControlsVisible] = useState(true);
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const revealControls = useCallback(() => {
    setControlsVisible(true);
    if (hideTimer.current) clearTimeout(hideTimer.current);
    if (videoRef.current && !videoRef.current.paused) {
      hideTimer.current = setTimeout(() => setControlsVisible(false), 2500);
    }
  }, []);

  useEffect(() => {
    if (playing) revealControls();
    else {
      if (hideTimer.current) clearTimeout(hideTimer.current);
      setControlsVisible(true); // always reachable when paused
    }
    return () => { if (hideTimer.current) clearTimeout(hideTimer.current); };
  }, [playing, revealControls]);

  useEffect(() => {
    const v = videoRef.current;
    if (!v || !src) return;
    const onTime = () => {
      setTime(v.currentTime);
      // Milestones: once each, keyed by name — scrubbing can't re-fire.
      if (v.duration > 0) {
        const pct = v.currentTime / v.duration;
        for (const m of MILESTONES) {
          if (pct >= m.pct && !milestonesFired.current.has(m.event)) {
            milestonesFired.current.add(m.event);
            trackVideoEvent(m.event, v.currentTime, v.duration);
          }
        }
      }
    };
    const onMeta = () => setDuration(v.duration || 0);
    const onEnded = () => {
      setPlaying(false);
      setStarted(false);
      if (!completeFired.current) {
        completeFired.current = true;
        trackVideoEvent("video_complete", v.duration || 0, v.duration || 0);
      }
    };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("ended", onEnded);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    // Chromium doesn't reliably fire `error` for a 404'd source — probe after
    // the source is attached: no metadata + no source after 4s = missing file.
    const probe = window.setTimeout(() => {
      if (v.readyState === 0 && (v.networkState === 3 || v.networkState === 0)) {
        setMissing(true);
      }
    }, 4000);
    const clearProbe = () => window.clearTimeout(probe);
    v.addEventListener("loadedmetadata", clearProbe, { once: true });
    return () => {
      window.clearTimeout(probe);
      v.removeEventListener("timeupdate", onTime);
      v.removeEventListener("loadedmetadata", onMeta);
      v.removeEventListener("ended", onEnded);
      v.removeEventListener("play", onPlay);
      v.removeEventListener("pause", onPause);
    };
  }, [src]);

  // Once the source is attached (first play click), start playback.
  useEffect(() => {
    if (!src) return;
    videoRef.current?.play().catch(() => setMissing(true));
  }, [src]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v || missing) return;
    if (!src) {
      if (!firstPlayTracked.current) {
        firstPlayTracked.current = true;
        // Existing engagement event — kept as-is.
        trackCtaClick("hero_video", "vsl_play");
        // video_play: first play only, once per session (survives remounts).
        let already = false;
        try { already = !!sessionStorage.getItem("vsl_play_fired"); } catch { /* unavailable */ }
        if (!already) {
          try { sessionStorage.setItem("vsl_play_fired", "1"); } catch { /* non-critical */ }
          trackVideoEvent("video_play", 0, 0);
        }
      }
      setStarted(true);
      // Single MP4 for every device — attaching the src here is what starts
      // the download. Nothing before this line costs video bandwidth.
      setSrc(VSL_URL);
      return;
    }
    if (v.paused) {
      setStarted(true);
      v.play().catch(() => setMissing(true));
    } else {
      v.pause();
    }
  };

  const seek = (val: number) => {
    const v = videoRef.current;
    if (!v || !duration) return;
    v.currentTime = (val / 100) * duration;
    setTime(v.currentTime);
  };

  return (
    <div className="relative mx-auto w-full max-w-[860px]">
      <div
        className="relative overflow-hidden rounded-[var(--r-xl)] border border-[var(--p-border)]"
        style={{
          background: "#111114",
          boxShadow:
            "0 0 0 1px rgba(43,38,32,0.05), 0 24px 70px -20px rgba(43,38,32,0.28)",
        }}
      >
        <div className="relative aspect-video">
          {missing ? (
            <div className="flex h-full w-full items-center justify-center">
              <p className="text-[15px] font-medium text-white/60">Video coming soon</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                src={src ?? undefined}
                poster={VSL_POSTER}
                playsInline
                preload="metadata"
                muted={muted}
                className="h-full w-full object-cover"
                onError={() => setMissing(true)}
              />

              {/* Centre play button — hidden once playing */}
              {!playing && (
                <button
                  type="button"
                  onClick={toggle}
                  aria-label="Play the video"
                  className="absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-offset-4 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p400)]"
                  style={{
                    background: "var(--p400)",
                    boxShadow: "0 10px 30px rgba(10,107,96,0.45)",
                    transition: "transform 240ms var(--ease-cta)",
                  }}
                >
                  <svg width="24" height="24" viewBox="0 0 24 24" fill="#fff" aria-hidden="true">
                    <path d="M8 5.5v13l11-6.5-11-6.5z" />
                  </svg>
                </button>
              )}

              {/* Handwritten annotation — sm+ only, hidden once started */}
              {!started && (
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute left-1/2 top-1/2 hidden translate-x-[52px] translate-y-[34px] items-end gap-1 sm:flex"
                >
                  <svg
                    width="34"
                    height="26"
                    viewBox="0 0 34 26"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    className="text-white/85"
                    style={{ transform: "translateY(-12px)" }}
                  >
                    <path d="M2 22 C 14 20, 26 12, 32 3" />
                    <polyline points="26,3 32,3 31,9" strokeLinejoin="round" fill="none" />
                  </svg>
                  <span className="font-hand text-[20px] leading-none text-white/85">
                    Watch the Video
                  </span>
                </div>
              )}

              {/* Tap/hover surface — brings the auto-hidden controls back
                  without toggling playback. Sits under the control bar. */}
              {playing && !controlsVisible && (
                <button
                  type="button"
                  aria-label="Show video controls"
                  onClick={revealControls}
                  onMouseMove={revealControls}
                  className="absolute inset-0 z-[1] cursor-default"
                />
              )}

              {/* Custom control bar — fades out during playback so it never
                  covers the video's burned-in subtitles. */}
              <div
                onMouseEnter={revealControls}
                onMouseMove={revealControls}
                className="absolute inset-x-0 bottom-0 z-[2] flex h-[44px] items-center gap-3 border-t border-white/10 px-4"
                style={{
                  background: "rgba(15,16,18,0.72)",
                  backdropFilter: "blur(12px)",
                  opacity: controlsVisible ? 1 : 0,
                  pointerEvents: controlsVisible ? "auto" : "none",
                  transition: "opacity 320ms ease",
                }}
              >
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={playing ? "Pause video" : "Play video"}
                  className="shrink-0 text-white/85 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p500)]"
                >
                  {playing ? (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM13 5h4v14h-4z" /></svg>
                  ) : (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M8 5.5v13l11-6.5-11-6.5z" /></svg>
                  )}
                </button>

                <input
                  type="range"
                  min={0}
                  max={100}
                  step={0.1}
                  value={duration ? (time / duration) * 100 : 0}
                  onChange={(e) => seek(Number(e.target.value))}
                  aria-label="Seek video position"
                  className="vsl-seek h-[3px] flex-1"
                />

                <span
                  className="shrink-0 text-[11.5px] text-white/55"
                  style={{ fontFamily: "var(--font-geist-mono, monospace)" }}
                >
                  {fmt(time)} / {fmt(duration)}
                </span>

                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? "Unmute video" : "Mute video"}
                  className="shrink-0 text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p500)]"
                >
                  {muted ? (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5zM22 9l-6 6M16 9l6 6" /></svg>
                  ) : (
                    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M11 5 6 9H3v6h3l5 4V5zM15.5 8.5a5 5 0 0 1 0 7M18.5 5.5a9 9 0 0 1 0 13" /></svg>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => videoRef.current?.requestFullscreen?.()}
                  aria-label="Enter fullscreen"
                  className="shrink-0 text-white/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p500)]"
                >
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M8 3H3v5M16 3h5v5M8 21H3v-5M16 21h5v-5" /></svg>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
