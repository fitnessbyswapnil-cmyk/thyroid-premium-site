import SectionCta from "./SectionCta";

// Ambiguity aversion is the largest remaining barrier once the call is free:
// an unspecified process gets avoided even when the expected value is good.
// "60 minutes, one to one" describes duration, not content — so this section
// says exactly what happens, minute by minute.
//
// It also answers the objection she will never voice on a free call ("this is
// really a pitch"). Left unanswered she does not argue with it; she simply
// does not book.
const AGENDA = [
  {
    when: "Before",
    what: "You send your thyroid reports. I read them before we speak — not during.",
  },
  {
    when: "0–10 min",
    what: "Your history, in your words. What you have already tried, and what happened.",
  },
  {
    when: "10–35 min",
    what: "Your reports on screen, and which of the three blockers is actually holding your fat loss.",
  },
  {
    when: "35–50 min",
    what: "What fixing that one involves — food, movement, and the order it has to happen in.",
  },
  {
    when: "50–60 min",
    what: "Your questions. If my programme is not right for you, I will say so.",
  },
  {
    when: "After",
    what: "A written summary within 24 hours. Yours to keep either way.",
  },
] as const;

export default function CallAgenda() {
  return (
    <section
      className="section-pad relative bg-[var(--bg-section)]"
      aria-labelledby="agenda-heading"
    >
      <div className="container-narrow relative z-10">
        <header className="section-header">
          <p className="section-label">What actually happens</p>
          <h2
            id="agenda-heading"
            className="section-title mx-auto text-balance"
            style={{ maxWidth: "20ch" }}
          >
            Sixty minutes, and here is every one of them.
          </h2>
        </header>

        <ol className="mx-auto max-w-[52ch] space-y-0" role="list">
          {AGENDA.map((row, i) => (
            <li
              key={row.when}
              className={[
                "grid grid-cols-[86px_1fr] gap-4 py-4 sm:grid-cols-[104px_1fr] sm:gap-5",
                i < AGENDA.length - 1
                  ? "border-b border-[var(--border-hairline)]"
                  : "",
              ].join(" ")}
            >
              <span className="pt-[2px] text-[length:var(--text-xs)] font-semibold uppercase tracking-[0.06em] text-[var(--gold-ink)]">
                {row.when}
              </span>
              <span className="text-pretty text-[length:var(--text-sm)] leading-[1.65] text-[var(--t2)]">
                {row.what}
              </span>
            </li>
          ))}
        </ol>

        <div className="mx-auto mt-9 max-w-[46ch] rounded-[14px] border border-[var(--border-hairline)] bg-white px-6 py-5 text-center">
          <p className="text-[length:var(--text-base)] font-semibold leading-[1.5] text-[var(--t1)]">
            Is this a sales call? No.
          </p>
          <p className="mt-2 text-pretty text-[length:var(--text-sm)] leading-[1.68] text-[var(--t2)]">
            It is a diagnosis. You leave knowing your blocker whether or not you
            ever work with me.
          </p>
        </div>

        <SectionCta
          variant="primary"
          className="mx-auto mt-8 max-w-sm"
          buttonClassName="w-full"
          label="Show Me What's Blocking It"
          sublabel="Free · 60 minutes · one to one"
          trust="Bring your latest thyroid report. I read it before we speak."
          ariaLabel="Schedule my 1-1 thyroid fat loss session"
          location="agenda"
        />
      </div>
    </section>
  );
}
