# Thyroid Premium Site — business handover

> **Provenance.** Transcribed 2026-08-19 from `thyroid-business-handover.pdf`
> (compiled 17 Aug 2026), which was supplied to a session and has since been lost
> from the owner's machine. Committed here so it cannot be lost again. If the
> original PDF resurfaces and disagrees with this file, the PDF wins.
> Contains NO secret values — env vars are named, never valued.

System handover: business model, funnel, backend, tracking and working
conventions. swapnilumbarkarfitness.in · Next.js on Vercel ·
repo `fitnessbyswapnil-cmyk/thyroid-premium-site`.

---

## 1. The business

A one-person online coaching practice for Indian women aged 30+ who have
hypothyroidism, are already on thyroid medication, and still cannot lose weight.
It is deliberately hyper-niched: the site targets the medicated-but-stuck woman,
not general fat loss.

| Item | Detail |
|---|---|
| Coach | Swapnil Umbarkar. ACE, INFS and AIHM certified. Instagram `@heal_thyroid_with_swapnil` |
| Front-end offer | Free 60-second Thyroid Score quiz |
| Paid entry | ₹299 private 60-minute 1-on-1 thyroid consultation |
| Back-end offer | 3-month reversal programme. Price quoted only on the call, after seeing reports. ₹299 is credited against it. |
| Guarantee | Leave the call without knowing your blocker and the ₹299 is refunded |
| Method | T.H.Y.R.O.I.D. Lean Method, presented as 3 pillars: Fix the Root, Fuel the Body, Flow into Fitness |
| Core promise | "Your weight isn't stuck. It's blocked." The tablet corrects TSH; it does not rebuild metabolism. |
| Proprietary word | **blocker** — used on the CTA, the quiz, the guarantee and the pillars. Keep it. |

### Editorial rule, enforced in code

`TransformationWall.tsx` documents a **women-only rule** for all on-page proof.
Several composites in `public/transformations` and `public/MoreThanFatLossSection`
are male clients and are excluded deliberately. Do not "helpfully" surface unused
images.

**Filenames are unreliable:** `nitin.png` is captioned "Meet Raghu". Always verify
by opening the image.

---

## 2. Stack and deployment

| Layer | Detail |
|---|---|
| Framework | Next.js App Router, TypeScript, Tailwind. Deps deliberately few: `@calcom/embed-react`, `@cashfreepayments/cashfree-js`, `framer-motion`, `googleapis`, `next`, `react` |
| Host | Vercel. TWO projects deploy from the same repo: `thyroid-premium-site` and `thyroid_fatloss_premium_consultation` |
| Production branch | `main` |
| Cron | `vercel.json`: `/api/admin/digest` daily, `/api/cron/payment-reminder` daily |

### Two things past sessions got wrong

- **There is no `HANDOFF.md`.** It has never existed in this repo. Do not look for it.
- **Production serves `main`**, not any `claude/*` branch. Those only ever build as
  Vercel Previews. A local clone may be far behind — always `git fetch` before
  reasoning about what is live.

---

## 3. Route map

### Pages

| Route | Purpose |
|---|---|
| `/` | Landing page. Hero + VSL, symptom chips, certifications, 3 pillars, transformation wall, video testimonials, WhatsApp proof, written testimonials, fit filter, FAQ, sticky booking bar. |
| `/assessment` | The quiz funnel. Live score, lead-capture gate, result screen, Cashfree checkout. |
| `/book`, `/book-confirmed` | Alternate booking flow with a qualifying step |
| `/payment`, `/payment-success` | 3-month programme enrolment |
| `/session-booked`, `/booking-confirmed` | Post-payment confirmation and slot booking (Cal.com embed) |
| `/admin` | Private ops dashboard: leads, WhatsApp inbox, broadcasts. Never indexed. |
| `/how-it-works`, `/privacy` | Supporting pages |

### API routes

| Group | Routes |
|---|---|
| Payments | `/api/create-cashfree-order`, `/api/verify-payment`, `/api/cashfree-webhook` |
| Booking | `/api/booking`, `/api/booking-access`, `/api/cal-webhook` |
| Leads | `/api/lead`, `/api/leads`, `/api/leads/[leadId]`, `/api/quiz-lead`, `/api/tally-webhook` |
| Tracking | `/api/events` — browser-to-CAPI bridge |
| WhatsApp | `/api/whatsapp-webhook`, and under `/api/admin/`: broadcast, messages, send-template, templates, wa-account, wa-migrate, whatsapp-status |
| Admin / cron | `/api/admin/dashboard`, `/api/admin/ads`, `/api/admin/digest`, `/api/admin/mark`, `/api/cron/payment-reminder` |

