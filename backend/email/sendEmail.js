import nodemailer from 'nodemailer'

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

function extractEmailAddress(value) {
  const s = String(value || '').trim()
  const bracketed = s.match(/<([^>]+)>/)
  if (bracketed) return bracketed[1].trim()
  return s
}

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

/**
 * @param {{ to: string; subject: string; text: string; html: string }} mail
 */
export async function sendEmail({ to, subject, text, html }) {
  const transport = getTransporter()
  if (!transport) {
    throw new Error(formatEmailError(new Error('not configured')))
  }

  const from = extractEmailAddress(process.env.SMTP_FROM || smtpUser())

  try {
    await transport.sendMail({
      from: `Vortex Athletics <${from}>`,
      to,
      subject,
      text,
      html,
    })
  } catch (err) {
    if (String(err?.code) === 'EAUTH' || Number(err?.responseCode) === 535) {
      transporter = null
    }
    const friendly = new Error(formatEmailError(err))
    friendly.cause = err
    throw friendly
  }
}
