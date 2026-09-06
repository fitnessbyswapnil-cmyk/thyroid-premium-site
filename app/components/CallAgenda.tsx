import SectionCta from "./SectionCta";

// Ported to the supplied design: a horizontal six-step timeline, numbered red
// discs on a hairline connector, gold time labels beneath them.
//
// Ambiguity aversion is the largest remaining barrier once the call is free:
// an unspecified process gets avoided even when the expected value is good.
// It also answers the objection she will never voice on a free call ("this is
// really a pitch"). Left unanswered she does not argue with it; she simply
// does not book.
//
// Copy is the design's own, which is terser than what this section used to
// run — the horizontal layout gives each step roughly six words of room.
const AGENDA = [
  { n: 1, when: "Before", what: "Send your reports. I read them before we speak." },
  { n: 2, when: "0–10 min", what: "Your history, in your words." },
  { n: 3, when: "10–35 min", what: "Which of the three blockers is holding you back." },
  { n: 4, when: "35–50 min", what: "Food, movement, and the order it happens in." },
  { n: 5, when: "50–60 min", what: "Your questions, answered honestly." },
  { n: 6, when: "After", what: "Written summary within 24 hours." },
] as const;

export default function CallAgenda() {
  return (
    <section
      className="relative bg-[var(--bg-page)]"
      aria-labelledby="agenda-heading"
    >
      <div className="relative z-10 mx-auto w-full max-w-[1100px] px-4 py-9 md:px-6 md:py-12">
        <header className="mb-7 text-center md:mb-10">
          <p className="section-label">What actually happens</p>
          <h2 id="agenda-heading" className="section-title mx-auto text-balance">
            Sixty minutes, and here is every one of them.
          </h2>
        </header>

        <ol
          role="list"
          className="relative grid grid-cols-2 gap-x-3 gap-y-5 md:grid-cols-3 lg:grid-cols-6 lg:gap-[14px]"
        >
          {/* Connector rail — desktop only, sits behind the discs. */}
          <div
            aria-hidden="true"
            className="absolute left-[5%] right-[5%] top-[19px] hidden h-[2px] bg-[var(--border-on-wash)] lg:block"
            style={{ zIndex: 0 }}
          />

          {AGENDA.map((row) => (
            <li
              key={row.when}
              className="relative flex flex-row items-start gap-[10px] text-left lg:flex-col lg:items-center lg:text-center"
              style={{ zIndex: 1 }}
            >
              <span
                aria-hidden="true"
                className="flex h-10 w-10 flex-none items-center justify-center rounded-full text-[15px] font-extrabold text-white"
                style={{
                  background: "var(--red-cta)",
                  boxShadow: "0 4px 12px rgba(216,31,38,0.3)",
                }}
              >
                {row.n}
              </span>
              <span>
                <span className="mb-[2px] block text-[11px] font-bold uppercase tracking-[0.04em] text-[var(--gold-ink)]">
                  {row.when}
                </span>
                <span className="block text-[13.5px] leading-[1.35] text-[#3a3528]">
                  {row.what}
                </span>
              </span>
            </li>
          ))}
        </ol>

        <p className="mx-auto mt-8 max-w-[62ch] text-center text-[13.5px] leading-[1.55] text-[var(--t3)] md:text-[15px]">
          Is this a sales call? No — it is a diagnosis. You leave knowing your
          blocker whether or not you ever work with me.
        </p>

        {/* Every recorded call that failed this month failed on someone who was
            not on it. Asked here, at booking, instead of at minute sixty. */}
        <p className="mx-auto mt-4 max-w-[62ch] text-center text-[13.5px] leading-[1.55] text-[var(--t2)] md:text-[15px]">
          <strong className="font-semibold text-[var(--t1)]">One request.</strong>{" "}
          If someone else is part of the money decision &mdash; your husband,
          your family &mdash; bring them onto the call. It is a family decision,
          and I would rather answer their questions myself than have you carry
          mine home.
        </p>

        {/* Kept deliberately. The design has no button in this section, but the
            ads are live and this is a tracked mid-page booking surface; taking
            it out mid-campaign is a funnel change, not a design change. */}
        <SectionCta
          variant="primary"
          className="mx-auto mt-8 max-w-sm"
          buttonClassName=""
          label="Schedule My 1-1 Thyroid Fat Loss Call"
          sublabel="Free · 60 minutes · one to one"
          trust="Bring your latest thyroid report. I read it before we speak."
          ariaLabel="Schedule my 1-1 thyroid fat loss session"
          location="agenda"
        />
      </div>
    </section>
  );
}
