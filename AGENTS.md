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