---

## 4. The funnel, end to end

```
Meta ad
  → /  (landing)                          PageView, ViewContent
  → CTA "Find My Thyroid Blocker"
  → /assessment                           quiz starts
  → questions, live Thyroid Score
  → UNLOCK GATE: name, phone, email       Lead  (browser + CAPI, shared event_id)
  → result screen: blockers named, score shown
  → "Book My Call ₹299"                   InitiateCheckout
  → Cashfree checkout (real ₹299)
  → /api/cashfree-webhook confirms payment
  → /session-booked → Cal.com embed       Purchase (fires post-slot-confirm)
  → slot booked → /api/cal-webhook        Schedule
  → WhatsApp follow-up + Google Sheet row + Make digest
```

Every landing-page CTA routes to the quiz. This is a deliberate owner decision
recorded in `Hero.tsx`: the paid call is offered on the quiz result screen, once
she has a score and a reason to book, rather than blind on first click.

### Lead scoring

`lib/lead-scoring.ts` scores each quiz lead and assigns a tier: Best / Average /
Worst. Budget is captured in the quiz but **deliberately excluded from the visible
Thyroid Score** — two women with identical symptoms must see the same score
regardless of what they can pay. Budget is a private sales field surfaced only on
the admin dashboard.

---

## 5. Tracking architecture

| Component | Detail |
|---|---|
| Pixel / dataset | `1004294955172584` |
| Browser | GTM container `GTM-P3S5BXQB`, loaded through a Stape server container at `lime.swapnilumbarkarfitness.in` |
| Server | `lib/server-tracking.ts` posts to `graph.facebook.com/<META_PIXEL_ID>/events` |
| Bridge | `/api/events` takes a browser payload and re-sends it via CAPI |
| Dedup | `app/lib/analytics.ts` generates one `event_id`, pushes it to the dataLayer and returns it for the CAPI call, so both legs share an id |
| Match quality | 9.3/10 on Lead. Hashed email, phone, first name, plus IP, UA, fbp, external_id |

### Events and where they fire

| Event | Fires at |
|---|---|
| Lead | Quiz unlock gate (`QuizFunnel.tsx`), plus `BookingFlow.tsx` and `QualifyingFlow.tsx`. Not quiz-exclusive. |
| InitiateCheckout | Just before Cashfree redirect |
| Purchase | `/session-booked`, deliberately after slot confirmation. Deduped as `Purchase_<orderId>`. Value from `SESSION_PRICE`. |
| Schedule | `/booking-confirmed`, contract `schedule_<uid>` |
| ViewContent | `/book` |

### Known state, Aug 2026

- `fbc` (click ID) is absent from events. The code reads the `_fbc` cookie
  correctly; the cookie is empty because there has been almost no ad traffic. It
  should populate once delivery starts. **Not a bug.**
- A custom conversion "Quiz Completion" (`1847679389532264`) exists but is
  Inactive with 0 events. Lead-family events are only selectable under the Leads
  objective, not Sales.

---

## 6. Integrations

| Service | Role |
|---|---|
| Cashfree | ₹299 payment. `IS_TEST_MODE` in `create-cashfree-order` charges ₹1 when true. |
| Cal.com | Slot booking, embedded. Webhook confirms and triggers Purchase/Schedule. |
| WhatsApp Cloud API | Full BSP integration: templates, broadcasts, auto-reply, inbound webhook, admin inbox. |
| Google Sheets | Lead sheet via service account. `lib/lead-sheet.ts` formats rows and tiers. |
| Make.com | Digest webhook for the daily summary. |
| Meta Ads API | `/api/admin/ads` reads spend. Windsor.ai key also present. |

### Environment variables (names only)

