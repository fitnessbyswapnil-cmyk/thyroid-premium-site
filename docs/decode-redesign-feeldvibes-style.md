# /decode redesign in the style of feeldvibes.in — spec

> **Status:** spec only, approved 14-Sep-2026. **No site change is made until the owner says "build it."** Reference page studied read-only on a 375×812 phone viewport; nothing was copied from it but layout and section types.

## Context
You want /decode to look like **feeldvibes.in** (Coach Feelics). You say that page gets consistent clients and closes deals, and you want a detailed md file for similar changes on your site, using their colour scheme with **red** buttons.

**Your decisions (14 Sep):**
- **Page:** /decode only.
- **Colours:** gold/yellow labels with red buttons.
- **New sections:** Meet your coach, framework cards, and "Who this is for" with checkmarks.

**Starting point:** /decode was shortened earlier today to 365 words and 7.4 phone screens (commit `66070b7`). The long version is at /decode-long.

---

## 1. What their page actually is (measured 14 Sep, 375×812 phone)

| | feeldvibes.in | your /decode today |
|---|---|---|
| Length | 14,582px · **18 screens** | 6,018px · 7.4 screens |
| Words | **~744** | ~365 |
| Look | White hero, then **near-black** everywhere | White and cream, one dark proof band |
| Buttons | 1 red (hero) + 5 green, **sticky bar visible from the first second** | 6 red, sticky bar after 20% scroll |
| Proof | 6 before/after cards · **7 video** testimonials · ~6 WhatsApp screenshot cards | 4 cards · 3 videos · 3 screenshots |
| Trust | **Hero video of the coach talking** · "Meet your coach" section | Certification line only |
| Offer | **Free** 60-minute "strategy call" | **₹299** consultation |

**The honest read:** the look is only part of why their page closes. Three things likely matter more than colour:
- **the call is free**
- **his face and voice are the first thing she sees** (a video in the hero)
- **the sheer amount of proof with faces**

The spec copies the look and the section types. The free-call difference is **your business decision and is not part of this spec** (see §6).

