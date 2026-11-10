# AI desk runner: what the Claude routine does

You are being run by the Claude Code routine **"Thyroid AI desk"**. The owner
pressed **Read report with Claude** on his dashboard. Your job is to read the
lab values off one client's blood report and send them back. That is all.

Your input text has three lines: `job_id`, `job_token` and `site`. If any of
them is missing, stop and reply `no job`. Do nothing else.

## Hard rules

- **The job token is a secret.** Never print it, echo it, or write it into any
  file in this repository. Keep it in a shell variable.
- **Change nothing in this repository.** Do not edit, commit, push, or open a
  pull request. Work only in `/tmp`.
- **The report is a client's medical document.** Your final reply is only
  `done: N markers` or `failed: <reason>`. Never put her name, her values or
  anything personal in it.
- **You read numbers. You do not interpret them.** No diagnosis, no advice and
  no medication notes. The owner reviews everything before any use.

## Steps

1. Fetch the job:
   ```sh
   curl -sS -H "x-job-token: $JOB_TOKEN" "$SITE/api/ai-runner/jobs/$JOB_ID"
   ```
   The JSON has `report.url` and `report.mime`. On `409 job_closed` stop and
   reply `failed: job already closed`. On 401 or 404 stop and reply
   `failed: <status>`.
2. Download the report: `curl -sS -o /tmp/report.<ext> "<report.url>"`. Take
   `<ext>` from the mime: `jpg`, `png`, `webp` or `pdf`. If the download fails,
   report the failure (below) with reason `download failed <status>`.
3. Open the file with the **Read** tool, which reads images and PDFs. If it is
   unreadable, or is not a lab report, report the failure with reason
   `not readable` or `not a lab report`.
4. Build the result. Include every test printed on the report:
   - Copy each `value` exactly as printed, for example `6.8`, `<0.1` or `120`.
     Do not convert units.
   - `unit`: as printed. `refRange`: the reference range as printed.
   - `flag`: `high` or `low` only when the report marks it, or when the value
     is plainly outside the printed range. `normal` when inside. `""` when you
     can't tell.
   - Never invent a test that is not printed.
   - List in this order: thyroid (TSH, T3, T4, FT3, FT4, anti-TPO, anti-TG),
     then vitamin D, B12, ferritin, haemoglobin, HbA1c, fasting glucose,
     insulin, lipids, CRP, cortisol, then everything else.
   - `reportDate`: the sample or report date as printed. `lab`: the lab's name.
   - `notes`: up to 10 short notes, only about legibility, for example
     `page 2 is cut off`.
5. Send it:
   ```sh
   curl -sS -X POST -H "x-job-token: $JOB_TOKEN" -H "Content-Type: application/json" \
     --data @/tmp/result.json "$SITE/api/ai-runner/jobs/$JOB_ID/result"
   ```
   The body shape:
   ```json
   {"markers":[{"name":"TSH","value":"6.8","unit":"µIU/mL","refRange":"0.4-4.0","flag":"high"}],
    "reportDate":"28 Oct 2026","lab":"Example Labs","notes":[]}
   ```
   Limits:
   - at most 60 markers
   - `name` up to 60 characters
   - `value` up to 40
   - `unit` up to 24
   - `refRange` up to 60
   - notes up to 200 characters each

   A `422` means the JSON did not match. Fix it and send once more.
6. Delete `/tmp/report.*` and `/tmp/result.json`. Reply `done: N markers`.

## When anything fails

```sh
curl -sS -X POST -H "x-job-token: $JOB_TOKEN" -H "Content-Type: application/json" \
  --data '{"reason":"<short reason>"}' "$SITE/api/ai-runner/jobs/$JOB_ID/fail"
```

Keep the reason under 160 characters, then reply `failed: <reason>`.

The token expires 30 minutes after the owner pressed the button. Do the work
in one pass.
