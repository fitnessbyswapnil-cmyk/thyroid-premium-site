// The 3-pillar method section — reveals the MECHANISM (what the method is,
// why past attempts failed) while withholding the DIAGNOSIS (which pillar is
// broken in HER case — that's what the ₹299 call sells). The analogies are
// the owner's own sales-call language, compressed for the page.
const PILLARS = [
  {
    n: "1",
    name: "Fix the Root",
    body:
      "Diets failed because the root cause, thyroid and hormones, was never addressed. That's pressing the accelerator with the handbrake on. We reset the metabolism first.",
  },
  {
    n: "2",
    name: "Fuel the Body",
    body:
      "Home-cooked roti-sabzi meals built for thyroid health. No cutting out Indian food, no starving.",
  },
  {
    n: "3",
    name: "Flow into Fitness",
    body:
      "Joint-friendly, 30–40 minutes, fits a meetings-till-8pm day. Plus sleep and daily rhythm.",
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
            Why nothing worked before. And what will.
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

        <p className="mx-auto mt-8 max-w-[40ch] text-center text-pretty text-[length:var(--text-sm)] leading-[1.7] text-[var(--t2)]">
          In every stuck case, one pillar is broken.{" "}
          <strong className="font-semibold text-[var(--t1)]">
            The consultation finds which one is yours.
          </strong>
        </p>
      </div>
    </section>
  );
}
