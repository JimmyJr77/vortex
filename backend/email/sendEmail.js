import nodemailer from 'nodemailer'
import crypto from 'crypto'
import {
  normalizeEmail,
  isValidEmail,
  extractEmailAddress as extractAddr,
} from './emailAddress.js'
import {
  isKnownCategory,
  streamForCategory,
  isTransactional,
  isMarketing,
  isSecurityCategory,
  isFinancialCategory,
  findPromotionalContent,
  STREAM_TRANSACTIONAL,
} from './emailCategories.js'
import { POLICY, frontDeskReplyTo, billingMailbox, categoryDisabled } from './emailPolicy.js'
import {
  isSuppressed,
  addSuppression,
  recentSendStats,
  recordDelivery,
  updateDeliveryStatus,
} from './emailDeliveryStore.js'
import { EMAIL_LOGO_CID, EMAIL_LOGO_URL, normalizeOutboundEmailHtml } from './emailHtml.js'

let transporter = null

function smtpUser() {
  return (process.env.SMTP_USER || '').trim()
}

function smtpPass() {
  return (process.env.SMTP_PASS || '').trim()
}

function maskEmail(email) {
  const s = String(email || '').trim()
  const at = s.indexOf('@')
  if (at <= 1) return s ? '***' : ''
  return `${s[0]}***${s.slice(at)}`
}

function getTransporter({ forceNew = false } = {}) {
  if (forceNew) transporter = null
  if (transporter) return transporter

  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const user = smtpUser()
  const pass = smtpPass()

  if (!user || !pass) {
    return null
  }

  transporter = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
  })

  return transporter
}

export function isEmailConfigured() {
  return Boolean(smtpUser() && smtpPass())
}

/** Map nodemailer/Gmail errors to a short admin-facing message (no secrets). */
export function formatEmailError(err) {
  const msg = String(err?.message || err || '')
  const code = String(err?.code || '')
  const responseCode = Number(err?.responseCode || 0)

  if (!smtpUser() || !smtpPass()) {
    return 'Email is not configured on the server. Set SMTP_USER and SMTP_PASS in Render environment variables.'
  }

  if (
    code === 'EAUTH' ||
    responseCode === 535 ||
    /535|BadCredentials|Username and Password not accepted|Invalid login/i.test(msg)
  ) {
    return (
      'Gmail rejected the SMTP login. On Render, set SMTP_USER to the full sending address ' +
      '(e.g. team@vortexathletics.com) and SMTP_PASS to a Google App Password — not your normal ' +
      'account password. Create one at https://myaccount.google.com/apppasswords (2-Step Verification required). ' +
      'After updating env vars, redeploy the backend service.'
    )
  }

  if (/self-signed|certificate|UNABLE_TO_VERIFY/i.test(msg)) {
    return 'SMTP TLS/certificate error. Check SMTP_HOST and SMTP_PORT on the server.'
  }

  return msg || 'Failed to send email'
}

export const extractEmailAddress = extractAddr

export function getEmailConfigSummary() {
  const host = (process.env.SMTP_HOST || 'smtp.gmail.com').trim()
  const port = Number(process.env.SMTP_PORT || 587)
  const user = smtpUser()
  const pass = smtpPass()
  const fromRaw = (process.env.SMTP_FROM || user || '').trim()
  const fromEmail = extractEmailAddress(fromRaw)
  return {
    configured: Boolean(user && pass),
    smtpHost: host,
    smtpPort: port,
    smtpUser: user ? maskEmail(user) : null,
    smtpUserLooksValid: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(user),
    smtpPassLength: pass ? pass.length : 0,
    smtpPassLooksLikeAppPassword: pass.length === 16,
    smtpFrom: fromEmail ? maskEmail(fromEmail) : null,
    smtpFromLooksValid: fromEmail ? /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail) : false,
    smtpFromHasDisplayName: fromRaw.includes('<') || fromRaw.includes('>'),
  }
}

export async function verifySmtpConnection() {
  const transport = getTransporter({ forceNew: true })
  if (!transport) {
    return { ok: false, error: formatEmailError(new Error('not configured')) }
  }
  try {
    await transport.verify()
    return { ok: true, error: null }
  } catch (err) {
    transporter = null
    return { ok: false, error: formatEmailError(err) }
  }
}

