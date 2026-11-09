#!/usr/bin/env node
/**
 * Contrast lint.
 *
 * NOTE ON THE MESSAGE STRINGS BELOW: as in check-typography.mjs, none of them
 * may contain a literal Tailwind arbitrary-value class. Tailwind scans this
 * repo for class names and will compile an example out of an error message.
 * Name the token in words, never in bracket syntax.
 *
 * WHY A LINT AND NOT A REVIEW: on 08-Nov-2026 the headline on all four
 * WhatsApp proof cards was rendering #0b1120 on #0f0e0c — a contrast ratio of
 * 1.02:1, invisible — live, for weeks, through two separate pull requests that
 * each claimed to have verified the page. Nothing caught it: not the build,
 * not the 591 unit tests, not the typography lint, not human review. It was
 * found by reading computed styles out of a browser by hand.
 *
 * The cause was not a wrong colour. Both colours were right, for different
 * grounds. `.proof-card` is a SURFACE CONTRACT: it paints itself white and
 * redefines the ink tokens to their light values, so its children read dark on
 * white. That class had been put on an element which painted ITSELF with
 * var(--surface-page) — which inside `.band-deep` resolves to #0f0e0c. So a
 * near-black card was handed the ink of a white one.
 *
 * That class of bug is invisible in a diff and invisible in the CSS, because
 * it only exists where a component and a stylesheet meet. It is, however,
 * perfectly visible to arithmetic. Hence this file.
 *
 * THREE CHECKS:
 *   1. A surface-contract class may not sit on an element that paints its own
 *      background. One of the two is lying about the ground. (The 08-Nov bug.)
 *   2. Every ink token in effect in a scope must clear 4.5:1 against that
 *      scope's own ground — used today or not. A contract that declares a
 *      ground owes readable ink on it; unreadable ink is a loaded gun for
 *      whoever adds the next line of copy.
 *   3. A component that renders on more than one ground may not hardcode an
 *      ink hex. Those values are surface-dependent by construction: the
 *      stylesheet declares the same token differently per ground, so a literal
 *      is correct on one and wrong on the others. This is how the WhatsApp and
 *      video attribution lines ended up at 2.47:1 and 2.26:1.
 *
 * SCOPE is the funnel surface, the same list the typography lint governs. The
 * admin, CRM and inbox screens are internal tools and are not in scope.
 *
 * Run: node scripts/check-contrast.mjs [--dump]
 * `--dump` prints the parsed model instead of judging it. Read the model
 * before trusting a finding; a checker that is wrong about the page is worse
 * than no checker, and this one has a predecessor that reported 35 failures of
 * which 26 were false.
 */
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const CSS = "app/globals.css";

/** Components on the funnel surface, as check-typography.mjs lists them. */
const TSX = [
  "app/decode/page.tsx",
  "app/decode/DecodeQuiz.tsx",
  "app/decode/quiz/page.tsx",
  "app/decode/ShareWithFamily.tsx",
  "app/decode/DecodeStickyCta.tsx",
  "app/decode/CoachIntro.tsx",
  "app/session-booked/page.tsx",
  "app/components/SymptomChips.tsx",
  "app/components/AbsolveBlock.tsx",
  "app/components/HeroProofStrip.tsx",
  "app/components/TransformationWall.tsx",
  "app/components/WhatsappProofSection.tsx",
  "app/components/VideoTestimonial.tsx",
  "app/components/CertificationsSection.tsx",
];

/**
 * Which scope sits inside which. This is DECLARED, not derived: resolving the
 * real cascade statically would mean knowing the rendered tree, and guessing
 * it is how a checker starts lying. Each entry lists every ground the scope is
 * actually used on; a token is judged against all of them and reported at its
 * worst. Add a scope here when you add a surface contract to the stylesheet —
 * an unlisted one is reported as unplaced rather than silently skipped.
 */
