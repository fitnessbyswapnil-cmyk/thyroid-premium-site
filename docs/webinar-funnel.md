# The webinar funnel — how to run it

The free Thyroid Fat Loss Masterclass at `/webinar`: what it is, how to run the
next class, and every switch that controls it.

Written for the owner first. Nothing here needs a deploy unless it says so.

Read `docs/whatsapp-automation-session-2026-08.md` for the `/decode` funnel it
sits beside. This file is authoritative for `/webinar` only.

---

## 0. One thing to know before anything else

**The WhatsApp template body copy is not in this repo.** The code knows template
names and how many `{{n}}` parameters each one takes; the actual words live in
WhatsApp Manager on WABA `976081968452524`. §4 records the parameter contract
exactly — what the code sends into each slot — and the wording rule that got the
templates approved. If a word in a message is wrong, the fix is in WhatsApp
Manager, not here. If the *number* of parameters is wrong, the send fails with
Meta error 132000 and the fix is in the code.

Two other things are not set up yet, and the code handles their absence
gracefully rather than breaking:

- **The Zoom / Meet link.** `WEBINAR_JOIN_URL` is `null`. `/webinar/join`
  currently redirects to `/webinar`.
- **The Starter Kit PDF.** `WEBINAR_STARTER_KIT_URL` is `null`. The thank-you
  page hides the download button entirely while it is unset.

---

## 1. What the funnel is

```
Meta ad ─┐
         ├─→ /webinar ──→ register ──→ /webinar/confirmed
/decode ─┘   (page)       (phone +      (thank-you page,
gate                       medication)   group / kit / calendar / share)
                              │
                              ├─→ Leads tab row, Status = webinar_registered
                              ├─→ WhatsApp confirmation (webinar_confirmed_v1)
                              └─→ CompleteRegistration to Meta (server + browser)

                  ↓ then, on a schedule

   day before 5–8 PM  ·  75–45 min before  ·  at start  ·  next morning
        (four reminder templates, §5)

                  ↓ the class runs off-site (Zoom / Meet)

   attendance CSV import (§7) → Attended Min in the sheet
                              → WebinarAttended / WebinarStayedToPitch to Meta
                              → the offer is pitched live, and to buyers after
```

The page is a **general thyroid fat-loss class**. A blood report helps but is
never required — so nothing on the page or in a message may imply one is needed.

Two entry points, and they are counted differently:

| Who arrives | How she is marked | Counts in cost per registration? |
|---|---|---|
| A Meta ad | `UTM Content` = the ad id | **Yes** |
| The `/decode` quiz gate (`?src=decode_nurture`) | `Source Path` = `decode_nurture` | **No** |
| A registrant sharing the page (`utm_medium=whatsapp_share`) | `UTM Medium` = `whatsapp_share` | **No** |

Why: the `/decode` gate sends women who answered "in a month or two" or "just
exploring" to the class instead of the ₹299 checkout (`lib/decode-gate.ts`).
Meta still attributes her to the `/decode` ad she clicked — nothing in a tag can
change that — but the webinar's own ads did not buy her, so she must not sit in
the webinar's cost per registration. Shares are free for the same reason.

---

## 2. Running the NEXT class — the checklist

Do these in order. Steps 1 and 2 need a push to `main` (which deploys
automatically). Steps 3 to 6 need no deploy.

**1. Change the three constants in `lib/webinar.ts`.**

```ts
export const WEBINAR_WHEN_LONG = "Thursday 24 September, 8:00 PM IST";
export const WEBINAR_START_ISO = "2026-09-24T14:30:00.000Z"; // 8:00 PM IST
export const WEBINAR_END_ISO   = "2026-09-24T16:00:00.000Z"; // 9:30 PM IST
```

The ISO times are **UTC**. 8:00 PM IST is `14:30Z`; 9:30 PM IST is `16:00Z`.
Subtract 5 hours 30 minutes from the IST time you want.

Change all three together. Everything else is derived from them and cannot
disagree: the weekday in the sticky bar, the countdown, both calendar buttons,
the `.ics` file, the date inside the WhatsApp templates, and the cohort key the
reminders and the report filter on.

> **Check the weekday.** `WEBINAR_WHEN_LONG` is the one string typed by hand.
> The design once said "Thursday 18 September" and 18 September 2026 is a
> Friday, which would have put a wrong weekday in front of every registrant.
> The page derives its own weekday from `WEBINAR_START_ISO`, so a mismatch shows
> up as the page and the WhatsApp message disagreeing.

