"use client";

/**
 * /webinar — registration for the free live masterclass.
 *
 * The copy is the page that was already live and is deliberate: the symptom
 * list, the four takeaways, the agenda, come-if / skip-it-if, the bio, the
 * proof, the bonus, the FAQ and the disclaimer. What changed is the mechanics
 * around it, and the angle: since 15-Sep-2026 this is a general thyroid
 * fat-loss class, titled "Thyroid Fat Loss Masterclass" (owner's choice,
 * 17-Sep-2026): the headline says what she gets, not why she is stuck. A
 * report helps and is never required, so nothing on the page may read as if
 * she needs one to register or to attend. Never "naturally": in this niche it
 * reads as "without medicine".
 *
 * Design: "Case Notes", the owner's Claude Design mobile build (17-Sep-2026).
 * One column; desktop is the same column centred at 480. Proof sits directly
 * under the symptoms, where cold traffic needs it.
 *
 *  1. The form is inside the first screen on a phone (375 and 390 wide).
 *  2. A sticky bar (phones) once the form has scrolled away.
 *  3. One modal per session: exit intent on desktop, 55% scroll on phones.
 *     Never after she has registered.
 *  4. A call to action after the symptoms, proof, takeaways, agenda, bonus and
 *     in the closing section. Each scrolls to the form and focuses it.
 *  5. The approach is named, in exactly three places (WEBINAR_METHOD).
 *  6. The bonus shows its price inside the programme, once one is set.
 *  7. The real date, a countdown to the fixed start time, and the real coaching
 *     cap. No seat counter, no "people registered in the last hour".
 *
 * Language rule: short sentences, ordinary words. The reader is a woman in her
 * forties on a phone, often in her second language. No exclamation marks, no
 * emoji. Meta reviews this page, not only the ad: nothing here may promise to
 * reverse, cure or fix a thyroid condition, touch medication, or assert
 * anything about her body. lib/webinar-page.test.ts checks the banned phrases.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import {
  WEBINAR_WHEN_LONG,
  WEBINAR_WHEN_SHORT,
  WEBINAR_WEEKDAY,
  WEBINAR_METHOD,
  THYROID_PLATE_PRICE_INR,
  countdownTo,
  formatCountdown,
  type Countdown,
} from "@/lib/webinar";
import RegisterForm from "./RegisterForm";
import { hasRegistered, trackWebinarView } from "./pixel";
import s from "./webinar.module.css";

// ── Copy (kept from the live page) ────────────────────────────────────────────

const FAMILIAR = [
  "You eat less than everyone at home, and you are still the heaviest",
  "Your report came back normal, but you do not feel normal",
  "You take the medicine and the weight still will not move",
  "You are tired by 4pm every single day",
  "You have tried keto, fasting and 1,200-calorie plans",
  "The weight comes off, then comes straight back",
];
const LEARN = [
  { h: "Why eating less stops working", p: "When the thyroid slows, the body burns less too. So the gap you made closes. I will show you what to do instead." },
  { h: "The four numbers to ask for", p: "TSH alone is not enough. There are three more your doctor can test. I will tell you which, and why they matter." },
  { h: "The Indian plate that works", p: "Roti, dal, sabzi, curd. Same food, put together differently, so you get enough protein without eating things you hate." },
  { h: "Movement that does not wreck you", p: "More cardio is the wrong answer for a thyroid body. I will show you the weekly plan that actually helps." },
];
const RUN = [
  { t: "0–15 min", h: "Why the weight will not move", p: "What a slow thyroid changes, and what the numbers on a report mean." },
  { t: "15–45 min", h: "The four blockers", p: "The reasons weight stops moving on a thyroid body." },
  { t: "45–70 min", h: "Your plate and your week", p: "Food and movement, built for an Indian home." },
  { t: "70–90 min", h: "Your questions", p: "Ask anything. If you have a report with you, I will read one live." },
];
const FOR_YOU = [
  "You have a thyroid problem and the weight will not shift",
  "You were told recently and do not know where to start",
  "You have tried many diets and stalled on all of them",
  "You want something you can follow for a year, not 21 days",
];
const NOT_FOR_YOU = [
  "You want me to tell you to stop your thyroid medicine",
  "You are not willing to get a blood test",
  "You want a supplement that burns fat while you sleep",
  "You need 10 kg gone before a wedding next month",
];
/**
 * Square crops of the same images the main site serves (public/transformations),
 * cut to the photos, the weights and the name. The original files also carry a
 * printed caption ("balanced her thyroid naturally", "reversed hair loss caused
 * by thyroid issues", "Fixed Her Hormonal Imbalance") that this page may not
 * show, because Meta reads text inside images too. Regenerate with the same
 * crop (x 0, y 220, 1080 × 1080) if a source image changes.
 */
