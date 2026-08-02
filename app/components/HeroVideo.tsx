"use client";

import { useEffect, useRef, useState } from "react";
import { trackCtaClick } from "../lib/analytics";

// Hero VSL frame. The video file does not exist yet — this renders a graceful
// "Video coming soon" state until the file lands at these paths:
const VSL_SRC = "/videos/vsl.mp4";
const VSL_POSTER = "/videos/posters/vsl.jpg";

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
  const [missing, setMissing] = useState(false);
  const firstPlayTracked = useRef(false);

  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    const onTime = () => setTime(v.currentTime);
    const onMeta = () => setDuration(v.duration || 0);
    const onEnded = () => { setPlaying(false); setStarted(false); };
    const onPlay = () => setPlaying(true);
    const onPause = () => setPlaying(false);
    v.addEventListener("timeupdate", onTime);
    v.addEventListener("loadedmetadata", onMeta);
    v.addEventListener("ended", onEnded);
    v.addEventListener("play", onPlay);
    v.addEventListener("pause", onPause);
    // Chromium doesn't reliably fire `error` for a 404'd preload=metadata
    // source — probe instead: no metadata + no source after 3s = missing file.
    const probe = window.setTimeout(() => {
      if (v.readyState === 0 && (v.networkState === 3 || v.networkState === 0)) {
        setMissing(true);
      }
    }, 3000);
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
  }, [missing]);

  const toggle = () => {
    const v = videoRef.current;
    if (!v || missing) return;
    if (v.paused) {
      if (!firstPlayTracked.current) {
        firstPlayTracked.current = true;
        // Measures VSL engagement against booking rate.
        trackCtaClick("hero_video", "vsl_play");
      }
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
    <div className="relative mx-auto mt-[38px] w-full max-w-[860px]">
      <div
        className="relative overflow-hidden rounded-[var(--r-xl)] border border-[var(--p-border)]"
        style={{
          background: "var(--bg-elevated)",
          boxShadow:
            "0 0 0 1px rgba(168,85,247,0.10), 0 24px 70px -20px rgba(168,85,247,0.32)",
        }}
      >
        <div className="relative aspect-video">
          {missing ? (
            <div className="flex h-full w-full items-center justify-center">
              <p className="text-[15px] font-medium text-[var(--t4)]">Video coming soon</p>
            </div>
          ) : (
            <>
              <video
                ref={videoRef}
                src={VSL_SRC}
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
                  aria-label="Play the 45 second video"
                  className="absolute left-1/2 top-1/2 flex h-[72px] w-[72px] -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full outline-offset-4 hover:scale-105 focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p400)]"
                  style={{
                    background: "linear-gradient(135deg,#a855f7,#7e22ce)",
                    boxShadow: "0 10px 30px rgba(168,85,247,0.4)",
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
                    className="text-[var(--t2)]"
                    style={{ transform: "translateY(-12px)" }}
                  >
                    <path d="M2 22 C 14 20, 26 12, 32 3" />
                    <polyline points="26,3 32,3 31,9" strokeLinejoin="round" fill="none" />
                  </svg>
                  <span className="font-hand text-[20px] leading-none text-[var(--t2)]">
                    Watch 45 Sec Video
                  </span>
                </div>
              )}

              {/* Custom control bar */}
              <div
                className="absolute inset-x-0 bottom-0 flex h-[44px] items-center gap-3 border-t border-[var(--b-soft)] px-4"
                style={{ background: "rgba(15,16,18,0.72)", backdropFilter: "blur(12px)" }}
              >
                <button
                  type="button"
                  onClick={toggle}
                  aria-label={playing ? "Pause video" : "Play video"}
                  className="shrink-0 text-[var(--t2)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p400)]"
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
                  className="shrink-0 text-[11.5px] text-[var(--t4)]"
                  style={{ fontFamily: "var(--font-geist-mono, monospace)" }}
                >
                  {fmt(time)} / {fmt(duration || 45)}
                </span>

                <button
                  type="button"
                  onClick={() => setMuted((m) => !m)}
                  aria-label={muted ? "Unmute video" : "Mute video"}
                  className="shrink-0 text-[var(--t3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p400)]"
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
                  className="shrink-0 text-[var(--t3)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-[var(--p400)]"
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
