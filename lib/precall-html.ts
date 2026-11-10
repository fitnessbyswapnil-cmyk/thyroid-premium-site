/**
 * lib/precall-html.ts — PURE. A PrecallModel (lib/precall.ts) as the full HTML
 * of her pre-call PDF, ready for the PDF worker (workers/pdf) to print through
 * lib/pdf-render, exactly as the consultation summary is printed.
 *
 * THE SAME HOUSE, A DIFFERENT DOCUMENT
 * The approved summary's identity is kept: IBM Plex Sans for structure, Mono
 * for every number, Serif for the one headline, the same warm paper, ink, gold
 * and rust, the same section labels with their hairline. What makes it a
 * different document at a glance: the gold band across the top edge, the
 * serif question as the headline instead of her name, her name set top right
 * as the person it is prepared for, and a gold-ruled doctor box at the end
 * where the summary has its price and next step.
 *
 * THE COPY RULES ARE HELD HERE AND IN THE TESTS
 * No em dash anywhere, fixed or typed (lib/precall.ts strips them from what he
 * typed; nothing below contains one, not even as an entity). The doctor line
 * and "Individual results vary" are always printed. Nothing diagnoses, nothing
 * mentions a dose, nothing promises a cure or a reversal.
 *
 * EVERYTHING FROM HIM, HER OR THE SHEET IS ESCAPED
 * Marker names, values, ranges, flags, her answers and her name all go through
 * esc() (lib/summary-html), so a "<" in a range prints as a "<" and nothing
 * typed into a box or a Doc can run in the renderer's browser.
 *
 * THE FIT SCRIPT
 * As in the summary: once the load event and the fonts are in, any page whose
 * content is taller than its sheet is zoomed down uniformly until it fits,
 * never below 80%, and <html data-fit> tells the printer it may print.
 * lib/precall.ts (splitRows) decides what goes on which page, so the zoom only
 * ever absorbs a line or two of wrapping.
 */