const PARENTS = {
  ":root": [],
  ".theme-decode": [":root"],
  ".band-deep": [".theme-decode"],
  ".section-deep": [".theme-decode", ":root"], // /decode and / respectively
  ".proof-card": [".band-deep"],
  ".band-deep .light-panel": [".band-deep"],
};

/**
 * Grounds that live in a COMPONENT rather than in the stylesheet. A scope that
 * redefines ink but declares no background of its own has no ground this file
 * can see; without an entry here its ink is judged against the ground it
 * inherits, which is exactly backwards for a light panel inside a dark band
 * and produced a false 1.02:1 on the first run of this lint.
 *
 * `.band-deep .light-panel` is white because SymptomChips.tsx puts a Tailwind
 * bg-white on the same element (and, for the sticky counter, on its child).
 * The coupling is real, so it is written down rather than guessed at.
 */
const GROUND = {
  ".band-deep .light-panel": "#ffffff",
};

const INK = ["--t1", "--t2", "--t3", "--t4", "--t5"];
const AA_NORMAL = 4.5;

/**
 * Findings that are real and NOT yet fixed, each with the reason it is still
 * here. This list exists so the lint can guard against NEW breakage today
 * instead of waiting for every old one to be settled — but it is printed in
 * full on every green run, so it can never quietly become the place findings
 * go to die. Removing an entry is the fix landing; adding one needs a reason
 * a reader can check.
 *
 * "latent" means nothing in that scope reads the token today. It is still
 * written down, because the next line of copy put there renders at that ratio
 * and nobody will think to measure it.
 */
const ACCEPTED = [
  {
    scope: ":root",
    tokens: ["--t4", "--t5"],
    why:
      "LIVE on the /payment footer disclaimer (11px, #9a9890 on white). The fix " +
      "is one token value, but :root ink reaches / and /payment — a visual " +
      "change on two pages outside this lint's scope, and /payment is a 299 " +
      "payment file. Owner's call, not a lint's.",
  },
  {
    scope: ".proof-card",
    tokens: ["--t4", "--t5"],
    why:
      "Latent. The card contract overrides --t1/--t2/--t3 but leaves --t4 " +
      "falling through from .band-deep and sets --t5 to the old faint grey. " +
      "Nothing inside a card reads either one today.",
  },
  {
    scope: ".band-deep .light-panel",
    tokens: ["--t3", "--t4", "--t5"],
    why:
      "Latent. The panel contract overrides only --t1/--t2; the rest fall " +
      "through from .band-deep, which are light inks meant for a dark ground. " +
      "SymptomChips reads only --t1 inside the panel.",
  },
];

const isAccepted = (scope, token) =>
  ACCEPTED.find((a) => a.scope === scope && a.tokens.includes(token));

/* ── colour ──────────────────────────────────────────────────────────────── */

const srgbToLinear = (c) =>
  c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);

const luminance = ([r, g, b]) =>
  0.2126 * srgbToLinear(r / 255) +
  0.7152 * srgbToLinear(g / 255) +
  0.0722 * srgbToLinear(b / 255);

const ratio = (fg, bg) => {
  const a = luminance(fg);
  const b = luminance(bg);
  const [hi, lo] = a > b ? [a, b] : [b, a];
  return (hi + 0.05) / (lo + 0.05);
};

/** Paint `fg` (which may carry alpha) over opaque `bg`. */
const over = (fg, bg) => {
  const a = fg.length === 4 ? fg[3] : 1;
  if (a >= 1) return fg.slice(0, 3);
  return [0, 1, 2].map((i) => fg[i] * a + bg[i] * (1 - a));
};

