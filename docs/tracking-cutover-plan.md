# Meta tracking cutover: one Purchase per order, and a pixel that fires early

Written 2026-09-12. Covers the Meta dataset `1004294955172584`, the web GTM
container `GTM-P3S5BXQB` (served through Stape at `lime.swapnilumbarkarfitness.in`),
the Stape server container `GTM-TWZ9N346` ("MetaCAPI-Server"), and the app's own
Conversions API sends from `lib/server-tracking.ts`.

Nothing in this file contains a secret. Every console change below is done
by the owner. Code cannot reach GTM, Stape or Meta.

---

## 0. Summary

| Change | Where | Default | Needs a console change? |
|---|---|---|---|
| Purchase sends ONE browser leg per order | `app/lib/analytics.ts` `trackPurchase` | **on** (ships with the code, no flag) | Not to ship it. §4-A is still needed to rule out a second **server** leg. |
| Direct pixel in `<head>`, PageView with an event id | `app/components/tracking/MetaPixel.tsx`, `pixel-core.ts`, `trackPageView` | **off** (`NEXT_PUBLIC_DIRECT_PIXEL` unset) | **Yes. Never switch it on without §4-B.** On its own it sends every PageView twice. |

With the flag unset, the site behaves exactly as before, except that
`trackPurchase` no longer makes its own `fbq` call (see §2).

---

## 1. Event matrix

### 1.1 The live funnel, and which code is actually reachable

```
Meta ad → /decode → /decode/quiz (DecodeQuiz)
  gate: name + WhatsApp            → Lead (browser, via GTM)  + QuizComplete (server)
  checkout (ScheduleClient, embedded in DecodeQuiz)
                                    → InitiateCheckout (browser, via GTM)
  Cashfree → /payment-success → /session-booked
                                    → Purchase (browser, via GTM) + Cashfree webhook (server)
  Cal.com slot → /booking-confirmed → Schedule (browser, via GTM) + /api/cal-webhook (server)
```

`next.config.ts` redirects `/assessment`, `/schedule`, `/book`, `/book-session`,
`/complete-payment`, `/payment` and `/how-it-works`. The tracking calls in those
pages (`QuizFunnel`, `BookingFlow`, `QualifyingFlow`, `BookPageClient`,
`BookSessionClient`, `CompletePaymentClient`, `PayButton`) still exist but cannot
be reached by URL. `ScheduleClient` is still live because `DecodeQuiz` renders it.
`/booking-confirmed` is live again: `/session-booked`'s `handleBooked` sends every
paid booking there, even though a comment in `ConfirmSessionClient` calls it
"dormant".

### 1.2 How to read "can Meta deduplicate"

Meta pairs events that share `event_name` and `event_id` within 48 h. In this
account's own Test Events, **one browser leg plus one server leg** with the same
id pairs up and shows "Deduplicated" (PageView). Four legs sharing
`schedule_<uid>`, two browser and two server, were all "Processed" and all
counted (commit `3a0b119`). The working rule here is therefore:

> exactly one browser leg + exactly one server leg, same id → counted once.
> Any extra leg with the same id → counted again. Different ids → never pair.

"GTM" in the tables means a tag inside a container this codebase cannot see.
Every GTM row is an item to check in the console (§4).

### 1.3 Per event

**PageView**

| Leg | Emitted by | Channel | event_id | Notes |
|---|---|---|---|---|
| dataLayer `page_view` | `RouteTracker` → `trackPageView` | feeds GTM | `page_view_<unix>_<rand4>` | Every route. Under the flag, the first push of a document reuses the head script's id. |
| GTM "Meta Ads PageView" | web GTM, trigger Initialization – All Pages | Browser | **GTM: check** | This tag loads fbevents.js and inits the pixel today, with no advanced matching. It is the ~1.5 s chain. |
| Head script (flag on) | `MetaPixel.tsx` → `directPixelBootstrap` | Browser | `page_view_<unix>_<rand4>`, minted in the browser | Also pushes `meta_pageview_event_id` to the dataLayer before gtm.js loads. |
| `trackPageView` fbq (flag on) | client-side route changes only | Browser | same id as that route's dataLayer push | `fbq.disablePushState = true` stops fbevents' own id-less PageViews. |
| Stape CAPI PageView | sGTM, fed by a web GA4 tag | Server | **GTM: check** which variable | Today it pairs with the GTM browser tag ("Deduplicated"). |
| `/api/admin/capi-test` | admin only | Server | `capitest_<ms>` | Always carries a test code, so it never counts. |

