# GTM setup — hero VSL video events

Six events are pushed to `dataLayer` by `app/components/HeroVideo.tsx` via
`trackVideoEvent()` in `app/lib/analytics.ts`. Nothing below changes site code —
this is all container work in the GTM **web** container (`GTM-P3S5BXQB`, served
through the first-party sGTM host `lime.swapnilumbarkarfitness.in`).

**Mapping decision:** only `video_play` and `video_progress_75` go to Meta.
The other four are GA4-only — they are useful for funnel diagnostics but would
just add noise (and cost) in the Meta dataset.

---

## 1. The events as they arrive

Every push carries the standard payload plus the video fields:

| key | example | notes |
|---|---|---|
| `event` | `video_progress_75` | one of the six names below |
| `event_id` | `video_progress_75_1785740790_a3f9` | generated per fire — the dedup key |
| `video_position` | `275` | seconds, rounded |
| `video_duration` | `359` | seconds, rounded (real metadata, 5:59) |
| `video_percent` | `77` | position ÷ duration |
| `page_type` | `landing` | |
| `metaUserData`, `external_id`, `fbc`, `fbp` | | injected by `withUserSignals()`, same as every other event on the site |

Event names:

```
video_play           fires once per session, on the first play click
video_progress_25    first time playback passes 25%
video_progress_50    first time playback passes 50%
video_progress_75    first time playback passes 75%
video_progress_95    first time playback passes 95%
video_complete       on ended
```

Each fires **at most once per page view** (the component guards with a `Set`),
so scrubbing backwards and replaying cannot re-fire a milestone. `video_play`
additionally guards on `sessionStorage`, so it survives a remount.

---

## 2. Variables to create

**Variables → New → Data Layer Variable.** Version 2, no default value.

| Variable name | Data Layer Variable Name |
|---|---|
| `DLV - event_id` | `event_id` |
| `DLV - video_position` | `video_position` |
| `DLV - video_duration` | `video_duration` |
| `DLV - video_percent` | `video_percent` |

> `DLV - event_id` almost certainly already exists — the Lead / Purchase /
> Schedule tags use it. Reuse it, do not create a second one.

---

## 3. Triggers to create

**Triggers → New → Custom Event.** One per event, "This trigger fires on: All
Custom Events".

| Trigger name | Event name field |
|---|---|
| `CE - video_play` | `video_play` |
| `CE - video_progress_25` | `video_progress_25` |
| `CE - video_progress_50` | `video_progress_50` |
| `CE - video_progress_75` | `video_progress_75` |
| `CE - video_progress_95` | `video_progress_95` |
| `CE - video_complete` | `video_complete` |

*Optional shortcut for the GA4 side:* one trigger with **Use regex matching**
and event name `^video_(play|progress_\d+|complete)$`, paired with a single GA4
tag whose Event Name is `{{Event}}`. That replaces six GA4 tags with one. The
two Meta tags still need their own triggers.

---

## 4. Tags — GA4 (all six events)

**Tags → New → Google Analytics: GA4 Event**, using your existing GA4
configuration tag / measurement ID.

- **Event Name:** the event name (or `{{Event}}` if you took the regex shortcut)
- **Event Parameters:**

  | Parameter | Value |
  |---|---|
  | `video_position` | `{{DLV - video_position}}` |
  | `video_duration` | `{{DLV - video_duration}}` |
  | `video_percent` | `{{DLV - video_percent}}` |
  | `page_type` | `{{DLV - page_type}}` (optional) |

- **Trigger:** the matching `CE - …` trigger
- Leave "Send Ecommerce data" off.

In GA4, register `video_percent` and `video_position` as **custom dimensions**
(Admin → Custom definitions) if you want them in reports rather than just
BigQuery/raw.

---

## 5. Tags — Meta (only `video_play` and `video_progress_75`)

Two tags, using the container's existing Meta Pixel template and
`{{Meta Ads Pixel ID}}`:

| Setting | Tag A | Tag B |
|---|---|---|
| Tag name | `Meta - VideoPlay` | `Meta - VideoProgress75` |
| Event type | **Custom** | **Custom** |
| Event name | `VideoPlay` | `VideoProgress75` |
| Event ID | `{{DLV - event_id}}` | `{{DLV - event_id}}` |
| Object properties | `video_duration: {{DLV - video_duration}}`, `video_percent: {{DLV - video_percent}}` | same |
| Advanced matching | **Enabled**, same JS variables the other Meta tags use (`{{JS - user_email}}`, `{{JS - user_phone}}`, `{{JS - user_external_id}}` …) | same |
| Trigger | `CE - video_play` | `CE - video_progress_75` |
| Firing option | **Once per event** | **Once per event** |

### Why Event ID matters here

These are **browser-only** pushes — the site does not POST them to
`/api/events`, so there is no server CAPI twin *by default*. Setting Event ID
matters for one reason: your GTM web container is served through the
first-party sGTM host, so if you (now or later) add a **server-container tag**
that forwards these to the Meta Conversions API, the shared `event_id` makes
Meta collapse the browser and server copies into one event. Same contract as
Lead / Purchase / Schedule. If you never add the server tag, the Event ID is
harmless.

### Using these for optimization

`VideoPlay` and `VideoProgress75` are **custom** events, not standard ones.
To optimize or build audiences on them, create a **Custom Conversion** in Events
Manager (Events Manager → Custom Conversions → New, rule = event equals
`VideoProgress75`). `VideoProgress75` is the more meaningful intent signal of
the two — someone who watched 4.5 of 6 minutes of a thyroid VSL is a strong
retargeting audience.

---

## 6. Verification

1. GTM → **Preview**, load the homepage.
2. Confirm **no** `video_*` event fires on page load.
3. Click play → `video_play` appears once. Reload and click again → it does
   **not** fire again (session guard). Open a new tab → it fires again.
4. Scrub across 25/50/75/95 → four milestone events. Scrub **backwards** over
   them → nothing re-fires.
5. Let it end → `video_complete`.
6. Meta **Events Manager → Test Events**: `VideoPlay` and `VideoProgress75`
   arrive with the Event ID visible.
7. GA4 **DebugView**: all six arrive with the three video parameters populated.
