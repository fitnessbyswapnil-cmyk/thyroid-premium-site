# WhatsApp automation build — session record, 17–19 Aug 2026

Everything in this file is the state of the funnel automation **after** PRs #117–#133.
It exists so a future session does not have to re-derive decisions, and does not
re-make mistakes that were already made and fixed here.

---

## 0. What this file does NOT cover — read this first

This document plus the repo covers the backend, the automation, and the reasoning
behind both. It does not cover everything about the business. Four things live
elsewhere, and a session working only from this file will have blind spots.

**The two handover PDFs.** `thyroid-business-handover.pdf` and
`thyroid-meta-ads-whatsapp-strategy.pdf` describe the business model, the funnel
from ad click to booked call, the tracking architecture, the ad creative strategy,
and the copy rules (no em dashes, no "not X but Y", never invent client names or
figures, "blocker" is proprietary vocabulary). They are NOT in this repo. Ask the
owner to attach them. Nothing here replaces them.

**PR #116 is OPEN and unmerged.** It adds a second, standalone 14-question quiz at
`/quiz` plus `/api/quiz` — 10 files, ~1,640 lines, on branch
`add-quiz-blocker-score-page`. It is fully built, typechecks, builds, and was
verified in-browser, but `app/quiz/` does NOT exist on `main` and nothing links to
it. The live quiz is the 7-question one at `/assessment`. Decide whether to merge
or close it; leaving a large open PR is a trap for the next session, which will
otherwise find two quiz implementations and not know which is real.

**Meta Ads Manager state is not in code.** Campaign objective (Leads), conversion
event (Schedule), budget, audience, the six creatives A1–A6, and the account
spending-limit warning all live in Ads Manager only.

**WhatsApp template contents are not in code.** The code knows template names and
how many body params each takes. The actual body copy and button URLs live in
WhatsApp Manager on WABA `976081968452524`. If a button URL is wrong, the fix is
there, not here.

---

## 1. The WhatsApp sequence as it now stands

Seven templates, six of them wired to code. All live on WABA `976081968452524`
("Heal Thyroid With Swapnil", +91 79784 60386).

| Trigger | Template | Timing | Fallback |
|---|---|---|---|
| Quiz unlock-gate submit | `welcome_lead_link` | instant | `welcome_lead` |
| Unpaid | `payment_reminder_link` | 5min–24h | `payment_reminder` |
| Still unpaid | `payment_reminder_day2` | 24h–72h | none, by design |
| Cashfree payment success | `booking_confirmation` | instant | — |
| Paid, unbooked | `booking_nudge_1h` | 1h–24h | `booking_confirmation` |
| Still unbooked | `booking_nudge_day3` | 72h–7d | none, by design |
| Call booked | `call_reminder_24h` | 24h before | none |
| Call booked | `call_reminder_1h` | 1h before | none |

`rebook_after_noshow` is **approved in Meta but deliberately NOT wired** — see §4.

`welcome_lead_link` takes THREE body params (name, score, top symptom).
`call_reminder_24h` takes TWO (name, session time in IST). Everything else takes one.
Sending the wrong count fails the whole message with error 132000.

The cron (`/api/cron/payment-reminder`) runs four jobs in one pass. It is polled
every 5 minutes by cron-job.org — **not** by Vercel Cron, which on the Hobby plan
caps at once per day. `vercel.json` still holds a daily run as a safety net.

---

## 2. Decisions already made — do not re-litigate without new information

**The Cashfree hosted form is not the payment path.** It was proposed repeatedly
and rejected each time. `lib/cashfree-payload.ts` normalises FORM webhooks to
`payment: null`, so a payment made there never stamps Paid, never fires
`booking_confirmation`, and never fires `Schedule`. Two real ₹1 test payments went
through it (`CFPay_thyroid-session_…`, `CFPay_tempppp_…`) and are invisible to the
system to this day; one recorded `Name: N/A, email: no-reply@cashfree.com`. The
tracked path mints `thyroid_<leadId>_<timestamp>`. If a payment id does not start
with `thyroid_`, it did not go through the funnel.

**Every stage handoff must pass through our own domain first.** WhatsApp buttons
point at `/complete-payment?leadId={{1}}` and `/session-booked?leadId={{1}}`, never
at `payments.cashfree.com` or `cal.com` directly. That is what keeps `leadId`
attached across the handoff. Identity then resolves in three layers
(`lib/lead-sheet.ts::findLeadRowNumber`): leadId, then phone last-10, then email.

**Ads optimise for `Schedule`, not `Lead`.** An earlier attempt at Lead produced
form-fillers who never paid. At the time of writing the account produces 3–4
schedules/day on ₹3,000/day. An earlier recommendation in this session to switch
back to Lead was **wrong** — it was based on `alreadyBooked: 5` read from the Leads
sheet, which badly undercounts because the Make.com Cal.com→Sheets scenario drops
most write-backs. Trust Cal.com for booking counts, not the sheet.

**Reminder dedup is per-row for REMINDED, cross-row for PAID.** Owner decision,
2026-08-18. A phone reminded on one row no longer blocks a different row, so a
genuine retake earns its own reminder. A phone that PAID on any row still settles
every row she owns. Accepted trade-off: a woman who retakes the quiz twice across
two different 5-minute polls can be messaged twice.

**Budget and decisionMaker never touch the Thyroid Score.** `computeParts()` reads
only symptoms, tried, duration, diagnosis, medication. Two women with identical
symptoms must see identical scores regardless of what they can pay.

---

