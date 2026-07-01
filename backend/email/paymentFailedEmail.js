import { sendEmail, isEmailConfigured } from './sendEmail.js'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`
}

/**
 * Failed-payment / dunning notice (transactional, category `payment_receipt`).
 * Uses neutral, factual language (no promotional content) so it passes the
 * transactional guardrail.
 * @param {{
 *   to: string
 *   guardianName?: string | null
 *   amountCents: number
 *   reason?: string | null
 *   updatePaymentUrl?: string | null
 * }} params
 */
export async function sendPaymentFailedEmail({
  to,
  guardianName = null,
  amountCents,
  reason = null,
  updatePaymentUrl = null,
}) {
  if (!isEmailConfigured()) {
    console.warn('[paymentFailedEmail] SMTP not configured; skipping send')
    return { sent: false }
  }
  if (!to) return { sent: false }

  const subject = `Action needed: payment of ${money(amountCents)} could not be processed`
  const greeting = guardianName ? `Hi ${guardianName},` : 'Hi,'
  const reasonLine = reason ? `Reason provided by the processor: ${reason}.` : ''
  const actionLine = updatePaymentUrl
    ? `Please update your payment method to keep your account current: ${updatePaymentUrl}`
    : 'Please contact us or update your payment method to keep your account current.'

  const text = [
    greeting,
    '',
    `We attempted to process a payment of ${money(amountCents)} for your Vortex Athletics account, but it did not go through.`,
    reasonLine,
    '',
    actionLine,
    '',
    'If you have already resolved this, you can disregard this message.',
    '',
    '— Vortex Athletics',
  ]
    .filter((line) => line !== '')
    .join('\n')

  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>We attempted to process a payment of <strong>${money(amountCents)}</strong> for your Vortex Athletics account, but it did not go through.</p>
    ${reason ? `<p style="color:#555;">Reason provided by the processor: ${escapeHtml(reason)}.</p>` : ''}
    <p>${
      updatePaymentUrl
        ? `Please <a href="${escapeHtml(updatePaymentUrl)}">update your payment method</a> to keep your account current.`
        : 'Please contact us or update your payment method to keep your account current.'
    }</p>
    <p style="color:#777;font-size:13px;">If you have already resolved this, you can disregard this message.</p>
    <p>— Vortex Athletics</p>
  `

  await sendEmail({ to, subject, text, html, category: 'payment_receipt' })
  return { sent: true }
}
