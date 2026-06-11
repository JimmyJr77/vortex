import nodemailer from 'nodemailer'

let transporter = null

function getTransporter() {
  if (transporter) return transporter

  const host = process.env.SMTP_HOST || 'smtp.gmail.com'
  const port = Number(process.env.SMTP_PORT || 587)
  const user = process.env.SMTP_USER
  const pass = process.env.SMTP_PASS

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
  return Boolean(process.env.SMTP_USER && process.env.SMTP_PASS)
}

/** Map nodemailer/Gmail errors to a short admin-facing message (no secrets). */
export function formatEmailError(err) {
  const msg = String(err?.message || err || '')
  const code = String(err?.code || '')

  if (!process.env.SMTP_USER || !process.env.SMTP_PASS) {
    return 'Email is not configured on the server. Set SMTP_USER and SMTP_PASS in Render environment variables.'
  }

  if (
    code === 'EAUTH' ||
    /535|BadCredentials|Username and Password not accepted/i.test(msg)
  ) {
    return (
      'Gmail rejected the SMTP login. On Render, set SMTP_USER to the full sending address ' +
      '(e.g. team@vortexathletics.com) and SMTP_PASS to a Google App Password — not your normal ' +
      'account password. Create one at https://myaccount.google.com/apppasswords (2-Step Verification required).'
    )
  }

  if (/self-signed|certificate|UNABLE_TO_VERIFY/i.test(msg)) {
    return 'SMTP TLS/certificate error. Check SMTP_HOST and SMTP_PORT on the server.'
  }

  return msg || 'Failed to send email'
}

/**
 * @param {{ to: string; subject: string; text: string; html: string }} mail
 */
export async function sendEmail({ to, subject, text, html }) {
  const transport = getTransporter()
  if (!transport) {
    throw new Error(formatEmailError(new Error('not configured')))
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  try {
    await transport.sendMail({
      from: `Vortex Athletics <${from}>`,
      to,
      subject,
      text,
      html,
    })
  } catch (err) {
    const friendly = new Error(formatEmailError(err))
    friendly.cause = err
    throw friendly
  }
}