**2. Push to `main`.** Cloudflare Workers Builds deploys it. Then open
`https://www.swapnilumbarkarfitness.in/webinar` and confirm the date, the
weekday and the countdown.

**3. Create the new dated group inside the Community.** One WhatsApp group per
class, named for the date. Copy its invite link — it must look exactly like
`https://chat.whatsapp.com/XXXXXXXX`, or the code treats it as unset.

**4. Paste the join link in.**

```
npx wrangler secret put WEBINAR_COMMUNITY_URL
```

Paste the group link when prompted. It takes effect on the next request; no
deploy. The thank-you page asks `/webinar/links` whether it is set and shows the
"Join the class group on WhatsApp" button only when it is.

**5. Set the class link once you have it.**

```
npx wrangler secret put WEBINAR_JOIN_URL
```

**6. Clear last class's replay.** `WEBINAR_REPLAY_URL` still points at the old
recording until you change it. Set the new one after the class, before the
replay window the next morning (§5).

### Registration closes by itself

At `WEBINAR_START_ISO`, two things happen without anyone doing anything:

- **The page** replaces the form with "Registration for this session has closed.
  The next date will be announced here." (`RegisterForm`, when `closed`).
- **The API** returns **410** to any `POST /api/webinar-register`, so a tab left
  open since yesterday cannot book a seat for a class already running.

Moving the date forward in step 1 **reopens both**. There is no separate switch
to flip, and no state to reset.

---

## 3. The Worker variables

All six are read at request time, so a change applies **without a deploy**.

They are **secrets, not repo values**, because the GitHub repo is public and
these are private invite links. Set each one with:

```
npx wrangler secret put <NAME>
```

| Variable | What it switches on | Set it when |
|---|---|---|
| `WEBINAR_COMMUNITY_URL` | `/webinar/group` redirects to the class group, and the thank-you page shows the "Join the class group" button. Must match `https://chat.whatsapp.com/…`. | Every class, after you create the dated group |
| `WEBINAR_JOIN_URL` | `/webinar/join` redirects to the live class. This is the URL behind the reminder templates' button. | Once you have the Zoom / Meet link. **Not set today** |
| `WEBINAR_REPLAY_URL` | `/webinar/replay` redirects to the recording | After each class, before the next morning |
| `WEBINAR_STARTER_KIT_URL` | `/webinar/starter-kit` redirects to the PDF, and the thank-you page shows the download button. Accepts `/webinar/thyroid-starter-kit.pdf` once the file is in `public/webinar`, or a full `https://` URL. | When the PDF exists. **Not set today** |
| `WEBINAR_REMINDER_TEMPLATES` | Which reminders may send. Comma-separated exact template names. Anything not listed sends **nothing**. | Add each name the day Meta approves it |
| `WEBINAR_CONFIRM_TEMPLATE` | Which confirmation the register route sends. Unset means `webinar_confirmed_v1`. Set it to `webinar_registered_v2` once that is approved. | Only when switching confirmations |

**Why the redirects exist at all.** An approved template's button URL is frozen
— changing it means re-approval, and re-approval takes days you do not have on
class day. So every button points at one of our own four paths
(`/webinar/group`, `/webinar/join`, `/webinar/replay`, `/webinar/starter-kit`)
and *those* redirect to whatever is current. A new class, a new group, a new
Zoom link: nothing is re-approved, nothing is redeployed.

**A malformed value counts as unset.** A pasted link with a stray space or the
wrong shape makes `resolveWebinarLink` return `null`, the route sends her back
to `/webinar`, and a warning is logged. She never sees an error page.

---

## 4. The five approved templates

All on WABA `976081968452524` ("Heal Thyroid With Swapnil", +91 79784 60386).

Body parameters are **positional**: the first string the code sends fills
`{{1}}`, the second fills `{{2}}`. Sending the wrong count fails the whole
message with Meta error 132000, in every language.

All five webinar templates below were approved on 18-Sep-2026 and are Active.
The bodies are copied here because WhatsApp Manager is the only other place they
exist, and a reworded body that changes the parameter count breaks every send.

