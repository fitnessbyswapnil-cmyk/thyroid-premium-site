"use client";

/**
 * Cloudflare Turnstile for the two public forms that cost money when a bot
 * fills them: the /decode quiz gate (paid WhatsApp + Meta Lead/QuizComplete)
 * and the /webinar registration (paid WhatsApp).
 *
 * Off by default. With NEXT_PUBLIC_TURNSTILE_SITE_KEY unset at build time,
 * nothing here loads, renders or changes a single request body.
 *
 * With it set:
 *  - The script loads from Cloudflare at runtime (no npm package, nothing added
 *    to the worker bundle) and the widget renders in Managed mode with
 *    appearance "interaction-only": invisible for almost everyone, a checkbox
 *    only for a visitor Cloudflare is unsure about.
 *  - The token is requested before submit and travels as `turnstileToken`.
 *  - If no token arrives within TOKEN_WAIT_MS (in-app browser, blocked script,
 *    bad network) the form submits WITHOUT one. The server then saves the lead
 *    as "unverified" rather than losing her. The wait stretches only while the
 *    checkbox is actually on screen asking her to tap it.
 *  - Tokens are single-use, so each one is consumed on submit and the widget
 *    is reset for the next attempt.
 */

import { useCallback, useMemo, useRef, useState } from "react";

// Inlined by `next build`. Empty means Turnstile is off.
export const TURNSTILE_SITE_KEY = (process.env.NEXT_PUBLIC_TURNSTILE_SITE_KEY ?? "").trim();

const SCRIPT_SRC =
  "https://challenges.cloudflare.com/turnstile/v0/api.js?render=explicit&onload=__thyroidTurnstileOnload";

/** How long a submit waits for a token before going ahead without one. */
export const TOKEN_WAIT_MS = 6000;
/** Upper bound when the checkbox is visibly waiting for her tap. */
const INTERACTIVE_WAIT_MS = 30000;

type TurnstileApi = {
  render: (el: HTMLElement, opts: Record<string, unknown>) => string | null | undefined;
  reset: (widgetId?: string) => void;
  remove: (widgetId?: string) => void;
};
type TurnstileWindow = Window & {
  turnstile?: TurnstileApi;
  __thyroidTurnstileOnload?: () => void;
};

let loading: Promise<TurnstileApi | null> | null = null;

/**
 * Load api.js once per page. Resolves null (never rejects) when the script
 * cannot load, and forgets the failure so a later call can try again.
 */
export function loadTurnstile(): Promise<TurnstileApi | null> {
  if (!TURNSTILE_SITE_KEY || typeof window === "undefined") return Promise.resolve(null);
  const w = window as TurnstileWindow;
  if (w.turnstile) return Promise.resolve(w.turnstile);
  if (!loading) {
    loading = new Promise((resolve) => {
      w.__thyroidTurnstileOnload = () => resolve(w.turnstile ?? null);
      const s = document.createElement("script");
      s.src = SCRIPT_SRC;
      s.async = true;
      s.onerror = () => {
        loading = null;
        s.remove();
        resolve(null);
      };
      document.head.appendChild(s);
    });
  }
  return loading;
}

export type BotCheck = {
  /** False when no site key was built in: every other member is then inert. */
  enabled: boolean;
  /** Callback ref for the element the widget renders into. Not named `ref`:
   *  the React Compiler lint treats any `ref` property as a ref object. */
  attach: (el: HTMLDivElement | null) => void;
  /** True while Cloudflare is showing her a checkbox. */
  interactive: boolean;
  /** A fresh single-use token, or null if none arrived in time. */
  getToken: () => Promise<string | null>;
  /** Discard the current token and start a new challenge. */
  reset: () => void;
};

/** Returns true when it took the delivery. */
type Waiter = (token: string | null) => boolean;

