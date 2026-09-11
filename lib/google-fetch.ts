/**
 * Makes googleapis talk to Google through the runtime's own `fetch`.
 *
 * gaxios (the HTTP layer under googleapis) only uses the built-in fetch when a
 * browser `window` exists; everywhere else it falls back to the `node-fetch`
 * package. On Cloudflare Workers that fallback returns Google's responses still
 * gzip-compressed, so every token and Sheets call failed with an unreadable
 * body. Handing gaxios the native fetch fixes it there, and on Node (Vercel,
 * local dev) native fetch is equally correct.
 *
 * The token request and every API call share the auth client's transporter,
 * so setting it once on the auth client covers both. Use:
 *   new google.auth.GoogleAuth({ clientOptions: googleClientOptions, ... })
 *   new google.auth.JWT({ transporterOptions: googleTransporterOptions, ... })
 */

// Wrapped, not passed bare: some runtimes reject `fetch` called unbound.
export const googleTransporterOptions = {
  fetchImplementation: ((input: RequestInfo | URL, init?: RequestInit) =>
    fetch(input, init)) as typeof fetch,
};

export const googleClientOptions = { transporterOptions: googleTransporterOptions };
