import { test } from "node:test";
import assert from "node:assert/strict";
import vm from "node:vm";
import {
  META_PIXEL_ID,
  isFlagOn,
  isPurchaseEventId,
  claimOnce,
  consumeHeadPageViewId,
  directPixelSnippet,
} from "../app/components/tracking/pixel-core.ts";

// ── Fakes ────────────────────────────────────────────────────────────────────
// Objects created inside the VM belong to another realm, so every comparison
// below goes through JSON first (deepEqual would otherwise fail on prototypes).
const plain = (v: unknown) => JSON.parse(JSON.stringify(v));

type Env = {
  window: Record<string, unknown>;
  document: Record<string, unknown>;
  inserted: Array<{ async: boolean; src: string }>;
  appended: Array<{ async: boolean; src: string }>;
};

function fakeEnv(opts: {
  identity?: unknown;
  externalId?: string;
  cookie?: string;
  storageThrows?: boolean;
  noScriptTags?: boolean;
} = {}): Env {
  const store = new Map<string, string>();
  if (opts.identity !== undefined) {
    store.set(
      "meta_user_identity",
      typeof opts.identity === "string" ? opts.identity : JSON.stringify(opts.identity),
    );
  }
  if (opts.externalId) store.set("meta_external_id", opts.externalId);

  const inserted: Env["inserted"] = [];
  const appended: Env["appended"] = [];
  const firstScript = {
    parentNode: { insertBefore: (el: { async: boolean; src: string }) => inserted.push(el) },
  };
  const document = {
    cookie: opts.cookie ?? "",
    createElement: () => ({ async: false, src: "" }),
    getElementsByTagName: () => (opts.noScriptTags ? [] : [firstScript]),
    head: { appendChild: (el: { async: boolean; src: string }) => appended.push(el) },
  };
  const window: Record<string, unknown> = {};
  if (opts.storageThrows) {
    Object.defineProperty(window, "localStorage", {
      get() {
        throw new Error("site data blocked");
      },
    });
  } else {
    window.localStorage = { getItem: (k: string) => store.get(k) ?? null };
  }
  return { window, document, inserted, appended };
}

// Runs the EXACT string the layout inlines, in a context holding nothing but
// window + document. Any reference to module scope would throw here and the
// bootstrap would swallow it, so the assertions below would fail.
function runSnippet(env: Env) {
  vm.runInNewContext(directPixelSnippet(META_PIXEL_ID), {
    window: env.window,
    document: env.document,
  });
  const fbq = env.window.fbq as { queue: ArrayLike<unknown>[]; disablePushState?: boolean };
  return { fbq, calls: plain(fbq.queue.map((args) => Array.from(args))) as unknown[][] };
}

const PAGE_VIEW_ID = /^page_view_\d{10}_[a-z0-9]*$/;

// ── Direct pixel bootstrap ───────────────────────────────────────────────────

test("direct pixel: one async fbevents.js, init, then PageView carrying an event id", () => {
  const env = fakeEnv();
  const { fbq, calls } = runSnippet(env);

  assert.equal(env.inserted.length, 1);
  assert.equal(env.inserted[0].src, "https://connect.facebook.net/en_US/fbevents.js");
  assert.equal(env.inserted[0].async, true);

  assert.equal(calls.length, 2);
  assert.deepEqual(calls[0], ["init", META_PIXEL_ID]);
  const [cmd, name, params, opts] = calls[1] as [string, string, unknown, { eventID: string }];
  assert.equal(cmd, "track");
  assert.equal(name, "PageView");
  assert.deepEqual(params, {});
  assert.match(opts.eventID, PAGE_VIEW_ID);

  // fbevents must not add its own id-less PageViews on route changes.
  assert.equal(fbq.disablePushState, true);
});

test("direct pixel: the PageView id is shared with trackPageView and with GTM", () => {
  const env = fakeEnv();
  const { calls } = runSnippet(env);
  const eventId = (calls[1][3] as { eventID: string }).eventID;

  assert.equal(env.window.__metaPageViewId, eventId);
  assert.deepEqual(plain(env.window.dataLayer), [{ meta_pageview_event_id: eventId }]);
});

test("direct pixel: registers itself so GTM's pixel template does not init it again", () => {
  const env = fakeEnv();
  runSnippet(env);
  assert.deepEqual(plain(env.window._fbq_gtm_ids), [META_PIXEL_ID]);
});

test("direct pixel: advanced matching normalised exactly like analytics.ts", () => {
  const env = fakeEnv({
    identity: {
      email: "  Priya.S@Example.COM ",
      phone: "098765 43210",
      first_name: " Priya ",
      last_name: "Sharma",
    },
    cookie: "a=1; _visitor_id=v_abc%2D1; b=2",
  });
  const { calls } = runSnippet(env);
  assert.deepEqual(calls[0], [
    "init",
    META_PIXEL_ID,
    {
      em: "priya.s@example.com",
      ph: "919876543210",
      fn: "priya",
      ln: "sharma",
      external_id: "v_abc-1",
    },
  ]);
});

