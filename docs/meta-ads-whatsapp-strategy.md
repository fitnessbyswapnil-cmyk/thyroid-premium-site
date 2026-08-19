# Meta Ads + WhatsApp automation — strategy

> **Provenance.** Transcribed 2026-08-19 from
> `fthyroid-meta-ads-whatsapp-strategy.pdf` (compiled 17 Aug 2026), which was
> supplied to a session and has since been lost from the owner's machine.
> Committed here so it cannot be lost again. If the original PDF resurfaces and
> disagrees with this file, the PDF wins. Contains NO secret values.
>
> **The WhatsApp automation in §5 is the state as of 17 Aug 2026 and is now
> OUT OF DATE.** It has been substantially rebuilt — see
> `docs/whatsapp-automation-session-2026-08.md` for what actually runs today.
> §1–§4 and §6 (the ad strategy) remain current.

Companion to `docs/business-handover.md` — read that first for the funnel and
tracking architecture.

---

## 1. Campaign structure

| Level | Value |
|---|---|
| Campaign | `Stage1 \| Cold \| Quiz \| Metros` |
| Objective | Sales (**but see §4** — this was later found to be wrong for this account) |
| Ad set | One only — `Broad \| W30-55 \| Metros \| <event>` |
| Audience | Women, 30–55, India metros. Detailed targeting deliberately empty. |
| Destination | swapnilumbarkarfitness.in → the quiz. Every ad's CTA is **Learn More**, never Book Now. |

### Why one ad set, not six

Meta's learning phase counts conversions **per ad set**, needing roughly 50/week to
exit. Splitting six creatives into six ad sets means each needs its own 50; pooled
into one ad set they share the threshold and exit ~4-6x faster. This is the single
highest-leverage structural decision in the build.

### Why not thyroid interest targeting

