// The 3-pillar method section — reveals the MECHANISM (what the method is,
// why past attempts failed) while withholding the DIAGNOSIS (which pillar is
// broken in HER case — that's what the free call diagnoses). The analogies are
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
      className="relative bg-[var(--bg-elevated)] py-16"
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

        <div className="mx-auto grid max-w-[1000px] grid-cols-1 gap-5 sm:grid-cols-3">
          {PILLARS.map((p) => (
            <article
              key={p.n}
              className="rounded-2xl bg-[var(--bg-page)] p-7 text-center"
            >
              <span
                aria-hidden="true"
                className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full text-[18px] font-extrabold text-white"
                style={{ background: "var(--red-cta)" }}
              >
                {p.n}
              </span>
              <h3 className="mb-2 text-[18px] font-extrabold text-[var(--t1)]">
                {p.name}
              </h3>
              <p className="text-[14px] leading-[1.45] text-[var(--t2)]">{p.body}</p>
            </article>
          ))}
        </div>

        <p className="mx-auto mt-7 max-w-[62ch] text-center text-[15px] leading-[1.55] text-[#3a3528]">
          In every stuck case, one pillar is broken.{" "}
          <strong className="font-semibold text-[var(--t1)]">
            The consultation finds which one is yours.
          </strong>
        </p>
      </div>
    </section>
  );
}
