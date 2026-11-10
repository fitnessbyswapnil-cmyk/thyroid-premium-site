/**
 * lib/summary-html.ts — PURE. A SummaryModel (lib/summary.ts) as the full
 * HTML of the owner's approved two-page consultation summary, ready for the
 * PDF worker (workers/pdf) to print.
 *
 * THE DESIGN IS HIS, APPROVED 9-NOV-2026
 * The stylesheet and markup below are the approved template, kept as close to
 * verbatim as the data allows: IBM Plex Mono for every number, Sans for
 * structure, Serif only for her voice and the one line at the bottom of page
 * 1. Page 1 is the diagnosis, page 2 the decision. The pillar and deliverable
 * text is his own wording and is fixed. What changed from the template:
 *  - the "TEMPLATE · SAMPLE DATA" badges are gone;
 *  - the dashed "insert one published client result" box is the real card,
 *    from lib/summary-proof;
 *  - the quote's timestamp is gone (this version has none to give);
 *  - "the four years this weight took to arrive" reads "the years …": the
 *    four was the sample's, and her answer is a band, not a number;
 *  - each A4 page is sized in millimetres, so a print is exactly two sheets;
 *  - a section whose source is empty is left out rather than shown blank.
 *
 * EVERYTHING FROM HIS NOTES IS ESCAPED
 * Her words, his blockers and every cell he typed go through esc(). A "<" in a
 * symptom must print as a "<", not open a tag, and nothing he pastes into a
 * Doc should be able to run in the renderer's browser.
 *
 * THE FIT SCRIPT
 * The clamps in lib/summary.ts keep each page's text short, but a long word
 * can still wrap one line further than expected. Each page has a fixed height
 * and hides overflow, so an overlong page would silently lose its footer.
 * Instead, once the fonts have loaded, any page whose content is taller than
 * the sheet is zoomed down uniformly until it fits, never below 80%. Uniform,
 * so the proportions of the approved design hold. A page that fits is left at
 * 100%, which is the normal case.
 */
import type { SummaryModel } from "./summary.ts";