/** "#abc" | "#aabbcc" | "rgb(…)" | "rgba(…)" -> [r,g,b(,a)] or null. */
function parseColour(v) {
  const s = v.trim();
  let m = s.match(/^#([0-9a-f]{3})$/i);
  if (m) return [...m[1]].map((c) => parseInt(c + c, 16));
  m = s.match(/^#([0-9a-f]{6})$/i);
  if (m) return [0, 2, 4].map((i) => parseInt(m[1].slice(i, i + 2), 16));
  m = s.match(/^rgba?\(([^)]+)\)$/i);
  if (m) {
    const p = m[1].split(/[,\s/]+/).filter(Boolean).map(Number);
    if (p.length >= 3 && p.slice(0, 3).every((n) => Number.isFinite(n))) {
      return p.length > 3 && Number.isFinite(p[3]) ? p.slice(0, 4) : p.slice(0, 3);
    }
  }
  return null;
}

const hex = (c) =>
  "#" + c.slice(0, 3).map((n) => Math.round(n).toString(16).padStart(2, "0")).join("");

/* ── CSS ─────────────────────────────────────────────────────────────────── */

/** Flatten the stylesheet to [{selector, decls}], descending into @-blocks. */
function rules(src) {
  const out = [];
  let i = 0;
  const walk = (from, to) => {
    let j = from;
    let head = "";
    while (j < to) {
      const ch = src[j];
      if (ch === "/" && src[j + 1] === "*") {
        const end = src.indexOf("*/", j + 2);
        j = end === -1 ? to : end + 2;
        continue;
      }
      if (ch === "{") {
        let depth = 1;
        let k = j + 1;
        while (k < to && depth) {
          if (src[k] === "/" && src[k + 1] === "*") {
            const end = src.indexOf("*/", k + 2);
            k = end === -1 ? to : end + 2;
            continue;
          }
          if (src[k] === "{") depth++;
          else if (src[k] === "}") depth--;
          k++;
        }
        const selector = head.trim();
        const body = src.slice(j + 1, k - 1);
        if (selector.startsWith("@")) walk(j + 1, k - 1);
        else if (selector) out.push({ selector, body, at: j });
        head = "";
        j = k;
        continue;
      }
      if (ch === "}") { head = ""; j++; continue; }
      head += ch;
      j++;
    }
  };
  walk(i, src.length);
  return out;
}

/** Top-level `prop: value` pairs of a rule body, ignoring nested rules. */
function decls(body) {
  const out = new Map();
  let depth = 0;
  let buf = "";
  for (let i = 0; i < body.length; i++) {
    const ch = body[i];
    if (ch === "/" && body[i + 1] === "*") {
      const end = body.indexOf("*/", i + 2);
      i = end === -1 ? body.length : end + 1;
      continue;
    }
    if (ch === "{") { depth++; buf = ""; continue; }
    if (ch === "}") { depth--; buf = ""; continue; }
    if (depth > 0) continue;
    if (ch === ";") {
      const c = buf.indexOf(":");
      if (c > 0) out.set(buf.slice(0, c).trim(), buf.slice(c + 1).trim());
      buf = "";
      continue;
    }
    buf += ch;
  }
  const c = buf.indexOf(":");
  if (c > 0) out.set(buf.slice(0, c).trim(), buf.slice(c + 1).trim());
  return out;
}

const src = readFileSync(join(root, CSS), "utf8");
const allRules = rules(src);
const lineOf = (i) => src.slice(0, i).split("\n").length;

/** Merge every rule sharing a selector; keep the first line for reporting. */
const scopes = new Map();
for (const r of allRules) {
  for (const sel of r.selector.split(",").map((s) => s.trim())) {
    if (!(sel in PARENTS)) continue;
    const d = decls(r.body);
    if (!scopes.has(sel)) scopes.set(sel, { sel, line: lineOf(r.at), decls: new Map() });
    const s = scopes.get(sel);
    for (const [k, v] of d) s.decls.set(k, v);
    if (lineOf(r.at) < s.line) s.line = lineOf(r.at);
  }
}

/** Resolve a custom property by walking one chain of ancestors. */
function lookup(sel, prop, chain, seen = new Set()) {
  if (seen.has(sel)) return null;
  seen.add(sel);
  const s = scopes.get(sel);
  if (s?.decls.has(prop)) return { value: s.decls.get(prop), from: sel };
  for (const p of PARENTS[sel] ?? []) {
    const hit = lookup(p, prop, chain, seen);
    if (hit) return hit;
  }
  return null;
}

/** Resolve a value to a colour, following var() and compositing alpha. */
function resolve(value, sel, groundFor) {
  let v = value;
  for (let hop = 0; hop < 8; hop++) {
    const m = v.match(/^var\(\s*(--[a-z0-9-]+)\s*(?:,[^)]*)?\)$/i);
    if (!m) break;
    const hit = lookup(sel, m[1]);
    if (!hit) return null;
    v = hit.value;
  }
  const c = parseColour(v);
  if (!c) return null;
  if (c.length === 4 && groundFor) {
    const g = groundFor();
    return g ? over(c, g) : null;
  }
  return c.slice(0, 3);
}

