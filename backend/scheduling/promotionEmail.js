import { sendEmail } from '../email/sendEmail.js'

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
 *   categoryName: string
 *   slotLabel: string
 *   signupNumber: number
 *   maxParticipants: number
 * }} params
 */
export async function sendPromotionEmail({
  registrantFirstName,
  registrantEmail,
  formTitle,
  categoryName,
  slotLabel,
  signupNumber,
  maxParticipants,
}) {
  const firstName = registrantFirstName || 'there'
  const title = formTitle || 'your Vortex Athletics event'
  const subject = `A spot opened up — you're confirmed for ${title}`

  const text = `Hi ${firstName},

Great news — a spot has opened up and you are now confirmed!

You are number ${signupNumber} of ${maxParticipants}.

Event details:
• Event: ${title}
• Category: ${categoryName}
• Time: ${slotLabel}

We're excited to have you at Vortex Athletics. Save this email for your records.

Questions? Reply to this email or contact us at ${TEAM_EMAIL}.

See you soon!
Vortex Athletics
${TEAM_EMAIL}`

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 560px;">
  <p>Hi <strong>${escapeHtml(firstName)}</strong>,</p>
  <p><strong>Great news — a spot has opened up and you are now confirmed!</strong></p>
  <p style="font-size: 18px;">You are number <strong>${signupNumber}</strong> of <strong>${maxParticipants}</strong>.</p>
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Event</td><td><strong>${escapeHtml(title)}</strong></td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Category</td><td><strong>${escapeHtml(categoryName)}</strong></td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Time</td><td><strong>${escapeHtml(slotLabel)}</strong></td></tr>
  </table>
  <p>Save this email for your records.</p>
  <p>Questions? Reply to this email or contact us at <a href="mailto:${escapeHtml(TEAM_EMAIL)}">${escapeHtml(TEAM_EMAIL)}</a>.</p>
  <p style="margin-top: 24px;">See you soon!<br><strong>Vortex Athletics</strong></p>
</body>
</html>`

  await sendEmail({ to: registrantEmail, subject, text, html })
}
