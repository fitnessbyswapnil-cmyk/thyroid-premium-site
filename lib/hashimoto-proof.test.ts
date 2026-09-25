/**
 * The Hashimoto's section may only repeat claims this site already makes.
 *
 * It exists because prospects ask for Hashimoto's proof by name, which makes
 * it the most tempting place on the site to stretch. On 25-Sep the request was
 * to relabel two named video clients as Hashimoto's cases and publish a "40%
 * antibody drop" for them. One of those women is on record here as a partial
 * thyroidectomy, the other as a general coaching client, and neither has a
 * published antibody number.
 *
 * So the rules are enforced rather than remembered: every woman named in this
 * section must already appear in SocialProof as a Hashimoto's client, and no
 * antibody result may be asserted anywhere in it.
 */
import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

const read = (p: string) => readFileSync(new URL(`../${p}`, import.meta.url), "utf8");
const PROOF = read("app/components/HashimotoProof.tsx");
const SOCIAL = read("app/components/SocialProof.tsx");
const VIDEO = read("app/components/VideoTestimonial.tsx");
const PAGE = read("app/decode/page.tsx");

const namesIn = (src: string) => [...src.matchAll(/name: "([^"]+)"/g)].map((m) => m[1]);

test("every woman named here is already published as a Hashimoto's client", () => {
  const names = namesIn(PROOF);
  assert.ok(names.length >= 2, "the section needs at least two named stories");
  const entries = SOCIAL.split(/\{\s*\n\s*name:/).slice(1);
  for (const n of names) {
    const entry = entries.find((e) => e.startsWith(` "${n}"`));
    assert.ok(entry, `${n} is not in SocialProof — this section may not introduce a new client`);
    assert.match(
      entry,
      /condition:\s*"Hashimoto/,
      `${n} is published as something other than Hashimoto's — her condition may not be changed to fit this section`,
    );
  }
});

test("the video clients are not quietly relabelled as Hashimoto's", () => {
  // Kshama Handa is on record as a partial thyroidectomy and Fathima P. as a
  // general thyroid coaching client. Neither is a Hashimoto's case, and a
  // thyroidectomy has no meaningful antibody story at all.
  assert.match(VIDEO, /Partial Thyroidectomy/i, "Kshama's actual condition is still recorded");
  for (const name of namesIn(VIDEO)) {
    assert.ok(
      !PROOF.includes(name),
      `${name} is a video-testimonial client and is not published as Hashimoto's — do not move her here`,
    );
  }
});

test("no antibody result is asserted, in any form", () => {
  // TPO antibodies swing on their own, rarely fall quickly, and track symptoms
  // poorly. A promised drop is unsupportable, and this audience researches.
  //
  // Comments are stripped first: the file's own header explains why the 25-Sep
  // "40% drop" request was refused, and that explanation must not read as the
  // claim it exists to forbid.
  const shipped = PROOF.replace(/\/\*[\s\S]*?\*\//g, " ").replace(/^\s*\/\/.*$/gm, " ");
  assert.doesNotMatch(
    shipped,
    /\b\d+\s*%\s*(drop|fall|reduction|lower)|\b(anti-?\s?TPO|TPO)\b[^.\n]{0,40}\b\d{2,}\b/i,
    "an antibody number or percentage drop appeared — it must never be asserted here",
  );
  assert.match(shipped, /rise and fall on their own/i, "the honest line about antibodies stays");
});

test("marker rows stay empty until real, dated, permissioned numbers exist", () => {
  assert.match(PROOF, /\/\*\* Real, dated, permissioned lab movements only\. Empty until then\. \*\//);
  assert.doesNotMatch(PROOF, /markers:\s*\[/, "a marker row was populated — the numbers must come from the owner");
});

test("the section carries the same qualifier the rest of the page carries", () => {
  assert.match(PROOF, /Individual results vary/i);
  assert.match(PROOF, /replaces your doctor/i);
});

test("the page renders it inside the proof block", () => {
  const at = PAGE.indexOf("<HashimotoProof />");
  assert.ok(at > -1, "the section is on the page");
  assert.ok(at > PAGE.indexOf("<VideoTestimonial compact />"), "it follows the video proof");
  assert.ok(at < PAGE.indexOf("<WhatsappProofSection"), "and comes before the screenshots");
});