const TRANSFORM = [
  { src: "/webinar/vaidehi.webp", name: "Vaidehi", story: "Down from 72 kg to 60 kg." },
  { src: "/webinar/surekha.webp", name: "Surekha", story: "Bloating and afternoon tiredness, gone." },
  { src: "/webinar/namrata.webp", name: "Namrata", story: "16 kg down, and the all-day tiredness went with it." },
  { src: "/webinar/heenal.webp", name: "Heenal", story: "IT professional, Bengaluru. Her blocker was the root, not her diet." },
];
/**
 * "Heenal R4" is deliberately absent. Its printed headline and the coach's own
 * reply in it ("reversing this naturally without meds") break both the reversal
 * and the medication rule. Do not add it back to this page.
 */
const COACH = "/webinar/coach.webp";
const COACH_SMALL = "/webinar/coach-sm.webp";

const PROOF = [
  { src: "/webinar/proof-shariya.webp", w: 303, h: 640 },
  { src: "/webinar/proof-pooja.webp", w: 360, h: 640 },
  { src: "/webinar/proof-priya.webp", w: 427, h: 640 },
  { src: "/webinar/proof-ritika.webp", w: 345, h: 640 },
  { src: "/webinar/proof-sruthi.webp", w: 302, h: 640 },
];
const BONUS = [
  "7 days of breakfast, lunch, dinner and two snacks",
  "Protein in katori and spoon measures, not grams you have to guess",
  "A swap list for eating out and travel days",
  "When to take your thyroid medicine around meals",
];
const FAQ = [
  { q: "Is it really free?", a: "Yes. The full 90 minutes is free. At the end I will mention my coaching if you want help, and you can leave before that." },
  { q: "What if I cannot come live?", a: "Come live if you can — I answer questions and read reports on the call. The replay goes only to people who attend." },
  { q: "Do I need my blood report?", a: "Bring it if you have one. If you do not, still come. I will tell you exactly which tests to ask for." },
  { q: "Will you tell me to stop my medicine?", a: "No. Never. I do not touch your medication and I do not sell supplements." },
  { q: "I am not diagnosed. Should I come?", a: "Yes. Symptoms show up long before a report goes abnormal. That gap is where most women get stuck." },
];

const WEEKDAY = WEBINAR_WEEKDAY;
const CTA_LINE = `${WEBINAR_WHEN_LONG}. Free.`;

const MODAL_KEY = "webinar_modal_shown";
const MOBILE_SCROLL_DEPTH = 0.55;

// ── Hooks ─────────────────────────────────────────────────────────────────────

/** Null until mounted, so the server HTML and the first client render agree. */
function useCountdown(): Countdown | null {
  const [c, setC] = useState<Countdown | null>(null);
  useEffect(() => {
    const tick = () => setC(countdownTo(Date.now()));
    tick();
    const id = window.setInterval(tick, 20000);
    document.addEventListener("visibilitychange", tick);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", tick);
    };
  }, []);
  return c;
}

const reducedMotion = () =>
  typeof window !== "undefined" && window.matchMedia("(prefers-reduced-motion: reduce)").matches;

/** Scroll to the hero form and put the cursor in the number field. */
function goToForm() {
  const input = document.getElementById("wb-phone-hero") as HTMLInputElement | null;
  const target = document.getElementById("register");
  if (!target) return;
  // Focus inside the tap itself: iOS only opens the keyboard for a focus that
  // happens during the user's gesture.
  input?.focus({ preventScroll: true });
  target.scrollIntoView({ behavior: reducedMotion() ? "instant" : "smooth", block: "start" });
}

