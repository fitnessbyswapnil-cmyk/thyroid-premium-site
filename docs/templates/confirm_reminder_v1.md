# confirm_reminder_v1

**DRAFT — NOT SUBMITTED.** Nothing in this file has been sent to Meta. It is
submitted only after the owner OKs the text, by him, in WhatsApp Manager on
WABA `976081968452524` ("Heal Thyroid With Swapnil", +91 79784 60386). Check the
WABA id **and** the phone before creating it.

| Field | Value |
|---|---|
| Name | `confirm_reminder_v1` |
| Category | UTILITY |
| Language | English (`en`) |
| Body parameters | 2 |
| `{{1}}` | her first name |
| `{{2}}` | her session date and time as she reads it, from `formatBookingWhen` in lib/whatsapp.ts (e.g. "Friday, 14 November 2026 at 07:00 pm") |
| Header, footer, buttons | none |

## Body (exact)

```text
Hi {{1}}, Swapnil here. Your consultation call is booked for {{2}}. Please reply YES to confirm you can join. If that time no longer works for you, reply here and I will offer you another slot.
```

## Sample (for the submission form)

`{{1}}` = `Meera`, `{{2}}` = `Friday, 14 November 2026 at 07:00 pm`

> Hi Meera, Swapnil here. Your consultation call is booked for Friday, 14
> November 2026 at 07:00 pm. Please reply YES to confirm you can join. If that
> time no longer works for you, reply here and I will offer you another slot.

## Its job

Her booking is coming up and she has not confirmed (she has not replied on
WhatsApp since her booking confirmation). It asks her to reply YES. Her reply
is what counts as Confirmed on Today, and it also opens her 24-hour window,
so everything after it can go as free session messages.

## When it is sent

Never automatically. His tap ("Send reminder") on a not-confirmed card.
Until this template is approved and `confirm_reminder_template_approved` is
on, that tap is "Send from your phone". After approval, the same tap sends it
from the business number when her window is shut, through
`POST /api/admin/send-template` with `params: [firstName, sessionWhen]`.

## Why it is worded like this

UTILITY needs the body to name the booking and carry a concrete date
(`docs/webinar-funnel.md` §4, learned 18-Sep-2026): "Your consultation call is
booked for `{{2}}`" does both. No "free", no offer, no link: promotional words
are what get a utility template reclassified to MARKETING. Plain ASCII, no
emoji, no em dash. `{{2}}` must be one line: Meta rejects a parameter with a
newline or a tab, and `formatBookingWhen` already collapses whitespace.
