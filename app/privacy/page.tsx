import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy Policy | Swapnil Umbarkar Fitness",
  description:
    "How we collect, use, protect and delete your personal information.",
  robots: { index: true, follow: true },
};

// Static legal page. Meta's app review requires a reachable Privacy Policy URL
// (and a data-deletion instructions URL — the #data-deletion anchor below
// serves as both). Deliberately zero client JS and zero tracking beyond the
// global layout, so it loads instantly and never interferes with the funnel.

const SECTION = "mx-auto max-w-2xl px-6";
const H2 = "mt-10 mb-3 text-xl font-semibold text-white";
const P = "mb-4 leading-relaxed text-slate-300";
const LI = "mb-2 leading-relaxed text-slate-300";

export default function PrivacyPolicyPage() {
  return (
    <main className="min-h-screen bg-slate-950 py-16 text-slate-300">
      <div className={SECTION}>
        <h1 className="mb-2 text-3xl font-bold text-white">Privacy Policy</h1>
        <p className="mb-8 text-sm text-slate-400">Last updated: 12 August 2026</p>

        <p className={P}>
          This website (swapnilumbarkarfitness.in) is operated by Swapnil
          Umbarkar (&ldquo;we&rdquo;, &ldquo;us&rdquo;). It offers a thyroid
          health assessment, a paid consultation booking, and a coaching
          programme. This policy explains what information we collect, why,
          who processes it, and how you can have it deleted.
        </p>

        <h2 className={H2}>Information we collect</h2>
        <ul className="list-disc pl-5">
          <li className={LI}>
            <strong className="text-slate-200">Contact details</strong> you
            submit with the assessment: name, WhatsApp number and email
            address.
          </li>
          <li className={LI}>
            <strong className="text-slate-200">Assessment answers</strong>:
            your responses about thyroid diagnosis, medication, symptoms and
            related lifestyle questions, and the score computed from them.
          </li>
          <li className={LI}>
            <strong className="text-slate-200">Payment confirmation</strong>:
            when you pay for a consultation, our payment provider tells us the
            amount, status and a payment reference. We never see or store your
            card number, UPI PIN or banking credentials.
          </li>
          <li className={LI}>
            <strong className="text-slate-200">Usage data</strong>: standard
            analytics and advertising measurement data (pages viewed, ad
            interactions) collected via cookies and similar technologies.
          </li>
        </ul>

        <h2 className={H2}>How we use it</h2>
        <ul className="list-disc pl-5">
          <li className={LI}>To compute and show you your Thyroid Score.</li>
          <li className={LI}>
            To contact you on WhatsApp and email about your assessment,
            consultation booking, payment and programme — including reminders
            if you started but did not complete a booking.
          </li>
          <li className={LI}>To schedule and conduct your consultation.</li>
          <li className={LI}>
            To measure advertising performance so we can run ads efficiently.
          </li>
        </ul>
        <p className={P}>We do not sell your personal information to anyone.</p>

        <h2 className={H2}>Who processes it for us</h2>
        <p className={P}>
          We use a small number of service providers to run this site, each
          receiving only what its function requires: Vercel (website hosting),
          Google (spreadsheet storage of leads and messages), Meta&rsquo;s
          WhatsApp Business Platform (WhatsApp messages), Cashfree Payments
          (payment processing), Cal.com (consultation scheduling), and Meta
          advertising tools (ad measurement).
        </p>

        <h2 className={H2}>Retention</h2>
        <p className={P}>
          We keep your information for as long as needed to provide the
          services above and to meet legal and accounting obligations, after
          which it is deleted.
        </p>

        <h2 id="data-deletion" className={H2}>
          Your rights &amp; data deletion
        </h2>
        <p className={P}>
          You can ask us at any time to access, correct or delete the personal
          information we hold about you. To request deletion, contact us using
          either channel below and include the WhatsApp number or email you
          used on this site:
        </p>
        <ul className="list-disc pl-5">
          <li className={LI}>
            Email:{" "}
            <a
              href="mailto:fitnessbyswapnil@gmail.com"
              className="text-emerald-400 underline"
            >
              fitnessbyswapnil@gmail.com
            </a>{" "}
            with the subject &ldquo;Delete my data&rdquo;.
          </li>
          <li className={LI}>
            WhatsApp: message &ldquo;DELETE&rdquo; to +91&nbsp;79784&nbsp;60386.
          </li>
        </ul>
        <p className={P}>
          We will confirm and complete the deletion within 30 days, except for
          records we are legally required to retain (such as payment records).
        </p>

        <h2 className={H2}>Messaging consent</h2>
        <p className={P}>
          By submitting the assessment with your WhatsApp number, you agree to
          receive WhatsApp messages from us about your score, booking and
          programme. Reply &ldquo;STOP&rdquo; at any time and we will stop
          messaging you.
        </p>

        <h2 className={H2}>Contact</h2>
        <p className={P}>
          Questions about this policy: {" "}
          <a
            href="mailto:fitnessbyswapnil@gmail.com"
            className="text-emerald-400 underline"
          >
            fitnessbyswapnil@gmail.com
          </a>
          . If we update this policy, the date at the top changes.
        </p>
      </div>
    </main>
  );
}
