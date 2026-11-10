<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# Before touching the funnel automation

Three documents in `docs/`, in the order worth reading them:

1. `business-handover.md` — the business, the funnel end to end, the tracking
   architecture, the guarded paths, and the copy rules. Start here.
2. `meta-ads-whatsapp-strategy.md` — campaign structure, the six ad creatives,
   why the funnel is quiz-first, and the objective/conversion-event reasoning.
3. `whatsapp-automation-session-2026-08.md` — what the automation actually does
   today, decisions already settled, bugs and their failure modes, what is still
   open. **Authoritative wherever it disagrees with the other two**, which
   predate the rebuild.

Its §0 also flags an open PR (#116) containing a SECOND quiz implementation that
is not on `main` — the live quiz is the 7-question one at `/assessment`.

It records what the seven templates do and when they fire, decisions that were
already argued out and settled (notably: why the Cashfree hosted form is NOT the
payment path, and why ads optimise for Schedule rather than Lead), the bugs that
were found and the failure modes behind them, and what is still open. It exists so
those are not re-derived or re-broken.

Two things from it that bite hardest:

- **Post-response work must use `after()` from `next/server`.** A bare un-awaited
  promise dies when the serverless invocation freezes, and logs nothing.
- **Never hardcode an index derived from a list.** A hardcoded question index
  silently discarded the last quiz answer when a question was added.

# Hosting and deploys (since 2026-09-11)

- Production is **Cloudflare Workers** (worker `thyroid-funnel`, built with
  OpenNext): `wrangler.jsonc`, `custom-worker.js`, `open-next.config.ts`. Vercel
  still builds `main` as a rollback copy that receives no traffic.
- **A push to `main` deploys automatically** through Cloudflare Workers Builds
  (`npx opennextjs-cloudflare build`, then `npx opennextjs-cloudflare deploy`).
  Build-time `NEXT_PUBLIC_*` values live in the Workers Builds settings, not in
  the repo; runtime secrets live on the worker.
- Free-plan limits shape the code: 3 MB gzipped bundle, 10 ms CPU per request,
  and a read-only static page cache, so no ISR `revalidate` anywhere.
- Every googleapis client must pass `clientOptions: googleClientOptions`
  (`lib/google-fetch.ts`). Without it Google's responses arrive still gzipped on
  Workers and every Sheets call fails.
- **The service account cannot CREATE files in his Drive** — Google refuses
  with "Service Accounts do not have storage quota", and the fixes it offers
  (shared drives, delegation) need paid Workspace; this is a consumer Gmail.
  Every file the system makes in his Drive (call notes, blood reports, summary
  PDFs) goes through the Apps Script bridge `scripts/drive-bridge.gs`, which
  runs as him — never through the service account. Each client has one folder
  inside "Client Notes" (`GOOGLE_DRIVE_NOTES_FOLDER_ID`), named
  "Name · 10 digits" and found by her phone digits, never by her name. The
  worker reaches the script through the pairing "Connect Google Drive" stores
  in D1 (trust on first use: the script adopts the first secret it is sent and
  refuses any other), or through `DRIVE_BRIDGE_URL` / `DRIVE_BRIDGE_SECRET`,
  which win when set. After editing the `.gs`, run `npm run sync:bridge` (the
  dashboard hands out `lib/drive-bridge-source.ts`, and a test fails until the
  two match), and the owner must redeploy it in Apps Script as a New version
  (Manage deployments → Edit → New version), which keeps the same URL. Reading
  a shared folder with the service account still works.
- Before changing any Meta tracking, read `docs/tracking-cutover-plan.md`.
  `NEXT_PUBLIC_DIRECT_PIXEL` must stay off until the GTM change in its §4-B is
  made in the same window, or every PageView is counted twice.
