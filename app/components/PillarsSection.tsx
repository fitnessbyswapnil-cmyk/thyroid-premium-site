// The 3-pillar method section — reveals the MECHANISM (what the method is,
// why past attempts failed) while withholding the DIAGNOSIS (which pillar is
// broken in HER case — that's what the ₹299 call sells). The analogies are
// the owner's own sales-call language, compressed for the page.
const PILLARS = [
  {
    n: "1",
    name: "Fix the Root",
    body:
      "Diets failed because the root — your thyroid and hormonal health — was never addressed. It's pressing the accelerator with the handbrake on. We track your markers, find your lifestyle gaps, and reset the metabolism first.",
  },
  {
    n: "2",
    name: "Fuel the Body",
    body:
      "No cutting out Indian food. Home-cooked roti-sabzi meals built for thyroid health — fueling the body properly instead of running it on 5% battery all day.",
  },
  {
    n: "3",
    name: "Flow into Fitness",
    body:
      "No 2-hour gym guilt. Joint-friendly 30–40 minute routines that fit a meetings-till-8pm day — plus sleep and daily rhythm, so consistency happens naturally.",
  },
] as const;

export default function PillarsSection() {
  return (
    <section
      className="section-pad relative bg-[var(--bg-section)]"
      aria-labelledby="pillars-heading"
    >
      <div className="container-default relative z-10">
        <header className="section-header">
          <p className="section-label">The T.H.Y.R.O.I.D. Lean Method</p>
          <h2
            id="pillars-heading"
            className="section-title mx-auto text-balance"
            style={{ maxWidth: "24ch" }}
          >
            Why nothing worked before &mdash; and what will.
          </h2>
        </header>

        <div className="mx-auto grid max-w-[960px] gap-4 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <article key={p.n} className="glass-card-sm p-6">
              <div className="mb-3 flex items-center gap-3">
                <span
                  aria-hidden="true"
                  className="flex h-9 w-9 items-center justify-center rounded-full bg-[var(--p-tint)] text-[15px] font-bold text-[var(--p300)]"
                  style={{ fontFamily: "var(--font-display), Georgia, serif" }}
                >
                  {p.n}
                </span>
                <h3 className="text-[1.15rem] font-bold text-[var(--t1)]">{p.name}</h3>
              </div>
              <p className="text-[0.95rem] leading-[1.7] text-[var(--t2)]">{p.body}</p>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-8 max-w-[52ch] text-center text-pretty text-[length:var(--text-sm)] leading-[1.7] text-[var(--t2)]">
          All three must work together &mdash; and in every stuck case, one of
          them is broken.{" "}
          <strong className="font-semibold text-[var(--t1)]">
            The quiz + consultation finds which one is broken in YOUR case.
            That&rsquo;s your blocker.
          </strong>
        </p>
      </div>
    </section>
  );
}
