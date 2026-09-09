"use client";

/**
 * /webinar — registration for the free live masterclass.
 *
 * Language rule for this page: short sentences, ordinary words. The reader is
 * a woman in her forties reading on a phone, often in her second language, and
 * every clever phrase is one more thing between her and the form. "What
 * actually changes in energy expenditure when thyroid output drops" became
 * "why eating less stops working" and lost nothing she needed.
 *
 * Proof is the same media the main site uses, at the same paths — one set of
 * assets, so a swap there is a swap here.
 */

import { useState } from "react";
import { WEBINAR_WHEN_SHORT, WEBINAR_WHEN_LONG } from "@/lib/webinar";

const CAL_LINK =
  "https://calendar.google.com/calendar/render?action=TEMPLATE" +
  "&text=" + encodeURIComponent("Free Thyroid Masterclass with Swapnil") +
  "&dates=20260917T143000Z/20260917T160000Z" +
  "&details=" + encodeURIComponent("Keep your last thyroid report (TSH, T3, T4) next to you.");

const LEARN = [
  { h: "Why eating less stops working", p: "When the thyroid slows down, the body burns less too. So the gap you made closes. I will show you what to do instead." },
  { h: "The four numbers to ask for", p: "TSH alone is not enough. There are three more your doctor can test. I will tell you which, and why they matter." },
  { h: "The Indian plate that works", p: "Roti, dal, sabzi, curd. Same food, put together differently, so you get enough protein without eating things you hate." },
  { h: "Movement that does not wreck you", p: "More cardio is the wrong answer for a thyroid body. I will show you the weekly plan that actually helps." },
];

