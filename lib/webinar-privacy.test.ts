import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

// The webinar form takes her WhatsApp number, so the privacy policy is one tap
// away from it. It opens in a dialog over the form, never as a navigation:
// in Instagram's and Facebook's in-app browsers a new tab replaces the page and
// the number she typed is lost. Mirrors lib/decode-privacy.test.ts.

const root = join(import.meta.dirname, "..");
const FORM = readFileSync(join(root, "app/webinar/RegisterForm.tsx"), "utf8");
const CSS = readFileSync(join(root, "app/webinar/webinar.module.css"), "utf8");
// Elements, not mentions: the comments in the file talk about <form> and <dialog> too.
const formStart = FORM.search(/<form\s+className=/);
const formEnd = FORM.indexOf("</form>");

test("the privacy link sits inside the form, under the number field", () => {
  assert.ok(formStart > -1 && formEnd > formStart);
  const form = FORM.slice(formStart, formEnd);
  assert.match(form, /type="tel"[\s\S]*href="\/privacy"/);
});

test("it opens in a dialog that is not nested in the form", () => {
  const dialogAt = FORM.search(/<dialog\s+ref=\{privacyRef\}/);
  assert.ok(dialogAt > -1, "the privacy dialog is missing");
  assert.ok(dialogAt > formEnd, "a <dialog> inside the <form> would let its buttons submit the form");
  assert.match(FORM, /\.showModal\(\)/);
  assert.match(FORM, /e\.preventDefault\(\)/);
});

test("the policy loads only when she opens it", () => {
  assert.match(FORM, /\{privacyOpen && <iframe src="\/privacy"/);
  assert.equal((FORM.match(/<iframe\b/g) ?? []).length, 1);
});

test("the link can be seen and the dialog is centred", () => {
  const rule = (name: string) => CSS.match(new RegExp(`\\.${name}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
  assert.match(rule("privacyLink"), /text-decoration:\s*underline/);
  assert.match(rule("privacyDialog"), /margin:\s*auto/);
});