| Template | When | Params | Body | Button |
|---|---|---|---|---|
| `webinar_registered_v2` | Instantly on registration | 1 | Your seat is confirmed for the Thyroid Fat Loss Masterclass on `{{1}}`. The joining link and class reminders are posted in the class group. If you did not register, please ignore this message. | Join class group → `/webinar/group` |
| `webinar_reminder_day` | 5–8 PM the day before | 1 | Reminder: the Thyroid Fat Loss Masterclass you registered for is tomorrow, `{{1}}`. Keep 90 minutes free, and your thyroid report nearby if you have one. | Add to calendar → `/webinar/calendar.ics` |
| `webinar_reminder_1h` | 75–45 min before | 1 | The Thyroid Fat Loss Masterclass you registered for starts in one hour, at `{{1}}`. Use the button below to join on time. | Join the class → `/webinar/join` |
| `webinar_live_now` | 0–20 min after the start | 1 | The Thyroid Fat Loss Masterclass you registered for on `{{1}}` has started. Use the button below to join now. | Join now → `/webinar/join` |
| `webinar_replay` | 8:30 AM–12 PM the next day | **2** | The Thyroid Fat Loss Masterclass you registered for on `{{1}}` has ended. The recording is available for the next `{{2}}` hours. | Watch the recording → `/webinar/replay` |

What the code sends into each is `reminderParams()` in `lib/webinar-reminders.ts`,
pinned by a test: `{{1}}` is `WEBINAR_WHEN_LONG` everywhere except
`webinar_reminder_1h`, which gets the time only ("8:00 PM IST"), and
`webinar_replay`, which also gets `REPLAY_HOURS` as `{{2}}`. **Reword a body and
you must change that function and its test in the same commit**, or Meta rejects
the send with error 132000 and the class hears nothing.

`webinar_confirmed_v1`, the old confirmation, takes 2 parameters (her first name
and the date). It is still what `WEBINAR_CONFIRM_TEMPLATE` falls back to if the
variable is ever unset, and the register route sends the right count for
whichever name is configured.

### Why `webinar_confirmed_v1` is UTILITY

A registration confirmation is transactional. Utility templates are not subject
to the marketing frequency cap that silently eats messages — the cap that
swallowed a real customer's welcome message. Keep any replacement confirmation
in the same category.

**Meta reclassified four of these to Marketing on its own** (17-Sep-2026):
`webinar_confirmed_v1`, `payment_confirmed_v2`, `booking_confirmation` and
`thyroid_score_result_v2`. A category review was requested for the first three
on 18-Sep and is pending. `thyroid_score_result_v2` was deliberately left alone:
its body invites her to a paid consultation, which genuinely is marketing, and a
review would only burn the window. Reviews are one click in Business Support
Home — there is no justification box, so the reasoning cannot be submitted.

### The wording rule — learned 18-Sep-2026

**Meta's classifier pushes a template to Marketing unless the body both (a) names
the registration it belongs to — "the class you registered for" — and (b) carries
a concrete date.**

`webinar_live_now` and `webinar_replay` were **both blocked at submission** until
reworded that way — Meta showed a "Category does not match" modal saying the
template would be rejected. `webinar_live_now` originally had no parameters at
all, which is why it now carries a date; `webinar_replay` gained the date as
`{{1}}`, pushing the replay hours to `{{2}}`. Both went through on the first try
after the rewording, with no modal.

The two reminders Meta accepted first time both do this already. Copy their
shape for any new template: name the registration, name the date, and keep the
link out of the body — it belongs on the button, pointing at one of our four
redirect paths.

---

## 5. The reminders

`/api/cron/webinar-reminders` runs **every 15 minutes**, beside `meta-retry`
(`"*/15 * * * *"` in `CRON_ROUTES`, `custom-worker.js`). 95 of its 96 daily runs
find nothing due and exit before reading the sheet at all.

### The windows, and why they are where they are

Minutes relative to the class start. For an 8:00 PM IST class:

| Reminder | Window | Real time | Why there |
|---|---|---|---|
| `webinar_reminder_day` | −27h to −24h | 5–8 PM the day before | Evening, when she is on her phone. Not the morning, when it is forgotten by 8 PM |
| `webinar_reminder_1h` | −75 to −45 min | 6:45–7:15 PM | Enough time to finish dinner and sit down |
| `webinar_live_now` | 0 to +20 min | 8:00–8:20 PM | While the class is still opening |
| `webinar_replay` | +12.5h to +16h | 8:30 AM–12 PM next day | **Morning, never the night before.** A message at midnight costs goodwill and gets the number reported |

Every window is at least 30 minutes wide, so **at least two 15-minute runs fall
inside it**. One failed run never loses a reminder. Windows never overlap, so at
most one reminder is ever due.

### Nothing sends unless it is listed

Only template names in `WEBINAR_REMINDER_TEMPLATES` are sent. An unlisted one is
skipped **by name**, before any sheet read, and the response says
`reason: "not_approved"`.

Why: a send to a template Meta has not approved fails **and is still billed as
an attempt**. The list is the switch that keeps a not-yet-approved template from
burning money on class day.

