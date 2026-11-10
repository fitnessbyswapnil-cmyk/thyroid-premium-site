# followup_day7_v1

**DRAFT — NOT SUBMITTED.** Nothing in this file has been sent to Meta. It is
submitted only after the owner OKs the text, by him, in WhatsApp Manager on
WABA `976081968452524` ("Heal Thyroid With Swapnil", +91 79784 60386). Check the
WABA id **and** the phone before creating it.

| Field | Value |
|---|---|
| Name | `followup_day7_v1` |
| Category | MARKETING |
| Language | English (`en`) |
| Body parameters | 2 |
| `{{1}}` | her first name |
| `{{2}}` | his Cashfree Payment Link for the price he quoted her (lib/payment-links `payLinkFor`) |
| Header, footer, buttons | none |

## Body (exact)

```text
Hi {{1}}, Swapnil here. This is my last message about the programme, so I do not crowd your chat.

If now is not the right time, I understand. If you decide to go ahead later, this is your payment link:
{{2}}

You can reply here any time with a question. Wishing you good health.
```

## Sample (for the submission form)

`{{1}}` = `Meera`, `{{2}}` = his real ₹20,000 link as saved on the dashboard
(a `https://payments.cashfree.com/links/...` address, never a shortened link).

## Its job

Day 7: a respectful last note. It says plainly that this is the last one,
accepts a "not now", and leaves the door open with the link and an
invitation to reply. No discount, no deadline, no medical claim.

## When it is sent

Never automatically. His tap on the follow-up card. Until this template is
approved and `followup_templates_approved` is on, that tap is "Send from
your phone". After approval, the same tap sends it from the business number
when her 24-hour window is shut, through `POST /api/admin/send-template` with
`params: [firstName, payLinkFor(her quoted price)]`. No link for her price:
do not use the template (Meta rejects an empty parameter).

Cashfree links can carry an expiry date. The words promise only that she can
reply any time, not that this link will still work months later.

## The link is `{{2}}`, not a URL button

Same reason as `followup_day1_v1.md`.

## MARKETING caveats

The per-recipient cap (#131049) fails after a message id is returned. Check
her thread to see whether it arrived.
