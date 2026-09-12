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
  return sendWhatsAppTemplate(phone, 'welcome_lead_v2', [firstName])
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
  personal: { score: string; markers: string },
  languageOverride?: string,
): Promise<WhatsAppResult> {
  const firstName = (fullName || '').trim().split(/\s+/)[0] || 'there'
  return sendWhatsAppTemplate(
    phone,
    'welcome_lead_score_v2',
    [firstName, personal.score, personal.markers],
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
 * booking_confirmed_free_v2 is UTILITY, takes the same single {{1}} first-name
 * parameter, and has no button. It asks for her thyroid report instead, which
 * is the filter that replaced the Rs299.
 *
 * v2 over v1: the em dashes are gone (they read as machine-written), the ask is
 * a bold line with a document marker so it survives a phone skim, and the
 * closing line is about her hour rather than mine. Two emoji, used as
 * structure. More than that reads as spam on a utility message, which is the
 * category Meta already reclassified once in this account.
 */
/**
 * The abandoned-checkout nudge, sent within a minute of her leaving.
 *
 * payment_reminder_link_v2 says the same thing but is MARKETING, and marketing
 * templates carry a per-recipient frequency cap. The welcome message lands two
 * seconds after the quiz, so a reminder minutes later is the SECOND marketing
 * template that person has received — and Meta drops it as #131026/#131049
 * after returning a message id, which makes the send look successful while
 * nothing arrives. A test on a fresh number reproduced it exactly: welcome
 * delivered, reminder nine minutes later blocked.
 *
 * checkout_pending_v2 carries the same link under UTILITY, which is uncapped.
 * It declares the lead id as {{2}} — used both as the printed reference and
 * inside the resume URL — so callers must pass one.
 */
export async function sendCheckoutPending(
  phone: string,
  fullName: string,
  leadId: string,
  languageOverride?: string,
): Promise<WhatsAppResult> {
  const firstName = (fullName || '').trim().split(/\s+/)[0] || 'there'
  return sendWhatsAppTemplate(phone, 'checkout_pending_v2', [firstName, leadId], languageOverride)
}

/** Shared by both confirmation templates: a full name reads like a mail merge,
 *  so only the first name is ever passed. */
function firstNameOf(fullName: string | null | undefined): string {
  return (fullName || '').trim().split(/\s+/)[0] || 'there'
}

export const BOOKING_CONFIRMED_TEMPLATE = 'booking_confirmed_free_v2'

/**
 * The forwardable confirmation, for a woman who does not decide alone.
 *
 * Same moment as booking_confirmed_free_v2 and never alongside it — one
 * confirmation per booking, this one or that one. It asks her to forward the
 * message to whoever she makes health decisions with and have them join for
 * fifteen minutes, which is the only way that person hears the reasoning
 * first-hand: we never collect their number, so we can never message them.
 *
 * UTILITY, and it must stay that way. This WABA's marketing templates hit
 * Meta's per-recipient cap (#131049) and fail AFTER returning a message id, so
 * the send looks successful and nothing arrives. Buttons and links are what get
 * a template reclassified, which is why this one carries neither.
 *
 * Its {{1}} is NOT the first name — it is the session date and time as she
 * would read it. Sending the wrong value here is invisible: the message still
 * delivers, it just greets her with a timestamp.
 */
export const BOOKING_CONFIRMED_PARTNER_TEMPLATE = 'booking_confirmed_partner_v1'

/**
 * The "Partner On Call" answers that mean she is NOT the sole decider.
 *
 * All three qualify. "no" is not a rejection of the consultation — it means
 * the person she decides with is not planning to join, which is exactly who
 * the forwardable message is for. A sole decider answers something outside
 * this set, and a legacy row answers nothing at all; both keep the existing
 * confirmation.
 */
const NOT_SOLE_DECIDER = new Set(['yes', 'unsure', 'no'])

/**
 * Kill switch for the partner confirmation, OFF unless explicitly 'on'.
 *
 * booking_confirmed_partner_v1 is PENDING review at the time of writing, and
 * sending a template Meta has not approved fails the whole message. Nothing
 * about the partner path runs — not even the extra Sheets read that finds her
 * answer — until WHATSAPP_PARTNER_TEMPLATE=on.
 */
export function partnerTemplateEnabled(raw?: string | null): boolean {
  const value = raw === undefined ? process.env.WHATSAPP_PARTNER_TEMPLATE : raw
  return String(value ?? '').trim().toLowerCase() === 'on'
}

/**
 * Her slot as one readable string for the template's {{1}}.
 *
 * Both halves arrive already formatted from the Cal.com handler
 * ("Friday, 19 September 2026" and "06:00 pm"). Whitespace is collapsed
 * because Meta rejects a body parameter containing a newline or a tab, which
 * would fail the entire send.
 */
export function formatBookingWhen(date?: string | null, time?: string | null): string {
  const clean = (v: string | null | undefined) => String(v ?? '').replace(/\s+/g, ' ').trim()
  const d = clean(date)
  const t = clean(time)
  if (d && t) return `${d} at ${t}`
  return d || t
}

export type BookingConfirmationPlan = {
  template: string
  params: string[]
  /** Why this template and not the other — logged, so a surprise is diagnosable. */
  reason: 'flag_off' | 'sole_decider' | 'no_session_time' | 'partner'
}

/**
 * PURE. Decide which of the two confirmations a booking earns.
 *
 * Exactly one template comes back every time, so a caller can never send both.
 * Every route out of the partner path lands on the existing confirmation
 * rather than on silence: an unknown answer, a missing column, a legacy row
 * and a booking whose time could not be formatted all still get confirmed.
 */
export function planBookingConfirmation(input: {
  fullName?: string | null
  /** Raw cell from the Leads sheet's "Partner On Call" column, or undefined
   *  when the column does not exist yet. */
  partnerOnCall?: string | null
  /** Output of formatBookingWhen. */
  sessionWhen?: string | null
  /** Raw WHATSAPP_PARTNER_TEMPLATE; omit to read the environment. */
  flag?: string | null
}): BookingConfirmationPlan {
  const firstName = firstNameOf(input.fullName)
  const keepExisting = (reason: BookingConfirmationPlan['reason']): BookingConfirmationPlan => ({
    template: BOOKING_CONFIRMED_TEMPLATE,
    params: [firstName],
    reason,
  })

  if (!partnerTemplateEnabled('flag' in input ? input.flag : undefined)) return keepExisting('flag_off')

  const answer = String(input.partnerOnCall ?? '').trim().toLowerCase()
  if (!NOT_SOLE_DECIDER.has(answer)) return keepExisting('sole_decider')

  // {{1}} is the slot itself, so no slot means no message worth sending under
  // this template. Better the existing confirmation than "confirmed for .".
  const when = String(input.sessionWhen ?? '').replace(/\s+/g, ' ').trim()
  if (!when) return keepExisting('no_session_time')

  return { template: BOOKING_CONFIRMED_PARTNER_TEMPLATE, params: [when], reason: 'partner' }
}

export async function sendBookingConfirmedFree(phone: string, fullName: string): Promise<WhatsAppResult> {
  return sendWhatsAppTemplate(phone, BOOKING_CONFIRMED_TEMPLATE, [firstNameOf(fullName)])
}

/**
 * The single confirmation for a booked slot — partner-forwardable or not.
 *
 * If the partner template is picked but Meta will not take it (not approved
 * yet, wrong parameter count), she falls back to the existing confirmation
 * rather than receiving nothing: the first attempt delivered no message, so
 * the fallback keeps it at exactly one confirmation per number.
 */
export async function sendBookingConfirmedSlot(
  phone: string,
  fullName: string,
  opts: { partnerOnCall?: string | null; sessionWhen?: string | null; flag?: string | null } = {},
): Promise<WhatsAppResult & { template: string; reason: string }> {
  const plan = planBookingConfirmation({ fullName, ...opts })

  if (plan.template === BOOKING_CONFIRMED_TEMPLATE) {
    const r = await sendWhatsAppTemplate(phone, plan.template, plan.params)
    return { ...r, template: plan.template, reason: plan.reason }
  }

  const r = await sendTryingLanguages((language) =>
    sendWhatsAppTemplate(phone, plan.template, plan.params, language),
  )
  if (r.sent || !isTemplateConfigError(r.error)) {
    return { ...r, template: plan.template, reason: plan.reason }
  }
  const fallback = await sendBookingConfirmedFree(phone, fullName)
  return { ...fallback, template: BOOKING_CONFIRMED_TEMPLATE, reason: 'partner_unavailable' }
}

/**
 * The receipt after Cashfree confirms payment — the one message she must
 * receive, because it carries the slot picker and about half of payers used to
 * stop here.
 *
 * It goes out as payment_receipt_v2, which Meta approved as UTILITY. That
 * matters more than the wording: MARKETING templates are subject to a
 * per-recipient frequency cap, and a capped send fails as #131049 with a
 * message id still returned — the API looks successful and nothing arrives.
 * Meta reclassified two earlier attempts at this template to MARKETING because
 * they carried a call-to-action button; payment_receipt_v2 keeps the Cal.com
 * link in the body instead, and cleared review as utility.
 *
 * It declares an order reference as {{2}}, so callers must pass one. Without it
 * the send would fail on parameter count, so fall back to the marketing
 * template rather than send nothing.
 */
export async function sendBookingConfirmation(
  phone: string,
  fullName: string,
  orderRef?: string,
): Promise<WhatsAppResult> {
  const firstName = (fullName || '').trim().split(/\s+/)[0] || 'there'
  const ref = (orderRef || '').trim()
  if (!ref) return sendWhatsAppTemplate(phone, 'payment_confirmed_v2', [firstName])
  return sendWhatsAppTemplate(phone, 'payment_receipt_v2', [firstName, ref])
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
  return sendWhatsAppTemplate(phone, 'payment_reminder_link_v2', [firstName], languageOverride, leadId)
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