Dedup today: yes (browser GTM + sGTM share an id, source unseen). Flag on: only
if the sGTM PageView tag carries the head id (§4-B step B2/B3).

**ViewContent**

| Leg | Emitted by | Channel | event_id | Notes |
|---|---|---|---|---|
| dataLayer `view_content` | `trackViewContent` in `BookSessionClient`, `BookPageClient` | feeds GTM | `view_content_<unix>_<rand4>` | Both routes redirect to `/decode`, so **nothing on the live funnel pushes ViewContent**. |
| GTM / sGTM tags | unknown | | **GTM: check** | If a ViewContent reaches Meta today, it comes from a GTM trigger, not this code. |
| `/api/events` | allow-listed, no caller | | | |

**Lead**

| Leg | Emitted by | Channel | event_id | Notes |
|---|---|---|---|---|
| dataLayer `lead` | `trackLead`: `DecodeQuiz` gate (live); `ScheduleClient` only when no lead exists yet (on /decode the gate has already made one); retired routes | feeds GTM | `lead_<unix>_<rand4>` | |
| GTM "Meta Pixel – Lead (Browser)" | web GTM | Browser | **GTM: check.** Memory from 07-Sep notes the event-id variables are inconsistent (`{{DL - event_id}}` / `{{js – Persistent Lead ID}}` / `{{DLV - event_id}}`). | Carries advanced matching (em/ph/external_id/fn). |
| `/api/events` Lead | `ScheduleClient` (no-existing-lead path), `QuizFunnel`, `QualifyingFlow`, `BookingFlow` | Server | same `lead_…` as the push | **Not sent from the live `/decode` gate**: `DecodeQuiz` calls `trackLead` only. |
| Stape CAPI Lead | sGTM | Server | **GTM: check** | |
| `/api/tally-webhook` | legacy Tally form | Server | form's `event_id` or `Lead_tally_<id>` | |

Dedup on the live gate is decided entirely by the GTM Lead tag and the sGTM
Lead tag. They pair only if both read the dataLayer `event_id`. Where
`/api/events` also fires, it is a possible third leg.

**QuizComplete** (custom): server only, `/api/quiz-lead` (source `decode_quiz`),
`quiz_<leadId>`, action_source website. One leg, nothing to pair. A repeat POST for
the same lead reuses the id.

**InitiateCheckout**

| Leg | Emitted by | Channel | event_id | Notes |
|---|---|---|---|---|
| dataLayer `initiate_checkout` | `trackInitiateCheckout` in `ScheduleClient` (live); retired routes; `PayButton` (value 45000, retired) | feeds GTM | `initiate_checkout_<unix>_<rand4>` | Exactly one push per checkout. |
| GTM browser tag | unknown | Browser | **GTM: check** | |
| Stape CAPI InitiateCheckout | sGTM | Server | **GTM: check** | |

Events Manager already shows InitiateCheckout doubled
(`whatsapp-automation-session-2026-08.md` §4). The code pushes once and has no
server leg, so the extra event comes from the tag layer.

**Purchase**: the event this upgrade is about

