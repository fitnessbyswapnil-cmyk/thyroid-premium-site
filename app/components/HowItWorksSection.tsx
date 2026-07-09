import SectionCta from "./SectionCta";
import SectionHeader from "./SectionHeader";

// "How your consultation works" — the 6-step Root-Cause Session flow, placed
// as the last thing read before the final booking CTA. Deliberately
// PRICE-NEUTRAL (works before and after the paid-session cutover): no free/₹
// language anywhere in this section.
//
// Every text/pill combo here was contrast-checked programmatically against the
// composited surfaces (t1/t2 on --s1 card, --p400 on --p-tint pill, t2 on
// --p-subtle): all ≥ 6.4:1, WCAG AA. No text below 14px on mobile.

const STEPS = [
  {
    n: 1,
    time: "0–10 MIN",
    title: "Thyroid Reports Review",
    body: "TSH, T3, T4, antibodies — whatever you have.",
    chip: "No reports? We start from your symptoms.",
  },
  {
    n: 2,
    time: "10–20 MIN",
    title: "Symptom History Mapping",
    body: "Energy, sleep, cravings, hair, periods, mood — the patterns tell the story.",
  },
  {
    n: 3,
    time: "20–30 MIN",
    title: "Lifestyle Audit",
    body: "Food timing, stress, sleep, movement — what's helping, what's hurting.",
  },
  {
    n: 4,
    time: "30–40 MIN",
    title: "Past Approaches Review",
    body: "Every diet and plan you've tried — and why each one stalled.",
  },
  {
    n: 5,
    time: "40–50 MIN",
    title: "Hidden Factor Screen",
    body: "Gut, cortisol, insulin, deficiencies, conversion — the usual suspects.",
  },
  {
    n: 6,
    time: "50–60 MIN",
    title: "Your Root-Cause Map",
    body: "The exact reason your fat loss is stuck — and your next step forward.",
  },
] as const;

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="section-pad relative scroll-mt-8 bg-[var(--bg-page)] text-white"
      aria-labelledby="how-it-works-heading"
    >
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-narrow relative z-10">
        <SectionHeader
          label="Your 60-Minute Session"
          title={
            <span id="how-it-works-heading">
              How your consultation <span className="text-gradient">works</span>
            </span>
          }
          lead="Six steps. One outcome — the exact reason your weight isn't shifting."
          titleMaxCh="22ch"
        />

        {/* ── Vertical timeline ── */}
        <ol className="relative list-none space-y-4 pl-8 sm:pl-9">
          {/* Connecting line — violet gradient, sits behind the dots */}
          <div
            aria-hidden="true"
            className="absolute bottom-5 left-[5px] top-5 w-px sm:left-[6px]"
            style={{
              background:
                "linear-gradient(to bottom, rgba(168,85,247,0.55) 0%, rgba(168,85,247,0.28) 60%, rgba(213,183,101,0.3) 100%)",
            }}
          />

          {STEPS.map((step) => (
            <li key={step.n} className="relative">
              {/* Timeline dot — aligned with the card's STEP label row */}
              <span
                aria-hidden="true"
                className="absolute -left-8 top-6 block h-[11px] w-[11px] rounded-full sm:-left-9"
                style={{
                  background:
                    "radial-gradient(circle, var(--p400) 0%, var(--p600) 100%)",
                  boxShadow:
                    "0 0 0 3px rgba(168,85,247,0.16), 0 0 12px rgba(168,85,247,0.45)",
                }}
              />

              <article className="rounded-2xl border border-[var(--b-soft)] bg-[var(--s1)] p-4 sm:p-5">
                <div className="mb-1.5 flex items-center justify-between gap-3">
                  <span className="text-[14px] font-bold uppercase tracking-[0.16em] text-[var(--p400)]">
                    Step {step.n}
                  </span>
                  <span className="shrink-0 rounded-full border border-[var(--p-border)] bg-[var(--p-tint)] px-3 py-1 text-[14px] font-semibold uppercase tracking-[0.08em] leading-none text-[var(--p400)]">
                    {step.time}
                  </span>
                </div>

                <p className="mb-1 text-[15.5px] font-bold leading-snug text-[var(--t1)]">
                  {step.title}
                </p>
                <p className="text-[14px] leading-[1.65] text-[var(--t2)]">
                  {step.body}
                </p>

                {"chip" in step && step.chip ? (
                  <p className="mt-3 inline-flex rounded-full border border-[var(--p-border)] bg-[var(--p-subtle)] px-3.5 py-1.5 text-[14px] font-medium leading-snug text-[var(--t2)]">
                    {step.chip}
                  </p>
                ) : null}
              </article>
            </li>
          ))}
        </ol>

        {/* ── Closing callout ── */}
        <div className="mt-8 rounded-2xl border border-[var(--p-border)] bg-[var(--p-subtle)] p-5 text-center">
          <p className="mx-auto max-w-[44ch] text-[15px] font-semibold leading-[1.65] text-[var(--t1)]">
            Reports &ldquo;normal&rdquo; but the weight won&apos;t move?{" "}
            <span className="text-gradient">
              That&apos;s exactly what this session decodes.
            </span>
          </p>
        </div>

        {/* ── CTA — same destination as the hero CTA (goToCta booking flow).
              No sublabel/trust line: this section stays price-neutral. ── */}
        <SectionCta
          variant="primary"
          className="mx-auto max-w-sm"
          buttonClassName="w-full"
          label="Book My Root-Cause Session"
          ariaLabel="Book my root-cause thyroid session"
          location="how_it_works"
        />
      </div>
    </section>
  );
}
