# Free-call migration plan

**Status: plan only. No behaviour changed by this document.**

Goal: take the ₹299 fee off the cold-traffic path so the consultation is free to
book. This is a funnel migration, not a copy change. Nine WhatsApp sequences, a
CRM stage machine, a lead-scoring pipeline and one Meta conversion event all
read paid state today, and several of them read it as a proxy for something
else. Shipping this as one commit would produce silent, expensive failures with
no error anywhere.

Written 23-Sep-2026, against `386cb81`.

---

## 0. The shape of the problem in one paragraph

Today, paying is the only way to reach the calendar, so `Paid = Y` doubles as
four separate facts: *she is serious*, *she has reached the booking step*, *she
owes nothing*, and *we have a conversion to report to Meta*. Making the call
free does not remove one fact, it splits one column into four questions the code
no longer has an answer to. Every item below is a place where one of those four
meanings was assumed.

---

## 1. (a) The blocker: abandoned-checkout nudges sent to free bookings

### What the code does now

`lib/reminder-plan.ts` → `planReminders()` is the decision logic for the
`checkout_pending_v2` WhatsApp nudge, driven by `GET /api/cron/payment-reminder`.
Its candidate loop (`lib/reminder-plan.ts:205-260`) skips a row for exactly six
reasons: paid, already reminded, no phone, unparseable timestamp, settled on
another row, and outside the age window.

```ts
if (cell(row, cols.paid).toUpperCase() === "Y") { skipped.paid++; continue; }
```

There is **no booking check anywhere in this function**. Booking is not in
`ReminderColumns` at all (`lib/reminder-plan.ts:66-83`): the type has `name`,
`phone`, `paid`, `paidAt`, `timestamp`, `reminderSent`, `leadId`. It cannot
check a booking even if it wanted to.

That is safe today only because of an accident of sequencing: on the current
funnel you cannot book without paying, so "not paid" implies "not booked", and
the nudge can never reach someone who is already on the calendar.

### What breaks the moment booking is free

Every free booking is a row with `Paid != Y` and a recent timestamp. It matches
every rule. Within the `DEFAULT_MIN_AGE_MINUTES` window she is sent
`checkout_pending_v2`, a template whose entire job is to say her checkout is
still open and ask for money, with a deep link to `/complete-payment`. She
booked a free call ninety seconds ago. This is the worst message in the system
and it would go to **100% of free bookings**, capped at `DEFAULT_LIMIT` (25) per
run.

It is also a Meta messaging-policy exposure, not only an embarrassment: the
template's approved copy is about an incomplete payment that, after this
migration, never existed.

### The proof that a booking check is the right shape

The same file already solves this problem correctly in a different function.
`planBroadcast()` (`lib/reminder-plan.ts:356-357`) carries:

```ts
const bookedEvidence = (r: string[]): boolean =>
  !!cell(r, cols.bookingStatus) || !!cell(r, cols.sessionDate);
```

And `BookingNudgeColumns` (`lib/reminder-plan.ts:457-471`) documents why it
reads **either** column: the Cal.com Make scenario sometimes stamps only one of
the two, and live data contains booked women with an empty Booking Status. Any
booking check added to `planReminders` must use this same either-column test.
Testing only `Booking Status` would leak nudges to genuinely booked women, which
is the failure this whole section exists to prevent.

### Recommendation: gate on booking evidence, not on a new column

Two options were considered.

**Option A — a new "Free Booking" sheet column.** Write a marker at booking
time; teach `planReminders` to skip it.

- Against: it adds a fifth meaning to a sheet that already overloads `Paid`.
  It only protects rows written *after* the column exists, so anything mid-
  flight at cutover is unprotected. It depends on a write succeeding at booking
  time; if that write fails, she gets the nudge, and a missing marker is
  indistinguishable from an abandoned checkout. It also needs
  `ensureGridColumns` plumbing and a `RESERVED_INDEXES` update.

**Option B (recommended) — add booking evidence to `ReminderColumns` and skip on
it, reading Cal.com first and the sheet only as a fallback.**

