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
 * Payment receipt email (transactional, category `payment_receipt`).
 * @param {{
 *   to: string
 *   guardianName?: string | null
 *   amountCents: number
 *   method?: string | null
 *   paidAt?: string | Date | null
 *   reference?: string | null
 *   balanceAfterCents?: number | null
 * }} params
 */
export async function sendPaymentReceiptEmail({
  to,
  guardianName = null,
  amountCents,
  method = null,
  paidAt = null,
  reference = null,
  balanceAfterCents = null,
}) {
  if (!isEmailConfigured()) {
    console.warn('[paymentReceiptEmail] SMTP not configured; skipping send')
    return { sent: false }
  }
  if (!to) return { sent: false }

  const paidDate = paidAt ? new Date(paidAt) : new Date()
  const dateStr = paidDate.toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' })
  const subject = `Payment received: ${money(amountCents)} — Vortex Athletics`
  const greeting = guardianName ? `Hi ${guardianName},` : 'Hi,'

  const detailLines = [
    `Amount: ${money(amountCents)}`,
    `Date: ${dateStr}`,
  ]
  if (method) detailLines.push(`Method: ${method}`)
  if (reference) detailLines.push(`Reference: ${reference}`)
  if (balanceAfterCents != null) detailLines.push(`Remaining balance: ${money(balanceAfterCents)}`)

  const text = [
    greeting,
    '',
    `We received your payment of ${money(amountCents)} to Vortex Athletics. Thank you!`,
    '',
    ...detailLines,
    '',
    'This is your receipt for the payment above.',
    '',
    '— Vortex Athletics',
  ].join('\n')

  const rows = detailLines
    .map((line) => {
      const [label, ...rest] = line.split(': ')
      return `<tr><td style="padding:6px 12px 6px 0;color:#666;">${escapeHtml(label)}</td><td><strong>${escapeHtml(rest.join(': '))}</strong></td></tr>`
    })
    .join('')

  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>We received your payment of <strong>${money(amountCents)}</strong> to Vortex Athletics. Thank you!</p>
    <table style="margin:12px 0;border-collapse:collapse;">${rows}</table>
    <p style="color:#555;font-size:14px;">This is your receipt for the payment above.</p>
    <p>— Vortex Athletics</p>
  `

  await sendEmail({ to, subject, text, html, category: 'payment_receipt' })
  return { sent: true }
}