### Who gets one

A row is a candidate only if every one of these is true:

| Rule | Check | Why |
|---|---|---|
| **Cohort** | `Webinar Date` equals this class's key exactly | A woman who registered for last week's class must not get this week's reminders |
| **Status** | `Status` is `webinar_registered` | Quiz leads and buyers are in the same tab |
| **Once** | The `Tpl <template>` column for her row is empty | The cron is stateless and may run twice; the sheet is the memory |
| **Bots** | `Bot Check` is not `unverified` | A bot never earns a paid WhatsApp, the same rule as the confirmation |
| **One woman** | One send per phone per run, across all her rows | A second registration must not earn a second message |
| **Cap** | 150 per run | A wrong rule hits one batch, not the whole list |

**The cohort key** is `mc-20260924T143000Z` — the start time, stripped of
punctuation, with an `mc-` prefix. It is deliberately **not** a plain ISO date:
the register route appends with `USER_ENTERED`, and Sheets will happily turn a
date-looking string into a date value that then reads back formatted and never
matches anything again.

**The stamp columns** are named `Tpl webinar_reminder_day`,
`Tpl webinar_reminder_1h`, `Tpl webinar_live_now`, `Tpl webinar_replay`. Each
holds the timestamp of that send. The cron creates a missing stamp column
**before** any send goes out — a send with nowhere to record itself would repeat
on the next run, fifteen minutes later.

### Checking a window before it arrives

```
curl -H "x-admin-key: $ADMIN_DASH_KEY" \
  "https://www.swapnilumbarkarfitness.in/api/cron/webinar-reminders?dryRun=1"
```

`dryRun=1` reports who would get what and sends nothing. Add
`&at=2026-09-23T12:00:00Z` (admin + dryRun only) to pretend it is that moment,
so a window can be rehearsed days early. Phone numbers come back masked as
`***1234`.

---

## 6. Tracking, and the wall between this and `/decode`

### The events

| Event | Where from | Legs | Notes |
|---|---|---|---|
| `ViewContent` | `/webinar` page load | Browser | Once per load |
| `WebinarFormStart` | First focus on a phone field | Browser | Custom event. **Not `Lead`** |
| `CompleteRegistration` | Register route **and** `/webinar/confirmed` | Server + browser, paired | id `CompleteRegistration_<leadId>` |
| `WebinarGroupJoin` · `WebinarCalendarAdd` · `WebinarKitDownload` · `WebinarShare` | Thank-you page taps | Browser | Audience and diagnostic only, never an optimisation target |
| `WebinarReminderClick` | `/webinar/join` redirect | Server | One per visitor per day. The only signal that a reminder worked, since the class runs off-site |
| `WebinarAttended` | Attendance import | Server | id `wbatt_<leadId>` |
| `WebinarStayedToPitch` | Attendance import, ≥55 minutes | Server | id `wbpitch_<leadId>` |

### The separation rules

**Webinar events never reuse `Lead`, `Schedule` or `Purchase`.** Those three
belong to the `/decode` funnel and must never move because a webinar happened.

The sharpest case: `WebinarFormStart` is a custom event and not `Lead`. `Lead` is
the `/decode` quiz gate's event (advanced matching, EMQ 9.3) — and the gate sends
women on to this page. A `Lead` on focus here would count a **second** `Lead`
against the `/decode` ad for one woman, and dilute that event's match quality
with anonymous focus events. Any of these custom events can still be made a
custom conversion and optimised on, which gets the benefit without the damage.

`CompleteRegistration` is the exception that proves it: it is a standard event,
but it is not one `/decode` uses.

**`/webinar` pixel calls go straight to `fbq`, not through a `dataLayer` push.**
A `dataLayer` push can reach the Stape server container through the GA4
forwarding tag, which would add a server leg with a *different* id — an
unpairable duplicate. `Schedule` and `Purchase` are the **opposite**: their
browser leg **is** a GTM tag, and `app/lib/analytics.ts` forbids a direct `fbq`
for them. Do not copy this page's pattern there.

### GTM

**Every `/decode` tag must be scoped to Page Path matching `^/decode`.** The one
exception is **"Meta Ads PageView", which stays global** — it is the tag that
loads `fbevents.js` and initialises the pixel, and `/webinar` has no tag of its
own, so every `fbq` call on this page waits for that tag to arrive. Unscope the
PageView tag and the webinar page sends nothing at all. Leave a `/decode` tag
unscoped and it fires on `/webinar` too, putting a `Lead` or a `Schedule` on a
page that has no business producing one.

