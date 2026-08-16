// Qualification section — the page's lead-quality lever. Every "not for you"
// line repels a low-intent lead AND makes the right one trust the page more:
// refusing people is the most credible thing a page can do. The closing
// "serious investment" line filters ₹500-diet-chart hunters without naming
// the program price (which is quoted only on the call, after diagnosis).
const FOR_YOU = [
  "You take thyroid medicine daily but the weight won't move",
  "Or your reports say “normal” while your body disagrees",
  "Your day runs on meetings and family — not gym hours",
  "You're ready to fix this properly, with your reports on the table",
] as const;

const NOT_FOR_YOU = [
  "You want a free diet PDF",
  "You need a crash diet before a function next month",
  "You're not willing to look at your blood work",
] as const;

export default function FitFilter() {
  return (
    <section
      className="section-pad relative bg-[var(--bg-page)]"
      aria-labelledby="fit-heading"
    >
      <div className="container-narrow relative z-10">
        <header className="section-header">
          <p className="section-label">An honest filter</p>
          <h2
            id="fit-heading"
            className="section-title mx-auto text-balance"
            style={{ maxWidth: "20ch" }}
          >
            This is not for everyone.
          </h2>
        </header>

        <div className="mx-auto grid max-w-[760px] gap-4 sm:grid-cols-2">
          <div className="glass-card-sm p-6">
            <p className="mb-4 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--p300)]">
              This is for you if
            </p>
            <ul className="space-y-3">
              {FOR_YOU.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-[0.92rem] leading-[1.6] text-[var(--t2)]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className="mt-1 shrink-0"
                  >
                    <circle cx="8" cy="8" r="7.25" stroke="var(--p500)" strokeWidth="1.4" />
                    <path d="M5 8.2l2 2 4-4.4" stroke="var(--p500)" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                  {line}
                </li>
              ))}
            </ul>
          </div>

          <div className="glass-card-sm p-6" style={{ borderColor: "var(--coral-border)" }}>
            <p className="mb-4 text-[0.72rem] font-bold uppercase tracking-[0.16em] text-[var(--coral)]">
              This is NOT for you if
            </p>
            <ul className="space-y-3">
              {NOT_FOR_YOU.map((line) => (
                <li key={line} className="flex items-start gap-2.5 text-[0.92rem] leading-[1.6] text-[var(--t2)]">
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 16 16"
                    fill="none"
                    aria-hidden="true"
                    className="mt-1 shrink-0"
                  >
                    <circle cx="8" cy="8" r="7.25" stroke="var(--coral)" strokeWidth="1.4" />
                    <path d="M5.5 5.5l5 5M10.5 5.5l-5 5" stroke="var(--coral)" strokeWidth="1.6" strokeLinecap="round" />
                  </svg>
                  {line}
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Seriousness signal — filters on commitment without naming a price */}
        <p className="mx-auto mt-8 max-w-[52ch] text-center text-pretty text-[0.9rem] leading-[1.7] text-[var(--t3)]">
          One more thing, said plainly: if we find your blocker and you want my
          help fixing it, my 3-month programs are a{" "}
          <strong className="font-semibold text-[var(--t2)]">serious investment</strong>{" "}
          &mdash; quoted on the call, only after I&rsquo;ve seen your case. No
          pressure either way: the diagnosis is yours to keep.
        </p>
      </div>
    </section>
  );
}
