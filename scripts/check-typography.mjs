#!/usr/bin/env node
/**
 * Typography lint.
 *
 * NOTE ON THE MESSAGE STRINGS BELOW: none of them may contain a literal
 * Tailwind arbitrary-value class. Tailwind scans this repo for class names and
 * will happily compile an example out of an error message — a `--fs-*` inside
 * square brackets became a real rule with a literal asterisk in it, which is
 * not valid CSS, and the dev server refused to serve the stylesheet at all.
 * Describe the fix in words instead of spelling the class. Runs before every build (`npm run build`) and inside
 * `npm test`.
 *
 * WHY A LINT AND NOT A CONVENTION: the fifty-eight font sizes this scale
 * replaced did not arrive deliberately. They accumulated one "just slightly
 * smaller here" at a time over months, until 0.55rem, 0.56rem, 0.58rem and
 * 0.59rem all existed at once — 8.8px, 9.0px, 9.3px, 9.4px, four separate
 * decisions nobody could tell apart. A scale with nothing stopping additions
 * is back to fifty-eight within a month. This is the thing that stops it.
 *
 * SCOPE is the funnel surface, listed explicitly below. The admin, CRM, inbox
 * and webinar screens are internal tools on their own type systems and are not
 * in scope; widen SCOPE when one of them is migrated, rather than loosening
 * the rules.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

const SCOPE = [
  "app/globals.css",
  "app/decode/page.tsx",
  "app/decode/DecodeQuiz.tsx",
  "app/decode/quiz/page.tsx",
  "app/decode/ShareWithFamily.tsx",
  "app/decode/DecodeStickyCta.tsx",
  "app/session-booked/page.tsx",
  "app/components/SymptomChips.tsx",
  "app/components/AbsolveBlock.tsx",
  "app/components/HeroProofStrip.tsx",
  "app/components/TransformationWall.tsx",
  "app/components/WhatsappProofSection.tsx",
  "app/components/VideoTestimonial.tsx",
  "app/components/CertificationsSection.tsx",
];

// The nine sizes, four tracks, four leadings and two measures. Anything else
// is a new one-off, which is the whole thing this prevents.
const SIZE = /^--fs-(3xs|2xs|xs|sm|base|lg|xl|2xl|3xl)$/;
const TRACK = /^--ls-(display|heading|body|caps)$/;
const LEAD = /^--lh-(display|heading|body|tight)$/;
const WEIGHTS = new Set(["400", "500", "600", "700"]);

/** The token block itself is where raw values are allowed to live. */
const tokenBlock = (src) => {
  const start = src.indexOf("--fs-3xs:");
  const end = src.indexOf("/* Spacing */");
  return start > -1 && end > start ? [start, end] : [-1, -1];
};

const problems = [];
const at = (src, i) => src.slice(0, i).split("\n").length;

for (const file of SCOPE) {
  const src = readFileSync(join(root, file), "utf8");
  const [tokStart, tokEnd] = tokenBlock(src);
  const inTokens = (i) => i >= tokStart && i < tokEnd;
  const report = (i, msg) => problems.push(`${file}:${at(src, i)}  ${msg}`);

  if (file.endsWith(".css")) {
    for (const m of src.matchAll(/font-size:\s*([^;]+);/g)) {
      if (inTokens(m.index)) continue;
      const v = m[1].trim();
      const token = v.match(/^var\((--[a-z0-9-]+)\)$/)?.[1];
      if (!token || !SIZE.test(token)) report(m.index, `font-size must use an --fs- token, got "${v}"`);
    }
    for (const m of src.matchAll(/letter-spacing:\s*([^;]+);/g)) {
      if (inTokens(m.index)) continue;
      const v = m[1].trim();
      const token = v.match(/^var\((--[a-z0-9-]+)\)$/)?.[1];
      if (!token || !TRACK.test(token)) report(m.index, `letter-spacing must use an --ls- token, got "${v}"`);
    }
    for (const m of src.matchAll(/line-height:\s*([^;]+);/g)) {
      if (inTokens(m.index)) continue;
      const v = m[1].trim();
      if (v === "1" || v === "0") continue; // icon boxes, not text
      const token = v.match(/^var\((--[a-z0-9-]+)\)$/)?.[1];
      if (!token || !LEAD.test(token)) report(m.index, `line-height must use an --lh- token, got "${v}"`);
    }
    for (const m of src.matchAll(/font-weight:\s*([a-z0-9]+)/g)) {
      if (!WEIGHTS.has(m[1])) report(m.index, `font-weight must be 400/500/600/700, got "${m[1]}"`);
    }
    continue;
  }

  // TSX: Tailwind arbitrary values and inline styles.
  for (const m of src.matchAll(/text-\[(?!length:var\(--fs-)([^\]]*(?:px|rem|em)[^\]]*)\]/g)) {
    report(m.index, "raw font-size \"" + m[1] + "\" — use an --fs- token via the length: hint");
  }
  for (const m of src.matchAll(/tracking-\[(?!var\(--ls-)([^\]]+)\]/g)) {
    report(m.index, "raw letter-spacing \"" + m[1] + "\" — use an --ls- token");
  }
  for (const m of src.matchAll(/leading-\[(?!var\(--lh-)([^\]]+)\]/g)) {
    report(m.index, "raw line-height \"" + m[1] + "\" — use an --lh- token");
  }
  for (const m of src.matchAll(/\b(font-extrabold|font-black|font-light|font-thin)\b/g)) {
    report(m.index, `"${m[1]}" is outside the three-weight scale (400 / 500 / 700, 600 on caps)`);
  }
  for (const m of src.matchAll(/fontWeight:\s*"?([a-z0-9]+)"?/g)) {
    if (!WEIGHTS.has(m[1])) report(m.index, `font-weight "${m[1]}" is outside the scale`);
  }
  for (const m of src.matchAll(/fontSize:\s*"?([^",}]+)"?/g)) {
    if (!m[1].includes("var(--fs-")) report(m.index, `inline fontSize "${m[1]}" — use a token`);
  }
}

if (problems.length) {
  console.error(`\ntypography: ${problems.length} value(s) outside the scale\n`);
  for (const p of problems) console.error("  " + p);
  console.error("\nThe scale is nine sizes, four tracks, four leadings, three weights.");
  console.error("If one of them genuinely does not fit, change the token — not the call site.\n");
  process.exit(1);
}
console.log(`typography: ${SCOPE.length} files on the scale`);