/** The opaque ground a scope paints, or inherits from an ancestor. */
function ground(sel, viaParent = null, seen = new Set()) {
  if (seen.has(sel)) return null;
  seen.add(sel);
  const s = scopes.get(sel);
  const parents = viaParent ? [viaParent] : PARENTS[sel] ?? [];
  const parentGround = () => {
    for (const p of parents) {
      const g = ground(p, null, new Set(seen));
      if (g) return g;
    }
    return null;
  };
  if (GROUND[sel]) return parseColour(GROUND[sel]);
  const own = s?.decls.get("background") ?? s?.decls.get("background-color");
  if (own) {
    const c = resolve(own, sel, parentGround);
    if (c) return c;
  }
  if (sel === ":root") {
    const c = resolve("var(--surface-page)", ":root", null);
    if (c) return c;
  }
  return parentGround();
}

/* ── dump ────────────────────────────────────────────────────────────────── */

if (process.argv.includes("--dump")) {
  console.log("\nparsed surface contracts (selector, line, ground, ink in effect)\n");
  for (const sel of Object.keys(PARENTS)) {
    const s = scopes.get(sel);
    if (!s) { console.log(`  ${sel}  — NOT FOUND in ${CSS}`); continue; }
    for (const parent of PARENTS[sel].length ? PARENTS[sel] : [null]) {
      const g = ground(sel, parent);
      const via = parent ? `  (inside ${parent})` : "";
      console.log(`  ${sel}${via}  ${CSS}:${s.line}  ground ${g ? hex(g) : "UNKNOWN"}`);
      for (const tok of INK) {
        const hit = lookup(sel, tok);
        if (!hit) { console.log(`      ${tok}  undeclared anywhere`); continue; }
        const c = resolve(hit.value, sel, () => g);
        const r = c && g ? ratio(c, g) : null;
        const own = hit.from === sel ? "own" : `from ${hit.from}`;
        console.log(
          `      ${tok}  ${hit.value.padEnd(9)} ${own.padEnd(20)} ` +
            (r ? `${r.toFixed(2)}:1` : "unresolved"),
        );
      }
    }
  }
  console.log();
  process.exit(0);
}

/* ── checks ──────────────────────────────────────────────────────────────── */

const problems = [];
const at = (s, i) => s.slice(0, i).split("\n").length;

/* Check 0: every declared surface contract must be placed in PARENTS. */
for (const r of allRules) {
  const d = decls(r.body);
  const redefinesInk = INK.some((t) => d.has(t));
  if (!redefinesInk) continue;
  for (const sel of r.selector.split(",").map((s) => s.trim())) {
    if (sel in PARENTS) continue;
    problems.push(
      `${CSS}:${lineOf(r.at)}  "${sel}" redefines ink tokens but is not placed in ` +
        `PARENTS in this script — add it, so its ink can be judged against its ground`,
    );
  }
}