| Leg | Emitted by | Channel | event_id | Status |
|---|---|---|---|---|
| B1 GTM "Meta Pixel – Purchase" | web GTM, trigger `purchase` (id 165), Event ID `{{DL - event_id}}` | Browser | `Purchase_<orderId>` | Live. **The one browser leg, after this change.** |
| B2 direct `fbq("track","Purchase")` | `trackPurchase` in `app/lib/analytics.ts` | Browser | `Purchase_<orderId>` | **Removed by this change.** It was a second browser leg with the same id. |
| S1 Cashfree webhook | `/api/cashfree-webhook` → `sendCAPIEvent` | Server | `Purchase_<refId>` (= the `thyroid_<leadId>_<ts>` order id on the gateway path) | Live. Fires on payment even if she never reaches /session-booked. Guarded by the sheet's Paid + Payment Ref columns. |
| S2 `/api/events` Purchase | `/session-booked` POST | Server | `Purchase_<orderId>` | **Dead.** `Purchase` is not in `/api/events`' allow-list, so the route returns 400. That is harmless, and in fact good, because it would otherwise be a second server leg. The route is guarded, so it is left alone. |
| S3 Stape CAPI Purchase | sGTM tag 71, trigger 68 `purchase`, Event ID `{{ED - event_id}}` | Server | whatever the web GA4 tag forwards | **GTM: check.** If the web tag "GA4 – Purchase" is active it forwards `{{JS - event_id}}`, a random id, which gives a second, never-deduplicated Purchase. Memory says version 515 (19 Aug) paused it. The 10-Sep double says something still sends a second leg. |

Before this change one order produced B1 + B2 in the browser plus S1 (and
possibly S3) on the server. On 10 Sep one real ₹299 payment showed as 2 Purchases
worth ₹598. Removing B2 is certain to take one extra leg out. Whether S3 is also
live can only be seen in the console, so §4-A covers it.

`lib/meta-conversion.ts` sends the programme sale as **`Subscribe`**
(`program_<seed>`, action_source phone_call) via `/api/admin/mark`. It is a
different event name and cannot collide with Purchase.

**Schedule** (the event the ads optimise for)

| Leg | Emitted by | Channel | event_id | Notes |
|---|---|---|---|---|
| dataLayer `schedule` | `trackSchedule` from `/booking-confirmed` (live) and `/confirm-session` (retired free flow). `claimScheduleOnce` limits it to one per uid per browser. | feeds GTM | `schedule_<uid>` | No direct fbq since `3a0b119`. |
| GTM "Meta Pixel - Schedule (Browser)" | web GTM | Browser | **GTM: check** it is `{{DLV - event_id}}` | Advanced matching from `metaUserData`. |
| `/api/cal-webhook` | BOOKING_CREATED | Server | `schedule_<uid>` | The intended server leg. |
| `/api/admin/replay-schedule` | manual admin replay | Server | `schedule_<uid>` | Only for bookings the webhook missed. Replaying one the webhook DID send makes a second server leg. |
| sGTM | `3a0b119` saw the server container forwarding the `schedule` push | Server | **GTM: check** | The current sGTM tag list (PageView, Lead, InitiateCheckout, Purchase, CalcomView) has no Schedule tag. Confirm none remains. |
| `/api/events` | rejects Schedule with 409 | | | |

**QualifiedSchedule** (custom): server only, `/api/cal-webhook`, `qsched_<uid>`.

**CallHeld** (custom): server only, action_source phone_call, `call_<uid>`,
event_time = call start. Two senders share the id: `/api/fathom-webhook` and
`/api/admin/fathom-backfill`. Running backfill with `force` on a call the webhook
already sent produces a second server leg.

**ReportReceived** (custom): server only, `/api/whatsapp-webhook`,
action_source business_messaging, `report_<last10>_<YYYYMMDD>` (one per number
per day).

**Browser-only dataLayer events** (which of these reach Meta is decided entirely
in GTM):
`symptom_pattern_reached` (`symptom_pattern_…`), `calcom_view` (`calcom_view_…`;
the web GTM "CalcomView" tag sits on an obsolete trigger, while the sGTM has a
CalcomView CAPI tag), `video_play` / `video_progress_75` (tags `Meta - VideoPlay` /
`Meta - VideoProgress75` per `docs/gtm-video-events.md`, if they were built),
`cta_click`, `scroll_depth` (no event_id), and `metaUserDataReady` (identity
carrier, not a Meta event). Also `booking_identity` and the
`decode_*`/`schedule_*`/`quiz_*` funnel markers.

