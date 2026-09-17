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
 *  1. The form is inside the first screen on a phone (390 wide).
 *  2. A sticky bar (phones) once the form has scrolled away.
 *  3. One modal per session: exit intent on desktop, 55% scroll on phones.
 *     Never after she has registered.
 *  4. A call to action after the symptoms, takeaways, agenda, proof, bonus and
 *     FAQ. Each scrolls to the form and puts the cursor in it.
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
  WEBINAR_START_ISO,
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

/** "Thursday", from the start time itself, so it can never disagree with it. */
const WEEKDAY = new Date(WEBINAR_START_ISO).toLocaleDateString("en-IN", { weekday: "long", timeZone: "Asia/Kolkata" });
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

function Cta({ label }: { label: string }) {
  return (
    <div className={s.cta}>
      <a
        href="#register"
        className={s.button}
        onClick={(e) => { e.preventDefault(); goToForm(); }}
      >
        {label}
      </a>
      <p className={s.ctaLine}>{CTA_LINE}</p>
    </div>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function WebinarClient() {
  const countdown = useCountdown();
  const closed = countdown !== null && countdown.state !== "before";

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
      {/* ── Hero ─────────────────────────────────────────────────────────── */}
      <section className={s.hero} aria-labelledby="wb-title">
        <div className={`${s.wrap} ${s.heroGrid}`}>
          <div className={s.heroWhen}>
            <span className={s.whenDate}>{WEBINAR_WHEN_LONG}</span>
            <span className={s.whenCount} aria-live="off">{countdown ? formatCountdown(countdown) : ""}</span>
          </div>

          <div className={s.heroCopy}>
            <p className={s.eyebrow}>Thyroid Fat Loss Masterclass</p>
            <h1 id="wb-title" className={s.h1}>
              How to lose weight with a slow thyroid, <span className={s.h1Quiet}>eating Indian home food.</span>
            </h1>
          </div>

          <div className={s.heroForm} id="register" ref={formRef} style={{ scrollMarginTop: 16 }}>
            <RegisterForm place="hero" submitLabel="Save my free seat" closed={closed} />
          </div>

          <div className={s.heroMore}>
            <p className={s.heroSub}>
              A free 90-minute class on {WEBINAR_METHOD}. No report needed to join.
            </p>
            <p className={s.host}>
              <strong>Swapnil Umbarkar</strong>
              Thyroid fat loss coach and Assistant Professor, KJ Somaiya. 100+ thyroid women coached.
            </p>
          </div>
        </div>
      </section>

      {/* ── Sound familiar ───────────────────────────────────────────────── */}
      <section className={s.section} aria-labelledby="wb-familiar">
        <div className={s.wrap}>
          <p className={s.label}>Sound familiar?</p>
          <h2 id="wb-familiar" className={s.h2}>You did everything right. The scale did not agree.</h2>
          <ul className={`${s.rows} ${s.rowsTwo}`}>
            {FAMILIAR.map((f) => <li key={f}>{f}</li>)}
          </ul>
          <p className={s.prose} style={{ fontStyle: "italic" }}>If two or more are you, this class was built for you.</p>
          <Cta label="Save my seat" />
        </div>
      </section>

      {/* ── Report: helpful, never required ──────────────────────────────── */}
      <section className={`${s.section} ${s.sectionRaised}`} style={{ paddingBlock: "clamp(28px,4vw,40px)" }}>
        <div className={`${s.wrap} ${s.narrow}`}>
          <p className={s.prose} style={{ margin: 0 }}>
            <strong>Have a thyroid report?</strong> Keep it next to you on {WEEKDAY} and I will show you what to look for on it. No report? Still come. I will tell you which tests to ask for.
          </p>
        </div>
      </section>

      {/* ── What you take away ───────────────────────────────────────────── */}
      <section className={s.section} aria-labelledby="wb-learn">
        <div className={s.wrap}>
          <p className={s.label}>What you take away</p>
          <h2 id="wb-learn" className={s.h2}>Four things nobody told you.</h2>
          <ol className={s.takeaways}>
            {LEARN.map((l, i) => (
              <li key={l.h}>
                <span className={s.takeNum} aria-hidden="true">{i + 1}</span>
                <div>
                  <h3 className={s.h3}>{l.h}</h3>
                  <p>{l.p}</p>
                </div>
              </li>
            ))}
          </ol>
          <Cta label="Reserve my seat" />
        </div>
      </section>

      {/* ── Agenda ───────────────────────────────────────────────────────── */}
      <section className={s.section} aria-labelledby="wb-agenda">
        <div className={s.wrap}>
          <p className={s.label}>The 90 minutes</p>
          <h2 id="wb-agenda" className={s.h2}>No filler. Here is the plan.</h2>
          <p className={s.prose}>
            The class follows {WEBINAR_METHOD}: the right tests to ask for, then the plate, then the week.
          </p>
          <ol className={s.agenda}>
            {RUN.map((r) => (
              <li key={r.t}>
                <span className={s.agendaTime}>{r.t}</span>
                <div>
                  <h3 className={s.h3}>{r.h}</h3>
                  <p>{r.p}</p>
                </div>
              </li>
            ))}
          </ol>
          <p className={s.small} style={{ marginTop: 20, maxWidth: "64ch" }}>
            The class teaches the plan. At the end I will mention my coaching if you want help running it. You can leave before that.
          </p>
          <Cta label="Send me the link" />
        </div>
      </section>

      {/* ── Fit ──────────────────────────────────────────────────────────── */}
      <section className={`${s.section} ${s.sectionRaised}`} aria-label="Who this class is for">
        <div className={`${s.wrap} ${s.fit}`}>
          <div>
            <h2 className={s.h3} style={{ fontSize: "var(--fs-lg)" }}>Come if</h2>
            <ul>
              {FOR_YOU.map((x) => (
                <li key={x}><span className={s.fitMark} aria-hidden="true">✓</span>{x}</li>
              ))}
            </ul>
          </div>
          <div className={s.fitSkip}>
            <h2 className={s.h3} style={{ fontSize: "var(--fs-lg)", color: "var(--text-2)" }}>Skip it if</h2>
            <ul>
              {NOT_FOR_YOU.map((x) => (
                <li key={x}><span className={s.fitMark} aria-hidden="true">×</span>{x}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Host ─────────────────────────────────────────────────────────── */}
      <section className={s.section} aria-labelledby="wb-host">
        <div className={s.wrap}>
          <p className={s.label}>Your host</p>
          <h2 id="wb-host" className={s.h2}>Swapnil Umbarkar</h2>
          <p className={s.small} style={{ margin: "12px 0 0" }}>
            Thyroid fat loss coach. Assistant Professor, KJ Somaiya. <strong style={{ color: "var(--text)" }}>100+ thyroid women coached.</strong>
          </p>
          <p className={s.prose} style={{ fontSize: "var(--fs-md)", lineHeight: 1.5, color: "var(--text)" }}>
            Most thyroid coaching starts with a diet plan. Mine starts with the right tests, then the plate, then the week, which is why I call it {WEBINAR_METHOD}.
            A plan built on the wrong reason fails by week six — and you have already lived that.
          </p>
          <p className={s.small} style={{ margin: "18px 0 0" }}>
            Certified: ACE, INFS, and AIHM Nutrition for Hashimoto&rsquo;s Thyroiditis.
          </p>
        </div>
      </section>

      {/* ── Proof ────────────────────────────────────────────────────────── */}
      <section className={s.section} aria-labelledby="wb-proof">
        <div className={s.wrap}>
          <p className={s.label}>From women I have coached</p>
          <h2 id="wb-proof" className={s.h2}>What changed for them.</h2>
          <p className={s.vary}>Results vary from person to person. These are their results, not a promise.</p>
          <ul className={s.cases}>
            {TRANSFORM.map((t) => (
              <li key={t.name}>
                <figure>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={t.src} alt={`${t.name}, two photos with her weight at each`} width={600} height={600} loading="lazy" decoding="async" />
                  <figcaption>
                    <strong>{t.name}</strong>
                    {t.story}
                  </figcaption>
                </figure>
              </li>
            ))}
          </ul>

          <h3 className={s.h3} style={{ marginTop: 48 }}>In their own words</h3>
          <ul className={s.proofStrip} aria-label="WhatsApp messages from clients">
            {PROOF.map((p) => (
              <li key={p.src}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.src} alt="WhatsApp message from a client" width={p.w} height={p.h} loading="lazy" decoding="async"
                  style={{ aspectRatio: `${p.w} / ${p.h}` }} />
              </li>
            ))}
          </ul>
          <Cta label="Save my seat" />
        </div>
      </section>

      {/* ── Bonus ────────────────────────────────────────────────────────── */}
      <section className={`${s.section} ${s.sectionRaised}`} aria-labelledby="wb-bonus">
        <div className={s.wrap}>
          <p className={s.label}>Free for everyone who attends</p>
          <h2 id="wb-bonus" className={s.h2}>The Thyroid Plate — 7 days of meals.</h2>
          <p className={s.prose}>
            A printable week of Indian meals with enough protein and fibre, and swaps for veg, egg and non-veg.
            Sent the moment the class ends, to everyone in the room.
          </p>
          <div className={s.price}>
            {THYROID_PLATE_PRICE_INR !== null && (
              <span className={s.priceWas}>
                <span className="sr-only">Price inside the coaching programme: </span>
                ₹{THYROID_PLATE_PRICE_INR.toLocaleString("en-IN")}
              </span>
            )}
            <span className={s.priceNow}>Free with your seat</span>
            {THYROID_PLATE_PRICE_INR !== null && (
              <span className={s.small}>Part of the coaching programme. Free to everyone who attends.</span>
            )}
          </div>
          <ul className={`${s.rows} ${s.rowsTwo}`}>
            {BONUS.map((x) => <li key={x}>{x}</li>)}
          </ul>
          <Cta label="Reserve my seat" />
        </div>
      </section>

      {/* ── FAQ ──────────────────────────────────────────────────────────── */}
      <section className={s.section} aria-labelledby="wb-faq">
        <div className={`${s.wrap} ${s.narrow}`}>
          <p className={s.label}>Before you ask</p>
          <h2 id="wb-faq" className={s.h2}>Questions.</h2>
          <div className={s.faq}>
            {FAQ.map((f) => (
              <details key={f.q}>
                <summary>{f.q}</summary>
                <p>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* ── Final ────────────────────────────────────────────────────────── */}
      <section className={`${s.section} ${s.final}`} aria-labelledby="wb-final">
        <div className={s.wrap}>
          <h2 id="wb-final" className={s.h2}>One evening. A plan that fits your body.</h2>
          <p className={s.prose}>Registration closes when we go live.</p>
          <Cta label="Send me the link" />
          <p className={s.cap}>
            I coach seven clients a month. That is the cap, and it is why this stays small.
          </p>
          <p className={s.disclaimer}>
            Educational content only. Nothing in this class is medical advice, and it does not replace your
            doctor or endocrinologist. Never change or stop thyroid medicine without your doctor.
          </p>
        </div>
      </section>

      {/* ── Sticky bar (phones) ──────────────────────────────────────────── */}
      {!closed && (
        <div
          className={`${s.bar} ${barShown ? s.barShown : ""} ${barShown && barAnimate ? s.barAnimate : ""}`}
          aria-hidden={!barShown}
          onAnimationEnd={() => setBarAnimate(false)}
        >
          <span className={s.barWhen}>
            <strong>{WEBINAR_WHEN_SHORT}</strong>
            {countdown ? formatCountdown(countdown) : "Free live class"}
          </span>
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

      {/* ── Modal ────────────────────────────────────────────────────────── */}
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
          <p className={s.modalWhen}>{WEBINAR_WHEN_LONG}. Free, 90 minutes.</p>
          {modalOpen && <RegisterForm place="modal" submitLabel="Save my free seat" closed={closed} />}
        </div>
      </dialog>
    </main>
  );
}