/* Check 1: a surface-contract class may not sit on a self-painting element. */
const contractClasses = [];
for (const [sel, s] of scopes) {
  const paints = s.decls.has("background") || s.decls.has("background-color");
  const ink = INK.some((t) => s.decls.has(t));
  if (!paints || !ink) continue;
  const cls = sel.trim().split(/\s+/).pop();
  if (cls?.startsWith(".")) contractClasses.push({ cls: cls.slice(1), sel, line: s.line });
}

/** The attribute text of the JSX opening tag containing index `i`. */
function openingTag(s, i) {
  let start = i;
  while (start > 0 && !(s[start] === "<" && /[A-Za-z]/.test(s[start + 1] ?? ""))) start--;
  if (s[start] !== "<") return null;
  let depth = 0;
  let quote = null;
  for (let k = start; k < s.length; k++) {
    const ch = s[k];
    if (quote) { if (ch === quote) quote = null; continue; }
    if (ch === '"' || ch === "'" || ch === "`") { quote = ch; continue; }
    if (ch === "{") depth++;
    else if (ch === "}") depth--;
    else if (ch === ">" && depth === 0) return { text: s.slice(start, k + 1), start };
  }
  return null;
}

for (const file of TSX) {
  const s = readFileSync(join(root, file), "utf8");
  for (const { cls, sel, line } of contractClasses) {
    const re = new RegExp(`className=(?:"|'|\\{\`)[^"'\`]*\\b${cls}\\b`, "g");
    for (const m of s.matchAll(re)) {
      const tag = openingTag(s, m.index);
      if (!tag) continue;
      const style = tag.text.match(/style=\{\{([\s\S]*?)\}\}/);
      const inlineBg = style ? /\bbackground(?:Color)?\s*:/.test(style[1]) : false;
      // A Tailwind utility paints just as hard as an inline style. Only the
      // unambiguous ones are read; a palette name this file cannot resolve is
      // left alone rather than guessed at.
      const utility = tag.text.match(/\bbg-(white|black|transparent|\[[^\]]+\])/);
      const utilityBg = utility
        ? (() => {
            const named = { white: "#ffffff", black: "#000000" }[utility[1]];
            if (named) return named;
            if (utility[1] === "transparent") return null;
            const inner = utility[1].slice(1, -1);
            return /^#[0-9a-fA-F]{3,8}$/.test(inner) ? inner : null;
          })()
        : null;
      if (!inlineBg && !utilityBg) continue;
      // A utility that paints the SAME ground the contract declares is the
      // contract being honoured, not broken.
      if (!inlineBg && utilityBg) {
        const declared = scopes.get(sel)?.decls.get("background");
        const a = parseColour(utilityBg);
        const b = declared ? resolve(declared, sel, null) : null;
        if (a && b && hex(a) === hex(b)) continue;
      }
      problems.push(
        `${file}:${at(s, m.index)}  element carries "${cls}" AND paints its own ` +
          `background. "${cls}" (${CSS}:${line}) declares a ground and the ink for ` +
          `that ground; an element that repaints the ground keeps the other ground's ` +
          `ink. Drop one of the two — this is the 08-Nov 1.02:1 bug`,
      );
    }
  }
}

/* Check 2: ink in effect must clear AA against the scope's own ground. */
for (const sel of Object.keys(PARENTS)) {
  const s = scopes.get(sel);
  if (!s) continue;
  for (const parent of PARENTS[sel].length ? PARENTS[sel] : [null]) {
    const g = ground(sel, parent);
    if (!g) continue;
    for (const tok of INK) {
      const hit = lookup(sel, tok);
      if (!hit) continue;
      const c = resolve(hit.value, sel, () => g);
      if (!c) continue;
      const r = ratio(c, g);
      if (r >= AA_NORMAL) continue;
      if (isAccepted(sel, tok)) continue;
      const where = hit.from === sel ? `declared here` : `inherited from "${hit.from}"`;
      const via = parent ? ` when used inside "${parent}"` : "";
      problems.push(
        `${CSS}:${s.line}  in "${sel}"${via}, ${tok} is ${hex(c)} on ${hex(g)} = ` +
          `${r.toFixed(2)}:1, under ${AA_NORMAL}:1 (${where})`,
      );
    }
  }
}

