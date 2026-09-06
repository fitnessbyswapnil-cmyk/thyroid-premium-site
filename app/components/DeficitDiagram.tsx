"use client";

/**
 * The single explanatory graphic of the /decode page.
 *
 * It replaces the VSL. A video asks for 6-8 minutes before the argument lands;
 * this makes the same argument in about four seconds of looking, weighs ~4 kB,
 * and needs nothing shot.
 *
 * WHAT IT ARGUES — and why the shape is the argument:
 *
 *   She believes: "I ate less and nothing happened, so I must have cheated."
 *   The truth:    she ate less, her burn came down to meet it, and the deficit
 *                 she created closed on its own.
 *
 * So the drawing is deliberately a SAWTOOTH, not a decline. Every cut opens a
 * real gap — that part of her experience is true and must be shown as true, or
 * the page is calling her a liar. The gap then closes without her doing
 * anything wrong. Two cuts later she is eating 600 kcal less for the same
 * result. That closing motion is the whole product: it is the thing a blood
 * report can show and a bathroom scale cannot.
 *
 * The numbers are illustrative of a documented pattern (adaptive thermogenesis
 * / reduced T4-to-T3 conversion under sustained restriction), not a reading of
 * anyone's chart, and the caption says so. Nothing here is a diagnosis.
 */

import { useEffect, useRef, useState } from "react";

/* Plot geometry. y = 272 - (kcal - 1000) * 0.228, x = 80 + month * 66.7 */
const EAT = "M80,90 L247,90 L247,158 L480,158 L480,226 L680,226";
const BURN = "M80,67 L247,67 C320,67 410,140 480,147 C545,154 610,205 680,215";
/* The region between them: eat forward, burn back. This is the deficit. */
const GAP =
  "M80,90 L247,90 L247,158 L480,158 L480,226 L680,226 L680,215 " +
  "C610,205 545,154 480,147 C410,140 320,67 247,67 L80,67 Z";

const STEPS = [
  {
    when: "First 2 months",
    head: "You eat 1,500. It works.",
    body: "Three kilos come off. This part is real. You are not imagining it, and you did nothing wrong.",
  },
  {
    when: "Month 3 to 5",
    head: "Your body starts burning less.",
    body: "Less food coming in, so your body makes less of the active thyroid hormone (T3). It slows the burn down to match. The gap you made closes by itself.",
  },
  {
    when: "Month 6 and after",
    head: "You eat even less. Same result.",
    body: "Now you eat 1,200 and the weight still will not move. Your body has raised reverse T3, which blocks the active hormone. And your TSH report still says normal.",
  },
];

