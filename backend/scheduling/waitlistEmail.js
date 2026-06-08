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
 *   waitlistPosition: number
 * }} params
 */
export async function sendWaitlistEmail({
  registrantFirstName,
  registrantEmail,
  formTitle,
  categoryName,
  slotLabel,
  waitlistPosition,
}) {
  const firstName = registrantFirstName || 'there'
  const title = formTitle || 'your Vortex Athletics event'
  const subject = `You're on the waitlist for ${title} — Vortex Athletics`

  const text = `Hi ${firstName},

Thanks for signing up! This time slot is currently full, so you've been added to the waitlist.

Your waitlist position: #${waitlistPosition}

You've signed up for:
• Event: ${title}
• Category: ${categoryName}
• Time: ${slotLabel}

We'll email you if a spot opens up. If you have questions, reply to this email or contact us at ${TEAM_EMAIL}.

Vortex Athletics
${TEAM_EMAIL}`

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 560px;">
  <p>Hi <strong>${escapeHtml(firstName)}</strong>,</p>
  <p>Thanks for signing up! This time slot is currently full, so you've been added to the <strong>waitlist</strong>.</p>
  <p style="font-size: 18px;"><strong>Your waitlist position: #${waitlistPosition}</strong></p>
  <table style="margin: 20px 0; border-collapse: collapse;">
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Event</td><td><strong>${escapeHtml(title)}</strong></td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Category</td><td><strong>${escapeHtml(categoryName)}</strong></td></tr>
    <tr><td style="padding: 6px 12px 6px 0; color: #666;">Time</td><td><strong>${escapeHtml(slotLabel)}</strong></td></tr>
  </table>
  <p>We'll email you if a spot opens up.</p>
  <p>Questions? Reply to this email or contact us at <a href="mailto:${escapeHtml(TEAM_EMAIL)}">${escapeHtml(TEAM_EMAIL)}</a>.</p>
  <p style="margin-top: 24px;"><strong>Vortex Athletics</strong></p>
</body>
</html>`

  await sendEmail({ to: registrantEmail, subject, text, html })
}
