-- The steps of her journey that happen on his side of the screen, which no
-- other system records: his notes Doc made, her summary made and sent, the
-- thank-you after the call, the pre-call PDF made and sent, onboarding, and the
-- three follow-ups after a priced call. Accessed only through
-- lib/journey-marks.ts.
--
-- WHY: the journey card on Today and Pipeline shows one button for the next
-- thing to do, and "notes made, summary not sent" decides which button that
-- is. The Doc and the PDF live in his Drive, which is reached only through his
-- Apps Script at one subrequest a question; a screen of forty cards cannot ask
-- Drive forty times. One row per woman and kind answers every card in one
-- query.
--
-- ONE ROW PER (phone_key, kind): the latest time it happened, and the link
-- that goes with it (the notes Doc, the summary PDF) when there is one. A
-- later write keeps the earlier link when it brings none of its own.
--
-- PRIVACY: no raw name, phone or email. phone_key is the SHA-256 of "p:" + the
-- last 10 digits (lib/journey-store hashKey), the same key as migrations/0003
-- and 0005. url is a Google Drive link to a file that lives only in his Drive.
--
-- lib/journey-marks.ts also creates this table lazily, so the cards work
-- before this file is applied; applying it keeps the schema on record.
--
-- `at` is Unix epoch MILLISECONDS.
-- Apply with: npx wrangler d1 migrations apply thyroid-ledger --remote

CREATE TABLE IF NOT EXISTS journey_marks (
  phone_key  TEXT NOT NULL,
  -- notes_made | summary_made | summary_sent | thank_you_sent | precall_made |
  -- precall_sent | onboarded | followup_1 | followup_2 | followup_3
  kind       TEXT NOT NULL,
  at         INTEGER NOT NULL,
  url        TEXT NOT NULL DEFAULT '',
  PRIMARY KEY (phone_key, kind)
);
