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

  const body = {
    messaging_product: 'whatsapp',
    to: recipient,
    type: 'template',
    template: {
      name: templateName,
      language: { code: language },
      ...(bodyParams.length
        ? {
            components: [
              {
                type: 'body',
                parameters: bodyParams.map((text) => ({ type: 'text', text })),
              },
            ],
          }
        : {}),
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
 * Sent the moment Cashfree confirms payment.
 *
 * This is the recovery path for the funnel's most expensive leak: half of the
 * women who pay Rs299 never pick a call slot, so the money is spent and no
 * consultation happens. booking_confirmation is UTILITY category — far cheaper
 * than marketing and higher deliverability, because it follows an action she
 * just took. Its button links straight to the Cal.com picker.
 */
export async function sendBookingConfirmation(phone: string, fullName: string): Promise<WhatsAppResult> {
  const firstName = (fullName || '').trim().split(/\s+/)[0] || 'there'
  return sendWhatsAppTemplate(phone, 'booking_confirmation', [firstName])
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