Meta removed health-condition interests (hypothyroidism, Hashimoto's, thyroid) from
detailed targeting in January 2022. They do not exist as options. **The creative
itself does the audience filtering** — "For women 30+ on thyroid medicine" printed
on the image filters before the click, where filtering is free.

---

## 2. The six creatives

Each entry point maps to a distinct psychological objection. This is deliberate:
cold traffic doesn't know it needs your product, so the ad's job is to make her
recognise her own situation, not to sell.

| ID | Angle | Objection it answers | Status |
|---|---|---|---|
| A1 | Reports Normal — "Fine on paper. Stuck in real life." | Her doctor dismissed her; the reports look fine | Launch |
| A2 | Tablet vs Energy — "The tablet was never meant to do this" | She doesn't understand why medication alone hasn't worked | Launch |
| A3 | Checklist — "Still living with all of this?" | She hasn't connected her symptoms into one pattern | Launch |
| A4 | Not Willpower — "It was never your willpower" | Self-blame after repeated failed attempts | Reserve (wave 2) |
| A5 | Tried Everything — "Before you try one more thing" | She's already spent money on a diet/trainer that failed | Reserve (wave 2) |
| A6 | Meet Your Coach — "A diagnosis call, not a sales call" | Distrust of "free consultation" as a sales trap | Launch |

### Copy, headline, description

Shared across every ad: CTA button "Learn More", URL swapnilumbarkarfitness.in,
₹299 named in the body (**never the hook**, to filter price-shoppers before the
click).

| Ad | Primary text (first ~125 chars) | Headline | Description |
|---|---|---|---|
| A1 | The reports say fine. The dose is correct. And two years later nothing has changed. You are not imagining that gap… | Fine on paper. Stuck in real life. | Private 1-on-1 call · ₹299 |
| A2 | The tablet keeps your thyroid level where the doctor wants it. That is all it was ever designed to do… | The tablet was never meant to do this | Real Indian food · No starving |
| A3 | Tired by evening. Hair fall. Puffy face. Weight that will not move no matter what you cut… | Still living with all of this? | Private 1-on-1 · Limited slots |
| A4 | Every plan you tried assumed your body works like everybody else's. It does not, and that is not a discipline problem… | It was never your willpower | Thyroid-only · ACE & INFS certified |
| A5 | You have already spent money on this. A nutritionist, a gym, maybe both. None of them were built for a thyroid… | Before you try one more thing | Written summary in 24 hours |
| A6 | Most free consultations are a sales pitch with a timer on it. This one is 60 minutes on your reports… | A diagnosis call, not a sales call | ACE · INFS · AIHM Certified |

### Visual design

| Set | Palette | Where used |
|---|---|---|
| Cream/ink (site match) | `#faf7f0` · `#2b2620` · teal CTA | A1, A3 — seamless click-through from ad to landing page |
| Ink/coral (contrast) | `#221e19` · coral | A2, A5 — stops the scroll harder against Instagram's white UI |
| White/gold DR layout | white · gold · coral highlight | A6 — direct-response structure: question headline, ✗ objection list, cut-out portrait, full-bleed CTA bar |

All feed creatives are **1080×1350 (4:5)**; all story/reel creatives are
**1080×1920 (9:16)**, built as separate files and assigned via placement
customisation — never relying on Meta's auto-crop of the 4:5, which cuts ~19% off
each side and can clip left-aligned copy.

---

## 3. Why quiz-first, not direct-to-pay

Every ad routes to the free quiz, not straight to the ₹299 checkout. This was a
deliberate resolution of a real tension:

- **Cold traffic won't pay a stranger on click one.** A ₹299 ask with zero prior
  trust has a very high bounce rate.
- **The quiz earns the right to ask.** By the time she reaches the result screen
  she has a personalised Thyroid Score and named blockers — a concrete reason to
  book, not a blind pitch.
- The CTA was renamed from "Get My Free Thyroid Score" to **"Find My Thyroid
  Blocker"** specifically because the old wording made the free quiz feel like the
  product. The new wording keeps the ₹299 consultation as the real destination
  while the quiz stays the entry step.

### The retargeting counterpart

Cold → quiz-first is stage 1. Warm audiences (people who already visited or
completed the quiz without paying) are the intended audience for a direct ₹299 ask
— "Book Your ₹299 Thyroid Consultation" — once retargeting pools reach workable
size (~1,000+). Not yet built; noted so it isn't rebuilt from scratch later.

---

## 4. Objective and conversion event — the ladder

Objective decides **which people** Meta looks for. Conversion event decides **what
counts as success**. Separate settings, both matter.

| Rung | Optimise for | Approx. volume | When |
|---|---|---|---|
| 1 | Lead (quiz unlock gate) | ~32/week | Highest-volume event on the account |
| 2 | InitiateCheckout | ~17/week | Once Lead clears 50/week |
| 3 | Purchase | — | Once InitiateCheckout clears 50/week |

Meta needs ~50 events/week per ad set to exit the learning phase; below that,
delivery stays expensive and erratic indefinitely.

### Account-specific constraint, confirmed live

Lead-family conversion events (including the pre-existing "Quiz Completion" custom
conversion, ID `1847679389532264`, inactive with 0 events) are **only selectable
under the Leads objective on this ad account, not Sales**. If the Sales objective's
event dropdown does not offer Lead, the ad set must be rebuilt under a
Leads-objective campaign — objective is fixed at creation and cannot be changed in
place; ads can be duplicated into the new ad set.

> **Superseded in practice, 2026-08-19.** The campaign now runs the **Leads**
> objective with **Schedule** as the conversion event, producing 3–4 schedules/day
> on ₹3,000/day. An earlier Lead-optimised test produced form-fillers who never
> paid. The ladder above assumes Schedule volume is negligible; on this account it
> is not. See `docs/whatsapp-automation-session-2026-08.md` §2.

---

## 5. WhatsApp automation — SUPERSEDED

> This section described four automatic sends as of 17 Aug 2026. It has since been
> rebuilt into a seven-template sequence. **Do not use this section as a reference
> for what runs today** — see `docs/whatsapp-automation-session-2026-08.md` §1.

For historical context, the original four were: `welcome_lead` on quiz completion;
`booking_confirmation` on payment success; `payment_reminder` on a daily cron for
unpaid leads aged 45min–24h; and `booking_confirmation` reused as a nudge for
paid-but-unbooked leads aged 20h–7d.

Manual, non-automatic routes (still current): `/api/admin/send-template` for a
one-off template to a single number, and `/api/admin/broadcast` for a bulk
template to a filtered list, capped at 50/run. Free-form replies
(`lib/wa-autoreply.ts`) work only inside the 24-hour service window a customer
opens by messaging first — a Meta platform rule, not a choice in the code.

### The dataLayer / GTM signal

Quiz completion also pushes `{event: "quiz_completed"}` to the dataLayer at the
same moment the welcome message fires — the browser-side signal GTM/Stape uses in
parallel with the CAPI Lead event. Both legs share one `event_id` for
deduplication.

---

## 6. How the ad strategy and the WhatsApp automation connect

The ad's only job is to get her into the quiz. Everything after that — speed of
first contact, payment recovery, booking recovery — is the automation's job, and it
runs identically regardless of which creative brought her in. **Creative-level
attribution stops at Lead**; WhatsApp behaviour from that point is angle-agnostic.

One implication for future ad iteration: if a specific ad angle produces leads with
a worse pay-through rate (Lead → Purchase), the fix is in the ad's
promise-matching, not the WhatsApp sequence — the same cadence handles every lead
source.
