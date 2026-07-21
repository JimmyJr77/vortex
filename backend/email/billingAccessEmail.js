import { sendEmail, isEmailConfigured } from './sendEmail.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export async function sendBillingAccessEmail({ to, action, reason, billingUrl, idempotencyKey }) {
  if (!to || !isEmailConfigured()) return { sent: false, skipped: true }
  const suspended = action === 'suspend'
  const subject = suspended
    ? 'Vortex account access paused after unsuccessful payment recovery'
    : 'Vortex account access restored'
  const summary = suspended
    ? 'Your affected Vortex enrollments have been paused after the payment recovery period ended.'
    : 'Your affected Vortex enrollments have been restored.'
  const actionText = suspended
    ? 'Please update your payment method or contact our billing team for assistance.'
    : 'No further action is required unless a balance remains on your account.'
  const text = [summary, '', `Reason: ${reason}`, '', actionText, billingUrl ? `Billing: ${billingUrl}` : '', '', '— Vortex Athletics']
    .filter(Boolean)
    .join('\n')
  const html = `
    <p>${escapeHtml(summary)}</p>
    <p><strong>Reason:</strong> ${escapeHtml(reason)}</p>
    <p>${escapeHtml(actionText)}</p>
    ${billingUrl ? `<p><a href="${escapeHtml(billingUrl)}">Open your Vortex billing account</a></p>` : ''}
    <p>— Vortex Athletics</p>
  `
  return sendEmail({ to, subject, text, html, category: 'billing_access', idempotencyKey, skipPolicy: true })
}
