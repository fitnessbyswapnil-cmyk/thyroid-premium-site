/**
 * Where the admin key lives in the browser — one place, for every screen.
 *
 * It used to be sessionStorage, which the browser wipes whenever the tab
 * closes, so the owner retyped the key on every single visit, on every tab.
 * On 14-Sep-2026 he asked to remove the password altogether. That would have
 * put every client's name, phone number and thyroid details on the open web,
 * and let anyone send a WhatsApp broadcast from the business number or post a
 * fake sale to Meta. He chose this instead: enter the key once per device and
 * stay signed in until "Log out".
 *
 * localStorage persists across restarts. The server still checks the key on
 * every request, so a device that never entered it sees nothing. A key saved
 * by the old sessionStorage code is moved across on first read, so nobody is
 * asked again after this ships.
 */
export const ADMIN_KEY_STORE = "admin_dash_key";

/** Fired on save and clear, so every mounted tab re-reads without a reload. */
export const ADMIN_KEY_EVENT = "admin-key-changed";

function notify() {
  try {
    window.dispatchEvent(new Event(ADMIN_KEY_EVENT));
  } catch {
    /* no window: nothing to tell */
  }
}

export function readAdminKey(): string {
  try {
    const kept = localStorage.getItem(ADMIN_KEY_STORE);
    if (kept) return kept;
    const legacy = sessionStorage.getItem(ADMIN_KEY_STORE);
    if (legacy) {
      localStorage.setItem(ADMIN_KEY_STORE, legacy);
      sessionStorage.removeItem(ADMIN_KEY_STORE);
      return legacy;
    }
  } catch {
    /* storage blocked (private mode, strict browser): ask again, never crash */
  }
  return "";
}

export function saveAdminKey(key: string) {
  try {
    localStorage.setItem(ADMIN_KEY_STORE, key);
    sessionStorage.removeItem(ADMIN_KEY_STORE);
  } catch {
    /* storage blocked: the key still works for this page view */
  }
  notify();
}

/** Log out, or a key the server has rejected. Clears both stores. */
export function clearAdminKey() {
  try {
    localStorage.removeItem(ADMIN_KEY_STORE);
    sessionStorage.removeItem(ADMIN_KEY_STORE);
  } catch {
    /* nothing stored */
  }
  notify();
}