/* Check 3: no ink literal in a component that renders on several grounds. */
const inkLiterals = new Map(); // hex -> which tokens/scopes declare it
for (const [sel, s] of scopes) {
  for (const tok of INK) {
    const v = s.decls.get(tok);
    if (!v) continue;
    const c = parseColour(v);
    if (!c) continue;
    const key = hex(c);
    if (!inkLiterals.has(key)) inkLiterals.set(key, []);
    inkLiterals.get(key).push(`${tok} in "${sel}"`);
  }
}

const PAGES = ["app/page.tsx", "app/decode/page.tsx", "app/decode-long/page.tsx", "app/payment/page.tsx"];
const pageSrc = PAGES.map((p) => {
  try { return readFileSync(join(root, p), "utf8"); } catch { return ""; }
});

/**
 * Pure white and pure black are NOT surface-dependent ink. They are the
 * universal on-accent colour — white type on a red button is white on every
 * page — and they only land in the ink set because .section-deep happens to
 * use #ffffff for --t1. Judging them flagged two correct lines on the first
 * run of this check.
 */
const UNIVERSAL = new Set(["#ffffff", "#000000"]);

for (const file of TSX) {
  // A page IS a ground; only shared components render on several. (Deriving
  // the name from the filename counted every page.tsx as rendering on four
  // grounds, because every page file contains the word "page".)
  if (file.endsWith("/page.tsx")) continue;
  const name = file.split("/").pop().replace(/\.tsx$/, "");
  const grounds = pageSrc.filter((p) => p.includes(name)).length;
  if (grounds < 2) continue; // single ground: a literal there is a local decision
  const s = readFileSync(join(root, file), "utf8");
  for (const m of s.matchAll(/\bcolor:\s*(['"])(#[0-9a-fA-F]{3,8})\1/g)) {
    const c = parseColour(m[2]);
    if (!c) continue;
    if (UNIVERSAL.has(hex(c))) continue;
    const owners = inkLiterals.get(hex(c));
    if (!owners) continue;
    // An element that paints its own background in the same breath is
    // self-consistent: it is not relying on the ground at all.
    const tag = openingTag(s, m.index);
    if (tag && /\bbackground(?:Color)?\s*:/.test(tag.text)) continue;
    problems.push(
      `${file}:${at(s, m.index)}  ink literal ${m[2]} — that value is ${owners[0]}, ` +
        `and this component renders on ${grounds} different grounds. Use the token, ` +
        `so the ground decides the ink`,
    );
  }
}

/* ── report ──────────────────────────────────────────────────────────────── */

if (problems.length) {
  console.error(`\ncontrast: ${problems.length} problem(s)\n`);
  for (const p of problems) console.error("  " + p);
  console.error(
    "\nA surface contract owns both the ground and the ink on it. Change the token,\n" +
      "not the call site — and never put a contract class on an element that paints\n" +
      "its own background.\n",
  );
  process.exit(1);
}
console.log(
  `contrast: ${scopes.size} surface contracts, ${TSX.length} components, ` +
    `all ink at or above ${AA_NORMAL}:1`,
);
if (ACCEPTED.length) {
  const n = ACCEPTED.reduce((a, e) => a + e.tokens.length, 0);
  console.log(`contrast: ${n} known finding(s) carried, not fixed:`);
  for (const a of ACCEPTED) {
    console.log(`  ${a.scope}  ${a.tokens.join(", ")}`);
    console.log(`    ${a.why.replace(/\s+/g, " ")}`);
  }
}