const FAMILIAR = [
  "You eat less than everyone at home, and you are still the heaviest",
  "Your report came back normal, but you do not feel normal",
  "You are on medicine and the weight still will not move",
  "You are tired by 4pm every day",
  "You have tried keto, fasting and 1,200-calorie plans",
  "The weight comes off and then comes straight back",
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

const RUN = [
  { t: "0-15 min", h: "Why your report says normal", p: "What the numbers mean, and what they hide." },
  { t: "15-45 min", h: "The four blockers", p: "The reasons weight stops moving on a thyroid body." },
  { t: "45-70 min", h: "Your plate and your week", p: "Food and movement, built for an Indian home." },
  { t: "70-90 min", h: "Your questions", p: "Bring your report. I will read one live." },
];

const TRANSFORM = [
  { src: "/transformations/Vaidehi 1.png", name: "Vaidehi", story: "Balanced her thyroid naturally. Down from 72 kg to 60 kg." },
  { src: "/transformations/Surekha 3.png", name: "Surekha", story: "Bloating and afternoon tiredness, gone." },
  { src: "/transformations/Namrata 5.png", name: "Namrata", story: "16 kg down, and the all-day tiredness went with it." },
  { src: "/transformations/Heenal 7.png", name: "Heenal", story: "IT professional, Bengaluru. Her blocker was the root, not her diet." },
];

const PROOF = [
  "/whatsapp-proof/Shariya-Sultana.jpeg",
  "/whatsapp-proof/Pooja-Sharma.jpeg",
  "/whatsapp-proof/Priya-Shree.jpeg",
  "/whatsapp-proof/Ritika-Deshmukh.jpeg",
  "/whatsapp-proof/Sruthi-Reddy.jpeg",
  "/whatsapp-proof/Heenal R4.png",
];

const FAQ = [
  { q: "Is it really free?", a: "Yes. The full 90 minutes is free. At the end I will tell you about my coaching if you want help, and you can leave before that." },
  { q: "What if I cannot come live?", a: "Come live if you can — I answer questions and read reports on the call. The replay goes only to people who attend." },
  { q: "Do I need my blood report?", a: "Bring it if you have one. If you do not, still come — I will tell you exactly which tests to ask for." },
  { q: "Will you tell me to stop my medicine?", a: "No. Never. I do not touch your medication and I do not sell supplements." },
  { q: "I am not diagnosed. Should I come?", a: "Yes. Symptoms show up long before a report goes abnormal. That gap is where most women get stuck." },
];

export default function WebinarClient() {
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [med, setMed] = useState("");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState("");

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    const digits = phone.replace(/\D/g, "").slice(-10);
    if (!name.trim()) { setErr("Please enter your name"); return; }
    if (digits.length !== 10) { setErr("Enter a 10-digit WhatsApp number"); return; }
    setErr(""); setBusy(true);
    try {
      const r = await fetch("/api/webinar-register", {
        method: "POST", headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), phone: digits, medication: med }),
      });
      if (!r.ok) throw new Error("failed");
      setDone(true);
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch {
      setErr("Something went wrong. Please try again.");
    } finally { setBusy(false); }
  }

  const S = { wrap: { maxWidth: 820, margin: "0 auto", padding: "0 18px" } as React.CSSProperties };
  const eyebrow: React.CSSProperties = { fontSize: 12, fontWeight: 800, letterSpacing: ".12em", textTransform: "uppercase", color: "var(--p500)" };
  const h2: React.CSSProperties = { fontSize: 30, lineHeight: 1.18, fontWeight: 800, letterSpacing: "-.02em", color: "var(--t1)", margin: "0 0 14px", textWrap: "balance" };
  const p: React.CSSProperties = { fontSize: 16.5, lineHeight: 1.62, color: "var(--t2)", margin: 0 };
  const card: React.CSSProperties = { background: "#fff", border: "1px solid #e6e8ec", borderRadius: 16, padding: 20 };
  const section: React.CSSProperties = { padding: "44px 0" };

  if (done) {
    return (
      <main style={{ background: "var(--bg-page)", minHeight: "100vh" }}>
        <div style={{ ...S.wrap, padding: "70px 18px", textAlign: "center" }}>
          <div style={eyebrow}>You are in</div>
          <h1 style={{ ...h2, fontSize: 38, marginTop: 12 }}>Your seat is saved.</h1>
          <p style={{ ...p, maxWidth: 560, margin: "0 auto" }}>
            <strong>{WEBINAR_WHEN_LONG}.</strong> Your joining link and reminders come on WhatsApp —
            now, a day before, an hour before, and five minutes before we start.
          </p>
          <div style={{ ...card, maxWidth: 560, margin: "26px auto 0", textAlign: "left", background: "var(--p-subtle)", borderColor: "var(--p-border)" }}>
            <strong style={{ color: "var(--t1)" }}>One thing before then</strong>
            <p style={{ ...p, marginTop: 6, fontSize: 15.5 }}>
              Find your last thyroid report (TSH, T3, T4) and keep it next to you.
              I will show you how to read it, live.
            </p>
          </div>
          <a href={CAL_LINK} target="_blank" rel="noreferrer" className="cta-button" style={{ maxWidth: 300, margin: "22px auto 0", textDecoration: "none" }}>
            Add to my calendar
          </a>
        </div>
      </main>
    );
  }

  return (
    <main style={{ background: "var(--bg-page)" }}>
      {/* Hero */}
      <section style={{ ...section, paddingTop: 34 }}>
        <div style={{ ...S.wrap, textAlign: "center" }}>
          <div style={{ display: "inline-block", padding: "7px 15px", borderRadius: 999, background: "var(--p-subtle)", border: "1px solid var(--p-border)", ...eyebrow }}>
            Free live class · {WEBINAR_WHEN_SHORT}
          </div>
          <h1 style={{ fontSize: 40, lineHeight: 1.1, fontWeight: 800, letterSpacing: "-.03em", color: "var(--t1)", margin: "18px 0 0", textWrap: "balance" }}>
            Your report says normal.
            <span style={{ display: "block", color: "var(--p500)" }}>And you still cannot lose weight.</span>
          </h1>
          <p style={{ ...p, maxWidth: 620, margin: "16px auto 0" }}>
            A free 90-minute class for women with a slow thyroid. Bring your last blood report —
            I will read one live and show you what to look for.
          </p>
          <a href="#save" className="cta-button" style={{ maxWidth: 340, margin: "24px auto 0", textDecoration: "none" }}>
            Save my seat
            <span className="cta-sub">Free · 90 minutes · live</span>
          </a>
          <p style={{ fontSize: 13, color: "var(--t3)", marginTop: 12 }}>
            Swapnil Umbarkar · Thyroid Fat Loss Coach · 100+ thyroid women coached
          </p>
        </div>
      </section>

      {/* Form */}
      <section id="save" style={{ ...section, background: "var(--p-subtle)", borderTop: "1px solid var(--p-border)", borderBottom: "1px solid var(--p-border)" }}>
        <div style={{ ...S.wrap, maxWidth: 520 }}>
          <h2 style={{ ...h2, fontSize: 26, textAlign: "center" }}>Two boxes. That is all.</h2>
          <p style={{ ...p, textAlign: "center", fontSize: 15, marginBottom: 20 }}>
            {WEBINAR_WHEN_LONG}. Everything after this comes on WhatsApp.
          </p>
          <form onSubmit={submit} style={{ ...card, display: "flex", flexDirection: "column", gap: 14 }}>
            <label style={{ fontSize: 13.5, fontWeight: 700, color: "var(--t1)" }}>
              Your name
              <input value={name} onChange={(e) => setName(e.target.value)} placeholder="First name"
                style={{ width: "100%", marginTop: 6, padding: "13px 14px", fontSize: 16, borderRadius: 11, border: "1px solid #d7dbe2" }} />
            </label>
            <label style={{ fontSize: 13.5, fontWeight: 700, color: "var(--t1)" }}>
              WhatsApp number
              <div style={{ display: "flex", marginTop: 6 }}>
                <span style={{ padding: "13px 12px", fontSize: 16, borderRadius: "11px 0 0 11px", border: "1px solid #d7dbe2", borderRight: 0, background: "#f6f7f9", color: "var(--t2)" }}>+91</span>
                <input value={phone} onChange={(e) => setPhone(e.target.value)} inputMode="numeric" placeholder="10-digit number"
                  style={{ flex: 1, padding: "13px 14px", fontSize: 16, borderRadius: "0 11px 11px 0", border: "1px solid #d7dbe2" }} />
              </div>
              <span style={{ display: "block", fontWeight: 500, fontSize: 12.5, color: "var(--t3)", marginTop: 5 }}>
                Your joining link and reminders come here.
              </span>
            </label>
            <div>
              <div style={{ fontSize: 13.5, fontWeight: 700, color: "var(--t1)", marginBottom: 7 }}>Are you taking thyroid medicine?</div>
              <div style={{ display: "flex", gap: 8 }}>
                {["Yes", "No", "Not sure"].map((o) => (
                  <button key={o} type="button" onClick={() => setMed(o)}
                    style={{ flex: 1, padding: "11px 8px", fontSize: 14.5, fontWeight: 600, borderRadius: 11, cursor: "pointer",
                      border: `1.5px solid ${med === o ? "var(--p500)" : "#d7dbe2"}`,
                      background: med === o ? "var(--p-subtle)" : "#fff", color: med === o ? "var(--p600)" : "var(--t2)" }}>
                    {o}
                  </button>
                ))}
              </div>
            </div>
            {err && <div style={{ color: "#b91c1c", fontSize: 13.5 }}>{err}</div>}
            <button type="submit" disabled={busy} className="cta-button" style={{ width: "100%", marginTop: 4 }}>
              {busy ? "Saving your seat…" : "Save my free seat"}
            </button>
            <p style={{ fontSize: 12, color: "var(--t3)", textAlign: "center", margin: 0 }}>
              Taught to 100+ women with a slow thyroid. No spam — reply stop any time.
            </p>
          </form>
        </div>
      </section>

      {/* Sound familiar */}
      <section style={section}>
        <div style={S.wrap}>
          <div style={eyebrow}>Sound familiar?</div>
          <h2 style={h2}>You did everything right. The scale did not agree.</h2>
          <ul style={{ listStyle: "none", padding: 0, margin: "0 0 14px", display: "grid", gap: 10 }}>
            {FAMILIAR.map((f) => (
              <li key={f} style={{ display: "flex", gap: 11, alignItems: "flex-start", fontSize: 16, lineHeight: 1.55, color: "var(--t2)" }}>
                <span aria-hidden style={{ flex: "none", marginTop: 7, width: 8, height: 8, borderRadius: 99, background: "var(--p500)" }} />
                {f}
              </li>
            ))}
          </ul>
          <p style={{ ...p, fontSize: 15.5, fontStyle: "italic" }}>If two or more are you, this class was built for you.</p>
        </div>
      </section>

      {/* What you learn */}
      <section style={{ ...section, background: "#fafbfc", borderTop: "1px solid #eef0f3", borderBottom: "1px solid #eef0f3" }}>
        <div style={S.wrap}>
          <div style={eyebrow}>What you take away</div>
          <h2 style={h2}>Four things nobody told you.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 14 }}>
            {LEARN.map((l, i) => (
              <div key={l.h} style={card}>
                <div style={{ ...eyebrow, color: "var(--t3)" }}>{String(i + 1).padStart(2, "0")}</div>
                <h3 style={{ fontSize: 19, fontWeight: 700, margin: "7px 0 7px", color: "var(--t1)" }}>{l.h}</h3>
                <p style={{ ...p, fontSize: 15.5 }}>{l.p}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Run of show */}
      <section style={section}>
        <div style={S.wrap}>
          <div style={eyebrow}>The 90 minutes</div>
          <h2 style={h2}>No filler. Here is the plan.</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {RUN.map((r) => (
              <div key={r.t} style={{ ...card, display: "flex", gap: 16, alignItems: "flex-start", padding: 16 }}>
                <span style={{ flex: "none", fontSize: 13, fontWeight: 800, color: "var(--p500)", minWidth: 76 }}>{r.t}</span>
                <div>
                  <strong style={{ fontSize: 16.5, color: "var(--t1)" }}>{r.h}</strong>
                  <p style={{ ...p, fontSize: 15, marginTop: 3 }}>{r.p}</p>
                </div>
              </div>
            ))}
          </div>
          <p style={{ ...p, fontSize: 14.5, marginTop: 14, color: "var(--t3)" }}>
            The class teaches the plan. At the end I will mention my coaching if you want help running it. You can leave before that.
          </p>
        </div>
      </section>

      {/* For / not for */}
      <section style={{ ...section, background: "#fafbfc", borderTop: "1px solid #eef0f3", borderBottom: "1px solid #eef0f3" }}>
        <div style={{ ...S.wrap, display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(280px,1fr))", gap: 16 }}>
          <div style={card}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--p600)", margin: "0 0 12px" }}>Come if</h3>
            {FOR_YOU.map((x) => <p key={x} style={{ ...p, fontSize: 15.3, marginBottom: 9 }}>· {x}</p>)}
          </div>
          <div style={card}>
            <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--t3)", margin: "0 0 12px" }}>Skip it if</h3>
            {NOT_FOR_YOU.map((x) => <p key={x} style={{ ...p, fontSize: 15.3, marginBottom: 9 }}>· {x}</p>)}
          </div>
        </div>
      </section>

      {/* Host */}
      <section style={section}>
        <div style={S.wrap}>
          <div style={eyebrow}>Your host</div>
          <h2 style={h2}>Swapnil Umbarkar</h2>
          <p style={{ ...p, marginBottom: 12 }}>
            Thyroid Fat Loss Coach · Assistant Professor, KJ Somaiya · <strong>100+ thyroid women coached</strong>
          </p>
          <p style={p}>
            Most thyroid coaching starts with a diet plan. Mine starts with your blood report.
            A plan built on the wrong reason fails by week six — and you have already lived that.
          </p>
          <div style={{ display: "flex", gap: 9, flexWrap: "wrap", marginTop: 16 }}>
            {["ACE", "INFS", "AIHM"].map((c) => (
              <span key={c} style={{ padding: "6px 13px", borderRadius: 999, background: "var(--p-subtle)", border: "1px solid var(--p-border)", fontSize: 12.5, fontWeight: 700, color: "var(--p600)" }}>{c}</span>
            ))}
          </div>
        </div>
      </section>

      {/* Proof */}
      <section style={{ ...section, background: "#fafbfc", borderTop: "1px solid #eef0f3" }}>
        <div style={S.wrap}>
          <div style={eyebrow}>From women I have coached</div>
          <h2 style={h2}>What changed for them.</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(240px,1fr))", gap: 14 }}>
            {TRANSFORM.map((t) => (
              <figure key={t.name} style={{ ...card, margin: 0, padding: 12 }}>
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={t.src} alt={`${t.name}, before and after`} loading="lazy"
                  style={{ width: "100%", borderRadius: 11, display: "block" }} />
                <figcaption style={{ marginTop: 10 }}>
                  <strong style={{ fontSize: 15.5, color: "var(--t1)" }}>{t.name}</strong>
                  <p style={{ ...p, fontSize: 14.5, marginTop: 3 }}>{t.story}</p>
                </figcaption>
              </figure>
            ))}
          </div>

          <h3 style={{ fontSize: 18, fontWeight: 800, color: "var(--t1)", margin: "28px 0 12px" }}>In their own words</h3>
          <div style={{ display: "flex", gap: 12, overflowX: "auto", paddingBottom: 8 }}>
            {PROOF.map((src) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img key={src} src={src} alt="Client message" loading="lazy"
                style={{ height: 300, borderRadius: 12, border: "1px solid #e6e8ec", flex: "none" }} />
            ))}
          </div>
          <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 10 }}>Results are different for every person.</p>
        </div>
      </section>

      {/* Bonus */}
      <section style={section}>
        <div style={S.wrap}>
          <div style={eyebrow}>Free for everyone who attends</div>
          <h2 style={h2}>The Thyroid Plate — 7 days of meals.</h2>
          <p style={{ ...p, marginBottom: 14 }}>
            A printable week of Indian meals with enough protein and fibre, and swaps for veg, egg and non-veg.
            Sent the moment the class ends, to everyone in the room.
          </p>
          <div style={{ ...card, display: "grid", gap: 9 }}>
            {["7 days of breakfast, lunch, dinner and two snacks",
              "Protein in katori and spoon measures, not grams you have to guess",
              "A swap list for eating out and travel days",
              "When to take your thyroid medicine around meals"].map((x) => (
              <p key={x} style={{ ...p, fontSize: 15.3, margin: 0 }}>· {x}</p>
            ))}
          </div>
        </div>
      </section>

      {/* FAQ */}
      <section style={{ ...section, background: "#fafbfc", borderTop: "1px solid #eef0f3", borderBottom: "1px solid #eef0f3" }}>
        <div style={S.wrap}>
          <div style={eyebrow}>Before you ask</div>
          <h2 style={h2}>Questions.</h2>
          <div style={{ display: "grid", gap: 10 }}>
            {FAQ.map((f) => (
              <details key={f.q} style={{ ...card, padding: 16 }}>
                <summary style={{ fontSize: 16, fontWeight: 700, color: "var(--t1)", cursor: "pointer" }}>{f.q}</summary>
                <p style={{ ...p, fontSize: 15.3, marginTop: 9 }}>{f.a}</p>
              </details>
            ))}
          </div>
        </div>
      </section>

      {/* Close */}
      <section style={{ ...section, paddingBottom: 60 }}>
        <div style={{ ...S.wrap, textAlign: "center" }}>
          <h2 style={{ ...h2, fontSize: 32 }}>One evening. A plan that fits your body.</h2>
          <p style={{ ...p, maxWidth: 540, margin: "0 auto" }}>
            {WEBINAR_WHEN_LONG} · Free. Registration closes when we go live.
          </p>
          <a href="#save" className="cta-button" style={{ maxWidth: 340, margin: "22px auto 0", textDecoration: "none" }}>
            Save my seat
            <span className="cta-sub">Free · 90 minutes · live</span>
          </a>
          <p style={{ fontSize: 12.5, color: "var(--t3)", marginTop: 26, lineHeight: 1.7, maxWidth: 620, marginLeft: "auto", marginRight: "auto" }}>
            This class is for education only. Nothing in it is medical advice, and it does not replace your
            doctor. Never change or stop thyroid medicine without your doctor.
          </p>
        </div>
      </section>
    </main>
  );
}
