import { sendEmail, isEmailConfigured } from './sendEmail.js'
import { memberPortalLoginUrl } from './publicAppUrl.js'

const TEAM_EMAIL = process.env.SMTP_FROM || process.env.SMTP_USER || 'team@vortexathletics.com'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function extractEmailAddress(value) {
  const s = String(value || '').trim()
  const bracketed = s.match(/<([^>]+)>/)
  return bracketed ? bracketed[1].trim() : s
}

/**
 * Ask a member (or their guardian) to sign outstanding in-app waivers via the
 * Member Portal. Distinct from scheduling/waiverEmail.js, which links to the
 * external JackRabbit form.
 *
 * @param {{
 *   to: string
 *   athleteName?: string
 *   guardianName?: string
 *   outstandingCount?: number
 * }} params
 */
export async function sendWaiverRequestEmail({
  to,
  athleteName,
  guardianName,
  outstandingCount,
}) {
  if (!isEmailConfigured()) {
    console.warn('[waiverRequestEmail] SMTP not configured; skipping send to', to)
    return { sent: false }
  }
  if (!to) {
    console.warn('[waiverRequestEmail] No recipient email; skipping send')
    return { sent: false }
  }

  const url = memberPortalLoginUrl()
  const teamEmail = extractEmailAddress(TEAM_EMAIL)
  const greeting = guardianName ? `Hi ${guardianName},` : 'Hello,'
  const athlete = athleteName || 'your athlete'
  const countText =
    Number(outstandingCount) > 0
      ? `There ${Number(outstandingCount) === 1 ? 'is' : 'are'} ${outstandingCount} required waiver${
          Number(outstandingCount) === 1 ? '' : 's'
        } still to sign.`
      : 'There are required waivers still to sign.'

  const subject = `Action needed: sign required waivers for ${athlete} — Vortex Athletics`

  const text = [
    greeting,
    '',
    `Before ${athlete} can participate at Vortex Athletics, the required waivers must be completed.`,
    countText,
    '',
    'Log in to the Member Portal to review and sign them:',
    url,
    '',
    `Questions? Contact us at ${teamEmail}.`,
    '',
    '— Vortex Athletics',
  ].join('\n')

  const html = `
  <p>${escapeHtml(greeting)}</p>
  <p>Before <strong>${escapeHtml(athlete)}</strong> can participate at Vortex Athletics, the required waivers must be completed.</p>
  <p>${escapeHtml(countText)}</p>
  <p style="margin: 28px 0;">
    <a href="${escapeHtml(url)}"
       style="display: inline-block; background: #c41e3a; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 4px; font-weight: bold;">
      Sign waivers in the Member Portal
    </a>
  </p>
  <p style="font-size: 14px; color: #555;">Or copy this link: <a href="${escapeHtml(url)}">${escapeHtml(url)}</a></p>
  <p>Questions? Contact us at <a href="mailto:${escapeHtml(teamEmail)}">${escapeHtml(teamEmail)}</a>.</p>
  `

  await sendEmail({ to, subject, text, html })
  return { sent: true }
}
