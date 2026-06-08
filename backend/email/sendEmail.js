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

/**
 * @param {{ to: string; subject: string; text: string; html: string }} mail
 */
export async function sendEmail({ to, subject, text, html }) {
  const transport = getTransporter()
  if (!transport) {
    throw new Error('SMTP is not configured (set SMTP_USER and SMTP_PASS)')
  }

  const from = process.env.SMTP_FROM || process.env.SMTP_USER

  await transport.sendMail({
    from: `Vortex Athletics <${from}>`,
    to,
    subject,
    text,
    html,
  })
}