Dead code, for completeness: the `track*` functions in `lib/tracking.ts` have no
importers (only its cookie/UTM getters are used), and `/api/events` allow-lists
StartForm, CTAClick, WhatsAppClick, AddPaymentInfo, SessionQualified, Engagement
and ScrollDepth with no caller.

### 1.4 Headline findings

1. **Purchase had two browser legs**: GTM's "Meta Pixel – Purchase" plus a direct
   `fbq` call in `trackPurchase`, both `Purchase_<orderId>`. This is the same fault
   that produced four Schedules per booking. `3a0b119` kept the Purchase `fbq` on
   the belief that "that path has no GTM browser tag", but the tag exists (verified
   in the console, June and 07-Sep).
2. **The `/api/events` Purchase leg never reached Meta** (400, not allow-listed).
   Code sends exactly one server Purchase, from the Cashfree webhook.
3. **The only other possible Purchase leg is the Stape CAPI Purchase tag.** Code
   cannot see it. Pause it (§4-A).
4. **Lead on the live `/decode` gate has no code-side server leg**, so whether
   Lead deduplicates depends entirely on two GTM/Stape event-id fields.
5. **Nothing on the live funnel pushes ViewContent.**
6. `/booking-confirmed` is the live Schedule page for paid bookings.

---

## 2. What the code does now

**Purchase (`trackPurchase`, no flag).**
- Pushes the dataLayer `purchase` event and nothing else. The GTM tag is the
  browser leg and the Cashfree webhook is the server leg: one pair.
- Once per order per browser, durable across tabs (localStorage, with
  sessionStorage as fallback, key `meta_purchase_claimed_Purchase_<orderId>`).
  `/session-booked`'s own guard is sessionStorage only, so reopening the page in
  a new tab (for instance from the WhatsApp booking link) used to fire Purchase
  again.
- Refuses any id that is not `Purchase_<orderId>`. The old fallback minted a
  random id that could never pair with the webhook. The only caller always
  passes the contract id and returns early when there is no order id.

Why no flag: the dataLayer payload and event name are byte-for-byte what GTM
received before. "Meta Pixel – Purchase" and "GA4 – Purchase" see the same first
fire for every order. The only changes are that the duplicate `fbq` leg is gone
and repeat pushes for an order already pushed from this browser are suppressed.
The worst case is that the GTM tag is broken or paused. Then there is no browser
Purchase, the webhook still sends one, and Meta counts the sale once. It loses
some browser match signals, but the count stays right, and that is the safe
direction to fail.

`/session-booked` was not edited.

**Direct pixel (`NEXT_PUBLIC_DIRECT_PIXEL`, default off).** When on:
- An inline `<head>` script (not `next/script`: in the App Router even
  `beforeInteractive` inline scripts wait for Next's bootstrap chunk) installs the
  standard fbq queue, loads `fbevents.js` async, and inits the pixel. Advanced
  matching (em, ph, fn, ln, external_id) comes from the identity the site already
  stores, normalised exactly as `analytics.ts` normalises it. The script then
  sends PageView with an event id minted in the browser. The HTML is served from
  a static cache, so an id minted at render time would be shared by every visitor.
- It adds the pixel to `window._fbq_gtm_ids`, the list GTM's Facebook Pixel
  template checks before calling `init`. GTM's per-event Meta tags (Lead,
  Purchase, Schedule, video) keep firing. They reuse this pixel, and tags that
  carry advanced matching re-init with it exactly as they do today.
- `fbq.disablePushState = true`: client-side route changes send their PageView
  from `trackPageView`, carrying the same id as that route's dataLayer push,
  instead of fbevents' automatic, id-less one.
- The PageView id goes to `trackPageView` (the first `page_view` dataLayer push
  of the document reuses it) and to GTM as dataLayer key `meta_pageview_event_id`,
  pushed before gtm.js loads.