function resolveFromAddress() {
  const fromRaw = (process.env.SMTP_FROM || smtpUser() || '').trim()
  if (fromRaw.includes('<') && fromRaw.includes('>')) {
    return fromRaw
  }
  const email = extractEmailAddress(fromRaw)
  return email ? `Vortex Athletics <${email}>` : 'Vortex Athletics'
}

function resolveReplyTo() {
  const explicit = (process.env.SMTP_REPLY_TO || '').trim()
  if (explicit && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(explicit)) {
    return explicit
  }
  const fromEmail = extractEmailAddress(process.env.SMTP_FROM || smtpUser())
  return fromEmail || undefined
}

/**
 * Send a transactional (or marketing) email.
 *
 * Backward compatible: existing callers passing only `{ to, subject, text, html }` keep
 * working (treated as transactional). New callers should pass a `category` so the message
 * is classified, suppression/policy is enforced, and delivery is logged.
 *
 * @param {{
 *   to: string;
 *   subject: string;
 *   text: string;
 *   html: string;
 *   replyTo?: string;
 *   category?: string;
 *   idempotencyKey?: string;
 *   listUnsubscribeUrl?: string;   // marketing only
 *   templateVersion?: string;
 *   facilityId?: number | null;
 *   memberId?: number | null;
 *   invitationId?: number | null;
 *   skipPolicy?: boolean;          // bypass cooldown/cap (e.g. one-off security alerts)
 * }} mail
 * @returns {Promise<{ sent: boolean; suppressed?: boolean; skipped?: boolean; reason?: string; messageId?: string }>}
 */
