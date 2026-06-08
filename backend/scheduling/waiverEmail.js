import { sendEmail } from '../email/sendEmail.js'

const WAIVER_URL =
  process.env.WAIVER_URL || 'https://app.jackrabbitclass.com/regv2.asp?id=557920'
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
 *   parentFirstName: string
 *   parentEmail: string
 *   athleteFirstName: string
 *   athleteLastName: string
 *   formTitle: string
 * }} params
 */
export async function sendWaiverEmail({
  parentFirstName,
  parentEmail,
  athleteFirstName,
  athleteLastName,
  formTitle,
}) {
  const guardianName = parentFirstName || 'there'
  const athleteName = [athleteFirstName, athleteLastName].filter(Boolean).join(' ') || 'your child'
  const title = formTitle || 'a Vortex Athletics event or class'
  const subject = `Action needed: Sign waiver for ${athleteName} — Vortex Athletics`

  const text = `Hi ${guardianName},

Exciting news — ${athleteName} has just registered for ${title} at Vortex Athletics!

Before they can participate, a parent or guardian must complete the required waiver form. It only takes a few minutes.

Please sign the waiver here:
${WAIVER_URL}

This step is required for your child's participation. If you have any questions, contact us at ${TEAM_EMAIL}.

Thank you for supporting your athlete!
Vortex Athletics
${TEAM_EMAIL}`

  const html = `
<!DOCTYPE html>
<html>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #222; max-width: 560px;">
  <p>Hi <strong>${escapeHtml(guardianName)}</strong>,</p>
  <p>Exciting news — <strong>${escapeHtml(athleteName)}</strong> has just registered for <strong>${escapeHtml(title)}</strong> at Vortex Athletics!</p>
  <p>Before they can participate, a parent or guardian must complete the required waiver. It only takes a few minutes.</p>
  <p style="margin: 28px 0;">
    <a href="${escapeHtml(WAIVER_URL)}"
       style="display: inline-block; background: #c41e3a; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">
      Sign the waiver form
    </a>
  </p>
  <p style="font-size: 14px; color: #555;">Or copy this link: <a href="${escapeHtml(WAIVER_URL)}">${escapeHtml(WAIVER_URL)}</a></p>
  <p><strong>This step is required</strong> for your child's participation.</p>
  <p>Questions? Contact us at <a href="mailto:${escapeHtml(TEAM_EMAIL)}">${escapeHtml(TEAM_EMAIL)}</a>.</p>
  <p style="margin-top: 24px;">Thank you for supporting your athlete!<br><strong>Vortex Athletics</strong></p>
</body>
</html>`

  await sendEmail({ to: parentEmail, subject, text, html })
}
