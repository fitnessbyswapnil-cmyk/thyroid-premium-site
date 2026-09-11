"use client";

/**
 * /webinar — registration for the free live masterclass.
 *
 * The design is a warm editorial system, not the site's white-and-green: cream
 * ground, near-black and deep-teal bands alternating down the page, gold for
 * the live signal, vermilion for the one action. Sections alternate ground
 * colour deliberately — that rhythm is what carries the length, and flattening
 * it to white cards is what makes a long page read cheap.
 *
 * Language rule: short sentences, ordinary words. The reader is a woman in her
 * forties on a phone, often in her second language, and a clever phrase is one
 * more thing between her and the form.
 *
 * Proof is the same media the main site serves, at the same paths, with the
 * stories verbatim.
 */

import { useState } from "react";
import { WEBINAR_WHEN_SHORT, WEBINAR_WHEN_LONG } from "@/lib/webinar";
import { useTurnstile, TurnstileBox, postWithBotCheck } from "@/app/components/TurnstileWidget";

// ── Palette ───────────────────────────────────────────────────────────────────
const C = {
  cream: "#FBF7F0",
  creamDeep: "#F4EDE1",
  hair: "#E7DCC9",
  ink: "#17140F",
  inkSoft: "#221E18",
  teal: "#0E4C43",
  mint: "#7FC4B6",
  mintPale: "#B9D6CF",
  gold: "#C9922F",
  goldPale: "#E0B25C",
  fire: "#DE4B25",
  sand: "#D9D0C0",
  sandMute: "#A79D8B",
  line: "#DCD1BD",
};

// next/font hashes the family name, so the CSS variables set on the wrapper in
// page.tsx are the only reliable handle. The literal names stay as fallbacks
// for the moment before the font loads.
const DISPLAY = "var(--webinar-display), 'Bricolage Grotesque', system-ui, sans-serif";
const BODY = "var(--webinar-body), 'Instrument Sans', system-ui, -apple-system, sans-serif";

const CAL_LINK =
  "https://calendar.google.com/calendar/render?action=TEMPLATE" +
  "&text=" + encodeURIComponent("Free Thyroid Masterclass with Swapnil") +
  "&dates=20260917T143000Z/20260917T160000Z" +
  "&details=" + encodeURIComponent("Keep your last thyroid report (TSH, T3, T4) next to you.");

