/**
 * lib/whatsapp.ts
 *
 * Thin wrapper over the WhatsApp Cloud API for sending pre-approved
 * template messages.
 *
 * DORMANT UNTIL CONFIGURED. Every entry point returns a skipped result when
 * WHATSAPP_TOKEN / WHATSAPP_PHONE_NUMBER_ID are absent, so this ships safely
 * before billing is sorted and starts working the moment the env vars land —
 * no code change, no redeploy of anything but the vars themselves.
 *
 * ENV VARS (Vercel):
 *   WHATSAPP_TOKEN            — permanent System User token, scopes
 *                               whatsapp_business_messaging + _management.
 *                               WHATSAPP_ACCESS_TOKEN is accepted as an alias
 *                               so either naming works; whichever is set wins.
 *   WHATSAPP_PHONE_NUMBER_ID  — 1187443147793855 (+91 79784 60386)
 *   WHATSAPP_TEMPLATE_LANG    — optional, defaults to "en". Meta stores some
 *                               templates as "en_US"; if sends fail with
 *                               (#132001) template does not exist, set this
 *                               rather than editing code.
 *
 * NEVER THROWS. Messaging is an enhancement to the funnel, never a
 * precondition for it — a WhatsApp outage must not fail a quiz submission or
 * lose a lead. Callers get a result object and can ignore it.
 */

import { appendMessage } from './wa-messages.ts'

const GRAPH_VERSION = 'v21.0'

/**
 * Mirror an outbound template into the Messages tab.
 *
 * Without this the admin inbox only ever recorded free-form replies, so a
 * thread showed her answer with nothing above it — you could see "yes please
 * book me" and have no idea which message prompted it. Templates are what the
 * funnel actually sends, so they are most of the conversation.
 *
 * Fully swallowed and never awaited by the caller's critical path: logging a
 * message we already delivered must never turn a successful send into a
 * failure, and a Sheets outage must not slow the funnel.
 */
async function logTemplateToInbox(
  recipient: string,
  templateName: string,
  bodyParams: string[],
  messageId: string | undefined,
): Promise<void> {
  try {
    const label = bodyParams.length ? `[${templateName}] ${bodyParams.join(' · ')}` : `[${templateName}]`
    await appendMessage({
      ts: new Date().toISOString(),
      phone: recipient,
      direction: 'out',
      text: label,
      messageId: messageId ?? '',
      name: '',
      read: true,
    })
  } catch (err) {
    console.error('[whatsapp] template sent but inbox logging failed (ignored):', err instanceof Error ? err.message : String(err))
  }
}

/** The brief specifies WHATSAPP_ACCESS_TOKEN; the first deploy shipped
 *  WHATSAPP_TOKEN. Accept either so neither naming silently no-ops. */
function readToken(): string | undefined {
  return process.env.WHATSAPP_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN
}

export type WhatsAppResult = {
  sent: boolean
  skipped?: string // why nothing was attempted (config absent, no phone, …)
  messageId?: string
  error?: string
}

/** Meta reports 132001 for BOTH "no such template" and "exists, but not in the
 *  language you sent" — it does not distinguish them. */
export function isTemplateMissing(error: string | undefined): boolean {
  return /does not exist|132001/i.test(error ?? '')
}

/**
 * Template failures that are CONFIGURATION problems, not transient ones: the
 * template is absent (132001) or the caller sent the wrong number of body
 * parameters (132000). Both keep failing identically until a human changes
 * something, so the right response is to fall back to a template that works
 * — never to retry the same call.
 *
 * Kept separate from isTemplateMissing because the language-retry loop must
 * NOT re-attempt on a parameter mismatch: the count is wrong in every
 * language, so retrying just burns three API calls to fail three times.
 */
export function isTemplateConfigError(error: string | undefined): boolean {
  return isTemplateMissing(error) || /132000|number of parameters/i.test(error ?? '')
}