import { esc } from "./summary-html.ts";
import type { PrecallModel, ReportRow } from "./precall.ts";

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
  .page{width:210mm;height:297mm;background:var(--paper);padding:50px 58px 36px;
        display:flex;flex-direction:column;overflow:hidden;position:relative;break-after:page}
  .page:last-of-type{break-after:auto}
  .page>*{flex:0 0 auto}
  @media screen{body{background:#8c8681}.page{margin:0 auto 26px;box-shadow:0 10px 40px rgba(0,0,0,.3)}}

  /* ── this document's mark: the summary has no band ── */
  .band{position:absolute;left:0;right:0;top:0;height:7px;background:var(--gold)}

  /* ── header ── */
  .top{display:flex;justify-content:space-between;align-items:flex-end;gap:22px;
       border-bottom:2px solid var(--ink);padding-bottom:14px}
  .top>div:first-child{flex:0 0 auto}
  .kick{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--gold);font-weight:700;margin-bottom:9px}
  /* The headline never wraps; a long name wraps in its own corner instead. */
  h1{font-family:var(--d);font-weight:600;font-size:31px;line-height:1.08;letter-spacing:-.015em;white-space:nowrap}
  .sub{font-size:13.5px;color:var(--ink2);margin-top:7px;letter-spacing:.01em}
  .for{text-align:right;flex:0 1 auto;min-width:0;max-width:235px}
  .for .lab{font-size:9px;letter-spacing:.16em;text-transform:uppercase;color:var(--ink3);font-weight:700}
  .for .nm{font-weight:600;font-size:17px;letter-spacing:-.01em;line-height:1.2;margin-top:3px}
  .for .mt{font-size:11px;color:var(--ink3);margin-top:4px;line-height:1.5;letter-spacing:.03em}
  .t2{font-family:var(--d);font-weight:600;font-size:21px;line-height:1.15;letter-spacing:-.01em}

  .lead{font-size:12.5px;line-height:1.55;color:var(--ink2);margin-top:14px;max-width:600px}

  /* ── section furniture, as the summary ── */
  .sec{margin-top:21px}
  .lbl{font-size:9.5px;letter-spacing:.17em;text-transform:uppercase;color:var(--ink3);
       font-weight:700;display:flex;align-items:center;gap:9px;margin-bottom:10px}
  .lbl::after{content:"";flex:1;height:1px;background:var(--rule)}

  /* ── what she told the quiz: the question's gist over her answer ── */
  .facts{display:grid;grid-template-columns:1fr 1fr;gap:11px 28px}
  .f span{display:block;font-size:8.5px;letter-spacing:.14em;text-transform:uppercase;color:var(--ink3);font-weight:700}
  .f b{display:block;font-weight:500;font-size:13px;line-height:1.35;margin-top:3px}

  /* ── her report ── */
  table{width:100%;border-collapse:collapse}
  th{text-align:left;font-size:9px;letter-spacing:.13em;text-transform:uppercase;
     color:var(--ink3);padding:0 0 6px;border-bottom:1px solid var(--rule);font-weight:700}
  td{vertical-align:baseline}
  th:not(:last-child),td:not(:last-child){padding-right:12px}
  tr.r td{padding-top:8px;font-size:13.5px;line-height:1.3}
  tr.r.solo td{padding-bottom:8px;border-bottom:1px solid var(--rule)}
  td.mk{font-weight:600}
  td.v{font-family:var(--m);font-weight:600;font-size:13px;letter-spacing:-.02em;white-space:nowrap}
  td.rg{font-family:var(--m);font-size:12px;color:var(--ink3);white-space:nowrap}
  td.fl{font-family:var(--m);font-size:10.5px;font-weight:600;color:var(--warn);text-align:right;white-space:nowrap}
  tr.x td{font-size:10.5px;line-height:1.45;color:var(--ink2);padding:3px 0 9px;border-bottom:1px solid var(--rule)}
  .note{font-size:10px;color:var(--ink3);margin-top:8px;line-height:1.45}

  /* ── the call: same numerals as the summary's blockers ── */
  .ag{list-style:none;display:grid;gap:7px}
  .ag li{display:flex;gap:10px;font-size:12.5px;line-height:1.4}
  .ag b{font-family:var(--m);font-size:14px;font-weight:600;color:var(--gold);min-width:16px;line-height:1.25}

  /* ── the doctor box: where the summary has its price, held to the foot of
     the last page like the summary's ask, with a gap kept above it on a page
     too full to have any slack ── */
  .agsec{margin-bottom:20px}
  .doc{margin-top:auto;border-left:3px solid var(--gold);background:var(--goldL);padding:12px 16px;
       font-size:11.5px;line-height:1.5;color:var(--ink2)}
  .doc strong{display:block;color:var(--ink);font-weight:700;font-size:12.5px;margin-bottom:2px}
  .foot{margin-top:auto;padding-top:14px;font-size:9px;color:var(--ink3);text-align:center;letter-spacing:.05em}
  .doc + .foot{margin-top:0}
`;

// Runs in the renderer once the fonts are in; the printer waits for <html data-fit>.
// A zoomed page is widened by 1/zoom so it still fills the sheet, and its lines
// rewrap, which is why the zoom is searched for rather than computed.
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

/** The fixed sentences, in one place so the tests can hold every one of them to the copy rules. */
export const PRECALL_COPY = {
  kicker: "Pre-call analysis",
  title: "Why your weight isn’t moving",
  subtitle: "What your answers and your report show",
  subtitleNoAnswers: "What your report shows",
  lead:
    "Before our call I went through your quiz answers and your blood report. Here they are side by side, with what the main markers are and why they matter for energy and weight. On the call we work out what to do about them.",
  leadNoAnswers:
    "Before our call I went through your blood report. Here are your results, with what the main markers are and why they matter for energy and weight. On the call we work out what to do about them.",
  tableNote: "Values are copied from your report.",
  unexplainedNote: "A marker with no line under it is one we go through together on the call.",
  continued: "Continued on page 2.",
  doctorLine: "Please discuss these results with your doctor.",
  doctorBody:
    "This page is coaching insight, not a diagnosis or medical advice. It does not change your medication or replace your doctor’s care. Individual results vary.",
  footNote: "Coaching insight, not medical advice",
} as const;

function header(m: PrecallModel): string {
  const meta = m.meta.map(esc).join(" &middot; ");
  return `
  <div class="band"></div>
  <div class="top">
    <div>
      <div class="kick">${esc(PRECALL_COPY.kicker)}</div>
      <h1>${esc(PRECALL_COPY.title)}</h1>
      <div class="sub">${esc(m.facts.length ? PRECALL_COPY.subtitle : PRECALL_COPY.subtitleNoAnswers)}</div>
    </div>
    <div class="for">
      <div class="lab">Prepared for</div>
      <div class="nm">${esc(m.name)}</div>${meta ? `
      <div class="mt">${meta}</div>` : ""}
    </div>
  </div>
  <p class="lead">${esc(m.facts.length ? PRECALL_COPY.lead : PRECALL_COPY.leadNoAnswers)}</p>`;
}

function headerTwo(m: PrecallModel): string {
  return `
  <div class="band"></div>
  <div class="top">
    <div>
      <div class="kick">${esc(PRECALL_COPY.kicker)}, continued</div>
      <div class="t2">${esc(PRECALL_COPY.title)}</div>
    </div>
    <div class="for">
      <div class="nm">${esc(m.name)}</div>
      <div class="mt">Page 2</div>
    </div>
  </div>`;
}

function facts(m: PrecallModel): string {
  if (!m.facts.length) return "";
  return `
  <div class="sec">
    <div class="lbl">What you told me</div>
    <div class="facts">
${m.facts.map((f) => `      <div class="f"><span>${esc(f.label)}</span><b>${esc(f.value)}</b></div>`).join("\n")}
    </div>
  </div>`;
}

function row(r: ReportRow): string {
  const main = `      <tr class="r${r.note ? "" : " solo"}"><td class="mk">${esc(r.marker)}</td><td class="v">${esc(r.value)}</td><td class="rg">${esc(r.range)}</td><td class="fl">${esc(r.flag)}</td></tr>`;
  return r.note ? `${main}\n      <tr class="x"><td colspan="4">${esc(r.note)}</td></tr>` : main;
}

function table(rows: ReportRow[], label: string, note: string): string {
  return `
  <div class="sec">
    <div class="lbl">${esc(label)}</div>
    <table>
      <tr><th style="width:36%">Marker</th><th style="width:24%">Your value</th><th style="width:24%">Range</th><th></th></tr>
${rows.map(row).join("\n")}
    </table>
    <p class="note">${esc(note)}</p>
  </div>`;
}

function tail(m: PrecallModel): string {
  return `
  <div class="sec agsec">
    <div class="lbl">What we will look at on our call</div>
    <ol class="ag">
${m.agenda.map((a, i) => `      <li><b>${i + 1}</b><span>${esc(a)}</span></li>`).join("\n")}
    </ol>
  </div>

  <div class="doc">
    <strong>${esc(PRECALL_COPY.doctorLine)}</strong>
    ${esc(PRECALL_COPY.doctorBody)}
  </div>`;
}

function foot(m: PrecallModel, page: number, pages: number): string {
  const n = pages > 1 ? `Page ${page} of ${pages} &middot; ` : "";
  return `
  <div class="foot">${n}Prepared for ${esc(m.name)} by ${SWAPNIL} &nbsp;&bull;&nbsp; ${esc(PRECALL_COPY.footNote)}</div>`;
}

export function precallHtml(m: PrecallModel): string {
  const split = Math.max(0, Math.min(m.split, m.rows.length));
  const two = split < m.rows.length;
  const first = m.rows.slice(0, split);
  const rest = m.rows.slice(split);
  const explainedAll = m.rows.every((r) => r.group);
  const closing = explainedAll ? PRECALL_COPY.tableNote : `${PRECALL_COPY.tableNote} ${PRECALL_COPY.unexplainedNote}`;

  const pageOne = `
<section class="page">${header(m)}
${facts(m)}
${table(first, "What your report shows", two ? `${PRECALL_COPY.tableNote} ${PRECALL_COPY.continued}` : closing)}
${two ? "" : tail(m)}
${foot(m, 1, two ? 2 : 1)}
</section>`;

  const pageTwo = two
    ? `
<section class="page">${headerTwo(m)}
${table(rest, "What your report shows, continued", closing)}
${tail(m)}
${foot(m, 2, 2)}
</section>`
    : "";

  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<title>Pre-call Analysis &middot; ${esc(m.name)}</title>
<link rel="stylesheet" href="${FONTS}">
<style>${CSS}</style>
</head>
<body>
${pageOne}
${pageTwo}
<script>${FIT}</script>
</body>
</html>
`;
}
