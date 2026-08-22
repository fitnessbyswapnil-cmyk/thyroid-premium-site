// Attribution repair, placed immediately after she has ticked her symptoms.
//
// The dominant state of a woman who has failed three to six plans is not
// scepticism about the coach — it is the belief that the outcome is not
// controllable by her at all, because effort has repeatedly produced nothing.
// A CTA aimed at someone in that state does not convert however good the offer.
//
// So this section does one job and no other: move the cause of the failure off
// her and onto the plan, while keeping it fixable. It sells nothing and carries
// no CTA deliberately — the ask comes after the state has changed, not during.
//
// Ported to the supplied design: the prose became two facing cards, each with
// a left rule — bone for the plans she was handed, red for the thyroid.
export default function AbsolveBlock() {
  return (
    <section className="relative bg-[var(--bg-page)]" aria-labelledby="absolve-heading">
      <div className="relative z-10 mx-auto w-full max-w-[1000px] px-6 py-14">
        <header className="mb-9 text-center">
          <p className="section-label">Before you blame yourself again</p>
          <h2 id="absolve-heading" className="section-title mx-auto text-balance">
            You didn&rsquo;t fail. The plan did.
          </h2>
        </header>

        <div className="grid grid-cols-1 gap-5 md:grid-cols-2">
          <div
            className="rounded-2xl bg-white p-8"
            style={{ borderLeft: "4px solid var(--border-strong)" }}
          >
            <div className="mb-[10px] text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--t3)]">
              Every plan you were handed
            </div>
            <div className="text-[19px] font-semibold leading-[1.4] text-[var(--t1)]">
              Assumed a metabolism that works normally.
            </div>
          </div>

          <div
            className="rounded-2xl bg-white p-8"
            style={{ borderLeft: "4px solid var(--red-cta)" }}
          >
            <div className="mb-[10px] text-[12px] font-bold uppercase tracking-[0.06em] text-[var(--red-cta)]">
              With an underactive thyroid
            </div>
            <div className="text-[19px] font-semibold leading-[1.4] text-[var(--t1)]">
              That assumption is wrong from the first line.
            </div>
          </div>
        </div>

        <p className="mx-auto mt-7 max-w-[640px] text-center text-[16px] leading-[1.55] text-[var(--t2)]">
          Four failed attempts aren&rsquo;t four failures &mdash; they&rsquo;re four
          datasets telling you the same thing. The consultation starts from the
          opposite assumption. That&rsquo;s the whole difference.
        </p>
      </div>
    </section>
  );
}
