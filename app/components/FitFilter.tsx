// Qualification section — the page's lead-quality lever. Every "not for you"
// line repels a low-intent lead AND makes the right one trust the page more:
// refusing people is the most credible thing a page can do. The closing
// The investment line now NAMES a floor. Without one, women arrived with a
// blank price in their head and blank defaults to cheap — booking forms said
// "I can invest Rs 15,000" against Rs 25,000-30,000 pitches. A floor costs a
// few bookings that were never going to pay, and stops the low anchor.
const FOR_YOU = [
  "You take thyroid medicine daily but the weight won't move",
  "Or your reports say “normal” while your body disagrees",
  "Your day runs on meetings and family, not gym hours",
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
      className="relative bg-[var(--bg-page)] py-9 md:py-12"
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

        <div className="mx-auto grid max-w-[900px] grid-cols-1 gap-5 sm:grid-cols-2">
          <div className="rounded-2xl bg-white p-5 md:p-7">
            <p className="mb-4 text-[15px] font-extrabold text-[#1a7a3c]">
              This IS for you if
            </p>
            <ul className="space-y-3">
              {FOR_YOU.map((line) => (
                <li key={line} className="flex items-start gap-[10px]">
                  <span aria-hidden="true" className="flex-none font-extrabold text-[#1a7a3c]">
                    ✓
                  </span>
                  <span className="text-[14.5px] leading-[1.4] text-[var(--t1)]">{line}</span>
                </li>
              ))}
            </ul>
          </div>

          <div className="rounded-2xl bg-white p-5 md:p-7">
            <p className="mb-4 text-[15px] font-extrabold text-[var(--red-cta)]">
              This is NOT for you if
            </p>
            <ul className="space-y-3">
              {NOT_FOR_YOU.map((line) => (
                <li key={line} className="flex items-start gap-[10px]">
                  <span aria-hidden="true" className="flex-none font-extrabold text-[var(--red-cta)]">
                    ✕
                  </span>
                  <span className="text-[14.5px] leading-[1.4] text-[var(--t1)]">{line}</span>
                </li>
              ))}
            </ul>
          </div>
        </div>

        {/* Seriousness signal — filters on commitment without naming a price */}
        <p className="mx-auto mt-6 max-w-[70ch] text-center text-[14px] leading-[1.55] text-[var(--t2)]">
          My 3-month programmes{" "}
          <strong className="font-semibold text-[var(--t1)]">start at &#8377;25,000</strong>.
          The exact fee is quoted on the call, after the diagnosis &mdash; and
          the diagnosis is yours to keep either way.
        </p>
      </div>
    </section>
  );
}