- GTM keeps loading exactly as before, for everything else.

Expected effect: the browser PageView request leaves as soon as `fbevents.js` and
the signals config arrive. It no longer waits for hydration, then gtm.js through
Stape, then the GTM tag. That targets the ~43% of ad clicks that never register a
landing page view.

`NEXT_PUBLIC_*` is **inlined at build time**. On Cloudflare, set it in the shell
that runs `npm run deploy`. A Worker variable or secret does not reach client
code. On Vercel, set it as a project env var and redeploy.

---

## 3. Order of operations

1. Merge + deploy the code **with the flag unset**. This changes Purchase only.
2. Do §4-A (Purchase console checks). Verify. Let it run a few days of real
   payments.
3. Only then do §4-B: prepare GTM, deploy with `NEXT_PUBLIC_DIRECT_PIXEL=1`,
   publish GTM within minutes, verify.

> **Plainly: `NEXT_PUBLIC_DIRECT_PIXEL=1` must only be deployed together with the
> §4-B GTM publish.** Without it, every page sends two browser PageViews (the head
> pixel's and GTM's "Meta Ads PageView"), and the server PageView pairs with at
> most one of them.

---

## 4. Console plan

### 4-A. Purchase: one browser leg, one server leg

**A0. Baseline.** Events Manager → Datasets → `1004294955172584` → Overview →
Purchase. Note the last 7 days: total, Browser vs Server split, and the
deduplication figures in the event's detail panel. Compare with the number of
real Cashfree payments in the same window.

**A1. Web GTM `GTM-P3S5BXQB`, read the LIVE version.** Use Versions → the
published version, not the workspace, since a workspace can differ from what is
live.
- `GA4 – Purchase`: must be **Paused** in the live version. If it is active,
  pause it. It sends `purchase` to the server container with `{{JS - event_id}}`,
  a random id.
- Every tag on trigger `purchase` (id 165), and every tag on a regex or
  "All Custom Events" trigger that would match `purchase`: the only Meta tag
  should be `Meta Pixel – Purchase`. Its Event ID must be `{{DL - event_id}}`,
  and in Preview it must resolve to `Purchase_thyroid_…`.

**A2. Stape server container `GTM-TWZ9N346`.**
- **Pause the Facebook CAPI "Purchase" tag** (tag 71, trigger 68). The Cashfree
  webhook is the server Purchase owner. It fires on the payment itself, even if
  she closes the tab, and it carries fbc/fbp/visitor_id from the order tags. A
  second server Purchase, even with a matching id, is a third leg, and this
  account counts third legs.
- While there: any tag still carrying test event code `TEST13494` (June's list:
  tags 49, 53, 58, 71, 81) routes its events to Test Events, where they do not
  count. Remove it.
- Publish.

**A3. Verify with one test payment.**
- Events Manager → Test Events → "Test browser events", open the site from there,
  and pay through the normal `/decode/quiz` flow.
- Expected browser rows: **one** Purchase, Event ID `Purchase_thyroid_<leadId>_<ts>`.
  Reload `/session-booked`, then open it in a new tab: **no new row**.
- The webhook's server Purchase appears in Test Events only if it carries a test
  code. `META_TEST_EVENT_CODE` in `/api/cashfree-webhook` applies to **every**
  payment. Unlike `/api/cal-webhook`, it has no owner-only fence. Do not set it
  while real customers are paying: it would hide their Purchases from reporting
  (the 28-Aug Schedule incident). Confirm the server leg from the Worker log
  line `[cashfree-webhook] … Purchase CAPI result: { success: true, events_received: 1 }`
  instead.
- Next day, in the Events Manager Purchase detail: the test order appears once,
  with value equal to one charge. Over the following week, Purchases in Ads
  Manager should equal real Cashfree payments.

If any Purchase leg still shows up twice, identify it by its parameters:

| Leg | Test Events channel | Fingerprint |
|---|---|---|
| GTM "Meta Pixel – Purchase" | Browser | whatever the tag's object properties are; Event ID `Purchase_…` |
| old direct fbq (should be gone) | Browser | custom data exactly `value`, `currency`, `order_id` |
| Cashfree webhook | Server | `content_name: thyroid_session_fee`, `num_items: 1`, `order_id` |
| Stape tag 71 | Server | GA4-shaped fields (page_location, page_title…); id from event data |

**A4. Rollback.** GTM: Versions → publish the previous version (each container
separately). Code: revert the commit. The old double browser leg comes back with
it.

### 4-B. Direct pixel (after 4-A is settled)

**B1. Record before changing anything** (screenshots are fine):
- Web GTM `Meta Ads PageView`: its Event ID field, "Disable Automatic
  Configuration", "Disable History/pushState", advanced-matching table (expected
  empty), trigger.
- Which web tag feeds the server PageView: the Google tag / GA4 config sending
  its automatic `page_view` to the server URL, or a GA4 event tag on the `page_view`
  custom event. Record its `event_id` parameter.
- Stape `GTM-TWZ9N346`, Facebook CAPI PageView tag: its Event ID field.

**B2. Web GTM workspace (prepare, do NOT publish yet):**
- **Pause `Meta Ads PageView`.**
- New Data Layer Variable `DLV - meta_pageview_event_id` → key
  `meta_pageview_event_id`.
- Make the server PageView carry the head id. On the web tag that sends the page
  load's `page_view` to the server container, set event parameter `event_id` =
  `{{DLV - meta_pageview_event_id}}`. The key is pushed before gtm.js loads, so it
  is already set at Initialization. If the server PageView is instead built from
  the `page_view` custom event with `{{DLV - event_id}}`, nothing changes: under
  the flag, that push's `event_id` is the head id.
- Leave `Meta Pixel – Lead (Browser)`, `Meta Pixel – Purchase`,
  `Meta Pixel - Schedule (Browser)` and the video tags **active**.
- If `Meta Ads PageView` had "Disable Automatic Configuration" ticked, stop and
  tell engineering: the head pixel leaves automatic configuration on, which is
  also what powers Meta's automatic advanced matching.

**B3. Stape:** the Facebook CAPI PageView tag's Event ID must be
`{{ED - event_id}}` (event data). Publish if it changed. On its own this is safe:
the id it reads is the same kind of value as today.

**B4. Deploy with the flag.**
- Cloudflare (production): `NEXT_PUBLIC_DIRECT_PIXEL=1 npm run deploy`.
- Vercel (rollback copy): add `NEXT_PUBLIC_DIRECT_PIXEL=1` to the project's env
  and redeploy. Otherwise a rollback to Vercel serves a site with no pixel
  PageView at all, because GTM's is paused.
- Check view-source of `https://www.swapnilumbarkarfitness.in/decode`: the
  `<head>` contains `<script id="meta-pixel-direct">`.

**B5. Publish the B2 workspace immediately.** Between B4 and B5 every page sends
two browser PageViews, so keep that gap to minutes. A brief double PageView is
the lesser harm. The reverse order would leave a gap with no browser PageView.

**B6. Verify.**
- Meta Pixel Helper on `/decode`: one pixel, PageView with `eventID page_view_…`,
  no duplicate-pixel warning.
- Test Events: per page load, **one** browser PageView and **one** server
  PageView with the same Event ID, one marked "Deduplicated".
- Walk the funnel: the gate's Lead carries advanced-matching parameters as
  before, Purchase shows one browser row, Schedule shows one browser row.
- DevTools → Network on a cold load of `/decode`: record the time of the first
  `facebook.com/tr?…ev=PageView` request after navigation start. It was ~1.5 s,
  and it should now be well before GTM's own requests.

**B7. Watch 3–7 days:** landing page views ÷ link clicks in Ads Manager (the 43%
gap), daily PageView count against the baseline (a jump means the double is still
there), and Schedule/Purchase counts unchanged.

**Rollback B.** Publish the previous web GTM version (this reactivates
`Meta Ads PageView`), then redeploy without the flag (`npm run deploy` with the
variable unset; remove it on Vercel and redeploy). GTM first, for the same reason
as B5.