/** `action` shows in the Turnstile analytics: letters, digits, _ and -, 32 max. */
export function useTurnstile(action: string): BotCheck {
  const enabled = !!TURNSTILE_SITE_KEY;
  const [interactive, setInteractive] = useState(false);
  const st = useRef({
    el: null as HTMLElement | null,
    widgetId: "",
    token: "",
    failed: false,
    interactive: false,
    waiters: [] as Waiter[],
  });

  /** A token goes to the first waiter still listening; a failure goes to all. */
  const deliver = useCallback((token: string | null) => {
    const s = st.current;
    const waiters = s.waiters.splice(0);
    for (const w of waiters) {
      if (w(token) && token) {
        s.token = "";
        // Anyone left keeps waiting for the next token.
        s.waiters.push(...waiters.slice(waiters.indexOf(w) + 1));
        return;
      }
    }
  }, []);

  const attach = useCallback(
    (el: HTMLDivElement | null) => {
      if (!enabled) return;
      const s = st.current;
      if (!el) {
        const api = (window as TurnstileWindow).turnstile;
        if (s.widgetId && api) {
          try { api.remove(s.widgetId); } catch { /* already gone */ }
        }
        s.el = null;
        s.widgetId = "";
        s.token = "";
        return;
      }
      s.el = el;
      void loadTurnstile().then((api) => {
        if (!api) {
          s.failed = true;
          deliver(null);
          return;
        }
        if (s.el !== el || s.widgetId) return;
        try {
          s.widgetId =
            api.render(el, {
              sitekey: TURNSTILE_SITE_KEY,
              action,
              appearance: "interaction-only",
              // We send the token ourselves; no hidden input in the form.
              "response-field": false,
              callback: (token: string) => {
                s.failed = false;
                s.token = token;
                deliver(token);
              },
              // refresh-expired defaults to "auto": a new token follows on its own.
              "expired-callback": () => { s.token = ""; },
              "timeout-callback": () => { s.token = ""; },
              "error-callback": () => {
                s.token = "";
                s.failed = true;
                deliver(null);
              },
              "unsupported-callback": () => {
                s.failed = true;
                deliver(null);
              },
              "before-interactive-callback": () => {
                s.interactive = true;
                setInteractive(true);
              },
              "after-interactive-callback": () => {
                s.interactive = false;
                setInteractive(false);
              },
            }) || "";
        } catch {
          s.failed = true;
          deliver(null);
        }
      });
    },
    [enabled, action, deliver],
  );

  const getToken = useCallback((): Promise<string | null> => {
    const s = st.current;
    if (!enabled) return Promise.resolve(null);
    if (s.token) {
      const t = s.token;
      s.token = "";
      return Promise.resolve(t);
    }
    // The widget already said it cannot work here. Do not make her wait.
    if (s.failed) return Promise.resolve(null);
    return new Promise((resolve) => {
      const started = Date.now();
      let settled = false;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const waiter: Waiter = (token) => {
        if (settled) return false;
        settled = true;
        if (timer) clearTimeout(timer);
        resolve(token);
        return true;
      };
      const giveUp = () => {
        if (settled) return;
        // The checkbox is on screen and she may be about to tap it.
        if (s.interactive && Date.now() - started < INTERACTIVE_WAIT_MS) {
          timer = setTimeout(giveUp, 1000);
          return;
        }
        settled = true;
        s.waiters = s.waiters.filter((w) => w !== waiter);
        resolve(null);
      };
      s.waiters.push(waiter);
      timer = setTimeout(giveUp, TOKEN_WAIT_MS);
    });
  }, [enabled]);

  const reset = useCallback(() => {
    const s = st.current;
    s.token = "";
    const api = typeof window === "undefined" ? undefined : (window as TurnstileWindow).turnstile;
    if (s.widgetId && api) {
      try { api.reset(s.widgetId); } catch { /* widget removed */ }
    }
  }, []);

  return useMemo(
    () => ({ enabled, attach, interactive, getToken, reset }),
    [enabled, attach, interactive, getToken, reset],
  );
}

/**
 * Where the widget lives. Renders nothing at all when Turnstile is off, and an
 * empty zero-height box while it is invisible.
 */
export function TurnstileBox({ bot, hint, hintColor }: { bot: BotCheck; hint: string; hintColor?: string }) {
  if (!bot.enabled) return null;
  return <TurnstileSlot attach={bot.attach} interactive={bot.interactive} hint={hint} hintColor={hintColor} />;
}

// Split out so the callback ref and the render-time flag arrive as separate
// props: the React Compiler lint treats an object whose member is used as a
// ref as a ref itself, and would flag reading `bot.interactive` in render.
function TurnstileSlot({ attach, interactive, hint, hintColor }: {
  attach: (el: HTMLDivElement | null) => void;
  interactive: boolean;
  hint: string;
  hintColor?: string;
}) {
  return (
    <div style={{ marginTop: interactive ? 14 : 0 }}>
      <div ref={attach} style={{ display: "flex", justifyContent: "center" }} />
      {interactive && (
        <p style={{ fontSize: 13, lineHeight: 1.45, textAlign: "center", margin: "6px 0 0", color: hintColor ?? "inherit" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

/**
 * POST JSON with the bot check attached. With Turnstile off this is exactly
 * the plain fetch it replaces: same body, same headers, one request.
 *
 * A 403 is retried ONCE with a fresh token. The likely cause for a real person
 * is a token that expired or was already spent between the challenge and her
 * tap; a bot's second token is refused just like its first.
 */
export async function postWithBotCheck(bot: BotCheck, url: string, body: Record<string, unknown>): Promise<Response> {
  const send = async (): Promise<Response> => {
    const token = bot.enabled ? await bot.getToken() : null;
    try {
      return await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(token ? { ...body, turnstileToken: token } : body),
      });
    } finally {
      if (token) bot.reset();
    }
  };
  const res = await send();
  if (res.status === 403 && bot.enabled) return send();
  return res;
}

/**
 * Did the server count this as a real lead? False when it refused the token
 * (403) or saved the lead as unverified. Anything unreadable counts, as it
 * always has.
 */
export async function leadCounted(res: Response): Promise<boolean> {
  if (res.status === 403) return false;
  try {
    const j = (await res.clone().json()) as { botCheck?: string } | null;
    return j?.botCheck !== "unverified";
  } catch {
    return true;
  }
}
