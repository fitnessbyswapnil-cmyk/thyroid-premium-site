# call_thank_you_v1

**DRAFT — NOT SUBMITTED.** Nothing in this file has been sent to Meta. It is
submitted only after the owner OKs the text, by him, in WhatsApp Manager on
WABA `976081968452524` ("Heal Thyroid With Swapnil", +91 79784 60386). Check the
WABA id **and** the phone before creating it: this account has four
similarly named WABAs, and a template was once created on the wrong one.

| Field | Value |
|---|---|
| Name | `call_thank_you_v1` |
| Category | UTILITY |
| Language | English (`en`) |
| Body parameters | 1 |
| `{{1}}` | her first name |
| Header, footer, buttons | none |

## Body (exact)

```text
Hi {{1}}, Swapnil here. Thank you for your time on the consultation call you booked. Your written summary of the call is coming to you on this chat. If anything we discussed is unclear, just reply here and I will explain.
```

## Sample (for the submission form)

`{{1}}` = `Meera`

> Hi Meera, Swapnil here. Thank you for your time on the consultation call you
> booked. Your written summary of the call is coming to you on this chat. If
> anything we discussed is unclear, just reply here and I will explain.

## When it is sent

After a woman attends her free consultation call:

- **His tap** on Today (`POST /api/admin/thank-you`), or
- **automatically**, only while the switch `thank_you_auto` is on (default
  off): when he marks the call attended (`/api/admin/call-outcome`) or Fathom
  hears her on it (the CallHeld path of `/api/fathom-webhook`).

How it reaches her (`lib/thank-you.ts`):

1. Her 24-hour window open (she wrote to us in the last 24 hours, read from
   her thread the way the inbox reads it): the same words as a plain session
   message. No template is used, and none is needed.
2. Window shut, or her thread could not be read, with this template approved
   and `thank_you_template_approved` on: this template.
3. Window shut (or unreadable) otherwise: nothing goes from the business
   number. His tap gets "Send from your phone" with these words for a wa.me
   link; the automatic path sends nothing and leaves the step open on Today.

Never twice for one call (the `thank_you_sent` mark), never to test data
except his own number, and the automatic path never thanks a call more than
two days old or one whose summary has already gone.

## The automatic-template count (owner decision, 10-Nov-2026)

Before this template, a booked lead received at most **four** automatic
templates: `welcome_lead_score_v2`, `booking_confirmed_free_v2` (or
`booking_confirmed_partner_v1`), `call_reminder_24h`, `call_reminder_1h`.
Sending this one makes it a **fifth**, which relaxes the standing
four-per-booked-lead rule for this one message. **The owner has accepted
that: booked leads go to at most 5 automatic templates.**

**Only `call_thank_you_v1` becomes a new automatic template.** The day 1, 3
and 7 follow-ups are **not** automatic templates: they are "Send from your
phone" actions, each one his tap. The drafts `followup_day1_v1`,
`followup_day3_v1` and `followup_day7_v1` would only let that same tap go from
the business number once Meta approves them; they never send on their own,
so they do not add to the five.

## Why it is worded like this

- The same words as the session message and the wa.me text. The code holds
  them in one string, `THANK_YOU_BODY` in `lib/thank-you.ts`, and a test
  fails if this file and that string differ. Change both together, and
  Meta's copy too.
- It thanks her, says her written summary is coming on this chat, and invites
  a reply. No price, no payment link, no promotion, no medical claim.
- UTILITY, because it is an update about something she is owed from a
  booking she made: it names the booking ("the consultation call you
  booked"). Promotional wording is what gets a utility template reclassified
  to MARKETING, and marketing templates on this WABA hit Meta's per-recipient
  cap (#131049) and fail after returning a message id.
- Plain ASCII, no emoji, no em dash: the wa.me fallback corrupts symbols, and
  the copy rules ban em dashes.

## Risk at submission

Meta's classifier, as learned on 18-Sep-2026 (`docs/webinar-funnel.md` §4),
wants a utility body to name the booking **and** carry a concrete date. This
body names the booking but, by spec, has only her first name. If Meta shows
"Category does not match" at submission, the proven fix is a `v2` that
carries the call's date as `{{2}}` ("...the consultation call you booked for
`{{2}}`"), and the code must then send two parameters in the same commit, or
every send fails with 132000.

## After Meta approves it

1. WhatsApp Manager shows `call_thank_you_v1` as Approved, category UTILITY.
2. On Today, Automation, Thank-you template: "Meta approved it", then "Yes,
   it is approved" (sets `thank_you_template_approved`).
3. Only if he wants it automatic: turn on "Thank her automatically"
   (`thank_you_auto`).