### Their page, section by section
1. **Hero (white).**
   - Small grey audience line → huge black bold headline (Inter, 28px, weight 800).
   - Bold one-line promise → short paragraph with key words in bold → coach video (tap for sound).
   - **Red button** (#e93d3d, 58px tall, 8px corners, sentence case) → small "Limited spots" line.
2. **Proof (dark #0c110c).**
   - Green eyebrow "— THE PROOF" (11–12px, spaced capitals).
   - White heading with the second half in the accent colour (32px, weight 800).
   - White cards: occupation pill, "Lost 10 Kg In 90 Days Despite **Hypothyroidism**" (red highlight), one-line caption, Before/After photos with red/green labels.
3. **Video testimonials (dark).** Eyebrow + big heading ("When the Method Is Right – the Results Speak."); 7 video cards, each a white card with a bold headline (red highlight) above the video and the name and city under it.
4. **WhatsApp proof (darker #080c08).** "Real Feedback. Real Results."; white cards with a **bold italic headline** (red highlight) over each screenshot, with a red box drawn around the key line.
5. **Meet your coach (dark #0b110d).**
   - "Hey, I'm Coach Feelics.." (36px), a bold subtitle, credentials with gold highlights.
   - A short story paragraph ending in "I discovered one truth:".
   - A **bold italic quote with a 4px coloured left bar**.
6. **The framework (dark).** Gold eyebrow; heading with the gold acronym; **5 dark cards** (#151b15, faint 1px border, 12px corners), each a white bold title plus 2–3 grey lines.
7. **How coaching works (dark).** Amber eyebrow; heading with its second half in amber; **3 steps**: an amber-outlined square number box (01/02/03), white title, grey centred text, thin divider lines.
8. **Who this is for (dark).** Green eyebrow; "This Isn't Another Diet Plan. It's a Complete Thyroid Reset."; **green checkmark list**, then "NOT for you" list.
9. **Final button** + "Free 60-Minute Call · No Obligation · Few Spots Left This Week" + a small disclaimer footer.

---

## 2. Colour and type system for /decode (their layout, your gold, red buttons)

**Almost all of this already exists in `app/globals.css`:**
- `.band-deep` already carries their exact dark palette.
- `.theme-decode .band-deep` already switches its accent to gold.
- `--red-cta` is already their red (#e93d3d).

**Tokens:**

| Role | Token / value | Where |
|---|---|---|
| Hero ground | `#ffffff`, ink `#0b1120` | hero only |
| Dark ground | `#0c110c` (`.band-deep --bg-page`) | every section after the hero |
| Dark card | `#151b15`, border `rgba(255,255,255,.08)`, 12px corners | coach, pillars, steps, FAQ |
| Proof card | `#ffffff` on dark, 12px corners | before/after, video, WhatsApp cards (as now) |
| Heading ink on dark | `#ffffff` | h2 |
| Body ink on dark | `#b7b5ae` | paragraphs |
| **Eyebrow and highlight** | **gold `#ffc91e`** (`--accent-yellow`; readable on dark, 11:1) | "— THE PROOF", the gold half of headings, checkmarks, step-number outlines, quote bar |
| **Button** | **red `#e93d3d`** (`--red-cta`), hover `#d22f2f`, press `#b82626` | every Book button and the sticky bar |
| Red text highlight | `#e93d3d` **only inside white proof cards** ("Despite **Hypothyroidism**") | proof cards (as now) |

**Rules:**
- **Button contrast:** white on #e93d3d is 3.7:1, which passes only for *large* text. The label is therefore **≥19px bold** (their size) to meet readability standards. This replaces today's darker #c8102e.
- **Red means "press".** It is never used for eyebrows or headings on the dark ground, only as a button fill and inside white cards.
- **Type (already loaded in `app/layout.tsx`: Inter + Outfit):**
  - headings Inter 800, 28px mobile / 36px desktop, tight line-height
  - eyebrows 11–12px, uppercase, letter-spacing ~0.2em
  - body 15–16px, grey
  - Keep the `--fs-*` tokens so `scripts/check-typography.mjs` still passes; add a heavy-weight exception only for display headings.
- **Buttons:** 8px corners, 58px tall, full width to 24rem. The label stays **"Book my 1-1 Thyroid Consultation"** with "₹299 · 12 questions, then pick your slot" under it (the ad's label — guarded by a test).
- **Sticky bar:** white bottom bar with the red button, **visible from page load** (theirs is), instead of after 20% scroll.

---

## 3. New /decode, top to bottom

| # | Section | Background | Content (your words only) |
|---|---|---|---|
| 1 | **Hero** | white | Grey audience line: "For women 30+ with a slow thyroid". Headline (black, Inter 800): *Eating less but still not losing weight? **Your blood report shows why.*** The existing "why" sentence + 60-min call line. Refund sentence **word for word**. **Red button.** 100+ laurel. |
| 2 | **Sound familiar?** | dark | Six symptom tick-boxes (as now), white rows on dark. Gold eyebrow "— SOUND FAMILIAR?" |
| 3 | **The proof** | dark | Eyebrow "— THE PROOF"; heading "Four Women. **Four Reports.**" (second half gold); the 4 before/after cards unchanged. **Red button.** |
| 4 | **Video stories** | dark | Heading "When the Method Is Right, **the Results Speak.**"; 3 video cards unchanged (headline above, name under). |
| 5 | **What they sent afterwards** | darker `#080c08` | 3 WhatsApp cards, headline above each screenshot. **No red box drawn on the screenshot** (existing rule: nothing printed on top of the evidence). **Red button.** |
| 6 | **Meet your coach** *(new)* | dark | Eyebrow "— MEET YOUR COACH". "Hey, I'm **Coach Swapnil**." Subtitle: "Thyroid fat-loss coach for Indian women 30+". Credentials line: ACE · INFS · AIHM (Nutrition for Hashimoto's) · AHA BLS · **100+ thyroid women coached** (gold highlights). Photo `COACH_IMAGE`, rounded. 2–3 sentences in your own words. **Quote with a gold 4px left bar.** |
| 7 | **The method** *(new)* | dark | Eyebrow "— THE METHOD"; heading "The **T.H.Y.R.O.I.D.** Lean Method" (gold). **3 dark cards**: Fix the Root · Fuel the Body · Flow into Fitness, each with the existing one-line body from `PillarsSection.tsx`. |
| 8 | **What you get + how booking works** | dark | The 3 "what you get" lines as dark cards with gold dots; "How booking works" as **3 steps with gold-outlined number boxes** (01 Answer 12 quick questions · 02 Pay ₹299 · 03 Pick your slot), their divider style. **Red button.** |
| 9 | **Who this is for** *(new)* | dark | Eyebrow "— WHO THIS IS FOR"; heading "Not another diet chart. **Your report, read properly.**"; **gold checkmark list** of the 5 existing lines from the old page. No "not for you" list. |
| 10 | **Quick questions** | dark | The 3 FAQs as dark cards. |
| 11 | **Final button** | dark | **Red button** + one honest trust line: "₹299 · 60 minutes · one to one with Swapnil". + a small footer: "Individual results vary. Not a substitute for medical advice." |
| — | **Sticky bar** | white | Red button, visible from load. |

**Size:** about **~560 visible words** (365 today + ~70 coach + ~60 method + ~65 who-for), about 9–10 phone screens, **7 Book buttons** plus the sticky bar.

---

## 4. Do NOT copy (legal, honesty, your own rules)
- **Their words.** No sentence is lifted. All copy above comes from your site, your handover doc, or is new in your voice.
- **"50,000+ women"** — your claim is **"100+ thyroid women coached"**, never higher.
- **"Or I'll continue coaching you free until you get results"** — cannot be honoured at 7 clients a month. Your guarantee stays the ₹299 refund sentence, word for word.
- **"Limited spots", "Few spots left this week"** — no invented scarcity.
- **™ marks, the 🎥 emoji, "Don't take our word for it", "Real Feedback. Real Results."** — removed earlier on purpose, and guarded by tests.
- **Red boxes drawn over WhatsApp screenshots** — against the "nothing printed on top of the evidence" rule.
- **Their photos, videos or testimonials.** Only your own client assets, headlines verbatim, and no occupation pill unless confirmed (only Heenal's "IT Professional" is).
- **Price-based or decision-maker filters** in "Who this is for" (existing guarded rule).
- **Letter-by-letter T.H.Y.R.O.I.D. meanings.** None exist in your material. The method is documented as 3 pillars, so the cards use those; nothing is invented.

---

## 5. How it would be built (only after you say "build it")
- **`app/decode/page.tsx`:** new section order (§3). The whole page below the hero sits inside `.band-deep`, so dark tokens apply automatically. Copy stays in constants at the top.
- **`app/globals.css`, `.theme-decode`:**
  - `--cta-bg: var(--red-cta)` (#e93d3d) with hover and press colours; button label ≥19px bold, 8px corners
  - a `.decode-eyebrow` (gold, 11–12px, spaced capitals, leading "— ")
  - a `.gold` heading highlight
  - a dark-card utility (`#151b15`, 1px border, 12px corners)
  - `.band-deep` already exists.
- **New `app/decode/CoachIntro.tsx`:** reuses `COACH_IMAGE`, `COACH_NAME`, `CERTIFICATIONS` from `app/lib/authority.ts`. Owner supplies the 2–3 sentences and the quote.
- **Pillars:** reuse the `PILLARS` data from `app/components/PillarsSection.tsx` (export it) and render dark cards in the page. `/` keeps its own light version, unchanged.
- **`app/decode/DecodeStickyCta.tsx`:** a `showFromTop` prop (threshold 0), red fill.
- **Existing components (`SymptomChips`, `TransformationWall`, `WhatsappProofSection`, `VideoTestimonial`):** unchanged; they already restyle inside `.band-deep`.
- **`lib/decode-landing.test.ts`:**
  - update the section-order test to §3
  - raise the page's own word budget from 320 to ~520
  - restore the "Who this is for" excluded-filters guard
  - allow one method-name mention
  - keep: button label and price, refund sentence, 100+ claim, no emoji, occupation allow-list, nothing on screenshots
- **Verify:**
  - `npm test`, `npm run build`, typography lint
  - phone preview (375×812): hero button above the fold, sticky bar from load, contrast of white on #e93d3d at 19px bold, no console errors
  - `/` unchanged
  - after deploy, a week-on-week comparison in Windsor and the CRM (page loads → quiz starts → ₹299 paid → bookings)

## 6. Your decisions still open (not part of this build)
1. **Free call vs ₹299.** Their biggest difference is not visual. Your free funnel on `/` exists. Changing /decode's offer changes Meta events and ads, so it's a separate decision.
2. **Coach video in the hero.** They open with the coach talking. /decode deliberately has no video (page weight, 59% vs 71% of clicks reaching the page). A short 30–45s face-to-camera clip, loaded only on tap, is an option if you record one.
3. **More proof.** They show 7 videos and 6 before/afters; you have 3 and 4. Adding more needs real, consented client assets from you.
4. **Your words for "Meet your coach":** 2–3 sentences and one quote line.