### 4-C. Worth doing in the same console session (not required for this change)
- `Meta Pixel – Lead (Browser)` Event ID → `{{DLV - event_id}}`, and the Stape
  Lead tag → `{{ED - event_id}}`, so the gate's Lead pairs.
- InitiateCheckout: list every tag on `initiate_checkout` in both containers.
  Expect one browser tag plus one server tag, both reading the dataLayer
  `event_id`.

---

## 5. Should Cloudflare Zaraz replace GTM + Stape?

**Cost is not the issue.** Every Cloudflare account gets 1,000,000 Zaraz events a
month free, then $5 per extra million, and "one Zaraz Event is an event you are
sending to Zaraz, whether that is a page view, a `zaraz.track` event, or similar"
(developers.cloudflare.com/zaraz/pricing-info). This site's volume is far below that.

**Evidence on its Facebook Pixel tool** (the `managed-components/facebook-pixel`
component):
- Documented settings: Pixel ID, **Conversion API Access Token**, optional Test
  Event Code. The documented event fields list `ev`, value, em/ph/fn/ln/…,
  external_id and data-processing options. They do **not** list `event_id`,
  `fbc` or `fbp`.
- Its source (`src/track.ts`) sends events to the Graph API from Cloudflare's
  edge. It takes `event_id` from `payload.event_id` **if present, otherwise a
  random number**. That is undocumented behaviour, not a contract, so it can
  change. It keeps `fbp` in its own client key (`fb-pixel`) and builds `fbc`
  from `fbclid` into its own key (`fb-click`). It does not read the `_fbp`/`_fbc`
  cookies that `middleware.ts` seeds and that the app's own server events
  (Cashfree webhook, `/api/events`, cal-webhook metadata) forward. I found no
  browser `fbevents.js` leg in it.

**What that means for deduplication here.** Every "browser" event would become a
server event sent from the edge. The money events already have a server leg in
the app (Purchase via the Cashfree webhook, Schedule via cal-webhook, Lead via
`/api/events` on some paths). Put a Zaraz copy beside each and you get
server + server pairs, which this account has counted rather than folded. That is
exactly the failure being fixed here. They pair at all only if every `zaraz.track`
call passes the right `event_id`, and that relies on undocumented behaviour. The
same visitor would also carry two different fbp values (Zaraz's and `_fbp`),
which weakens matching between legs.

**Recommendation: do not migrate now.** Finish §4-A and §4-B first. The lower-risk
path to fewer moving parts, if that is still wanted later, is:
- the browser pixel owned in code (this flag, extended to the other browser events),
- the app's own CAPI sends for Lead, Purchase, Schedule and the custom events,
- the Stape Meta tags retired,
- GTM kept only for GA4.

Revisit Zaraz only if Cloudflare documents `event_id` and `_fbp`/`_fbc`
pass-through for the Facebook tool, or for GA4 offload alone.

---

## 6. Risks

- **Flag without console = double PageViews.** Stated above. It is the reason
  the flag defaults off.
- **Purchase browser leg now depends on the GTM tag**, as Schedule's already
  does. If that tag is paused or broken, Purchase still counts once, via the
  webhook, but with fewer browser signals.
- **GTM template assumption.** `_fbq_gtm_ids` and the re-init-with-AM behaviour
  come from the public Facebook Pixel GTM template source. If the container uses
  a different or custom template, the per-event tags may call `init` again.
  B6's Pixel Helper check catches that.
- **Automatic configuration** is left on by the head pixel. If the GTM tag had it
  off, automatic events and automatic advanced matching behave differently.
  B1/B2 check for this.
- **Build-time flag.** A flag set only as a Cloudflare runtime variable does
  nothing. The Cloudflare and Vercel builds must agree, or a rollback changes
  tracking.
- **Development only:** React StrictMode runs effects twice in `next dev`, so the
  dev server shows a second, id-carrying PageView. Production is unaffected.