- For: it reads state rather than a marker written at one particular moment, so
  it protects mid-flight rows retroactively. It needs no new column and no new
  writer. It is a pure change to a pure function with an existing test file.
- The predicate becomes: skip if paid **or** if there is booking evidence. A
  woman who booked and did not pay is, after the migration, a completed funnel,
  not an abandoned one.

> **Corrected 23-Sep, and this correction matters.** An earlier draft of this
> section said to copy `planBroadcast` and read the sheet's `Booking Status` /
> `Session Date` alone. **That would not have worked.**
> `whatsapp-automation-session-2026-08.md` §4 records that bookings are not
> reliably reaching the Leads sheet: the Make Cal.com → Sheets scenario drops
> most write-backs, Cal.com produces 3-4 bookings a day and the sheet showed
> one. §2 states the rule directly, trust Cal.com for booking counts and not the
> sheet. A sheet-only gate would therefore have missed most real bookings and
> leaked the nudge to them, which is the exact failure the gate exists to
> prevent. `app/api/admin/digest/route.ts:118` already resolves booking state
> the right way — Cal.com first, sheet as fallback — and the gate follows it.
>
> Cal.com's set must be scoped to bookings **still ahead of her**
> (`CalState.active`), or it re-introduces the bug the paid-settle logic was
> rewritten to fix: a woman who had a call in July and abandons a fresh checkout
> in September must stay reachable. The sheet fallback is read per row for the
> same reason.

**Do both only if the owner wants a free/paid distinction for reporting** — but
that is a reporting requirement, not a safety requirement, and should not be on
the critical path of the migration.

### The existing guard does not cover this, and it is easy to assume it does

`app/api/cron/payment-reminder/route.ts` already carries free-funnel machinery
from an earlier era, which reads at a glance as though the problem were solved:

- `PAID_FUNNEL_ACTIVE` (`:116`), a master switch over all four payment jobs.
- `paidFunnelRowsOnly()` (`:131-145`), which blanks the phone on any row whose
  leadId does not start with one of `PAID_LEAD_ID_PREFIXES = ["sched_", "dq_"]`,
  so free-consultation leads are never asked for money.

**Neither protects a free `/decode` booking.** `DecodeQuiz.tsx:354` mints
`dq_…` and `ScheduleClient.tsx:190` mints `sched_…` — precisely the two
prefixes the filter lets through. After the migration those same paths still
mint those same prefixes, so every free booking passes the filter and lands in
the candidate set. The prefix filter answers "which funnel did she come from",
which stops being a proxy for "does she owe money" the moment the main funnel is
free.

`PAID_FUNNEL_ACTIVE = false` is a real blunt-instrument option at cutover, and
worth knowing about, but it silences the sequence for genuinely paid leads too.

### The second, opposite failure in the same file

`planBookingNudges()` has the mirror-image problem and it is easy to miss
because it fails silently. It skips on `notPaid` (`BookingNudgeSkips.notPaid`,
`lib/reminder-plan.ts:473`): it nudges women who **paid but have not booked**.
When nobody pays, its candidate set becomes permanently empty and the entire
"you paid, now pick a slot" sequence — both stages, `BOOKING_NUDGE_STAGE1` at 1
hour and `BOOKING_NUDGE_STAGE2` at 72 hours — goes quiet forever with no error.

On a free funnel the equivalent population is *reached the booking step and did
not book*, which is a different and much weaker signal. Decide deliberately
whether that sequence is retargeted at the new population or retired. Do not
leave it silently matching nothing.

---

## 2. (b) Everything else that reads paid state

65 files under `app/` and `lib/` mention paid state. Most are display-only. The
ones that carry a decision:

| File | Needs a change? | What breaks if it does not |
|---|---|---|
| `lib/reminder-plan.ts` → `planReminders` | **Yes, blocking** | Every free booking is WhatsApped an abandoned-checkout nudge. §1. |
| `lib/reminder-plan.ts` → `planBookingNudges` | **Yes, blocking** | Skips on `notPaid`; matches nobody once nobody pays. The paid-not-booked sequence dies silently. §1. |
| `lib/reminder-plan.ts` → `planBroadcast` | Probably not | Already checks paid **and** booking evidence. Its "unpaid, unbooked, recent" population becomes "unbooked, recent", which is still the right target. Confirm the intent, change nothing. |
| `lib/journey.ts` | **Yes** | `paid_not_booked` (`lib/journey.ts:408, 516-518`) is driven by `consultPaidAt`, the ₹299 timestamp. With no ₹299 it never fires, and the "get her to pick a slot" queue item disappears from the owner's daily list. The `hot_abandon` item (score ≥57, unpaid, ≤3 days) inverts meaning: every free booking is "unpaid". Both need re-deriving from booking state. |
| `lib/crm-stage.ts` | **No, but verify** | `paid` is explicitly "any payment at all — the ₹299 fee included. Shown, never a win" (`:128`). `deriveStage` never branches on it; `won` is `₹15,000+` by `lib/metrics`. `agreedButUnpaid` is measured against the **programme**, not the fee (`:293-295`), so `agreed_unpaid` is unaffected. Add a test pinning that, because the name invites a wrong "fix" later. |
| `lib/lead-score.ts` | **No** | Its "Paid before" signal (`:155-159`) scores whether she has ever paid *a coach*, from quiz answers. Nothing to do with the ₹299. Leave it alone. |
| `lib/lead-scoring.ts` | **No, but watch** | `:71-72` documents a real past incident: a status writer put `⏳ Awaiting ₹299` into the STATUS column and clobbered the tier. That status string becomes a lie. Find and retire whatever writes it. |
| `lib/draft-message.ts` | **Yes** | `:212` hardcodes the pitch: "It is Rs 299 to hold the slot, and it comes off the programme fee if you go ahead", plus a resume-checkout link. It would be sent by hand, by the owner, to free bookers. Rewrite the draft. `:53` also infers funnel origin from a `dq_`/`sched_` leadId prefix, which survives. |
| `lib/crm-milestones.ts` | **Yes** | `:202-205, 223-232` render "Priced and not yet paid" / "She has paid — nothing owed" / "Priced, unpaid, and nobody has spoken to her" off `input.paid` + `paidAmount`. These are about the **programme** price in practice, but the input is fed from any payment. Confirm the feed; if `paid` includes the ₹299 today, every free booking shows as "priced and unpaid" in the CRM. |
| `app/api/cron/payment-reminder/route.ts` | **Yes** | The caller. Its header comment, its `TEMPLATE`/`TEMPLATE_FALLBACK` choice and its dry-run semantics all describe a payment funnel. |
| `app/api/admin/*` (11 routes: `crm`, `today`, `dashboard`, `digest`, `lead`, `ledger`, `mark`, `broadcast`, `creative-outcomes`, `fathom-backfill`, `webinar-report`) | **Mostly display** | These read paid state to show numbers. Per the CRM metric rules, revenue is programme-only and ₹299 never counted as a win, so headline revenue is already correct. Expect cosmetic breakage: "awaiting payment" counts, funnel step labels, and any ₹299 line in the digest. Audit as a batch, change as a batch, after the blocking items. |
| `app/lib/pricing.ts` | **Yes, eventually** | `SESSION_PRICE = 299` is the single source for both the charge and the reported value. `FREE_CALL_VALUE = 0` already exists and its comment (`:19-27`) states the free path must report zero, and that `SESSION_PRICE` stays for the paid path "currently dormant behind the middleware redirect". Read that comment before touching either constant: someone has already reasoned about this exact migration. |
| `app/complete-payment/*` | **Yes** | An entire route whose only job is resuming an abandoned ₹299 checkout, reached from the nudge template. Becomes unreachable on the cold path. Decide: retire, or keep for the retargeting case in (f). |

---

## 3. (c) The route change

### What the current path does

`app/decode/DecodeQuiz.tsx` renders the 12-tap qualifier and then mounts
`ScheduleClient` directly. Its header comment (`:24-27`) is an explicit
argument, not an implementation note:

> Pay-then-book, not book-then-pay: ScheduleClient captures the lead, takes the
> Rs 299, and only then opens the calendar. A free slot that is paid for later
> fires Schedule before any money moves, fills the calendar with people who
> never pay, and defeats the only reason the fee exists.

That comment is the previous owner-level decision this migration reverses. It
must be rewritten in the same commit that reverses it, with the new reasoning,
or the next reader will assume the change was an accident.

`app/schedule/ScheduleClient.tsx` currently does, in order (`:180-295`):

1. Fires the `Lead` server leg to `/api/events` with `LEAD_VALUE` / `CURRENCY`.
2. Mints `leadId` (`sched_<ts>_<rand>`) if one does not exist.
3. Writes `NATIVE_BOOKING_KEY` to `localStorage`: `{ step1: {name, phone,
   email}, leadId, qscore, startedAt }`.
4. POSTs `/api/quiz-lead` with the full sheet contract.
5. `trackInitiateCheckout()` + `schedule_payment_initiated`.
6. `POST /api/create-cashfree-order` → `{ paymentSessionId, orderId, amount }`.
7. Merges `{ orderId, amount }` into `NATIVE_BOOKING_KEY`.
8. Cashfree JS SDK `checkout()`.
9. On success: `window.location.href = /session-booked?orderId=…&leadId=…`.

### What the free path becomes

Steps 1-4 are unchanged and must stay unchanged — that is the lead capture, the
sheet write and the `Lead` event, none of which depend on money.

Steps 5-8 are deleted from the cold path. Step 9's redirect is what replaces
them: go straight to `/session-booked?leadId=…`, with **no `orderId`**.

The critical detail: `NATIVE_BOOKING_KEY` is the attribution bridge and it is
read in **five** places — `ScheduleClient`, `session-booked`,
`complete-payment`, `QuizFunnel`, `payment-success`. `/session-booked` reads
`step1` and `leadId` from it to prefill the Cal.com embed, and the comment at
`ScheduleClient.tsx:192-194` records why: without it the calendar asked for name,
phone and email again thirty seconds after she typed them. `qscore` rides
through the same key as Cal.com embed metadata and is, per the same comment,
**the only route the lead score has to the booking webhook**, because Cal's own
form has no questions any more.

So: the bridge survives intact, because it is written in step 3, before payment.
The only fields that stop being written are `orderId` and `amount` (step 7).
Every consumer that reads those two must tolerate their absence — audit all five
readers for `orderId` assumptions before shipping, especially `/session-booked`,
which currently receives `orderId` as a query parameter too.

`/session-booked` then opens the Cal.com embed exactly as it does today. The
`Schedule` and `QualifiedSchedule` events fire from `/api/cal-webhook` on
`BOOKING_CREATED`, which never knew about payment in the first place.

---

## 4. (d) Tracking

Read `docs/tracking-cutover-plan.md` §1.3 before changing anything here.

**`MicroPurchase` stops existing on the cold path.** It is sent server-side only,
from `/api/cashfree-webhook` (`:385-406`), guarded by the sheet's Paid + Payment
Ref columns. It was deliberately separated from `Purchase` on 12-Sep-2026 so the
₹299 fee could not drown the real programme-sale revenue number
(`app/lib/pricing.ts:8-12`, `lib/meta-conversion.ts:15`). No payment, no event.

What should happen to it: **leave the sender in place, untouched, and let it go
quiet.** It is already correctly guarded, it fires only on a real Cashfree
payment, and if the ₹299 survives anywhere (see (f)) it must keep working
unchanged. Deleting it buys nothing and costs the ability to take money on any
path. Do not replace it with a zero-value stand-in event: per the reasoning in
`pricing.ts:39-53`, this codebase reports money received, and inventing an event
for money that did not move is precisely the mistake `FREE_CALL_VALUE` exists to
undo.

