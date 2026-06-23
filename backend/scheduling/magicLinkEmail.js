import { sendEmail } from '../email/sendEmail.js'
import { publicAppUrl } from '../email/publicAppUrl.js'

const TEAM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || 'team@vortexathletics.com'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {{ email: string; formId: number; formTitle: string; token: string }} params
 */
export async function sendMagicLinkEmail({ email, formId, formTitle, token }) {
  const link = `${publicAppUrl()}/enroll?form=${formId}&auth=${encodeURIComponent(token)}`
  const title = formTitle || 'Vortex Athletics scheduling'
  const subject = `Sign in to complete your signup — ${title}`

  const text = `Hi,

Use this link to sign in and continue your scheduling signup for ${title}:

${link}

This link expires in 30 minutes. If you did not request this, you can ignore this email.

Questions? Contact us at ${TEAM_EMAIL}.

Vortex Athletics`

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 560px;">
  <p>Hi,</p>
  <p>Use the button below to sign in and continue your scheduling signup for <strong>${escapeHtml(title)}</strong>.</p>
  <p style="margin: 24px 0;">
    <a href="${escapeHtml(link)}" style="display:inline-block;background:#c41e3a;color:#fff;padding:12px 24px;text-decoration:none;border-radius:6px;font-weight:bold;">Continue signup</a>
  </p>
  <p style="font-size: 13px; color: #666;">This link expires in 30 minutes. If you did not request this, you can ignore this email.</p>
  <p>Questions? <a href="mailto:${escapeHtml(TEAM_EMAIL)}">${escapeHtml(TEAM_EMAIL)}</a></p>
  <p style="margin-top: 24px;"><strong>Vortex Athletics</strong></p>
</body>
</html>`

  return sendEmail({ to: email, subject, text, html, category: 'signin_magic_link', templateVersion: 'magic_link_v1' })
}
