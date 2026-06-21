import { sendEmail } from '../email/sendEmail.js'
import { formatPricingEmailBlock } from './pricing.js'

const TEAM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || 'team@vortexathletics.com'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {{
 *   registrantFirstName: string
 *   registrantEmail: string
 *   formTitle: string
 *   slotLabel: string
 *   signupNumber?: number | null
 *   maxParticipants?: number | null
 *   pricing?: object | null
 * }} params
 */
export async function sendConfirmationEmail({
  registrantFirstName,
  registrantEmail,
  formTitle,
  slotLabel,
  signupNumber,
  maxParticipants,
  pricing,
}) {
  const firstName = registrantFirstName || 'there'
  const title = formTitle || 'your Vortex Athletics event'
  const subject = `You're registered for ${title} — Vortex Athletics`

  const positionLine =
    signupNumber != null && maxParticipants != null
      ? `You are number ${signupNumber} of ${maxParticipants}.\n\n`
      : ''

  const pricingBlock = formatPricingEmailBlock(pricing)
  const pricingText = pricingBlock.text ? `\n\n${pricingBlock.text}\n` : ''

  const text = `Hi ${firstName},

Great news — your registration is confirmed!

${positionLine}You've signed up for:
• Event: ${title}
• Time: ${slotLabel}
${pricingText}
We're excited to have you at Vortex Athletics. Save this email for your records.

What happens next?
We'll be in touch if we need anything else before your session. If you have questions, reply to this email or contact us at ${TEAM_EMAIL}.

See you soon!
Vortex Athletics
${TEAM_EMAIL}`

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 560px;">
  <p>Hi <strong>${escapeHtml(firstName)}</strong>,</p>
  <p>Great news — <strong>your registration is confirmed!</strong> We're thrilled you're joining us at Vortex Athletics.</p>
  ${
    signupNumber != null && maxParticipants != null
      ? `<p style="font-size: 18px;">You are number <strong>${signupNumber}</strong> of <strong>${maxParticipants}</strong>.</p>`
      : ''
  }
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Event</td><td><strong>${escapeHtml(title)}</strong></td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Time</td><td><strong>${escapeHtml(slotLabel)}</strong></td></tr>
  </table>
  ${pricingBlock.html}
  <p>Save this email for your records. We'll reach out if we need anything else before your session.</p>
  <p>Questions? Reply to this email or contact us at <a href="mailto:${escapeHtml(TEAM_EMAIL)}">${escapeHtml(TEAM_EMAIL)}</a>.</p>
  <p style="margin-top: 24px;">See you soon!<br><strong>Vortex Athletics</strong></p>
</body>
</html>`

  await sendEmail({ to: registrantEmail, subject, text, html })
}