test("direct pixel: blank or non-string fields are omitted, never sent empty", () => {
  const env = fakeEnv({
    identity: { email: "   ", phone: "n/a", first_name: "", last_name: 42 },
    externalId: "u_1757_abcd1234",
  });
  const { calls } = runSnippet(env);
  // No _visitor_id cookie: falls back to the localStorage id analytics.ts mints.
  assert.deepEqual(calls[0], ["init", META_PIXEL_ID, { external_id: "u_1757_abcd1234" }]);
});

test("direct pixel: corrupt stored identity still sends the PageView", () => {
  const env = fakeEnv({ identity: "{not json" });
  const { calls } = runSnippet(env);
  assert.deepEqual(calls[0], ["init", META_PIXEL_ID]);
  assert.equal(calls[1][1], "PageView");
});

test("direct pixel: blocked site data never stops the PageView", () => {
  const env = fakeEnv({ storageThrows: true, cookie: "_visitor_id=v_9" });
  const { calls } = runSnippet(env);
  assert.deepEqual(calls[0], ["init", META_PIXEL_ID, { external_id: "v_9" }]);
  assert.equal(calls[1][1], "PageView");
});

test("direct pixel: an fbq already on the page is reused, fbevents not loaded twice", () => {
  const env = fakeEnv();
  const queue: unknown[] = [];
  const existing = Object.assign((...args: unknown[]) => queue.push(args), { queue });
  env.window.fbq = existing;
  vm.runInNewContext(directPixelSnippet(META_PIXEL_ID), {
    window: env.window,
    document: env.document,
  });
  assert.equal(env.inserted.length, 0);
  assert.equal(env.window.fbq, existing);
  assert.deepEqual(plain(queue.map((a) => (a as unknown[])[0])), ["init", "track"]);
});

test("direct pixel: with no script tag to anchor on, fbevents goes into <head>", () => {
  const env = fakeEnv({ noScriptTags: true });
  runSnippet(env);
  assert.equal(env.inserted.length, 0);
  assert.equal(env.appended.length, 1);
});

test("direct pixel: the inlined snippet names only window and document", () => {
  const src = directPixelSnippet(META_PIXEL_ID);
  assert.ok(src.endsWith(`(window,document,"${META_PIXEL_ID}");`));
  assert.doesNotMatch(src, /\brequire\(|\bimport\b|__webpack|_interop/);
});

// ── consumeHeadPageViewId ────────────────────────────────────────────────────

test("consumeHeadPageViewId hands the head id over exactly once", () => {
  const w: { __metaPageViewId?: string } = { __metaPageViewId: "page_view_1757000000_ab12" };
  assert.equal(consumeHeadPageViewId(w), "page_view_1757000000_ab12");
  assert.equal(consumeHeadPageViewId(w), "");
  assert.equal(consumeHeadPageViewId({}), "");
});

// ── isFlagOn ─────────────────────────────────────────────────────────────────

test("isFlagOn: only an explicit yes switches a flag on", () => {
  for (const v of ["1", "true", "TRUE", " on ", "yes"]) assert.equal(isFlagOn(v), true, v);
  for (const v of [undefined, "", "0", "false", "off", "no", "ture", "enabled"]) {
    assert.equal(isFlagOn(v), false, String(v));
  }
});

// ── isPurchaseEventId ────────────────────────────────────────────────────────

test("isPurchaseEventId accepts only the Purchase_<orderId> contract", () => {
  assert.equal(isPurchaseEventId("Purchase_thyroid_dq_abc_1757000000000"), true);
  assert.equal(isPurchaseEventId("Purchase_"), false);
  assert.equal(isPurchaseEventId("purchase_1757000000_ab12"), false); // the old random fallback
  assert.equal(isPurchaseEventId(""), false);
  assert.equal(isPurchaseEventId(undefined), false);
});

// ── claimOnce ────────────────────────────────────────────────────────────────

function memStore() {
  const m = new Map<string, string>();
  return { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => void m.set(k, v) };
}
const throwingStore = {
  getItem: (): string | null => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
};

test("claimOnce: true the first time, false every time after", () => {
  const local = memStore();
  const session = memStore();
  assert.equal(claimOnce("k", [local, session]), true);
  assert.equal(claimOnce("k", [local, session]), false);
  assert.equal(claimOnce("other", [local, session]), true);
});

test("claimOnce: a new tab (fresh sessionStorage) is still blocked by localStorage", () => {
  const local = memStore();
  assert.equal(claimOnce("k", [local, memStore()]), true);
  assert.equal(claimOnce("k", [local, memStore()]), false);
});

test("claimOnce: a throwing store is skipped and the other still guards", () => {
  const session = memStore();
  assert.equal(claimOnce("k", [throwingStore, session]), true);
  assert.equal(claimOnce("k", [throwingStore, session]), false);
});

test("claimOnce: with no usable store it lets the event through", () => {
  assert.equal(claimOnce("k", [undefined, throwingStore]), true);
});