## 3. Bugs found and fixed — the failure modes worth remembering

**Un-awaited work dies when the serverless invocation freezes.** `/api/quiz-lead`
fired `sendWelcomeLead()` as a bare promise after returning the response, so the
WhatsApp send frequently never completed — and logged nothing, because the whole
execution context was gone. Now wrapped in `after()` from `next/server`. Any new
post-response side effect must do the same.

**Error 132001 means two different things.** Meta returns it for both "no such
template" and "template exists but not in this language". WhatsApp Manager stores
"English" as `en`, `en_US` or `en_GB` depending on how it was picked.
`sendTryingLanguages()` tries the configured default, then `en`, `en_US`, `en_GB`.
Plain `en` is listed explicitly — if `WHATSAPP_TEMPLATE_LANG` is ever set to a
variant, `en` would otherwise never be attempted and every send would silently
fall back to the older template.

**A hardcoded question index skipped the last quiz question.** The advance handler
had `qi === 5` as "last question". Adding a seventh made it render with a correct
"Q7 · 0 to go" counter and then discard the answer. Now derived from `QS.length`.
Anything indexed off the question list must be derived, never hardcoded.

**Budget scoring had been silently dead.** `SCORING.investment` in
`lib/lead-scoring.ts` is keyed on the label string. The quiz's old budget labels
matched none of its keys, so the strongest single buying signal (30 of 100 points)
scored 0 for every quiz lead. Fixed in #131 by matching the labels exactly. **If
you change a quiz option label, check whether a scoring map keys on it.**

**Vercel cron schedules are UTC only.** `"20 5 * * *"` was intended as 05:20 IST
and actually fired at 10:50 IST for months. Now `"50 23 * * *"`.

**A template was once created on the wrong WABA.** The portfolio contains four
similarly-named WhatsApp accounts. Always confirm name **and** WABA ID
`976081968452524` **and** phone before creating anything.

---

## 4. Open items

**`rebook_after_noshow` is approved but not wired.** The sheet has a `Showed`
column and no distinct no-show marker — `app/api/admin/mark` writes only `showed`.
An unmarked cell means "not marked yet" as often as "did not attend", so
automating it would tell women who attended that we missed each other. Needs an
explicit no-show field first.

**Bookings are not reaching the Leads sheet.** Cal.com produces 3–4 bookings/day;
the sheet showed one upcoming session. Consequences: call reminders cannot fire for
bookings the sheet does not know about, and `planBookingNudges` may send
"your call time is not picked yet" to someone who already booked. The durable fix
is to read bookings from the Cal.com API (`api.cal.com/v2/bookings`, the pattern
`app/api/admin/_lib.ts` already uses) rather than from sheet columns written by
Make.com.

**28 unreadable Session Dates.** `parseSheetTime` handles ISO, Sheets serials and
locale strings; 28 rows match none. Those rows can never receive a call reminder.
Needs one real sample value to extend the parser.

**Purchase and InitiateCheckout duplicate in Events Manager.** Ruled out in
application code: `InitiateCheckout` has exactly one `dataLayer.push` and no
server leg anywhere, yet Meta records two. Purchase's three legs (browser Pixel,
`/api/events`, Cashfree webhook) all share `Purchase_<orderId>`. The duplication is
therefore in the tag layer — most likely the Stape server container's Facebook
Conversion API tag not passing through the same `event_id` the browser tag uses.
Fix is a GTM field, not code.

**Account spending limit** on the Meta ad account throttles delivery. Long-standing.

---

## 5. Configuration that lives outside this repo

- **cron-job.org** — polls `/api/cron/payment-reminder` every 5 minutes with
  `Authorization: Bearer <CRON_SECRET>`. Free account. Its "Test Run" hits the LIVE
  endpoint and really sends; use `?dryRun=1` to inspect without sending.
- **Cal.com webhook** — `https://www.swapnilumbarkarfitness.in/api/cal-webhook`,
  trigger "Booking created" only, HMAC secret must equal `CAL_WEBHOOK_SECRET` in
  Vercel. A separate disabled webhook points at `lime.swapnilumbarkarfitness.in`
  (the Stape domain) — leave it alone, it is not ours to repurpose.
- **Meta templates** — created in WhatsApp Manager. Category is Meta's call, not
  ours; `booking_nudge_day3` was submitted as Utility and reclassified to Marketing.
- **Vercel env vars** are write-only once marked Sensitive. `WHATSAPP_TOKEN` and
  `CAL_WEBHOOK_SECRET` cannot be read back — mint a new value rather than trying to
  recover the old one. A WhatsApp token is issued by Meta and cannot be invented.

---

## 6. Verification commands

Dry run — inspects all four cron jobs, sends nothing:

```
curl -s "https://www.swapnilumbarkarfitness.in/api/cron/payment-reminder?dryRun=1" \
  -H "Authorization: Bearer $CRON_SECRET"
```

`wouldUseTemplate` on each candidate reports which template would actually go out;
a `(fallback)` value means the newer template is not resolving. `callReminderSkipped
.h24.unparseableTime` above 0 means the Session Date format has drifted.

After any commit, the standing check from `AGENTS.md`:

```
git diff --stat origin/main -- app/booking-confirmed app/api/cal-webhook \
  app/api/events middleware.ts app/lib/pricing.ts app/api/create-cashfree-order
```

`app/api/create-cashfree-order` was touched once in this session, deliberately and
narrowly, to set `IS_TEST_MODE = false` after QA. It is the only switch that
changes what a customer is charged. `SESSION_PRICE` remains 299.