Before changing anything in Meta tracking, read `docs/tracking-cutover-plan.md`.
`NEXT_PUBLIC_DIRECT_PIXEL` must stay off until the GTM change in its §4-B is
made in the same window.

### The sheet columns this funnel adds

All in the same Leads tab every other entry point writes to, found by header
name and never by index.

| Column | Written by | Holds |
|---|---|---|
| `Webinar Date` | Register route | The cohort key, e.g. `mc-20260924T143000Z` |
| `Source Path` | Register route, only when present | `decode_nurture` when the `/decode` gate sent her |
| `Attended Min` | Attendance import | Minutes in the room |
| `Tpl <template>` | Reminder cron | Timestamp of that template's send to that row |

`Status` is `webinar_registered`. `UTM Source` is always `webinar` — it is how
the dashboard tells these rows apart — and the real medium, campaign, content
and term go in their own columns.

---

## 7. After the class

### Importing attendance

Export the participants list from the meeting platform as CSV. Then:

```
curl -X POST "https://www.swapnilumbarkarfitness.in/api/admin/webinar-attendance?dryRun" \
  -H "x-admin-key: $ADMIN_DASH_KEY" -H "content-type: application/json" \
  -d "{\"csv\": $(jq -Rs . < participants.csv), \"dryRun\": true}"
```

**Always run `dryRun: true` first.** It reports the matching and writes nothing.
Read the `unmatchedRows` before you commit: they are the women the import could
not place. Drop `dryRun` to write for real.

Body: `csv` (the export, pasted whole), optional `cohort` (defaults to this
class), optional `dryRun`, optional `pitchMinutes` (defaults to 55).

**How matching works,** in descending order of confidence:

1. **Phone** — a 10-digit Indian mobile found anywhere in the row. The only
   match that cannot be the wrong woman.
2. **Email** — exact, lowercased. Only if the sheet holds an email for her.
3. **Name** — normalised, and **only when exactly one registrant matches**. Two
   "Priya"s match nobody. A wrong match would send Meta a false attendance and
   point the coach at the wrong person.

Anything unmatched is reported, never guessed. The registration only asks for a
WhatsApp number, so matching is best-effort by design. Several rows for one
person (she rejoined) are added together.

Re-running the same export is safe: the D1 ledger keeps each event id to one
send, so nothing goes to Meta twice.

### Reading the report

```
curl -H "x-admin-key: $ADMIN_DASH_KEY" \
  "https://www.swapnilumbarkarfitness.in/api/admin/webinar-report?cohort=mc-20260924T143000Z"
```

Omit `cohort` for the current class.

| Field | Meaning |
|---|---|
| `registrations.total` | Every registration in the cohort |
| `registrations.paid` | **The only number for cost per registration** |
| `registrations.nurture` | Sent by the `/decode` gate. Free to this funnel |
| `registrations.share` | Came from a registrant's share. Free |
| `registrations.unverified` | Failed the bot check. Saved, but no WhatsApp and no Meta event |
| `attendance.showUpPct` | Attended ÷ total registrations |
| `attendance.stayedPct` | Stayed to the pitch ÷ attended |
| `attendance.imported` | `false` means the CSV has not been imported yet |
| `byAd` | Paid registrations per `utm_content`, which is the ad id |

**Only `paid` belongs in cost per registration.** Spend ÷ `total` flatters the
number with women the webinar's ads never bought. Use `byAd` to see which
creative is actually producing.

**Sales come from the CRM, not this route.** It reports registrations and
attendance, nothing downstream.

---

## 8. Things that will bite

- **Post-response work must use `after()` from `next/server`.** A bare
  un-awaited promise dies when the invocation freezes, and logs nothing. Both
  the confirmation send and the CAPI event are wrapped.
- **Never hardcode an index derived from a list.** A hardcoded question index
  once silently discarded the last quiz answer.
- **Every googleapis client must pass `clientOptions: googleClientOptions`**
  (`lib/google-fetch.ts`), or every Sheets call fails on Workers.
- **A registration that fails the bot check is saved and marked, but gets no
  WhatsApp and no Meta event.** She is reachable from the sheet by hand. A bot's
  registration must not teach the ad account what a registrant looks like.
- **The pure logic is tested.** `npm test` runs `lib/webinar.test.ts`,
  `lib/webinar-reminders.test.ts`, `lib/webinar-attendance.test.ts` and
  `lib/webinar-page.test.ts` under `node --test`. Those four `lib/` files have
  no imports on purpose, so the test runner can load them directly. Keep it that
  way.