export default function DeficitDiagram() {
  const ref = useRef<HTMLDivElement>(null);
  const [on, setOn] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setOn(true);
      return;
    }
    const io = new IntersectionObserver(
      ([e]) => {
        if (e.isIntersecting) {
          setOn(true);
          io.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    io.observe(el);
    return () => io.disconnect();
  }, []);

  return (
    <section
      className="relative bg-[var(--bg-section)]"
      aria-labelledby="deficit-heading"
    >
      <div
        ref={ref}
        className="mx-auto w-full max-w-[1000px] px-4 py-10 md:px-6 md:py-14"
      >
        <header className="mb-7 text-center md:mb-9">
          <p className="section-label">The part nobody explains</p>
          <h2
            id="deficit-heading"
            className="section-title mx-auto text-balance"
          >
            Where did the gap go?
          </h2>
          <p className="mx-auto mt-3 max-w-[620px] text-[15px] leading-[1.6] text-[var(--t2)] md:text-[16px]">
            You did make a gap between what you eat and what you burn. Twice.
            Both times it closed on its own.
          </p>
        </header>

        <figure className="m-0">
          <div
            className="overflow-x-auto rounded-2xl border p-3 md:p-5"
            style={{
              background: "var(--surface-wash-strong)",
              borderColor: "var(--border-on-wash)",
            }}
          >
            <svg
              viewBox="0 0 720 340"
              className={`block h-auto w-full dd${on ? " dd-on" : ""}`}
              role="img"
              aria-label="A chart over nine months. The food you eat drops twice, from 1,800 calories to 1,500 to 1,200. What your body burns starts at 1,900 and falls each time to meet the new amount, so the gap opens when you cut and then closes again."
            >
              {/* grid */}
              {[44, 101, 158, 215, 272].map((y) => (
                <line
                  key={y}
                  x1="80"
                  x2="680"
                  y1={y}
                  y2={y}
                  stroke="var(--border-hairline)"
                  strokeWidth="1"
                />
              ))}

              {/* y labels */}
              {[
                { y: 44, t: "2000" },
                { y: 158, t: "1500" },
                { y: 272, t: "1000" },
              ].map((d) => (
                <text
                  key={d.t}
                  x="68"
                  y={d.y + 4}
                  textAnchor="end"
                  fontSize="12"
                  fill="var(--t3)"
                  fontFamily="var(--font-mono)"
                >
                  {d.t}
                </text>
              ))}
              <text
                x="80"
                y="24"
                fontSize="11.5"
                fill="var(--t3)"
                letterSpacing="0.08em"
              >
                CALORIES PER DAY
              </text>

              {/* the two cuts */}
              {[247, 480].map((x) => (
                <g key={x} className="dd-cut">
                  <line
                    x1={x}
                    x2={x}
                    y1="44"
                    y2="286"
                    stroke="var(--border-strong)"
                    strokeWidth="1"
                    strokeDasharray="3 4"
                  />
                  <text
                    x={x + 6}
                    y="40"
                    fontSize="11.5"
                    fill="var(--t3)"
                  >
                    you eat less again
                  </text>
                </g>
              ))}

              {/* the deficit itself */}
              <path d={GAP} fill="rgba(184,134,11,0.20)" className="dd-gap" />

              {/* burn, then eat on top */}
              <path
                d={BURN}
                fill="none"
                stroke="var(--p500)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="dd-line dd-burn"
              />
              <path
                d={EAT}
                fill="none"
                stroke="var(--t1)"
                strokeWidth="3"
                strokeLinecap="round"
                strokeLinejoin="round"
                className="dd-line dd-eat"
              />

              {/* inline series labels — no legend to cross-reference */}
              <g className="dd-tag">
                <text x="92" y="59" fontSize="13" fontWeight="600" fill="var(--p600)">
                  What you burn
                </text>
                <text x="92" y="108" fontSize="13" fontWeight="600" fill="var(--t1)">
                  What you eat
                </text>
              </g>

              {/* x axis */}
              <line x1="80" x2="680" y1="286" y2="286" stroke="var(--border-strong)" strokeWidth="1" />
              {[
                { x: 80, t: "Month 0" },
                { x: 247, t: "3" },
                { x: 480, t: "6" },
                { x: 680, t: "9" },
              ].map((d) => (
                <text
                  key={d.t}
                  x={d.x}
                  y="304"
                  textAnchor={d.x === 80 ? "start" : d.x === 680 ? "end" : "middle"}
                  fontSize="12"
                  fill="var(--t3)"
                >
                  {d.t}
                </text>
              ))}

              {/* The measured deficit at four moments. This is the argument:
                  the number goes 400 -> 60 -> 330 -> 65. Without these the two
                  curves just look like a decline, and the point is the RESET. */}
              <g className="dd-measure">
                {/* wide, just after the first cut */}
                <line x1="270" x2="270" y1="69" y2="158" stroke="var(--p600)" strokeWidth="1.5" />
                <line x1="265" x2="275" y1="69" y2="69" stroke="var(--p600)" strokeWidth="1.5" />
                <line x1="265" x2="275" y1="158" y2="158" stroke="var(--p600)" strokeWidth="1.5" />
                <text x="280" y="117" fontSize="12.5" fontWeight="700" fill="var(--p600)">
                  &minus;400
                </text>

                {/* closed again, three months later */}
                <line x1="462" x2="462" y1="144" y2="158" stroke="var(--t3)" strokeWidth="1.5" />
                <text x="456" y="178" textAnchor="end" fontSize="12.5" fontWeight="700" fill="var(--t2)">
                  &minus;60
                </text>
                <line x1="458" x2="462" y1="172" y2="160" stroke="var(--t3)" strokeWidth="1" />

                {/* wide again, after the second cut */}
                <line x1="504" x2="504" y1="151" y2="226" stroke="var(--p600)" strokeWidth="1.5" />
                <line x1="499" x2="509" y1="151" y2="151" stroke="var(--p600)" strokeWidth="1.5" />
                <line x1="499" x2="509" y1="226" y2="226" stroke="var(--p600)" strokeWidth="1.5" />
                <text x="514" y="193" fontSize="12.5" fontWeight="700" fill="var(--p600)">
                  &minus;330
                </text>

                {/* and closed again */}
                <line x1="662" x2="662" y1="211" y2="226" stroke="var(--t3)" strokeWidth="1.5" />
                <text x="656" y="246" textAnchor="end" fontSize="12.5" fontWeight="700" fill="var(--t2)">
                  &minus;65
                </text>
                <line x1="658" x2="662" y1="240" y2="228" stroke="var(--t3)" strokeWidth="1" />
              </g>

              {/* Punchline, parked in the one large empty region of the plot. */}
              <g className="dd-note">
                <text x="600" y="86" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--t1)">
                  Same gap as before.
                </text>
                <text x="600" y="105" textAnchor="middle" fontSize="14" fontWeight="700" fill="var(--p600)">
                  600 calories less food.
                </text>
              </g>

            </svg>
          </div>
          <p className="mt-3 text-center text-[15px] font-semibold leading-[1.45] text-[var(--t1)] sm:hidden">
            Same gap as before. <span style={{ color: "var(--p600)" }}>600 calories less food.</span>
          </p>

          <figcaption className="mt-3 text-center text-[12.5px] leading-[1.5] text-[var(--t5)]">
            This shows a known pattern that happens when you eat less for a
            long time. It is not a reading of anyone&rsquo;s report, and it is
            not a diagnosis.
          </figcaption>
        </figure>

        {/* The same argument in words, for the people who read rather than look. */}
        <ol className="mt-8 grid list-none grid-cols-1 gap-4 p-0 md:mt-10 md:grid-cols-3">
          {STEPS.map((s, i) => (
            <li
              key={s.when}
              className="rounded-2xl bg-white p-4 md:p-6"
              style={{
                borderLeft: `4px solid ${i === 2 ? "var(--p500)" : "var(--border-strong)"}`,
                boxShadow: "var(--shadow-card)",
              }}
            >
              <div className="mb-2 text-[11.5px] font-bold uppercase tracking-[0.08em] text-[var(--t3)]">
                {s.when}
              </div>
              <div className="mb-1.5 text-[16px] font-semibold leading-[1.35] text-[var(--t1)] md:text-[17px]">
                {s.head}
              </div>
              <p className="m-0 text-[14.5px] leading-[1.6] text-[var(--t2)]">
                {s.body}
              </p>
            </li>
          ))}
        </ol>

        <p className="mx-auto mt-8 max-w-[660px] text-center text-[17px] font-semibold leading-[1.5] text-[var(--t1)] md:text-[19px]">
          Every one of these steps leaves a mark on a blood test.
          <span className="block text-[var(--t2)] font-normal mt-1 text-[15px] md:text-[16px]">
            That is what this session is for &mdash; to find which ones have
            already happened to you.
          </span>
        </p>
      </div>

      <style>{`
        .dd .dd-line { stroke-dasharray: 1400; stroke-dashoffset: 1400; }
        .dd .dd-gap, .dd .dd-tag, .dd .dd-note, .dd .dd-cut, .dd .dd-measure { opacity: 0; }
        .dd-on .dd-eat  { animation: dd-draw 1100ms cubic-bezier(.4,0,.2,1) forwards; }
        .dd-on .dd-burn { animation: dd-draw 1400ms cubic-bezier(.4,0,.2,1) 180ms forwards; }
        .dd-on .dd-cut  { animation: dd-fade 400ms ease 700ms forwards; }
        .dd-on .dd-gap  { animation: dd-fade 700ms ease 900ms forwards; }
        .dd-on .dd-tag  { animation: dd-fade 500ms ease 1100ms forwards; }
        .dd-on .dd-measure { animation: dd-fade 500ms ease 1500ms forwards; }
        .dd-on .dd-note { animation: dd-fade 600ms ease 2000ms forwards; }
        @keyframes dd-draw { to { stroke-dashoffset: 0; } }
        @keyframes dd-fade { to { opacity: 1; } }
        /* Phones: the 720-unit chart scales to ~340px, so 12px labels would
           render at ~6px. The dense annotations (cut markers, the four
           measures, the in-chart punchline) are hidden and the punchline is
           restated in HTML under the chart; the series tags and axis labels
           are enlarged so they survive the scale-down. The three cards below
           already carry the -400/-60/-330/-65 story in words. */
        @media (max-width: 639px) {
          .dd .dd-cut, .dd .dd-measure, .dd .dd-note { display: none; }
          .dd > text { font-size: 20px; }
          .dd .dd-tag text { font-size: 24px; }
        }
        @media (prefers-reduced-motion: reduce) {
          .dd .dd-line { stroke-dashoffset: 0; }
          .dd .dd-gap, .dd .dd-tag, .dd .dd-note, .dd .dd-cut, .dd .dd-measure { opacity: 1; }
          .dd * { animation: none !important; }
        }
      `}</style>
    </section>
  );
}
