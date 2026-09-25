// ── Hashimoto's ───────────────────────────────────────────────────────────────
//
// Added 25-Sep, because prospects started asking for Hashimoto's proof
// specifically and the page only spoke about hypothyroidism.
//
// BOTH WOMEN BELOW ARE REAL AND ALREADY PUBLISHED on this site, in
// app/components/SocialProof.tsx, with the same condition and the same words.
// Nothing here is new; it is the existing claim, surfaced where the question
// gets asked. Do not add a name to this section who is not already published
// elsewhere as a Hashimoto's client.
//
// WHY THERE ARE NO ANTIBODY NUMBERS HERE.
// TPO antibodies are the obvious thing to put on a Hashimoto's page, and they
// are the wrong thing. They swing week to week on their own, they rarely fall
// quickly, and they track how someone FEELS poorly — a woman can feel
// transformed with her antibodies unchanged. A "40% drop in a month" claim is
// not supportable, and this audience researches. Saying so out loud is the
// stronger position, and it is what the second column does.
//
// When real, dated, permissioned markers exist for a named client, they go in
// MARKERS below and render as a row under her quote. Free T3, ferritin and
// vitamin D are the ones that genuinely move inside twelve weeks.
type HashimotoStory = {
  name: string;
  where: string;
  detail: string;
  quote: string;
  /** Real, dated, permissioned lab movements only. Empty until then. */
  markers?: readonly { label: string; before: string; after: string }[];
};

const HASHIMOTO_STORIES: readonly HashimotoStory[] = [
  {
    name: "Divya M.",
    where: "Bengaluru",
    detail: "Hashimoto\u2019s \u00b7 10 weeks \u00b7 \u22126 kg",
    quote:
      "I cried on our first call because someone finally understood why nothing was working. This isn\u2019t just a coaching program. It\u2019s the first time I felt truly seen.",
  },
  {
    name: "Kavitha N.",
    where: "Hyderabad",
    detail: "Hashimoto\u2019s \u00b7 Root cause session",
    quote:
      "I walked in expecting a sales pitch. He spent the full hour on my actual reports. My TSH history, my food, my sleep. I left with three specific things to try that evening.",
  },
] as const;

const HASHIMOTO_MOVES = [
  "Free T3 \u2014 the hormone that actually does the work",
  "Ferritin, so T4 can convert to T3 at all",
  "Vitamin D, which almost nobody has checked",
  "Energy through the afternoon, and sleep",
  "Bloating, and inches before the scale",
] as const;

const HASHIMOTO_DOES_NOT = [
  "Your TPO antibodies, quickly. They rise and fall on their own.",
  "A number a lab prints, on any promised schedule.",
  "Anyone quoting you a fixed antibody drop in four weeks is guessing.",
] as const;

function Tick() {
  return (
    <span aria-hidden="true" className="mt-[2px] flex h-5 w-5 flex-none items-center justify-center rounded-full"
      style={{ background: "rgba(255,201,30,0.16)" }}>
      <svg width="11" height="11" viewBox="0 0 12 12">
        <path d="M2 6.4l2.6 2.6L10 3" fill="none" stroke="#ffc91e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    </span>
  );
}

function Cross() {
  return (
    <span aria-hidden="true" className="mt-[2px] flex h-5 w-5 flex-none items-center justify-center rounded-full"
      style={{ background: "rgba(220,52,52,0.16)" }}>
      <svg width="10" height="10" viewBox="0 0 12 12">
        <path d="M2 2l8 8M10 2l-8 8" fill="none" stroke="#ff6b6b" strokeWidth="2.2" strokeLinecap="round" />
      </svg>
    </span>
  );
}

