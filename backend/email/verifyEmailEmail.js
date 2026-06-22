import { sendEmail, isEmailConfigured } from './sendEmail.js'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * Email asking a user to confirm their email address via a single-use link.
 *
 * @param {{ to: string; verifyUrl: string; name?: string }} params
 */
export async function sendVerifyEmailEmail({ to, verifyUrl, name }) {
  if (!isEmailConfigured()) {
    console.warn('[verifyEmailEmail] SMTP not configured; verify URL:', verifyUrl)
    return { sent: false, verifyUrl }
  }
  if (!to) {
    console.warn('[verifyEmailEmail] No recipient email; skipping send')
    return { sent: false }
  }

  const greeting = name ? `Hi ${name},` : 'Hello,'
  const subject = 'Confirm your email — Vortex Athletics'

  const text = [
    greeting,
    '',
    'Please confirm your email address for your Vortex Athletics account.',
    '',
    `Confirm your email: ${verifyUrl}`,
    '',
    'This link expires in 7 days. If you did not create an account, you can ignore this email.',
    '',
    '— Vortex Athletics',
  ].join('\n')

  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>Please confirm your email address for your Vortex Athletics account.</p>
    <p style="margin: 28px 0;">
      <a href="${escapeHtml(verifyUrl)}"
         style="display: inline-block; background: #c41e3a; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">
        Confirm your email
      </a>
    </p>
    <p style="font-size: 14px; color: #555;">Or copy this link: <a href="${escapeHtml(verifyUrl)}">${escapeHtml(verifyUrl)}</a></p>
    <p style="color:#666;font-size:13px;">This link expires in 7 days. If you did not create an account, you can ignore this email.</p>
    <p>— Vortex Athletics</p>
  `

  await sendEmail({ to, subject, text, html })
  return { sent: true }
}
