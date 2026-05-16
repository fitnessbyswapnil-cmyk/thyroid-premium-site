<div
  className="relative w-full overflow-hidden bg-black"
  style={{
    aspectRatio: "16 / 9",
  }}
>
  <video
    controls
    playsInline
    preload="metadata"
    className="absolute inset-0 h-full w-full object-cover"
    style={{
      objectFit: "cover",
      objectPosition: "center center",
      display: "block",
      backgroundColor: "#000",
    }}
    aria-label={`Transformation video: ${t.name}`}
  >
    <source src={t.videoUrl} type="video/mp4" />
  </video>

  {/* Top cinematic vignette */}
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-x-0 top-0 h-24"
    style={{
      background:
        "linear-gradient(to bottom, rgba(0,0,0,0.72) 0%, transparent 100%)",
    }}
  />

  {/* Bottom vignette */}
  <div
    aria-hidden="true"
    className="pointer-events-none absolute inset-x-0 bottom-0 h-24"
    style={{
      background:
        "linear-gradient(to top, rgba(10,5,25,0.82) 0%, transparent 100%)",
    }}
  />

  {/* Stats pill */}
  <div
    className="absolute inset-x-3 top-3 flex overflow-hidden rounded-full"
    style={{
      background: "rgba(0,0,0,0.52)",
      backdropFilter: "blur(18px) saturate(1.5)",
      WebkitBackdropFilter: "blur(18px) saturate(1.5)",
      border: "1px solid rgba(255,255,255,0.1)",
      boxShadow: "0 4px 24px rgba(0,0,0,0.45)",
    }}
  >
    {t.stats.map((s, i) => (
      <div
        key={`${t.name}-${s.label}-${i}`}
        className={`flex flex-1 flex-col items-center justify-center py-2 ${
          i !== t.stats.length - 1
            ? "border-r border-white/[0.08]"
            : ""
        }`}
      >
        <span className="text-[12px] font-extrabold leading-none tracking-tight text-[var(--p300)]">
          {s.num}
        </span>

        <span className="mt-[3px] text-[8.5px] font-semibold uppercase tracking-[0.16em] text-white/50">
          {s.label}
        </span>
      </div>
    ))}
  </div>
</div>