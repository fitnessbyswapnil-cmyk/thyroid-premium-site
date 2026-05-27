import SectionCta from "./SectionCta";
import SectionHeader from "./SectionHeader";

const forItems = [
  "Your TSH is \"normal\" but you still feel exhausted, foggy, and heavy",
  "You've been told to \"just eat less\" — and it hasn't worked for years",
  "You gain weight eating the same food your family eats without any issue",
  "You have Hashimoto's and no doctor has explained what it means for your nutrition",
  "You're tired by noon despite sleeping 8 hours the night before",
  "You're done guessing and want a specific plan built for YOUR thyroid",
];

export default function WhoIsThisForSection() {
  return (
    <section className="section-pad relative bg-[var(--bg-page)] text-white">
      <div aria-hidden="true" className="section-glow">
        <div className="glow-section" />
      </div>

      <div className="container-narrow relative z-10">
        <SectionHeader
          label="Who This Is For"
          title={
            <>
              This consultation is{" "}
              <span className="text-gradient">specifically for you</span> if:
            </>
          }
          titleMaxCh="24ch"
        />

        <div className="flex flex-col gap-3">
          {forItems.map((item, i) => (
            <div
              key={i}
              className="flex items-start gap-4 rounded-[18px] border border-white/[0.06] bg-white/[0.025] px-5 py-4"
            >
              <div
                className="mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-full border"
                style={{
                  background: "rgba(168,85,247,0.12)",
                  borderColor: "rgba(168,85,247,0.35)",
                }}
                aria-hidden="true"
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path
                    d="M2 5l2 2.5 4-4"
                    stroke="rgba(196,181,253,0.9)"
                    strokeWidth="1.6"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </div>
              <p className="text-[14.5px] leading-[1.65] text-[var(--t2)]">
                {item}
              </p>
            </div>
          ))}
        </div>

        <p className="mt-6 text-center text-[12.5px] italic leading-relaxed text-[var(--t4)]">
          This is not for you if you&apos;re looking for a quick fix or aren&apos;t open to
          making small, consistent changes.
        </p>

        <SectionCta
          label="Apply For Your ₹299 Strategy Session"
          sublabel="Understand exactly what your thyroid needs"
          trust="200+ Indian women helped · ACE & INFS Certified"
          buttonClassName="w-full"
          style={{ maxWidth: "22rem" }}
          ariaLabel="Apply for your 299 rupee thyroid strategy session"
          location="who_is_this_for"
        />
      </div>
    </section>
  );
}
