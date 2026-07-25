import { sendEmail, isEmailConfigured } from './sendEmail.js'
import { emailButtonHtml, escapeHtml, preheaderHtml } from './emailHtml.js'

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`
}

export async function sendPaymentRequestEmail({
  to,
  guardianName = null,
  amountCents,
  checkoutUrl,
  expiresAt = null,
  idempotencyKey = null,
}) {
  if (!to || !checkoutUrl || !isEmailConfigured()) return { sent: false }
  const greeting = guardianName ? `Hi ${guardianName},` : 'Hi,'
  const amount = money(amountCents)
  const expiration = expiresAt
    ? new Date(expiresAt).toLocaleString('en-US', {
        month: 'long',
        day: 'numeric',
        year: 'numeric',
        hour: 'numeric',
        minute: '2-digit',
        timeZoneName: 'short',
      })
    : null
  const subject = `Secure payment link for ${amount} — Vortex Athletics`
  const text = [
    greeting,
    '',
    `Your Vortex Athletics account has an outstanding balance of ${amount}.`,
    'Use the secure Stripe checkout link below to review and submit payment.',
    '',
    `Pay securely: ${checkoutUrl}`,
    expiration ? `This link expires ${expiration}.` : '',
    '',
    'If you have already paid or believe this balance is incorrect, reply to this email before paying.',
    '',
    '— Vortex Athletics',
  ].filter(Boolean).join('\n')
  const html = `
    ${preheaderHtml(`Secure payment link for your ${amount} account balance.`)}
    <p>${escapeHtml(greeting)}</p>
    <p>Your Vortex Athletics account has an outstanding balance of <strong>${amount}</strong>.</p>
    <p>Use the secure Stripe checkout link below to review and submit payment.</p>
    ${emailButtonHtml(`Pay ${amount} securely`, checkoutUrl)}
    ${expiration ? `<p style="color:#555;font-size:14px;">This link expires ${escapeHtml(expiration)}.</p>` : ''}
    <p style="color:#555;font-size:14px;">If you have already paid or believe this balance is incorrect, reply to this email before paying.</p>
    <p>— Vortex Athletics</p>
  `
  await sendEmail({ to, subject, text, html, category: 'payment_request', idempotencyKey })
  return { sent: true }
}