/**
 * Run a send, retrying under Meta's other English variants if it comes back
 * "template missing".
 *
 * WhatsApp Manager shows a language LABEL, not its code, so a template created
 * as "English" may be stored as en, en_US or en_GB. Since 132001 cannot tell
 * "wrong language" apart from "no such template", trying each variant is the
 * only way to distinguish them from here — and it costs nothing when the first
 * attempt succeeds, which is the normal case.
 */
export async function sendTryingLanguages(
  send: (language?: string) => Promise<WhatsAppResult>,
): Promise<WhatsAppResult> {
  // undefined = whatever WHATSAPP_TEMPLATE_LANG resolves to, tried first so a
  // correctly-configured account costs exactly one call.
  //
  // 'en' is listed EXPLICITLY rather than assumed: if WHATSAPP_TEMPLATE_LANG
  // is set to a variant (the module docstring above suggests setting it to
  // en_US as a fix for 132001), then plain 'en' would otherwise never be
  // tried — and every template on this WABA is stored as plain "English".
  // That would silently fall through to the older template on every send.
  const attempts: (string | undefined)[] = [undefined, 'en', 'en_US', 'en_GB']
  const tried = new Set<string>()

  let r: WhatsAppResult | null = null
  for (const language of attempts) {
    const key = language ?? (process.env.WHATSAPP_TEMPLATE_LANG || 'en')
    if (tried.has(key)) continue
    tried.add(key)

    r = await send(language)
    if (r.sent || !isTemplateMissing(r.error)) return r
  }
  return r ?? { sent: false, error: 'no_language_attempted' }
}

/**
 * Cloud API wants a bare E.164 number: country code + subscriber, no '+',
 * no spaces or dashes. Indian 10-digit input is the common case; anything
 * already carrying 91 is passed through so we never double-prefix.
 */
export function toWhatsAppNumber(raw: string): string {
  const d = (raw || '').replace(/\D/g, '')
  if (!d) return ''
  if (d.length === 10) return `91${d}`
  if (d.length === 12 && d.startsWith('91')) return d
  // 11 digits starting 0 is the common "0XXXXXXXXXX" local form.
  if (d.length === 11 && d.startsWith('0')) return `91${d.slice(1)}`
  return d // already international, or something we shouldn't mangle
}

export function isWhatsAppConfigured(): boolean {
  return !!(readToken() && process.env.WHATSAPP_PHONE_NUMBER_ID)
}

/**
 * Send one pre-approved template.
 *
 * @param to          recipient, any Indian format — normalized here
 * @param templateName exact template name as approved in WhatsApp Manager
 * @param bodyParams  ordered values for the template's {{1}}, {{2}}, … slots.
 *                    The count MUST match the template or Meta rejects the
 *                    whole send, so callers pass exactly what the template
 *                    declares — welcome_lead/payment_reminder each take one
 *                    (first name).
 */