**`Schedule` and `QualifiedSchedule` are unaffected, and this is the whole
point of the migration.** Both fire from `/api/cal-webhook` on the booking
itself: `Schedule` as `schedule_<uid>` with a browser leg from
`/booking-confirmed`, `QualifiedSchedule` as `qsched_<uid>`, server-only. Neither
reads payment state. Ads optimise for `Schedule`, and removing the fee should
*increase* its volume, which is the stated reason for doing this at all.

Two things to verify rather than assume:

- `Schedule`'s value. `FREE_CALL_VALUE = 0` already exists precisely so a free
  booking reports zero rather than a phantom ₹299. Confirm the live `Schedule`
  leg uses it. If any path still reports `SESSION_PRICE` on a free booking, ROAS
  on the optimisation event is inflated from day one.
- `InitiateCheckout` disappears from the cold path along with the checkout.
  Events Manager already shows it doubled (a tag-layer problem, per §1.3). If
  any ad set or custom audience is built on `InitiateCheckout`, it silently
  stops filling. Check before cutover, not after.

**Do not touch `NEXT_PUBLIC_DIRECT_PIXEL`** as part of this work. Per `AGENTS.md`
it must stay off until the GTM change in `tracking-cutover-plan.md` §4-B lands in
the same window, or every PageView doubles.

---

## 5. (e) Leads mid-flight at cutover

Three populations exist at the moment of the switch.

**Already paid, not yet booked.** Nothing owed, nothing to change. She must
still be able to book. Her `Paid = Y` row continues to be skipped by
`planReminders` under either the current or the recommended predicate.
`planBookingNudges` still matches her (she is paid and unbooked) and will still
chase her for a slot — correct behaviour, and an argument for leaving that
function's paid check alone for a defined drain period rather than rewriting it
on day one.

**Owes ₹299, has not paid, within the nudge window.** This is the population
that decides the cutover style. Two honest options:

- *Drain.* Freeze new paid checkouts, let the ≤72h nudge windows
  (`DEFAULT_MAX_AGE_HOURS` 24, `REMINDER2_MAX_AGE_HOURS` 72) expire naturally,
  then switch. Simple, no contradictory messages, costs three days.
- *Forgive.* Switch immediately and send this cohort a one-off message telling
  them the call is now free and giving them the booking link. Warmer, converts
  some of them, but needs an approved template and must be sent *before* the
  next cron run, or she gets a "your checkout is still open" nudge first.

Recommended: **drain**, unless the owner wants the goodwill message. The 11 Oct
Meta deadline is on the copy work, not on this migration, so there is no reason
to take the messier option.

**Pending Cashfree order at the instant of the switch.** A `paymentSessionId`
has been issued and she may complete payment minutes or hours later. The webhook
will fire, mark `Paid = Y`, and send `MicroPurchase` for a call that is now free
for everyone else. This is why `MicroPurchase` and the webhook stay in place.
She has paid for something now free: the owner should decide refund or credit
(see (f)), and that decision should be made *before* cutover, not when the first
one lands.

---

## 6. (f) Decisions only the owner can make

These are blocking. The plan cannot be finalised without answers.

1. **Does ₹299 survive anywhere at all, or is it gone entirely?** Specifically:
   (a) as a retargeting offer to people who did not book free; (b) as a paid
   report reading sold separately; (c) not at all. The answer decides whether
   `/complete-payment`, `create-cashfree-order`, the Cashfree webhook and
   `MicroPurchase` are retired or kept live on a second path.
2. **Does the existing refund promise still apply?** "Leave the call without
   knowing your blocker and the ₹299 is refunded" is quoted copy on `/decode`
   and is the site's strongest risk-reversal line. With nothing to refund it is
   meaningless. Does it become a different guarantee, or does it go?
3. **Women who pay during the cutover window — refund, or credit against the
   programme?** Needs an answer before the switch, not after the first case.
4. **Does the `paid_not_booked` WhatsApp sequence get re-pointed at the free
   population, or retired?** Re-pointing means chasing everyone who reached the
   calendar and did not book, which is a much larger and colder group, at Meta
   template cost per send.