const LEARN = [
  { h: "Why eating less stops working", p: "When the thyroid slows, the body burns less too. So the gap you made closes. I will show you what to do instead." },
  { h: "The four numbers to ask for", p: "TSH alone is not enough. There are three more your doctor can test. I will tell you which, and why they matter." },
  { h: "The Indian plate that works", p: "Roti, dal, sabzi, curd. Same food, put together differently, so you get enough protein without eating things you hate." },
  { h: "Movement that does not wreck you", p: "More cardio is the wrong answer for a thyroid body. I will show you the weekly plan that actually helps." },
];
const FAMILIAR = [
  "You eat less than everyone at home, and you are still the heaviest",
  "Your report came back normal, but you do not feel normal",
  "You take the medicine and the weight still will not move",
  "You are tired by 4pm every single day",
  "You have tried keto, fasting and 1,200-calorie plans",
  "The weight comes off, then comes straight back",
];
const RUN = [
  { t: "0–15 min", h: "Why your report says normal", p: "What the numbers mean, and what they hide." },
  { t: "15–45 min", h: "The four blockers", p: "The reasons weight stops moving on a thyroid body." },
  { t: "45–70 min", h: "Your plate and your week", p: "Food and movement, built for an Indian home." },
  { t: "70–90 min", h: "Your questions", p: "Bring your report. I will read one live." },
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
const TRANSFORM = [
  { src: "/transformations/Vaidehi 1.png", name: "Vaidehi", story: "Balanced her thyroid naturally. Down from 72 kg to 60 kg." },
  { src: "/transformations/Surekha 3.png", name: "Surekha", story: "Bloating and afternoon tiredness, gone." },
  { src: "/transformations/Namrata 5.png", name: "Namrata", story: "16 kg down, and the all-day tiredness went with it." },
  { src: "/transformations/Heenal 7.png", name: "Heenal", story: "IT professional, Bengaluru. Her blocker was the root, not her diet." },
];
const PROOF = [
  "/whatsapp-proof/Shariya-Sultana.jpeg", "/whatsapp-proof/Pooja-Sharma.jpeg",
  "/whatsapp-proof/Priya-Shree.jpeg", "/whatsapp-proof/Ritika-Deshmukh.jpeg",
  "/whatsapp-proof/Sruthi-Reddy.jpeg", "/whatsapp-proof/Heenal R4.png",
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

const PAD = "clamp(52px,8vw,96px) clamp(20px,5vw,32px)";
const wrap: React.CSSProperties = { maxWidth: 1120, margin: "0 auto" };
const kicker = (color: string): React.CSSProperties => ({
  fontSize: 12, fontWeight: 600, letterSpacing: ".14em", textTransform: "uppercase", color,
});
const head = (color: string, size = "clamp(30px,5.4vw,46px)"): React.CSSProperties => ({
  fontFamily: DISPLAY, fontWeight: 800, fontSize: size, lineHeight: 1.05,
  letterSpacing: "-.03em", color, margin: "14px 0 0", textWrap: "balance",
});
const lede = (color: string): React.CSSProperties => ({
  fontSize: "clamp(16px,2.2vw,18px)", lineHeight: 1.6, color, margin: "16px 0 0", maxWidth: "38em",
});

export default function WebinarClient() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [med, setMed] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");
  // Bot check on registration: each one sends a paid WhatsApp. Inert unless
  // NEXT_PUBLIC_TURNSTILE_SITE_KEY was set at build time.
  const bot = useTurnstile("webinar_register");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (!name.trim()) { setErr("Please enter your name"); return; }
    if (digits.length !== 10) { setErr("Enter a 10-digit WhatsApp number"); return; }
    setErr(""); setBusy(true);
    try {
      const r = await postWithBotCheck(bot, "/api/webinar-register", { name: name.trim(), phone: digits, medication: med });
      if (!r.ok) throw new Error("failed");
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch { setErr("Something went wrong. Please try again."); }
    finally { setBusy(false); }
  }

  const input: React.CSSProperties = {
    width: "100%", boxSizing: "border-box", background: "#FFF", border: `1px solid ${C.line}`,
    borderRadius: 11, padding: 15, color: C.ink, fontSize: 17, outline: "none", fontFamily: BODY,
  };
  const fire: React.CSSProperties = {
    width: "100%", background: C.fire, color: "#FFF", border: "none", borderRadius: 11,
    padding: "18px 20px", fontSize: 17, fontWeight: 600, cursor: "pointer",
    letterSpacing: "-.01em", minHeight: 44, fontFamily: BODY,
  };

  const RegisterCard = (
    <div id="register" style={{
      background: C.cream, color: C.ink, borderRadius: 20,
      padding: "clamp(24px,4vw,34px)", boxShadow: "0 24px 60px -28px rgba(0,0,0,.7)",
    }}>
      {done ? (
        <div>
          <div style={kicker(C.teal)}>You are in</div>
          <h2 style={head(C.ink, "clamp(26px,4vw,34px)")}>Your seat is saved.</h2>
          <p style={{ ...lede(C.inkSoft), fontSize: 16 }}>
            <strong>{WEBINAR_WHEN_LONG}.</strong> Your joining link and reminders come on WhatsApp.
          </p>
          <div style={{ background: C.creamDeep, border: `1px solid ${C.hair}`, borderRadius: 13, padding: 16, marginTop: 18 }}>
            <strong style={{ fontSize: 15 }}>One thing before then</strong>
            <p style={{ fontSize: 15, lineHeight: 1.55, color: C.inkSoft, margin: "5px 0 0" }}>
              Find your last thyroid report (TSH, T3, T4) and keep it next to you. I will show you how to read it, live.
            </p>
          </div>
          <a href={CAL_LINK} target="_blank" rel="noreferrer" style={{ ...fire, display: "block", textAlign: "center", textDecoration: "none", marginTop: 14 }}>
            Add to my calendar
          </a>
        </div>
      ) : (
        <form onSubmit={submit}>
          <div style={kicker(C.teal)}>Save my seat</div>
          <h2 style={{ ...head(C.ink, "clamp(24px,3.4vw,30px)"), marginBottom: 4 }}>Two boxes. That is all.</h2>
          <p style={{ fontSize: 14.5, lineHeight: 1.55, color: "#6B6355", margin: "8px 0 20px" }}>
            {WEBINAR_WHEN_LONG}. Everything after this comes on WhatsApp.
          </p>
          <div style={{ display: "grid", gap: 13 }}>
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Your first name" style={input} />
            <div style={{ display: "flex" }}>
              <span style={{ ...input, width: "auto", borderRadius: "11px 0 0 11px", borderRight: 0, background: C.creamDeep, color: "#6B6355" }}>+91</span>
              <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric"
                placeholder="WhatsApp number" style={{ ...input, borderRadius: "0 11px 11px 0" }} />
            </div>
            <div>
              <div style={{ fontSize: 14, fontWeight: 600, color: C.ink, marginBottom: 8 }}>Are you taking thyroid medicine?</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["Yes", "No", "Not sure"].map((o) => (
                  <button key={o} type="button" onClick={() => setMed(o)} style={{
                    flex: 1, padding: "12px 8px", fontSize: 15, fontWeight: 600, borderRadius: 11, cursor: "pointer",
                    fontFamily: BODY, minHeight: 44,
                    border: `1.5px solid ${med === o ? C.teal : C.line}`,
                    background: med === o ? "rgba(14,76,67,.07)" : "#FFF",
                    color: med === o ? C.teal : "#6B6355",
                  }}>{o}</button>
                ))}
              </div>
            </div>
            {err && <div style={{ color: C.fire, fontSize: 14 }}>{err}</div>}
            <button type="submit" disabled={busy} style={fire}>
              {busy ? "Saving your seat…" : "Reserve my free seat →"}
            </button>
          </div>
          {/* Outside the grid so the invisible widget adds no gap. */}
          <TurnstileBox bot={bot} hint="One quick check. Tap the box and your seat is saved." hintColor="#6B6355" />
          <p style={{ fontSize: 12.5, color: "#6B6355", textAlign: "center", margin: "14px 0 0", lineHeight: 1.5 }}>
            Taught to 100+ women with a slow thyroid. No spam — reply stop any time.
          </p>
        </form>
      )}
    </div>
  );

  return (
    <main style={{ background: C.cream, color: C.ink, fontFamily: BODY, overflowX: "hidden" }}>
      <style>{`@keyframes pulseDot{0%,100%{opacity:1;transform:scale(1)}50%{opacity:.35;transform:scale(.75)}}`}</style>

      {/* Live bar */}
      <div style={{
        position: "sticky", top: 0, zIndex: 40, background: C.teal, color: C.cream,
        padding: "10px clamp(14px,4vw,28px)", display: "flex", flexWrap: "wrap",
        alignItems: "center", justifyContent: "center", gap: "6px 16px",
      }}>
        <span style={{ display: "flex", alignItems: "center", gap: 7 }}>
          <span style={{ width: 7, height: 7, borderRadius: "50%", background: C.gold, animation: "pulseDot 1.6s ease-in-out infinite", display: "block" }} />
          <span style={kicker(C.cream)}>Live · {WEBINAR_WHEN_SHORT}</span>
        </span>
        <span style={{ fontSize: 13, color: C.mintPale }}>Registration closes when we go live.</span>
      </div>

      {/* Hero */}
      <section style={{ background: C.ink, color: C.cream, padding: "clamp(36px,6vw,74px) clamp(20px,5vw,32px) clamp(48px,7vw,84px)" }}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(320px,1fr))", gap: "clamp(34px,5vw,60px)", alignItems: "start" }}>
          <div>
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, border: "1px solid rgba(251,247,240,.35)", borderRadius: 999, padding: "6px 13px 6px 10px", marginBottom: 22 }}>
              <span style={{ width: 6, height: 6, borderRadius: "50%", background: C.gold, display: "block" }} />
              <span style={kicker(C.cream)}>Free live masterclass · 90 min</span>
            </div>
            <h1 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: "clamp(38px,8.2vw,64px)", lineHeight: 1, letterSpacing: "-.035em", margin: 0, textWrap: "balance" }}>
              Your report says normal
              <span style={{ color: C.mint }}> and you still cannot lose weight.</span>
            </h1>
            <p style={{ fontSize: "clamp(17px,2.6vw,20px)", lineHeight: 1.5, color: C.sand, margin: "22px 0 0", maxWidth: "30em" }}>
              A free 90-minute class. Bring your last thyroid report — I will read one live.
            </p>
            <div style={{ display: "flex", alignItems: "center", gap: 14, marginTop: 30, paddingTop: 24, borderTop: "1px solid rgba(251,247,240,.16)" }}>
              <span style={{ width: 58, height: 58, borderRadius: "50%", flexShrink: 0, boxShadow: `0 0 0 2px ${C.gold}`, background: C.inkSoft, display: "grid", placeItems: "center", fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, color: C.gold }}>SU</span>
              <div>
                <div style={{ fontWeight: 600, fontSize: 16 }}>Swapnil Umbarkar</div>
                <div style={{ fontSize: 14, color: C.sandMute }}>Thyroid Fat Loss Coach · 100+ thyroid women coached</div>
              </div>
            </div>
          </div>
          {RegisterCard}
        </div>
      </section>

      {/* Checklist */}
      <section style={{ background: C.cream, padding: PAD }}>
        <div style={wrap}>
          <div style={kicker(C.fire)}>Sound familiar?</div>
          <h2 style={head(C.ink)}>You did everything right. The scale did not agree.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(300px,1fr))", gap: "12px 34px", marginTop: 30 }}>
            {FAMILIAR.map((f) => (
              <div key={f} style={{ display: "flex", gap: 13, alignItems: "flex-start", paddingBottom: 12, borderBottom: `1px solid ${C.hair}` }}>
                <span aria-hidden style={{ flex: "none", marginTop: 8, width: 7, height: 7, borderRadius: 99, background: C.gold }} />
                <span style={{ fontSize: 16.5, lineHeight: 1.5, color: C.inkSoft }}>{f}</span>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 16, color: "#5C5446", marginTop: 26, fontStyle: "italic" }}>If two or more are you, this class was built for you.</p>
        </div>
      </section>

      {/* Bring your report */}
      <section style={{ background: C.creamDeep, borderTop: `1px solid ${C.hair}`, borderBottom: `1px solid ${C.hair}`, padding: "clamp(26px,4vw,36px) clamp(20px,5vw,32px)" }}>
        <div style={{ ...wrap, display: "flex", gap: 14, alignItems: "center", justifyContent: "center", flexWrap: "wrap", textAlign: "center" }}>
          <span style={{ fontSize: 16.5, color: C.inkSoft, lineHeight: 1.5 }}>
            <strong>Before Thursday:</strong> find your last thyroid report and keep it next to you. I will show you what to look for on it, live.
          </span>
        </div>
      </section>

      {/* What you learn */}
      <section style={{ background: C.teal, color: C.cream, padding: PAD }}>
        <div style={wrap}>
          <div style={kicker(C.mint)}>What you take away</div>
          <h2 style={head(C.cream)}>Four things nobody told you.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: 1, marginTop: 34, background: "rgba(251,247,240,.16)" }}>
            {LEARN.map((l, i) => (
              <div key={l.h} style={{ background: C.teal, padding: "26px 22px" }}>
                <div style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 30, color: C.goldPale, lineHeight: 1 }}>{String(i + 1).padStart(2, "0")}</div>
                <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, letterSpacing: "-.02em", margin: "12px 0 8px" }}>{l.h}</h3>
                <p style={{ fontSize: 15.5, lineHeight: 1.55, color: C.mintPale, margin: 0 }}>{l.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Agenda */}
      <section style={{ background: C.cream, borderBottom: `1px solid ${C.hair}`, padding: PAD }}>
        <div style={wrap}>
          <div style={kicker(C.fire)}>The 90 minutes</div>
          <h2 style={head(C.ink)}>No filler. Here is the plan.</h2>
          <div style={{ marginTop: 30 }}>
            {RUN.map((r) => (
              <div key={r.t} style={{ display: "flex", gap: "clamp(16px,3vw,34px)", alignItems: "flex-start", padding: "20px 0", borderTop: `1px solid ${C.hair}` }}>
                <span style={{ flex: "none", fontSize: 13.5, fontWeight: 600, color: C.fire, minWidth: 88, paddingTop: 3, letterSpacing: ".02em" }}>{r.t}</span>
                <div>
                  <strong style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 19, letterSpacing: "-.02em", color: C.ink }}>{r.h}</strong>
                  <p style={{ fontSize: 15.5, lineHeight: 1.55, color: "#5C5446", margin: "5px 0 0" }}>{r.p}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ fontSize: 14.5, color: "#6B6355", marginTop: 22, lineHeight: 1.55 }}>
            The class teaches the plan. At the end I will mention my coaching if you want help running it. You can leave before that.
          </p>
        </div>
      </section>

      {/* Fit */}
      <section style={{ background: C.creamDeep, borderBottom: `1px solid ${C.hair}`, padding: PAD }}>
        <div style={{ ...wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(290px,1fr))", gap: "clamp(24px,4vw,44px)" }}>
          <div>
            <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, color: C.teal, margin: "0 0 16px", letterSpacing: "-.02em" }}>Come if</h3>
            {FOR_YOU.map((x) => (
              <p key={x} style={{ fontSize: 16, lineHeight: 1.5, color: C.inkSoft, margin: "0 0 12px", paddingLeft: 20, position: "relative" }}>
                <span aria-hidden style={{ position: "absolute", left: 0, color: C.teal, fontWeight: 700 }}>✓</span>{x}
              </p>
            ))}
          </div>
          <div>
            <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 22, color: "#6B6355", margin: "0 0 16px", letterSpacing: "-.02em" }}>Skip it if</h3>
            {NOT_FOR_YOU.map((x) => (
              <p key={x} style={{ fontSize: 16, lineHeight: 1.5, color: "#5C5446", margin: "0 0 12px", paddingLeft: 20, position: "relative" }}>
                <span aria-hidden style={{ position: "absolute", left: 0, color: C.sandMute }}>×</span>{x}
              </p>
            ))}
          </div>
        </div>
      </section>

      {/* Host */}
      <section style={{ background: C.cream, borderBottom: `1px solid ${C.hair}`, padding: PAD }}>
        <div style={wrap}>
          <div style={kicker(C.fire)}>Your host</div>
          <h2 style={head(C.ink)}>Swapnil Umbarkar</h2>
          <p style={{ fontSize: 15, color: "#6B6355", margin: "14px 0 0", letterSpacing: ".01em" }}>
            Thyroid Fat Loss Coach · Assistant Professor, KJ Somaiya · <strong style={{ color: C.ink }}>100+ thyroid women coached</strong>
          </p>
          <p style={{ ...lede(C.inkSoft), fontSize: "clamp(17px,2.4vw,20px)" }}>
            Most thyroid coaching starts with a diet plan. Mine starts with your blood report.
            A plan built on the wrong reason fails by week six — and you have already lived that.
          </p>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 22 }}>
            {["ACE", "INFS", "AIHM"].map((c) => (
              <span key={c} style={{ padding: "7px 14px", borderRadius: 999, border: `1px solid ${C.line}`, fontSize: 12.5, fontWeight: 600, color: "#5C5446", letterSpacing: ".08em" }}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <section style={{ background: C.ink, color: C.cream, padding: PAD }}>
        <div style={wrap}>
          <div style={kicker(C.goldPale)}>From women I have coached</div>
          <h2 style={head(C.cream)}>What changed for them.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(230px,1fr))", gap: 16, marginTop: 34 }}>
            {TRANSFORM.map((t) => (
              <figure key={t.name} style={{ margin: 0 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.src} alt={`${t.name}, before and after`} loading="lazy"
                  style={{ width: "100%", borderRadius: 14, display: "block", border: "1px solid rgba(251,247,240,.14)" }} />
                <figcaption style={{ marginTop: 12 }}>
                  <strong style={{ fontSize: 15.5 }}>{t.name}</strong>
                  <p style={{ fontSize: 14.5, lineHeight: 1.5, color: C.sandMute, margin: "4px 0 0" }}>{t.story}</p>
                </figcaption>
              </figure>
            ))}
          </div>
          <h3 style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 20, margin: "40px 0 14px", letterSpacing: "-.02em" }}>In their own words</h3>
          <div style={{ display: "flex", gap: 14, overflowX: "auto", paddingBottom: 10 }}>
            {PROOF.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="Message from a client" loading="lazy"
                style={{ height: 320, borderRadius: 14, border: "1px solid rgba(251,247,240,.14)", flex: "none" }} />
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: C.sandMute, marginTop: 12 }}>Results are different for every person.</p>
        </div>
      </section>

      {/* Bonus */}
      <section style={{ background: C.cream, borderBottom: `1px solid ${C.hair}`, padding: PAD }}>
        <div style={wrap}>
          <div style={kicker(C.fire)}>Free for everyone who attends</div>
          <h2 style={head(C.ink)}>The Thyroid Plate — 7 days of meals.</h2>
          <p style={lede(C.inkSoft)}>
            A printable week of Indian meals with enough protein and fibre, and swaps for veg, egg and non-veg.
            Sent the moment the class ends, to everyone in the room.
          </p>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(260px,1fr))", gap: "10px 30px", marginTop: 26 }}>
            {BONUS.map((x) => (
              <div key={x} style={{ display: "flex", gap: 12, alignItems: "flex-start", paddingBottom: 11, borderBottom: `1px solid ${C.hair}` }}>
                <span aria-hidden style={{ flex: "none", marginTop: 7, width: 6, height: 6, borderRadius: 99, background: C.gold }} />
                <span style={{ fontSize: 15.5, lineHeight: 1.5, color: C.inkSoft }}>{x}</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ background: C.creamDeep, padding: PAD }}>
        <div style={{ ...wrap, maxWidth: 760 }}>
          <div style={kicker(C.fire)}>Before you ask</div>
          <h2 style={head(C.ink)}>Questions.</h2>
          <div style={{ marginTop: 26 }}>
            {FAQ.map((f) => (
              <details key={f.q} style={{ borderTop: `1px solid ${C.hair}`, padding: "18px 0" }}>
                <summary style={{ fontFamily: DISPLAY, fontWeight: 800, fontSize: 17.5, letterSpacing: "-.015em", color: C.ink, cursor: "pointer", listStyle: "none" }}>{f.q}</summary>
                <p style={{ fontSize: 15.5, lineHeight: 1.6, color: "#5C5446", margin: "10px 0 0" }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Final CTA */}
      <section style={{ background: C.ink, color: C.cream, padding: "clamp(56px,9vw,104px) clamp(20px,5vw,32px)", textAlign: "center" }}>
        <div style={{ maxWidth: 660, margin: "0 auto" }}>
          <h2 style={{ ...head(C.cream, "clamp(30px,6vw,50px)"), margin: 0 }}>One evening. A plan that fits your body.</h2>
          <p style={{ fontSize: "clamp(16px,2.2vw,18px)", lineHeight: 1.55, color: C.sand, margin: "18px auto 0", maxWidth: "34em" }}>
            {WEBINAR_WHEN_LONG} · Free. Registration closes when we go live.
          </p>
          <a href="#register" style={{ ...fire, display: "inline-block", width: "auto", padding: "18px 34px", textDecoration: "none", marginTop: 26 }}>
            Save my seat →
          </a>
          <p style={{ fontSize: 13.5, color: C.sandMute, marginTop: 20 }}>
            I coach seven clients a month. That is the cap, and it is why this stays small.
          </p>
          <p style={{ fontSize: 12, color: "#6B6355", marginTop: 34, lineHeight: 1.7 }}>
            Educational content only. Nothing in this class is medical advice, and it does not replace your
            doctor or endocrinologist. Never change or stop thyroid medicine without your doctor.
          </p>
        </div>
      </section>
    </main>
  );
}