export async function sendWhatsAppTemplate(
  to: string,
  templateName: string,
  bodyParams: string[] = [],
  /**
   * Language code to send with. Meta matches a template by name AND language,
   * and rejects a mismatch with (#132001) "Template name does not exist in the
   * translation" — the same error as a missing template, which makes the real
   * cause hard to spot. WhatsApp Manager shows a language LABEL, not its code,
   * so "English" may be stored as en, en_US or en_GB. This override exists to
   * find the right one against the live API without a redeploy per guess.
   */
  languageOverride?: string,
  /**
   * Value for a dynamic URL button's {{1}} suffix (button index 0), for
   * templates approved with a "Visit Website" button whose URL ends in a
   * variable. Omit entirely for templates with a static button URL or no
   * button — passing this for a template that doesn't declare a dynamic
   * button parameter makes Meta reject the whole send.
   */
  buttonUrlParam?: string,
): Promise<WhatsAppResult> {
  const token = readToken()
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) {
    return { sent: false, skipped: 'whatsapp_not_configured' }
  }

  const recipient = toWhatsAppNumber(to)
  // 12 digits == 91 + 10. Anything shorter is a truncated/garbage number and
  // would just burn a paid conversation attempt.
  if (recipient.length < 12) {
    return { sent: false, skipped: 'invalid_phone' }
  }

  const language = languageOverride || process.env.WHATSAPP_TEMPLATE_LANG || 'en'

  const components = [
    ...(bodyParams.length
      ? [
          {
            type: 'body',
            parameters: bodyParams.map((text) => ({ type: 'text', text })),
          },
        ]
      : []),
    ...(buttonUrlParam
      ? [
          {
            type: 'button',
            sub_type: 'url',
            index: '0',
            parameters: [{ type: 'text', text: buttonUrlParam }],
          },
        ]
      : []),
  ]

  const body = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      ...(components.length ? { components } : {}),
    },
  }

  try {
    // Timeout guard: this runs inline on a visitor-facing request path, so a
    // hanging Meta call must never hold the response open.
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    let res: Response
    try {
      res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }

    const json = (await res.json()) as {
      messages?: { id?: string }[]
      error?: { message?: string; code?: number }
    }

    if (!res.ok || json.error) {
      const err = `${json.error?.code ?? res.status}: ${json.error?.message ?? 'unknown'}`
      console.error(`[whatsapp] send failed template=${templateName} to=***${recipient.slice(-4)} ${err}`)
      return { sent: false, error: err }
    }

    const messageId = json.messages?.[0]?.id
    console.log(`[whatsapp] sent template=${templateName} to=***${recipient.slice(-4)} id=${messageId ?? '(none)'}`)
    await logTemplateToInbox(recipient, templateName, bodyParams, messageId)
    return { sent: true, messageId }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error(`[whatsapp] send threw template=${templateName}`, message)
    return { sent: false, error: message }
  }
}

/**
 * First touch, fired the moment the Thyroid Score quiz is completed.
 *
 * Speed is the entire point: leads were waiting 2-9 hours for a manual
 * WhatsApp, and reply rates collapse over that window. welcome_lead takes a
 * single {{1}} — the first name only, since "Hi Priya Sharma," reads like a
 * mail merge and defeats the purpose.
 */
export async function sendWelcomeLead(phone: string, fullName: string): Promise<WhatsAppResult> {
  const firstName = (fullName || '').trim().split(/\s+/)[0] || 'there'
  return sendWhatsAppTemplate(phone, 'welcome_lead', [firstName])
}

/**
 * welcome_lead whose button deep-links to /complete-payment?leadId=... instead
 * of /assessment.
 *
 * The live welcome_lead template's button is a STATIC link to
 * https://swapnilumbarkarfitness.in/assessment — the quiz. It fires the instant
 * she FINISHES the quiz, so its own call-to-action sends her back to the thing
 * she just completed, with her score and the pay button left behind. Confirmed
 * by reading the approved template in WhatsApp Manager on 2026-08-18.
 *
 * Approved separately as welcome_lead_link so the original keeps sending,
 * untouched, while this one clears review — same approach used for
 * payment_reminder_link.
 */
export async function sendWelcomeLeadWithLink(
  phone: string,
  fullName: string,
  leadId: string,
  /**
   * Her own quiz answers, read back to her. This is the difference between a
   * mail-merge and a message that proves a human looked at what she wrote:
   * she answered six questions moments ago, and naming her score and the
   * symptom she picked is the cheapest trust you will ever buy.
   *
   * welcome_lead_link declares THREE body params, so both values are
   * REQUIRED. Callers that cannot supply them must send plain welcome_lead
   * instead — sending the wrong count fails the whole message (132000).
   */
  personal: { score: string; symptom: string },
  languageOverride?: string,
): Promise<WhatsAppResult> {
  const firstName = (fullName || '').trim().split(/\s+/)[0] || 'there'
  return sendWhatsAppTemplate(
    phone,
    'welcome_lead_link',
    [firstName, personal.score, personal.symptom],
    languageOverride,
    leadId,
  )
}

/**
 * Sent the moment Cashfree confirms payment.
 *
 * This is the recovery path for the funnel's most expensive leak: half of the
 * women who pay Rs299 never pick a call slot, so the money is spent and no
 * consultation happens. booking_confirmation is UTILITY category — far cheaper
 * than marketing and higher deliverability, because it follows an action she
 * just took. Its button links straight to the Cal.com picker.
 */
