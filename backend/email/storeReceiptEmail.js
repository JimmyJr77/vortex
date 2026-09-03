import { isEmailConfigured, sendEmail } from './sendEmail.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function money(cents) {
  return `$${(Math.max(0, Number(cents) || 0) / 100).toFixed(2)}`
}

/** Send the pickup receipt for a confirmed store order. */
export async function sendStoreOrderReceiptEmail({
  to,
  purchaserName = null,
  orderNumber,
  items = [],
  subtotalCents,
  discountCents = 0,
  totalCents,
  paymentMethod,
  pickupNote = 'Pickup at Vortex Athletics.',
  idempotencyKey = null,
}) {
  if (!to || !isEmailConfigured()) return { sent: false, skipped: true }

  const paymentLabel = paymentMethod === 'billing_account'
    ? 'Billed to your monthly account'
    : paymentMethod === 'mobile'
      ? 'Mobile payment'
      : `${String(paymentMethod || 'payment').replace(/^./, (letter) => letter.toUpperCase())} payment`
  const lineText = items.map((item) => `${item.quantity} × ${item.productName} — ${money(item.lineTotalCents)}`)
  const lineRows = items.map((item) => `
    <tr>
      <td style="padding:8px 16px 8px 0;">${escapeHtml(`${item.quantity} × ${item.productName}`)}</td>
      <td style="padding:8px 0;text-align:right;"><strong>${money(item.lineTotalCents)}</strong></td>
    </tr>
  `).join('')
  const discountRow = Number(discountCents) > 0
    ? `<tr><td style="padding:6px 16px 6px 0;color:#666;">Discount</td><td style="padding:6px 0;text-align:right;">−${money(discountCents)}</td></tr>`
    : ''
  const greeting = purchaserName ? `Hi ${purchaserName},` : 'Hi,'
  const subject = `Store receipt ${orderNumber} — Vortex Athletics`
  const text = [
    greeting,
    '',
    `Thanks for your Vortex store order (${orderNumber}).`,
    '',
    ...lineText,
    '',
    `Subtotal: ${money(subtotalCents)}`,
    ...(Number(discountCents) > 0 ? [`Discount: −${money(discountCents)}`] : []),
    `Total: ${money(totalCents)}`,
    `Payment: ${paymentLabel}`,
    '',
    pickupNote,
    'We do not ship store items. Please pick up your order at the gym.',
    '',
    '— Vortex Athletics',
  ].join('\n')
  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>Thanks for your Vortex store order <strong>${escapeHtml(orderNumber)}</strong>.</p>
    <table style="width:100%;max-width:560px;border-collapse:collapse;margin:16px 0;">${lineRows}</table>
    <table style="width:100%;max-width:560px;border-collapse:collapse;margin:8px 0 18px;">
      <tr><td style="padding:6px 16px 6px 0;color:#666;">Subtotal</td><td style="padding:6px 0;text-align:right;">${money(subtotalCents)}</td></tr>
      ${discountRow}
      <tr><td style="padding:8px 16px 0 0;font-size:16px;"><strong>Total</strong></td><td style="padding:8px 0 0;text-align:right;font-size:16px;"><strong>${money(totalCents)}</strong></td></tr>
    </table>
    <p><strong>Payment:</strong> ${escapeHtml(paymentLabel)}</p>
    <p><strong>Pickup:</strong> ${escapeHtml(pickupNote)}<br/>We do not ship store items.</p>
    <p>— Vortex Athletics</p>
  `

  await sendEmail({
    to,
    subject,
    text,
    html,
    category: 'payment_receipt',
    idempotencyKey,
  })
  return { sent: true }
}