5. **Does the ₹299 keep its role as the qualifier?** The fee's stated purpose
   was filtering out people who never pay. Removing it fills the calendar with
   colder bookings. Is the quiz gate (`lib/decode-gate.ts`) expected to carry
   that filtering alone, and is its threshold being raised to compensate?
6. **What replaces "₹299 · 60 minutes · one to one" site-wide?** It is the CTA
   sublabel on the homepage, `/decode`, `CallAgenda` and `FAQSection`, and the
   §9 brand rules name the site-wide CTA explicitly.
7. **Is the free call the same 60-minute consultation, or a shorter one?** If
   the product changes, more than the price does.

---

## 7. (g) Rollback

The migration is reversible if, and only if, it is built to be. Three rules.

1. **Do not delete the payment path. Bypass it.** Retiring
   `create-cashfree-order`, the Cashfree webhook, `/complete-payment` or
   `MicroPurchase` turns a config revert into a re-implementation. Leave them
   intact and unreachable from the cold path. They are already guarded and
   already tested.
2. **Sheet columns are append-only during this migration.** Do not repurpose
   `Paid`, do not renumber anything in `RESERVED_INDEXES`. Rows written under
   the free funnel must remain readable by the paid-funnel code, and vice versa.
   This is what makes a revert safe for mid-flight leads.
3. **The reminder predicate change is independently revertible.** Because the
   recommended fix (§1, Option B) is a pure-function change with a colocated
   test, it can be reverted on its own without touching the route change.

Rollback procedure, in order: revert the route change (checkout returns), revert
the copy, leave the reminder booking-check **in place** (it is correct under both
funnels — a booked woman should never get a checkout nudge either way), then
reconcile any free bookings taken in the window by hand.

The one genuinely irreversible part is bookings already taken for free. Those
calls get honoured. Budget for them.

---

## 8. Recommended PR sequence

Smallest reviewable step first. Each step is safe to ship and stop.

**PR 1 — Reminder safety, no behaviour change on the live funnel. SHIPPED as
PR #144.**
Booking evidence added to `ReminderColumns` and skipped on in `planReminders`,
Cal.com primary with the sheet as fallback. 13 tests, verified both ways: with
the gate disabled 6 fail and the 7 negative tests still pass, so it can be
neither silently broken nor silently widened into swallowing the job. **This is
correct today** (a booked woman should never get a checkout nudge on any funnel)
and it is the single change that makes everything after it safe.

One thing to check on that PR before the cutover, not after: its dry run reports
a `bookingGate` block, and `calSource: "none"` there means `CAL_API_KEY` is not
reachable from the worker and the gate is running on the sheet columns alone.

**PR 2 — Decide and encode the `planBookingNudges` question.**
Either re-point it at the free population or fence it off explicitly, with a
comment recording the decision. No silent empty-set.

**PR 3 — The route change, behind a flag.**
`ScheduleClient` skips steps 5-8 and redirects to `/session-booked?leadId=…`.
Audit all five `NATIVE_BOOKING_KEY` readers for `orderId` assumptions. Rewrite
the `DecodeQuiz.tsx` pay-then-book header comment with the new reasoning. Flag
default off, so this merges without going live.

**PR 4 — Journey and CRM.**
`lib/journey.ts` `paid_not_booked` and `hot_abandon` re-derived from booking
state; `lib/draft-message.ts` pitch rewritten; `lib/crm-milestones.ts` feed
confirmed; the `⏳ Awaiting ₹299` status writer found and retired.

**PR 5 — Copy.**
CTA sublabels site-wide, the refund line, `/decode` and homepage. Depends on
answers to (f) 1, 2 and 6. Note that `/decode` copy is guarded and its
`COMPLIANCE FLOOR` rules apply to anything written here.

**PR 6 — Flip the flag, admin cosmetics after.**
Flip in a quiet window with the cron watched for one full cycle. The 11 admin
routes are audited as a batch afterwards; they are display-only and none of them
can send a message to a client.

---

## 9. What this document is not

It is not approval to start. Items (f) 1-3 are blocking, and PR 1 is the only
step that is unambiguously correct regardless of how they are answered.