function Cta({ label, sub = CTA_LINE }: { label: string; sub?: string }) {
  return (
    <div className={s.cta}>
      <a
        href="#register"
        className={s.button}
        onClick={(e) => { e.preventDefault(); goToForm(); }}
      >
        {label}
      </a>
      <p className={s.small}>{sub}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

function Mark({ children, hero = false }: { children: React.ReactNode; hero?: boolean }) {
  return (
    <div className={`${s.mark} ${hero ? s.markHero : ""}`}>
      <p>{children}</p>
    </div>
  );
}

export default function WebinarClient() {
  const countdown = useCountdown();
  const closed = countdown !== null && countdown.state !== "before";
  const countdownText = countdown ? formatCountdown(countdown) : "";

  const formRef = useRef<HTMLDivElement>(null);
  const [barShown, setBarShown] = useState(false);
  const [barAnimate, setBarAnimate] = useState(false);
  const barSeen = useRef(false);

  const dialogRef = useRef<HTMLDialogElement>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => { trackWebinarView(); }, []);

  // Sticky bar: shown once the form has scrolled up out of view, hidden while
  // it is on screen. Below the form only — not before she has seen it.
  useEffect(() => {
    const el = formRef.current;
    if (!el || typeof IntersectionObserver === "undefined") return;
    const io = new IntersectionObserver(([entry]) => {
      const past = !entry.isIntersecting && entry.boundingClientRect.top < 0;
      setBarShown(past);
      if (past && !barSeen.current) {
        barSeen.current = true;
        setBarAnimate(true);
      }
    });
    io.observe(el);
    return () => io.disconnect();
  }, []);

  const openModal = useCallback(() => {
    const d = dialogRef.current;
    if (!d || d.open) return;
    try {
      if (sessionStorage.getItem(MODAL_KEY)) return;
      sessionStorage.setItem(MODAL_KEY, "1");
    } catch {
      return; // no session storage means no way to keep it to once: never show it
    }
    setModalOpen(true);
    d.showModal();
  }, []);

  // Modal triggers. Once per session, never after registering, never once the
  // session has started, and never while she is typing into the hero form.
  useEffect(() => {
    if (closed) return;
    let seen = false;
    try { seen = !!sessionStorage.getItem(MODAL_KEY); } catch { seen = true; }
    if (seen || hasRegistered()) return;

    const busyInForm = () => {
      const a = document.activeElement;
      const phone = document.getElementById("wb-phone-hero") as HTMLInputElement | null;
      return (!!a && !!formRef.current?.contains(a)) || !!phone?.value.trim();
    };
    const tryOpen = () => {
      if (hasRegistered() || busyInForm()) return;
      openModal();
      cleanup();
    };

    const desktop = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
    let armed = false;
    const armTimer = window.setTimeout(() => { armed = true; }, 4000);

    const onMouseOut = (e: MouseEvent) => {
      if (!armed || e.relatedTarget || e.clientY > 0) return;
      tryOpen();
    };
    const onScroll = () => {
      const doc = document.documentElement;
      const depth = (window.scrollY + window.innerHeight) / doc.scrollHeight;
      if (depth >= MOBILE_SCROLL_DEPTH) tryOpen();
    };

    function cleanup() {
      window.clearTimeout(armTimer);
      document.removeEventListener("mouseout", onMouseOut);
      window.removeEventListener("scroll", onScroll);
    }
    if (desktop) document.addEventListener("mouseout", onMouseOut);
    else window.addEventListener("scroll", onScroll, { passive: true });
    return cleanup;
  }, [closed, openModal]);

  const closeModal = () => {
    dialogRef.current?.close();
  };

  return (
    <main className={s.page}>
      <div className={s.column}>
        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <section className={s.hero} aria-labelledby="wb-title">
          <Mark hero>Thyroid Fat Loss Masterclass</Mark>
          <h1 id="wb-title" className={s.h1}>
            How to lose weight with a slow thyroid, <span>eating Indian home food.</span>
          </h1>

          <div id="register" ref={formRef} style={{ scrollMarginTop: 16 }}>
            <RegisterForm
              place="hero"
              submitLabel="Save my free seat"
              closed={closed}
              head={{ when: WEBINAR_WHEN_LONG, countdown: countdownText }}
            />
          </div>

          <p className={s.heroSub}>A free 90-minute class on {WEBINAR_METHOD}. No report needed to join.</p>
          <div className={s.host}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={COACH_SMALL} alt="" width={52} height={52} decoding="async" />
            <p>Swapnil Umbarkar. Thyroid fat loss coach and Assistant Professor, KJ Somaiya. 100+ thyroid women coached.</p>
          </div>
        </section>

        {/* ── Sound familiar ─────────────────────────────────────────────── */}
        <div className={s.alt}>
          <section className={s.section} style={{ paddingBottom: 40 }} aria-labelledby="wb-familiar">
            <Mark>Sound familiar?</Mark>
            <h2 id="wb-familiar" className={s.h2}>You did everything right. The scale did not agree.</h2>
            <div className={s.rows}>
              {FAMILIAR.map((f) => <p key={f}>{f}</p>)}
            </div>
            <p className={s.serifLine} style={{ marginTop: 24 }}>If two or more are you, this class was built for you.</p>
          </section>
          <Cta label="Save my seat" />
        </div>

        {/* ── Proof ──────────────────────────────────────────────────────── */}
        <section className={`${s.section} ${s.proof}`} aria-labelledby="wb-proof">
          <div className={s.proofInner}>
            <Mark>From women I have coached</Mark>
            <h2 id="wb-proof" className={s.h2}>What changed for them.</h2>
            <p className={s.vary}>Results vary from person to person. These are their results, not a promise.</p>
            <ul className={s.cases}>
              {TRANSFORM.map((t) => (
                <li key={t.name}>
                  <figure>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={t.src} alt={`${t.name}, two photos with her weight at each`} width={600} height={600} loading="lazy" decoding="async" />
                    <figcaption>{t.name}: {t.story}</figcaption>
                  </figure>
                </li>
              ))}
            </ul>
            <h3 className={s.stripHead}>In their own words</h3>
          </div>
          <ul className={s.strip} aria-label="WhatsApp messages from clients">
            {PROOF.map((p) => (
              <li key={p.src}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="WhatsApp message from a client" width={p.w} height={p.h} loading="lazy" decoding="async"
                  style={{ aspectRatio: `${p.w} / ${p.h}` }} />
              </li>
            ))}
          </ul>
        </section>
        <div style={{ paddingTop: 8 }}>
          <Cta label="Send me the link" />
        </div>

        {/* ── Report: helpful, never required ────────────────────────────── */}
        <p className={s.reportNote}>
          Have a thyroid report? Keep it next to you on {WEEKDAY} and I will show you what to look for on it. No report? Still come. I will tell you which tests to ask for.
        </p>

        {/* ── What you take away ─────────────────────────────────────────── */}
        <section className={s.section} style={{ paddingBottom: 20 }} aria-labelledby="wb-learn">
          <Mark>What you take away</Mark>
          <h2 id="wb-learn" className={s.h2} style={{ marginBottom: 32 }}>Four things nobody told you.</h2>
          <ol className={s.takeaways}>
            {LEARN.map((l, i) => (
              <li key={l.h}>
                <span className={s.num} aria-hidden="true">{i + 1}</span>
                <div>
                  <h3 className={s.itemHead}>{l.h}.</h3>
                  <p>{l.p}</p>
                </div>
              </li>
            ))}
          </ol>
        </section>
        <Cta label="Reserve my seat" />

        {/* ── Agenda ─────────────────────────────────────────────────────── */}
        <div className={s.alt}>
          <section className={s.section} style={{ paddingBottom: 36 }} aria-labelledby="wb-agenda">
            <Mark>The 90 minutes</Mark>
            <h2 id="wb-agenda" className={s.h2} style={{ marginBottom: 16 }}>No filler. Here is the plan.</h2>
            <p className={s.lead}>
              The class follows {WEBINAR_METHOD}: the right tests to ask for, then the plate, then the week.
            </p>
            <ol className={s.agenda}>
              {RUN.map((r) => (
                <li key={r.t}>
                  <span className={s.time}>{r.t}</span>
                  <h3 className={s.itemHead}>{r.h}.</h3>
                  <p>{r.p}</p>
                </li>
              ))}
            </ol>
            <p className={s.agendaNote}>
              The class teaches the plan. At the end I will mention my coaching if you want help running it. You can leave before that.
            </p>
          </section>
          <Cta label="Save my seat" />
        </div>

        {/* ── Fit ────────────────────────────────────────────────────────── */}
        <section className={s.section} aria-label="Who this class is for">
          <h2 className={s.fitHead}>Come if</h2>
          <ul className={`${s.fitList} ${s.fitCome}`}>
            {FOR_YOU.map((x) => <li key={x}>{x}</li>)}
          </ul>
          <h2 className={s.fitHead} style={{ marginTop: 36, color: "var(--ink-72)" }}>Skip it if</h2>
          <ul className={`${s.fitList} ${s.fitSkip}`}>
            {NOT_FOR_YOU.map((x) => <li key={x}>{x}</li>)}
          </ul>
        </section>

        {/* ── Host ───────────────────────────────────────────────────────── */}
        <section className={`${s.section} ${s.alt}`} aria-labelledby="wb-host">
          <div style={{ marginBottom: 24 }}><Mark>Your host</Mark></div>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img className={s.portrait} src={COACH} alt="Swapnil Umbarkar" width={684} height={684} loading="lazy" decoding="async" />
          <h2 id="wb-host" className={`${s.h2} ${s.hostName}`}>Swapnil Umbarkar</h2>
          <p className={s.hostMeta}>Thyroid fat loss coach and Assistant Professor, KJ Somaiya. 100+ thyroid women coached.</p>
          <p className={s.hostBody}>
            Most thyroid coaching starts with a diet plan. Mine starts with the right tests, then the plate, then the week, which is why I call it {WEBINAR_METHOD}.
            A plan built on the wrong reason fails by week six — and you have already lived that.
          </p>
          <p className={s.certs}>Certifications: ACE, INFS, and AIHM Nutrition for Hashimoto&rsquo;s Thyroiditis.</p>
        </section>

        {/* ── Bonus ──────────────────────────────────────────────────────── */}
        <section className={s.section} style={{ paddingBottom: 36 }} aria-labelledby="wb-bonus">
          <div className={s.bonusHead}>
            <Mark>Free for everyone who attends</Mark>
            <p className={s.pill}>
              {THYROID_PLATE_PRICE_INR !== null && (
                <s>
                  <span className="sr-only">Price inside the coaching programme: </span>
                  ₹{THYROID_PLATE_PRICE_INR.toLocaleString("en-IN")}
                </s>
              )}
              Free with your seat
            </p>
          </div>
          <h2 id="wb-bonus" className={s.h2} style={{ marginBottom: 16 }}>The Thyroid Plate — 7 days of meals.</h2>
          <p className={s.lead}>
            A printable week of Indian meals with enough protein and fibre, and swaps for veg, egg and non-veg.
            Sent the moment the class ends, to everyone in the room.
          </p>
          <div className={`${s.rows} ${s.bonusRows}`}>
            {BONUS.map((x) => <p key={x}>{x}</p>)}
          </div>
        </section>
        <Cta label="Reserve my seat" />

        {/* ── FAQ ────────────────────────────────────────────────────────── */}
        <section className={s.section} style={{ paddingBottom: 40 }} aria-labelledby="wb-faq">
          <div style={{ marginBottom: 20 }}><Mark>Questions</Mark></div>
          <h2 id="wb-faq" className="sr-only">Questions</h2>
          <div className={s.faq}>
            {FAQ.map((f, i) => (
              <details key={f.q} open={i === 0}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </section>

        {/* ── Final ──────────────────────────────────────────────────────── */}
        <section className={`${s.section} ${s.alt} ${s.final}`} aria-labelledby="wb-final">
          <h2 id="wb-final" className={`${s.h2} ${s.finalHead}`}>One evening. A plan that fits your body.</h2>
          <p className={s.lead}>Registration closes when we go live.</p>
          <Cta label="Save my seat" sub={WEBINAR_WHEN_LONG} />
          <p className={s.cap}>I coach seven clients a month. That is the cap, and it is why this stays small.</p>
          <p className={s.disclaimer}>
            Educational content only. Nothing in this class is medical advice, and it does not replace your
            doctor or endocrinologist. Never change or stop thyroid medicine without your doctor.
          </p>
        </section>
      </div>

      {/* ── Sticky bar ───────────────────────────────────────────────────── */}
      {!closed && (
        <div
          className={`${s.bar} ${barShown ? s.barShown : ""} ${barShown && barAnimate ? s.barAnimate : ""}`}
          aria-hidden={!barShown}
          onAnimationEnd={() => setBarAnimate(false)}
        >
          <div className={s.barWhen}>
            <p>{WEBINAR_WHEN_SHORT}</p>
            <p>{countdownText || "Free live class"}</p>
          </div>
          <a
            href="#register"
            className={s.button}
            tabIndex={barShown ? 0 : -1}
            onClick={(e) => { e.preventDefault(); goToForm(); }}
          >
            Save my seat
          </a>
        </div>
      )}

      {/* ── Pop-up ───────────────────────────────────────────────────────── */}
      <dialog
        ref={dialogRef}
        className={s.modal}
        aria-labelledby="wb-modal-title"
        onClose={() => setModalOpen(false)}
        onClick={(e) => { if (e.target === dialogRef.current) closeModal(); }}
      >
        <div className={s.modalInner}>
          <button type="button" className={s.close} onClick={closeModal} aria-label="Close">×</button>
          <h2 id="wb-modal-title" className={s.modalTitle}>Keep a seat for {WEEKDAY}?</h2>
          <p className={s.modalWhen}>{WEBINAR_WHEN_LONG}</p>
          {modalOpen && <RegisterForm place="modal" submitLabel="Save my free seat" closed={closed} />}
        </div>
      </dialog>
    </main>
  );
}
