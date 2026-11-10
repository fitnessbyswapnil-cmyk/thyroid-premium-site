# followup_day3_v1

**DRAFT — NOT SUBMITTED.** Nothing in this file has been sent to Meta. It is
submitted only after the owner OKs the text, by him, in WhatsApp Manager on
WABA `976081968452524` ("Heal Thyroid With Swapnil", +91 79784 60386). Check the
WABA id **and** the phone before creating it.

| Field | Value |
|---|---|
| Name | `followup_day3_v1` |
| Category | MARKETING |
| Language | English (`en`) |
| Body parameters | 2 |
| `{{1}}` | her first name |
| `{{2}}` | his Cashfree Payment Link for the price he quoted her (lib/payment-links `payLinkFor`) |
| Header, footer, buttons | none |

## Body (exact)

```text
Hi {{1}}, Swapnil here. Many women like to talk it over with family before they decide, and that is completely fine.

If it helps, I am happy to join a short call with them and answer their questions myself. Just reply here with a time that suits you.

Your payment link, for whenever you are ready:
{{2}}

Take all the time you need.
```

## Sample (for the submission form)

`{{1}}` = `Meera`, `{{2}}` = his real ₹20,000 link as saved on the dashboard
(a `https://payments.cashfree.com/links/...` address, never a shortened link).

## Its job

Day 3: answer the commonest hesitation without pressure. The repo records
it in `lib/decision-maker.ts` and `lib/decode-commitment.ts`: a good call
most often stalls because she does not decide alone, and the person she
decides with only hears it second-hand. So the message makes talking it over
normal and offers that person a short call of their own. No discount, no
deadline, no medical claim.

## When it is sent

Never automatically. His tap on the follow-up card. Until this template is
approved and `followup_templates_approved` is on, that tap is "Send from
your phone". After approval, the same tap sends it from the business number
when her 24-hour window is shut, through `POST /api/admin/send-template` with
`params: [firstName, payLinkFor(her quoted price)]`. No link for her price:
do not use the template (Meta rejects an empty parameter).

## The link is `{{2}}`, not a URL button

Same reason as `followup_day1_v1.md`: send-template passes body parameters
only, a dynamic button can only vary the end of one fixed address, and the
wa.me draft carries the link as text, so both read the same.

## MARKETING caveats

The per-recipient cap (#131049) fails after a message id is returned. Check
her thread to see whether it arrived.