export function esc(s: string): string {
  return String(s ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** "Reply START on WhatsApp…": the word she has to type is set in bold, as in the approved sample. */
export function stepHtml(step: string): string {
  return esc(step).replace(/(\b(?:[Rr]eply|[Ss]end|[Tt]ype|[Mm]essage|[Ww]rite)\s+)([A-Z][A-Z0-9]+)\b/g, "$1<strong>$2</strong>");
}

const FONTS =
  "https://fonts.googleapis.com/css2?family=IBM+Plex+Sans:wght@400;500;600;700&family=IBM+Plex+Serif:ital,wght@0,400;0,600;1,400&family=IBM+Plex+Mono:wght@400;500;600&display=swap";

const CSS = `
  :root{
    --paper:#FBF9F6; --ink:#1A1815; --ink2:#554D45; --ink3:#8A7F73;
    --gold:#B8860B; --goldL:#F3E9D2; --rule:#E2DAD0; --warn:#9C4A28;
    --d:"IBM Plex Serif",Georgia,serif;
    --b:"IBM Plex Sans","Helvetica Neue",sans-serif;
    --m:"IBM Plex Mono",ui-monospace,monospace;
  }
  @page{size:A4;margin:0}
  *{box-sizing:border-box;margin:0;padding:0;-webkit-print-color-adjust:exact;print-color-adjust:exact}
  html,body{background:var(--paper)}
  body{font-family:var(--b);color:var(--ink);-webkit-font-smoothing:antialiased}
  .page{width:210mm;height:297mm;background:var(--paper);padding:52px 58px;
        display:flex;flex-direction:column;overflow:hidden;position:relative;break-after:page}
  .page:last-of-type{break-after:auto}
  .page>*{flex:0 0 auto}
  @media screen{body{background:#8c8681}.page{margin:0 auto 26px;box-shadow:0 10px 40px rgba(0,0,0,.3)}}

  /* ── header ── */
  .top{display:flex;justify-content:space-between;align-items:flex-start;gap:18px;
       border-bottom:2px solid var(--ink);padding-bottom:13px}
  .who{font-family:var(--b);font-weight:600;letter-spacing:-.02em;font-size:31px;font-weight:600;line-height:1.05}
  .meta{font-size:11.5px;color:var(--ink3);margin-top:5px;letter-spacing:.04em}
  .kind{text-align:right;font-size:10px;letter-spacing:.16em;text-transform:uppercase;
        color:var(--gold);font-weight:700;line-height:1.5;max-width:240px}

  /* ── section furniture ── */
  .sec{margin-top:19px}
  .lbl{font-size:9.5px;letter-spacing:.17em;text-transform:uppercase;color:var(--ink3);
       font-weight:700;display:flex;align-items:center;gap:9px;margin-bottom:9px}
  .lbl::after{content:"";flex:1;height:1px;background:var(--rule)}

  /* ── her words ── */
  .quote{font-family:var(--d);font-size:20px;font-style:italic;line-height:1.38;
         color:var(--ink);border-left:3px solid var(--gold);padding-left:17px}
  .quote span{display:block;font-family:var(--b);font-style:normal;font-size:10.5px;
              color:var(--ink3);margin-top:7px;letter-spacing:.03em}

  /* ── match table ── */
  table{width:100%;border-collapse:collapse;font-size:12.5px}
  th{text-align:left;font-size:9px;letter-spacing:.13em;text-transform:uppercase;
     color:var(--ink3);padding:0 0 6px;border-bottom:1px solid var(--rule);font-weight:700}
  td{padding:7px 0;border-bottom:1px solid var(--rule);vertical-align:top;line-height:1.3}
  td.m{font-family:var(--m);font-weight:600;white-space:nowrap;font-size:12.5px;letter-spacing:-.02em}
  td.m span{color:var(--ink3);font-weight:400}
  /* A value with its unit and range can be longer than the sample's "5.8
     (0.4–4.0)"; it may then wrap between the value and the range, never
     inside either. */
  td.mv{white-space:normal}
  td.mv b{white-space:nowrap;font-weight:inherit}
  td.mv span{white-space:nowrap}
  td.flag{color:var(--warn);font-weight:600;font-size:10px;font-family:var(--m);letter-spacing:-.01em;white-space:nowrap;text-align:right;padding-left:10px}
  .num{font-family:var(--m);font-size:12px;letter-spacing:-.02em}
  .note{font-size:10px;color:var(--ink3);margin-top:8px;line-height:1.4}
  .pending{font-size:13.5px;color:var(--ink2);line-height:1.45;padding:2px 0 4px}

  /* ── blockers ── */
  .blk{display:grid;grid-template-columns:1fr 1fr;gap:7px 18px}
  .bk{display:flex;gap:9px;font-size:12px;line-height:1.3}
  .bk b{font-family:var(--m);font-size:15px;font-weight:600;color:var(--gold);line-height:1;min-width:15px}
  .know{font-size:11.5px;color:var(--ink2);margin-top:14px;line-height:1.45;font-weight:600}

  /* ── spend ── */
  .tot{display:flex;justify-content:space-between;align-items:baseline;
       background:var(--ink);color:var(--paper);padding:11px 15px;margin-top:11px}
  .tot .l{font-size:10px;letter-spacing:.13em;text-transform:uppercase;opacity:.75}
  .tot .v{font-family:var(--m);font-size:22px;font-weight:600;letter-spacing:-.03em}

  /* ── another year ── */
  .warn{border:1.5px solid var(--warn);padding:14px 16px}
  .warn .h{font-family:var(--b);font-weight:600;font-size:17px;font-weight:600;color:var(--warn);margin-bottom:6px}
  .warn p{font-size:12px;line-height:1.45;color:var(--ink2)}

  /* ── proof: one card the website already publishes ── */
  .pf{display:flex;justify-content:space-between;align-items:center;gap:20px;
      border:1.5px solid var(--rule);padding:11px 16px}
  .pf .pn{font-family:var(--b);font-weight:600;font-size:15px;letter-spacing:-.01em;line-height:1.2}
  .pf .pn span{font-size:9px;letter-spacing:.13em;text-transform:uppercase;color:var(--ink3);font-weight:700;margin-left:8px}
  .pf .pc{font-size:11.5px;color:var(--ink2);margin-top:3px;line-height:1.4}
  .pf .pq{font-size:9.5px;color:var(--ink3);margin-top:4px;letter-spacing:.02em}
  .pf .pr{text-align:right;white-space:nowrap}
  .pf .pw{font-family:var(--m);font-size:19px;font-weight:600;letter-spacing:-.03em;line-height:1.1}
  .pf .pk{font-family:var(--m);font-size:12px;font-weight:600;color:var(--gold);margin-top:3px;letter-spacing:-.01em}

  /* ── pillars: 1 | 2 | 3, space around them ── */
  .pil{display:grid;grid-template-columns:repeat(3,1fr);gap:16px}
  .p{border-top:2.5px solid var(--gold);padding-top:11px}
  .p .n{font-family:var(--m);font-size:12px;color:var(--gold);font-weight:600;letter-spacing:.1em}
  .p .nm{font-family:var(--b);font-weight:600;letter-spacing:-.01em;font-size:18px;font-weight:600;line-height:1.12;margin:3px 0 6px}
  .p .bd{font-size:10px;line-height:1.38;color:var(--ink2)}

  /* ── deliverables paired to pillars ── */
  /* She is buying THIS. It gets the same numerals and the same weight as the
     blockers on page 1 — the two lists are meant to rhyme. */
  .dl{display:grid;grid-template-columns:1fr 1fr;gap:11px 24px}
  .d{display:flex;gap:9px;font-size:10.5px;line-height:1.35;align-items:flex-start;color:var(--ink2)}
  .d b{display:block;font-size:12.5px;font-weight:600;color:var(--ink);letter-spacing:-.01em;margin-bottom:1px}
  .d i{font-style:normal;font-family:var(--m);color:var(--gold);font-weight:600;
       font-size:15px;line-height:1.1;min-width:20px}
  .d em{font-style:normal;color:var(--gold);font-size:7.5px;letter-spacing:.11em;
        display:block;text-transform:uppercase;margin-top:3px;font-weight:600}

  /* ── the ask ── */
  .ask{margin-top:auto;border-top:2px solid var(--ink);padding-top:15px;
       display:flex;justify-content:space-between;align-items:flex-end;gap:22px}
  .ask .amt{font-family:var(--m);font-size:31px;font-weight:600;line-height:1;letter-spacing:-.04em}
  .ask .sub{font-size:10.5px;color:var(--ink3);margin-top:5px;line-height:1.4}
  .step{background:var(--goldL);border-left:3px solid var(--gold);padding:11px 14px;max-width:335px}
  .step .t{font-size:9px;letter-spacing:.14em;text-transform:uppercase;color:var(--gold);font-weight:700}
  .step .x{font-size:12.5px;font-weight:600;line-height:1.35;margin-top:4px}
  .ask.solo .step{max-width:none;flex:1}
  .foot{font-size:9px;color:var(--ink3);text-align:center;margin-top:12px;letter-spacing:.05em}

  /* Page 1 carries less content than page 2, so it is set larger — which is
     also the brief: fewer words, bigger type, readable on a phone. */
  .p1 .sec{margin-top:30px}
  .p1 .quote{font-size:24px;padding-left:20px}
  .p1 .quote span{font-size:11.5px;margin-top:9px}
  .p1 table{font-size:14.5px}
  .p1 td{padding:10px 0}
  .p1 th{font-size:9.5px;padding-bottom:8px}
  .p1 .blk{gap:11px 22px}
  .p1 .bk{font-size:13.5px;line-height:1.35}
  .p1 .bk b{font-size:17px;min-width:20px}

  /* Air the sample never needed: a cell long enough to reach its column's
     edge keeps a gap before the next one, and the ask keeps a gap above it
     on a page full enough to have no slack for margin-top:auto to give. */
  th:not(:last-child),td:not(:last-child){padding-right:12px}
  .gets{margin-bottom:18px}

  /* The bottom of page 1 is deliberately quiet: one line, a lot of air. */
  .bridge{margin-top:auto;padding-top:34px;text-align:center}
  .bridge span{display:block;width:54px;height:2px;background:var(--gold);margin:0 auto 20px}
  .bridge p{font-family:var(--d);font-size:23px;line-height:1.45;color:var(--ink)}
  .bridge em{font-style:italic;color:var(--gold)}
`;

// Runs in the renderer once the fonts are in. See THE FIT SCRIPT above.
// A zoomed page is also widened by 1/zoom, so it still fills the sheet — and
// its lines rewrap, which is why the zoom is searched for rather than computed
// from the overflow: the largest zoom that fits, to within a fifth of a per cent.
// It measures only after the load event AND the fonts: before load, a font
// that has not started downloading yet would not hold fonts.ready back, and
// the page would be fitted in the fallback font. <html data-fit> marks it done.
const FIT = `
(function () {
  var MIN = 0.8;
  function zoom(p, z) {
    p.style.zoom = z === 1 ? "" : String(z);
    p.style.width = z === 1 ? "" : "calc(210mm / " + z + ")";
    p.style.height = z === 1 ? "" : "calc(297mm / " + z + ")";
  }
  function fits(p) { return p.scrollHeight <= p.clientHeight; }
  function fit() {
    var pages = document.querySelectorAll(".page");
    for (var i = 0; i < pages.length; i++) {
      var p = pages[i], z = 1;
      zoom(p, 1);
      if (!fits(p)) {
        var lo = MIN, hi = 1;
        zoom(p, lo);
        if (fits(p)) {
          for (var n = 0; n < 7; n++) {
            var mid = (lo + hi) / 2;
            zoom(p, mid);
            if (fits(p)) lo = mid; else hi = mid;
          }
          zoom(p, lo);
        }
        z = lo;
      }
      p.setAttribute("data-zoom", z.toFixed(3));
      p.setAttribute("data-overflow", String(Math.max(0, p.scrollHeight - p.clientHeight)));
    }
    document.documentElement.setAttribute("data-fit", "1");
  }
  function afterFonts() {
    (document.fonts && document.fonts.ready ? document.fonts.ready : Promise.resolve()).then(fit, fit);
  }
  if (document.readyState === "complete") afterFonts();
  else window.addEventListener("load", afterFonts);
})();
`;

const SWAPNIL = "Swapnil Umbarkar";

function header(title: string, titleStyle: string, meta: string, kind: string): string {
  return `
  <div class="top">
    <div>
      <div class="who"${titleStyle}>${title}</div>
      <div class="meta">${meta}</div>
    </div>
    <div class="kind">${kind}</div>
  </div>`;
}

function pageOne(m: SummaryModel): string {
  const name = esc(m.name);
  const quote = m.quote
    ? `
  <div class="sec">
    <div class="lbl">What you told me</div>
    <div class="quote">
      &ldquo;${esc(m.quote)}&rdquo;
      <span>Your words, from our call</span>
    </div>
  </div>`
    : "";

  const symptoms = m.symptoms.length
    ? `
    <table>
      <tr><th style="width:38%">What you feel</th><th style="width:30%">What your report shows</th><th style="width:18%">Your value</th><th></th></tr>
${m.symptoms
  .map(
    (r) =>
      `      <tr><td>${esc(r.feel)}</td><td>${esc(r.marker)}</td><td class="m mv"><b>${esc(r.value)}</b>${r.range ? ` <span>${esc(r.range)}</span>` : ""}</td><td class="flag">${esc(r.flag)}</td></tr>`,
  )
  .join("\n")}
    </table>`
    : `
    <p class="pending">Your report is still being read. The markers that match your symptoms go here once it is.</p>`;

  const blockers = m.blockers.map((b, i) => `      <div class="bk"><b>${i + 1}</b><span>${esc(b)}</span></div>`).join("\n");

  return `
<section class="page p1">${header(name, "", m.meta.map(esc).join(" &middot; "), "Thyroid<br>Root-Cause Review")}
${quote}

  <div class="sec">
    <div class="lbl">Your symptoms, matched to your report</div>${symptoms}
    <p class="note">These are patterns worth addressing, not a diagnosis. Your doctor stays your doctor &mdash; nothing here replaces medical advice or your medication.</p>
  </div>

  <div class="sec">
    <div class="lbl">Why your weight is not moving &mdash; ${esc(m.blockerCount.heading)}</div>
    <div class="blk">
${blockers}
    </div>
    <p class="know">${esc(m.blockerCount.line)} What to fix, in what order, and measured against your markers every two weeks &mdash; that is the programme.</p>
  </div>

  <div class="bridge">
    <span></span>
    <p>None of this is a willpower problem.<br>It is a <em>sequencing</em> problem &mdash; and sequence is fixable.</p>
  </div>

  <div class="foot">Page 1 of 2 &middot; Diagnosis &nbsp;&bull;&nbsp; Prepared for ${name} by ${SWAPNIL}</div>
</section>`;
}

function pageTwo(m: SummaryModel): string {
  const spent = m.spent.length
    ? `
  <div class="sec">
    <table>
      <tr><th style="width:52%">What you have already tried</th><th style="width:24%">Time</th><th style="width:24%">Money</th></tr>
${m.spent.map((r) => `      <tr><td>${esc(r.what)}</td><td class="num">${esc(r.time)}</td><td class="m">${esc(r.money)}</td></tr>`).join("\n")}
    </table>${
      m.total
        ? `
    <div class="tot">
      <span class="l">Spent so far, and still at the start</span>
      <span class="v">${esc(m.total)}</span>
    </div>`
        : ""
    }
  </div>`
    : "";

  const lead = m.nextYear ? `${esc(m.nextYear)} ` : "";
  const proof = m.proof;
  const price = m.price
    ? `
    <div>
      <div class="amt">${esc(m.price.amount)}</div>
      <div class="sub">Three months, 1-to-1${m.price.comparison ? ` &middot; ${esc(m.price.comparison)}` : ""}<br>Instalments available &mdash; ask me</div>
    </div>`
    : "";

  return `
<section class="page">${header(
    "What this has already cost",
    ' style="font-size:25px"',
    "And what the next twelve months cost if nothing changes",
    `${esc(m.name)}<br>Page 2`,
  )}
${spent}

  <div class="sec">
    <div class="warn">
      <div class="h">Another twelve months of the same</div>
      <p>${lead}Hypothyroid fat loss gets <strong>slower</strong> each year, not faster &mdash; the years this weight took to arrive will not reverse on their own.</p>
    </div>
  </div>

  <div class="sec">
    <div class="lbl">Someone who started where you are</div>
    <div class="pf">
      <div>
        <div class="pn">${esc(proof.name)}${proof.occupation ? `<span>${esc(proof.occupation)}</span>` : ""}</div>
        <div class="pc">In 90 days, despite ${esc(proof.condition)}. ${esc(proof.story)}</div>
        <div class="pq">One client&rsquo;s own outcome, not a typical result.</div>
      </div>
      <div class="pr">
        <div class="pw">${esc(proof.from)} &rarr; ${esc(proof.to)}</div>
        <div class="pk">&minus;${esc(proof.kg)}</div>
      </div>
    </div>
  </div>

  <div class="sec">
    <div class="lbl">The method &mdash; three pillars</div>
    <div class="pil">
      <div class="p"><div class="n">PILLAR 1</div><div class="nm">Fix the<br>Root</div><div class="bd">Diets failed because the root cause, thyroid and hormones, was never addressed. That&rsquo;s pressing the accelerator with the handbrake on. We reset the metabolism first.</div></div>
      <div class="p"><div class="n">PILLAR 2</div><div class="nm">Fuel the<br>Body</div><div class="bd">Home-cooked roti-sabzi meals built for thyroid health. No cutting out Indian food, no starving.</div></div>
      <div class="p"><div class="n">PILLAR 3</div><div class="nm">Flow into<br>Fitness</div><div class="bd">Joint-friendly, 30&ndash;40 minutes, fits a meetings-till-8pm day. Plus sleep and daily rhythm.</div></div>
    </div>
  </div>

  <div class="sec gets">
    <div class="lbl">What you get</div>
    <div class="dl">
${m.deliverables
  .map((d) => `      <div class="d"><i>${esc(d.mark)}</i><span><b>${esc(d.title)}</b>${esc(d.body)}<em>${esc(d.tag)}</em></span></div>`)
  .join("\n")}
    </div>
  </div>

  <div class="ask${price ? "" : " solo"}">${price}
    <div class="step">
      <div class="t">Your next step</div>
      <div class="x">${stepHtml(m.nextStep)}</div>
    </div>
  </div>

  <div class="foot">Page 2 of 2 &middot; Decision &nbsp;&bull;&nbsp; Not medical advice. Results vary.</div>
</section>`;
}

export function summaryHtml(m: SummaryModel): string {
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Consultation Summary &middot; ${esc(m.name)}</title>
<link rel="stylesheet" href="${FONTS}">
<style>${CSS}</style>
</head>
<body>
${pageOne(m)}
${pageTwo(m)}
<script>${FIT}</script>
</body>
</html>
`;
}
