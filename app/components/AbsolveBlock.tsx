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
export default function AbsolveBlock() {
  return (
    <section className="section-pad relative" aria-labelledby="absolve-heading">
      <div className="container-narrow relative z-10">
        <header className="section-header">
          <p className="section-label">Before you blame yourself again</p>
          <h2
            id="absolve-heading"
            className="section-title mx-auto text-balance"
            style={{ maxWidth: "18ch" }}
          >
            You didn&rsquo;t fail. The plan did.
          </h2>
        </header>

        <div className="mx-auto max-w-[46ch] space-y-5 text-center">
          <p className="text-pretty text-[length:var(--text-base)] leading-[1.72] text-[var(--t2)]">
            Every plan you were handed assumed a metabolism that works normally.
            With an underactive thyroid that assumption is wrong from the first
            line &mdash; so it was never going to work, however well you followed it.
          </p>

          <p className="text-pretty text-[length:var(--text-base)] leading-[1.72] text-[var(--t2)]">
            Which means four failed attempts aren&rsquo;t four failures.
            They&rsquo;re{" "}
            <span className="mark-swipe font-semibold text-[var(--t1)]">
              four datasets
            </span>{" "}
            telling you the same thing: none of them were built for a thyroid.
          </p>

          <p className="text-pretty text-[length:var(--text-sm)] leading-[1.7] text-[var(--t3)]">
            The consultation starts from the opposite assumption. That is the
            whole difference.
          </p>
        </div>
      </div>
    </section>
  );
}
