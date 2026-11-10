# followup_day1_v1

**DRAFT — NOT SUBMITTED.** Nothing in this file has been sent to Meta. It is
submitted only after the owner OKs the text, by him, in WhatsApp Manager on
WABA `976081968452524` ("Heal Thyroid With Swapnil", +91 79784 60386). Check the
WABA id **and** the phone before creating it.

| Field | Value |
|---|---|
| Name | `followup_day1_v1` |
| Category | MARKETING |
| Language | English (`en`) |
| Body parameters | 2 |
| `{{1}}` | her first name |
| `{{2}}` | his Cashfree Payment Link for the price he quoted her (lib/payment-links `payLinkFor`) |
| Header, footer, buttons | none |

## Body (exact)

```text
Hi {{1}}, Swapnil here. Thank you again for your time on our call. How are you feeling about the plan we went through?

If any part of it needs more explaining, just reply here. When you are ready to begin the programme, this is your payment link:
{{2}}

Any question at all, I am here.
```

## Sample (for the submission form)

`{{1}}` = `Meera`, `{{2}}` = his real ₹20,000 link as saved on the dashboard
(a `https://payments.cashfree.com/links/...` address; Meta's reviewers may
open the sample, so use a real one, never a shortened link).

## Its job

Day 1 after a call where he quoted a price and she has not paid: a warm
check-in. It asks how she feels, invites questions and leaves the link. No
discount, no deadline, no medical claim.

## When it is sent

Never automatically. The follow-up card's button is his tap. Until this
template is approved and `followup_templates_approved` is on, that tap is
"Send from your phone" (a wa.me draft). After approval, the same tap sends
this template from the business number when her 24-hour window is shut,
through `POST /api/admin/send-template` with
`params: [firstName, payLinkFor(her quoted price)]`. Inside her window it is a
plain session message instead.

No link saved for her price: do not use this template (Meta rejects an empty
parameter). The card asks him to add the link, and the phone draft goes
without one.

## Why the link is `{{2}}` in the body, not a URL button

- The send path the dashboard uses, `/api/admin/send-template`, sends body
  parameters only. A URL button needs a separate button parameter that route
  does not pass.
- A dynamic URL button can vary only the END of a fixed address approved in
  advance. His four links are separate Cashfree links (and may be `cfre.in`
  short links), so no single fixed prefix fits them all without a redirect
  page of our own, which does not exist yet.
- The wa.me fallback carries the link as text, so the phone draft and the
  template read the same.

If he later wants a button, the clean version is a redirect on our own
domain (`/pay/{{1}}` with the price as the button's parameter), which keeps
every handoff on our domain first, as the WhatsApp session doc asks. That
needs a new route and a change to send-template, and a v2 of this template.

## MARKETING caveats

Marketing templates on this WABA hit Meta's per-recipient frequency cap
(#131049), which fails AFTER Meta returns a message id: the send looks
successful and nothing arrives. Check delivery in her thread, not the API's
answer. Meta may also offer a "Stop promotions" opt-out button at
submission; adding it is his choice.
