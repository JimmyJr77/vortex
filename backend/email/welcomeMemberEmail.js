import { sendEmail, isEmailConfigured } from './sendEmail.js'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {{ to: string; firstName?: string; username?: string | null; hasLogin?: boolean }} params
 */
export async function sendWelcomeMemberEmail({ to, firstName, username, hasLogin = true }) {
  if (!isEmailConfigured()) {
    console.warn('[welcomeMemberEmail] SMTP not configured; skipping send to', to)
    return { sent: false }
  }
  if (!to) {
    console.warn('[welcomeMemberEmail] No recipient email; skipping send')
    return { sent: false }
  }

  const greeting = firstName ? `Hi ${firstName},` : 'Hi,'
  const subject = 'Welcome to the Vortex Athletics Team'

  const loginHint = hasLogin && username
    ? `\nYou can sign in with username "${username}" or your email address.\n`
    : hasLogin
      ? '\nYou can sign in from the Member Portal using your email and password.\n'
      : ''

  const text = [
    greeting,
    '',
    'Thank you for joining the Vortex Athletics Team! We are excited to have you with us.',
    loginHint,
    'If you have questions, reply to this email or contact us through the website.',
    '',
    '— Vortex Athletics',
  ]
    .filter((line) => line !== '')
    .join('\n')

  const loginHtml =
    hasLogin && username
      ? `<p>You can sign in with username <strong>${escapeHtml(username)}</strong> or your email address.</p>`
      : hasLogin
        ? '<p>You can sign in from the Member Portal using your email and password.</p>'
        : ''

  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>Thank you for joining the <strong>Vortex Athletics Team</strong>! We are excited to have you with us.</p>
    ${loginHtml}
    <p style="color:#555;font-size:14px;">If you have questions, reply to this email or contact us through the website.</p>
    <p>— Vortex Athletics</p>
  `

  await sendEmail({ to, subject, text, html })
  return { sent: true }
}
