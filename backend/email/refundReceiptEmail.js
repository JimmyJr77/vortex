import { sendEmail, isEmailConfigured } from './sendEmail.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(cents) {
  return `$${((Number(cents) || 0) / 100).toFixed(2)}`
}

export async function sendRefundReceiptEmail({
  to,
  guardianName = null,
  amountCents,
  reason = null,
  reference = null,
  billingUrl = null,
  idempotencyKey = null,
}) {
  if (!to || !isEmailConfigured()) return { sent: false }

  const greeting = guardianName ? `Hi ${guardianName},` : 'Hi,'
  const subject = `Refund issued: ${money(amountCents)} — Vortex Athletics`
  const timing = 'Most banks post refunds within 5–10 business days.'
  const details = [
    `Amount: ${money(amountCents)}`,
    reason ? `Reason: ${reason}` : null,
    reference ? `Reference: ${reference}` : null,
  ].filter(Boolean)
  const text = [
    greeting,
    '',
    `We issued a refund of ${money(amountCents)} to your original payment method.`,
    timing,
    '',
    ...details,
    billingUrl ? '' : null,
    billingUrl ? `View billing activity: ${billingUrl}` : null,
    '',
    'If you have questions, reply to this email and our team will help.',
    '',
    '— Vortex Athletics',
  ].filter((line) => line != null).join('\n')

  const rows = details.map((line) => {
    const [label, ...rest] = line.split(': ')
    return `<tr><td style="padding:6px 12px 6px 0;color:#666;">${escapeHtml(label)}</td><td><strong>${escapeHtml(rest.join(': '))}</strong></td></tr>`
  }).join('')
  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>We issued a refund of <strong>${money(amountCents)}</strong> to your original payment method.</p>
    <p style="color:#555;">${timing}</p>
    <table style="margin:12px 0;border-collapse:collapse;">${rows}</table>
    ${billingUrl ? `<p><a href="${escapeHtml(billingUrl)}">View billing activity</a></p>` : ''}
    <p>If you have questions, reply to this email and our team will help.</p>
    <p>— Vortex Athletics</p>
  `

  await sendEmail({ to, subject, text, html, category: 'refund_receipt', idempotencyKey })
  return { sent: true }
}
