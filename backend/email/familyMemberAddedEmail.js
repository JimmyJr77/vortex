import { sendEmail, isEmailConfigured } from './sendEmail.js'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

const TEAM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || 'team@vortexathletics.com'

/**
 * @param {{
 *   to: string
 *   guardianFirstName?: string | null
 *   newMemberName: string
 *   familyName?: string | null
 * }} params
 */
export async function sendFamilyMemberAddedEmail({
  to,
  guardianFirstName,
  newMemberName,
  familyName,
}) {
  if (!isEmailConfigured()) {
    console.warn('[familyMemberAddedEmail] SMTP not configured; skipping send to', to)
    return { sent: false }
  }
  if (!to) {
    console.warn('[familyMemberAddedEmail] No recipient email; skipping send')
    return { sent: false }
  }

  const greeting = guardianFirstName ? `Hi ${guardianFirstName},` : 'Hi,'
  const familyLabel = familyName ? ` (${familyName})` : ''
  const subject = `New family member added to your Vortex account${familyLabel}`

  const text = [
    greeting,
    '',
    `Your Vortex Athletics family account${familyLabel} has welcomed a new member: ${newMemberName}.`,
    '',
    'If you did not expect or authorize this change, please contact us immediately so we can help secure your account.',
    '',
    TEAM_EMAIL,
    '',
    '— Vortex Athletics',
  ].join('\n')

  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>Your Vortex Athletics family account${escapeHtml(familyLabel)} has welcomed a new member: <strong>${escapeHtml(newMemberName)}</strong>.</p>
    <p style="color:#555;font-size:14px;">If you did not expect or authorize this change, please contact us immediately at <a href="mailto:${escapeHtml(TEAM_EMAIL)}">${escapeHtml(TEAM_EMAIL)}</a>.</p>
    <p>— Vortex Athletics</p>
  `

  return sendEmail({ to, subject, text, html, category: 'family_member_added', templateVersion: 'family_added_v1' })
}