export async function sendEmail({
  to,
  subject,
  text,
  html,
  replyTo,
  category,
  idempotencyKey,
  listUnsubscribeUrl,
  templateVersion = null,
  facilityId = null,
  memberId = null,
  invitationId = null,
  skipPolicy = false,
}) {
  const normalizedTo = normalizeEmail(to)
  if (!isValidEmail(normalizedTo)) {
    throw new Error('Invalid recipient email address')
  }

  const stream = category ? streamForCategory(category) : STREAM_TRANSACTIONAL
  if (category && !isKnownCategory(category)) {
    throw new Error(`Unknown email category: ${category}`)
  }

  // Classification guardrails.
  if (category && isTransactional(category)) {
    const promo = findPromotionalContent(subject, text)
    if (promo.length > 0) {
      throw new Error(
        `Transactional email (${category}) contains promotional content: ${promo.join(', ')}`,
      )
    }
    if (listUnsubscribeUrl) {
      throw new Error('Transactional email must not include a marketing unsubscribe link')
    }
  }
  if (category && isMarketing(category) && !listUnsubscribeUrl) {
    throw new Error('Marketing email requires a one-click unsubscribe URL')
  }

  // Kill switch / per-category disable.
  if (category && categoryDisabled(category)) {
    await recordDelivery({
      facilityId, memberId, invitationId, category, stream, templateVersion,
      email: normalizedTo, status: 'suppressed', providerReason: 'category_disabled', idempotencyKey,
    })
    return { sent: false, skipped: true, reason: 'category_disabled' }
  }

  // Suppression list (global blocks all; marketing-only blocks marketing stream).
  const supp = await isSuppressed(normalizedTo, stream)
  if (supp.suppressed) {
    await recordDelivery({
      facilityId, memberId, invitationId, category: category || 'unknown', stream,
      templateVersion, email: normalizedTo, status: 'suppressed',
      providerReason: `suppressed:${supp.reason}`, idempotencyKey,
    })
    return { sent: false, suppressed: true, reason: supp.reason }
  }

  // Cooldown + daily cap (skippable for one-off security messages).
  if (category && !skipPolicy) {
    const dayMs = 24 * 60 * 60 * 1000
    const stats = await recentSendStats(normalizedTo, category, dayMs)
    if (stats.count >= POLICY.dailyPerAddressMax) {
      return { sent: false, skipped: true, reason: 'daily_cap' }
    }
    if (stats.lastAt && Date.now() - stats.lastAt.getTime() < POLICY.resendCooldownSec * 1000) {
      return { sent: false, skipped: true, reason: 'cooldown' }
    }
  }

  const transport = getTransporter()
  if (!transport) {
    throw new Error(formatEmailError(new Error('not configured')))
  }

  const from = resolveFromAddress()
  const replyToAddress = resolveValidatedReplyTo(replyTo, category)

  const headers = {
    'X-Mailer': 'Vortex Athletics',
    'X-Entity-Ref-ID': idempotencyKey || crypto.randomUUID(),
  }
  if (stream === STREAM_TRANSACTIONAL) {
    // Signal mailbox providers this is an automated, non-bulk message.
    headers['Auto-Submitted'] = 'auto-generated'
    headers['X-Auto-Response-Suppress'] = 'All'
  }
  if (stream !== STREAM_TRANSACTIONAL && listUnsubscribeUrl) {
    headers['List-Unsubscribe'] = `<${listUnsubscribeUrl}>`
    headers['List-Unsubscribe-Post'] = 'List-Unsubscribe=One-Click'
  }

  const delivery = await recordDelivery({
    facilityId, memberId, invitationId, category: category || 'unknown', stream,
    templateVersion, email: normalizedTo, status: 'queued', idempotencyKey,
  })
  if (delivery.duplicate) {
    return { sent: false, skipped: true, reason: 'duplicate' }
  }

  try {
    const info = await transport.sendMail({
      from,
      to: normalizedTo,
      replyTo: replyToAddress,
      subject,
      text,
      html: normalizeOutboundEmailHtml(html),
      attachments: [
        {
          filename: 'vortex-athletics-logo.png',
          path: EMAIL_LOGO_URL,
          cid: EMAIL_LOGO_CID,
        },
      ],
      headers,
      // Account-security mail: never allow tracking pixels/redirects.
      ...(category && isSecurityCategory(category) ? { disableUrlAccess: false } : {}),
    })
    await updateDeliveryStatus(delivery.id, 'accepted', {
      providerReason: Array.isArray(info?.rejected) && info.rejected.length ? 'partial_reject' : null,
    })
    return { sent: true, messageId: info?.messageId }
  } catch (err) {
    if (String(err?.code) === 'EAUTH' || Number(err?.responseCode) === 535) {
      transporter = null
    }
    const code = Number(err?.responseCode) || null
    const isHardBounce = code != null && code >= 500 && code < 600
    await updateDeliveryStatus(delivery.id, isHardBounce ? 'bounced' : 'failed', {
      smtpCode: code != null ? String(code) : null,
      providerReason: classifyFailure(err),
    })
    // A permanent (5xx) failure is a hard bounce we observed synchronously — suppress it
    // so we stop retrying/reminding a dead address (mirrors what an ESP webhook would do).
    if (isHardBounce) {
      await addSuppression(normalizedTo, {
        scope: 'global', reason: 'hard_bounce', source: 'smtp', detail: String(code),
      })
    }
    const friendly = new Error(formatEmailError(err))
    friendly.cause = err
    throw friendly
  }
}

/** Validate Reply-To: must be a real address; never a no-reply. Falls back to front desk. */
export function resolveValidatedReplyTo(explicit, category) {
  if (isFinancialCategory(category)) return billingMailbox()
  const candidate = explicit || frontDeskReplyTo()
  if (candidate) {
    const addr = extractEmailAddress(candidate)
    if (isValidEmail(addr) && !/^no-?reply@/i.test(addr)) {
      return candidate
    }
  }
  // Fall back to the provider's existing logic (SMTP_REPLY_TO/From).
  return resolveReplyTo()
}

/** Short, non-sensitive failure classification for the delivery log. */
function classifyFailure(err) {
  const code = Number(err?.responseCode) || 0
  if (code === 535 || String(err?.code) === 'EAUTH') return 'auth_failed'
  if (code >= 500 && code < 600) return 'permanent_failure'
  if (code >= 400 && code < 500) return 'temporary_failure'
  return 'send_error'
}
