import SectionCta from "./SectionCta";

// Symptom recognition grid — framed for the MEDICATED woman ("still ticking
// these even on the tablet?"), which keeps the hyperniche sharp while letting
// the undiagnosed reader self-include (she ticks the same boxes). Descriptive
// only: symptoms are named, never "treated" or "cured" — that line keeps the
// section clean for ASCI and Meta health policy.
const SYMPTOMS = [
  "Constant fatigue",
  "Morning bloating",
  "Hair fall",
  "Brain fog in meetings",
  "Cold hands & feet",
  "Afternoon energy crash",
  "Cravings after dinner",
  "Weight that won't move",
  "Disturbed sleep",
  "Puffy face",
] as const;

export default function SymptomChips() {
  return (
    <section
      className="section-pad relative bg-[var(--bg-page)]"
      aria-labelledby="symptoms-heading"
    >
      <div className="container-narrow relative z-10">
        <header className="section-header">
          <p className="section-label">Sound familiar?</p>
          <h2
            id="symptoms-heading"
            className="section-title mx-auto text-balance"
            style={{ maxWidth: "22ch" }}
          >
            Still ticking these boxes &mdash; even on your tablet?
          </h2>
        </header>

        <ul
          className="mx-auto flex max-w-[560px] flex-wrap items-center justify-center gap-2.5"
          role="list"
        >
          {SYMPTOMS.map((s) => (
            <li
              key={s}
              className="inline-flex items-center gap-2 rounded-full border border-[var(--coral-border)] bg-white px-3.5 py-2 text-[13.5px] font-medium text-[var(--t2)]"
            >
              <span
                aria-hidden="true"
                className="flex h-[15px] w-[15px] items-center justify-center rounded-[4px] border-[1.5px] border-[var(--coral)] text-[10px] font-bold text-[var(--coral)]"
              >
                ✓
              </span>
              {s}
            </li>
          ))}
        </ul>

        <p className="mx-auto mt-7 max-w-[46ch] text-center text-pretty text-[length:var(--text-sm)] leading-[1.7] text-[var(--t2)]">
          Your TSH may be &ldquo;in range&rdquo; and these still won&rsquo;t go
          &mdash; because the tablet manages the hormone, not the metabolism.
          Count your ticks.{" "}
          <strong className="font-semibold text-[var(--t1)]">
            3 or more? That&rsquo;s your blocker talking
          </strong>{" "}
          &mdash; the quiz narrows down which one.
        </p>

        <SectionCta
          variant="primary"
          className="mx-auto mt-8 max-w-sm"
          buttonClassName="w-full"
          label="Get My Free Thyroid Score"
          sublabel="Free 60-second quiz · then a private ₹299 consultation"
          trust="Leave the call knowing your exact blocker — or your ₹299 back."
          ariaLabel="Take the free thyroid score assessment"
          location="symptoms"
        />
      </div>
    </section>
  );
}
