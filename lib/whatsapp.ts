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

const GRAPH_VERSION = 'v21.0'

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

  const language = process.env.WHATSAPP_TEMPLATE_LANG || 'en'

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