function Column({ tag, tagColor, tagBg, borderColor, title, lines, good }: {
  tag: string; tagColor: string; tagBg: string; borderColor: string;
  title: string; lines: readonly string[]; good: boolean;
}) {
  return (
    <article className="rounded-2xl p-5 md:p-7"
      style={{
        border: `1px solid ${borderColor}`,
        background: good
          ? "linear-gradient(180deg, rgba(255,201,30,0.05) 0%, rgba(255,255,255,0.02) 45%)"
          : "rgba(255,255,255,0.02)",
      }}>
      <p className="m-0 inline-block rounded-md px-2.5 py-1 text-[length:var(--fs-3xs)] font-bold tracking-[var(--ls-caps)]"
        style={{ color: tagColor, background: tagBg }}>{tag}</p>
      <h3 className="mb-0 mt-3 text-[length:var(--fs-lg)] font-bold leading-[var(--lh-tight)] text-white">{title}</h3>
      <ul className="mt-5 flex list-none flex-col gap-3.5 p-0">
        {lines.map((line) => (
          <li key={line} className="flex gap-3 text-[length:var(--fs-2xs)] leading-[var(--lh-body)]"
            style={{ color: good ? "var(--t1)" : "var(--t2)" }}>
            {good ? <Tick /> : <Cross />}<span>{line}</span>
          </li>
        ))}
      </ul>
    </article>
  );
}

export default function HashimotoProof() {
  return (
    <section className="px-4 py-12 md:px-6 md:py-16" aria-labelledby="hashimoto-heading">
      <div className="mx-auto w-full max-w-[880px]">
        <header className="text-center">
          <p className="section-label">If you have Hashimoto&rsquo;s</p>
          <h2 id="hashimoto-heading" className="section-title mx-auto text-balance">
            Yes &mdash; and I will tell you <span className="decode-gold">what actually changes</span>
          </h2>
          <p className="mx-auto mt-3 max-w-[560px] text-[length:var(--fs-xs)] leading-[var(--lh-body)] text-[var(--t2)]">
            Hashimoto&rsquo;s is not the same condition as hypothyroidism, and it does not get the same plan.
          </p>
        </header>

        <div className="mt-8 grid grid-cols-1 gap-4 md:grid-cols-2 md:gap-5">
          {HASHIMOTO_STORIES.map((h) => (
            <article
              key={h.name}
              className="rounded-2xl p-5 md:p-7"
              style={{ border: "1px solid rgba(255,255,255,0.10)", background: "rgba(255,255,255,0.02)" }}
            >
              <p className="m-0 text-[length:var(--fs-3xs)] font-bold tracking-[var(--ls-caps)] text-[var(--t2)]">
                {h.detail}
              </p>
              <p className="mt-4 text-[length:var(--fs-2xs)] leading-[var(--lh-body)] text-[var(--t1)]">
                &ldquo;{h.quote}&rdquo;
              </p>
              {h.markers?.length ? (
                <dl className="mt-5 flex list-none flex-col gap-2 p-0">
                  {h.markers.map((m) => (
                    <div key={m.label} className="flex items-baseline justify-between gap-3">
                      <dt className="text-[length:var(--fs-3xs)] text-[var(--t2)]">{m.label}</dt>
                      <dd className="m-0 text-[length:var(--fs-3xs)] text-[var(--t1)]">
                        {m.before} &rarr; <span className="decode-gold">{m.after}</span>
                      </dd>
                    </div>
                  ))}
                </dl>
              ) : null}
              <p className="mt-5 text-[length:var(--fs-3xs)] font-bold text-[var(--t2)]">
                {h.name} &middot; {h.where}
              </p>
            </article>
          ))}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 md:mt-5 md:grid-cols-2 md:gap-5">
          <Column
            tag="WHAT USUALLY MOVES"
            tagColor="#ffc91e"
            tagBg="rgba(255,201,30,0.16)"
            borderColor="rgba(255,201,30,0.28)"
            title="In the first eight to twelve weeks"
            lines={HASHIMOTO_MOVES}
            good
          />
          <Column
            tag="WHAT USUALLY DOES NOT"
            tagColor="#ff8a8a"
            tagBg="rgba(220,52,52,0.16)"
            borderColor="rgba(220,52,52,0.26)"
            title="And I would rather say it now"
            lines={HASHIMOTO_DOES_NOT}
            good={false}
          />
        </div>

        <p className="mx-auto mt-6 max-w-[620px] text-center text-[length:var(--fs-3xs)] leading-[var(--lh-body)] text-[var(--t2)]">
          Individual results vary with your starting point, consistency and medical history. Nothing here replaces your doctor&rsquo;s advice or your medication.
        </p>
      </div>
    </section>
  );
}