/**
 * The free-consultation replacement for booking_confirmation.
 *
 * booking_confirmation says "your payment is confirmed" and carries a button
 * back to the Cal.com picker — wrong on both counts now: nobody pays, and she
 * has already chosen her slot. Meta also reclassified it from UTILITY to
 * MARKETING on 17 Aug 2026, which is what payment language plus a booking
 * button reads as.
 *
 * booking_confirmed_free is UTILITY, takes the same single {{1}} first-name
 * parameter, and has no button. It asks for her thyroid report instead, which
 * is the filter that replaced the Rs299.
 */
export async function sendBookingConfirmedFree(phone: string, fullName: string): Promise<WhatsAppResult> {
  const firstName = (fullName || '').trim().split(/\s+/)[0] || 'there'
  return sendWhatsAppTemplate(phone, 'booking_confirmed_free', [firstName])
}

export async function sendBookingConfirmation(phone: string, fullName: string): Promise<WhatsAppResult> {
  const firstName = (fullName || '').trim().split(/\s+/)[0] || 'there'
  return sendWhatsAppTemplate(phone, 'booking_confirmation', [firstName])
}

/**
 * Payment reminder whose button deep-links straight back to
 * /complete-payment?leadId=... instead of the quiz intro — approved
 * separately as payment_reminder_link so the original payment_reminder
 * template (already sending, already accumulating quality data) is never
 * touched or put through re-review.
 *
 * DO NOT call this until payment_reminder_link shows Active in WhatsApp
 * Manager. Sending an unapproved/nonexistent template name fails the whole
 * request — Meta doesn't partially send a template.
 */
export async function sendPaymentReminderWithLink(phone: string, fullName: string, leadId: string, languageOverride?: string): Promise<WhatsAppResult> {
  const firstName = (fullName || '').trim().split(/\s+/)[0] || 'there'
  return sendWhatsAppTemplate(phone, 'payment_reminder_link', [firstName], languageOverride, leadId)
}

/**
 * Free-form reply, only valid inside the 24-hour service window a customer
 * opens by messaging first.
 *
 * This is the cheap half of WhatsApp and the reason the inbox matters: once she
 * writes to you, replies cost NOTHING and need no template or approval. Outside
 * that window Meta rejects with (#131047) and a template is required instead —
 * the dashboard surfaces that error rather than silently swallowing it, because
 * "my reply never arrived" is worse than a visible failure.
 */
export async function sendWhatsAppText(to: string, text: string): Promise<WhatsAppResult> {
  const token = readToken()
  const phoneNumberId = process.env.WHATSAPP_PHONE_NUMBER_ID
  if (!token || !phoneNumberId) return { sent: false, skipped: 'whatsapp_not_configured' }

  const recipient = toWhatsAppNumber(to)
  if (recipient.length < 12) return { sent: false, skipped: 'invalid_phone' }
  const body = (text || '').trim()
  if (!body) return { sent: false, skipped: 'empty_message' }

  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 8000)
    let res: Response
    try {
      res = await fetch(`https://graph.facebook.com/${GRAPH_VERSION}/${phoneNumberId}/messages`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: recipient,
          type: 'text',
          text: { preview_url: true, body },
        }),
        signal: controller.signal,
      })
    } finally {
      clearTimeout(timeout)
    }
    const json = (await res.json()) as { messages?: { id?: string }[]; error?: { message?: string; code?: number } }
    if (!res.ok || json.error) {
      const code = json.error?.code
      const err =
        code === 131047
          ? 'Her 24-hour reply window has closed — send an approved template instead.'
          : `${code ?? res.status}: ${json.error?.message ?? 'unknown'}`
      console.error(`[whatsapp] text send failed to=***${recipient.slice(-4)} ${err}`)
      return { sent: false, error: err }
    }
    return { sent: true, messageId: json.messages?.[0]?.id }
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err)
    console.error('[whatsapp] text send threw', message)
    return { sent: false, error: message }
  }
}