`ADMIN_DASH_KEY`, `ALERT_WEBHOOK_URL`, `CAL_API_KEY`, `CAL_WEBHOOK_SECRET`,
`CASHFREE_APP_ID`, `CASHFREE_SECRET_KEY`, `CASHFREE_WEBHOOK_SECRET`,
`CASHFREE_LINK_WEBHOOK_SECRET`, `CRON_SECRET`, `GOOGLE_PRIVATE_KEY`,
`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_SHEETS_ID`, `MAKE_DIGEST_WEBHOOK`,
`META_ADS_TOKEN`, `META_AD_ACCOUNT_ID`, `META_CAPI_TOKEN`, `META_PIXEL_ID`,
`META_TEST_EVENT_CODE`, `NEXT_PUBLIC_APP_URL`, `NEXT_PUBLIC_GTM_ID`,
`NEXT_PUBLIC_SGTM_URL`, `NEXT_PUBLIC_VSL_URL`, `NEXT_PUBLIC_WHATSAPP_NUMBER`,
`TALLY_SIGNING_SECRET`, `WHATSAPP_ACCESS_TOKEN`, `WHATSAPP_AUTOREPLY`,
`WHATSAPP_AUTOREPLY_COOLDOWN_HOURS`, `WHATSAPP_PHONE_NUMBER_ID`,
`WHATSAPP_TEMPLATE_LANG`, `WHATSAPP_TOKEN`, `WHATSAPP_VERIFY_TOKEN`,
`WHATSAPP_WABA_ID`, `WINDSOR_API_KEY`

---

## 7. Guarded paths — do not edit without explicit instruction

These carry money and attribution. Any change risks silently breaking payment or
double-counting revenue.

```
app/booking-confirmed
app/api/cal-webhook
app/api/events
middleware.ts
app/lib/pricing.ts
app/api/create-cashfree-order
```

### Verification to run after every commit

```bash
git diff --stat origin/main -- app/booking-confirmed app/api/cal-webhook \
  app/api/events middleware.ts app/lib/pricing.ts app/api/create-cashfree-order
# must be EMPTY

grep -n "SESSION_PRICE = " app/lib/pricing.ts        # expect 299
grep -n "const IS_TEST_MODE" app/api/.../route.ts    # expect false
npx tsc --noEmit && npm run build
curl -s -o /dev/null -w "%{http_code}" https://swapnilumbarkarfitness.in/assessment  # expect 200
```

---

## 8. Working conventions

- **Never push to `main` directly.** Branch off `origin/main`, open a PR,
  squash-merge. Every production commit in this repo is a squash-merged PR.
- Archived sections live in `app/components/_archived/` with a README recording
  why each was removed. Read it before rebuilding anything — three separate
  "results section" attempts were archived for the same reason (they duplicate
  `TransformationWall`).
- Tests are colocated: `lib/*.test.ts`, run with `npm test` (node --test).
- `AGENTS.md` warns that this Next.js version has breaking changes vs training
  data; read `node_modules/next/dist/docs/` before writing framework code.

---

## 9. Copy and brand rules

- **No em dashes** in headlines or body copy. Rewrite as a full stop or comma,
  never a hyphen.
- Avoid "It's not X, it's Y" constructions, rhetorical triplets, and the words
  **unlock / elevate / transform / journey / dive into**.
- Client testimonials are **verbatim**. Punctuation may be normalised; words may
  not be changed.
- **Never invent client names, weights or timeframes.** All figures are
  transcribed from the composites.
- Palette: cream `#faf7f0` · ink `#2b2620` · teal `#0b8f80` · coral `#c2453a` ·
  gold `#b8934a`.
- Primary CTA site-wide: **"Find My Thyroid Blocker"**, sublabel "60-second quiz ·
  then your private ₹299 consultation".

---

## 10. Current state as of the PDF (Aug 2026)

- Landing page live with the copy sweep applied and the CTA renamed.
- Stage 1 Meta campaign built as a draft: `Stage1 | Cold | Quiz | Metros`, one ad
  set, 6 ads.
- Open items at time of writing: ad set optimising for InitiateCheckout;
  Advantage+ sales campaign ON and should be off; account near its spending limit,
  which interrupts the learning phase.
- Volume benchmark: Lead ≈ 32/week, InitiateCheckout ≈ 17/week. Meta needs
  ~50/week per ad set to exit learning.

> Much of §10 has since changed. See
> `docs/whatsapp-automation-session-2026-08.md` for the current state.
