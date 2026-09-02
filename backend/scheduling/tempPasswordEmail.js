import crypto from 'crypto'
import { sendEmail } from '../email/sendEmail.js'

const TEAM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || 'team@vortexathletics.com'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function generateTemporaryPassword(length = 12) {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789'
  const bytes = crypto.randomBytes(length)
  let password = ''
  for (let i = 0; i < length; i += 1) {
    password += chars[bytes[i] % chars.length]
  }
  return password
}

/**
 * @param {{ registrantFirstName: string, registrantEmail: string, temporaryPassword: string }} params
 * @param {{ send?: typeof sendEmail, requirePasswordChange?: boolean }} options
 */
export async function sendTemporaryPasswordEmail({
  registrantFirstName,
  registrantEmail,
  temporaryPassword,
}, { send = sendEmail, requirePasswordChange = true } = {}) {
  const firstName = registrantFirstName || 'there'
  const subject = 'Your temporary Vortex Athletics password'
  const passwordGuidance = requirePasswordChange
    ? 'For your security, you will be asked to choose a new password the next time you sign in.'
    : 'After signing in, your facility Owner can replace this password from Staff Access.'

  const text = `Hi ${firstName},

A temporary password has been set for your Vortex Athletics account.

Temporary password: ${temporaryPassword}

${passwordGuidance}

If you did not expect this email, contact us at ${TEAM_EMAIL}.

Vortex Athletics
${TEAM_EMAIL}`

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 560px;">
  <p>Hi <strong>${escapeHtml(firstName)}</strong>,</p>
  <p>A temporary password has been set for your Vortex Athletics account.</p>
  <p style="font-size: 18px;"><strong>Temporary password:</strong> ${escapeHtml(temporaryPassword)}</p>
  <p>${escapeHtml(passwordGuidance)}</p>
  <p>Questions? Contact us at <a href="mailto:${escapeHtml(TEAM_EMAIL)}">${escapeHtml(TEAM_EMAIL)}</a>.</p>
  <p style="margin-top: 24px;"><strong>Vortex Athletics</strong></p>
</body>
</html>`

  const delivery = await send({
    to: registrantEmail,
    subject,
    text,
    html,
    category: 'password_reset',
    templateVersion: 'temp_password_v2',
    // Password resets have their own endpoint rate limit. A generic email
    // cooldown must not silently discard a newly generated password.
    skipPolicy: true,
  })

  if (!delivery?.sent) {
    const error = new Error('Temporary password email was not accepted for delivery.')
    error.code = 'TEMPORARY_PASSWORD_EMAIL_NOT_SENT'
    error.reason = delivery?.reason || 'not_sent'
    throw error
  }

  return delivery
}
