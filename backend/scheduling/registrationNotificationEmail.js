import { sendEmail } from '../email/sendEmail.js'
import { DEFAULT_ROSTER_RECIPIENT, loadRegistrationDetails } from './dailyRoster.js'

function money(value) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format((Number(value) || 0) / 100)
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function detailLabel(key) {
  return String(key).replaceAll('_', ' ').replace(/\b\w/g, (letter) => letter.toUpperCase())
}

function safeRegistrationDetails(details) {
  const excluded = new Set([
    'first_name', 'last_name', 'email', 'phone', 'password', 'signup_auth_token',
  ])
  return Object.entries(details || {})
    .filter(([key, value]) => !excluded.has(key) && value != null && value !== '' && typeof value !== 'object')
    .map(([key, value]) => ({ label: detailLabel(key), value: String(value) }))
}

export async function sendRegistrationNotification(pool, {
  signupIds,
  paidCents = null,
  to = process.env.DAILY_ROSTER_EMAIL || DEFAULT_ROSTER_RECIPIENT,
} = {}) {
  const ids = [...new Set((signupIds || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b)
  if (!ids.length) return { sent: false, skipped: true, reason: 'no_signups' }
  const registrations = await loadRegistrationDetails(pool, { signupIds: ids })
  if (!registrations.length) return { sent: false, skipped: true, reason: 'not_found' }

  const person = registrations[0]
  const totalCharged = registrations.reduce((sum, item) => sum + item.chargedCents, 0)
  const totalDiscount = registrations.reduce((sum, item) => sum + item.discountCents, 0)
  const totalRecurring = registrations.reduce((sum, item) => sum + item.recurringMonthlyCents, 0)
  const amountPaid = paidCents == null ? totalCharged : Math.max(0, Math.round(Number(paidCents) || 0))
  const additionalDetails = safeRegistrationDetails(person.details)
  const subject = `New class registration: ${person.name}`
  const classLines = registrations.map((item) =>
    `${item.className}${item.programName ? ` (${item.programName})` : ''}${item.scheduleLabel ? ` — ${item.scheduleLabel}` : ''} — ${item.status}`,
  )
  const text = [
    subject,
    '',
    `Athlete: ${person.name}`,
    `Email: ${person.email || 'Not provided'}`,
    `Phone: ${person.phone || 'Not provided'}`,
    '',
    'Classes:',
    ...classLines.map((line) => `• ${line}`),
    '',
    `Amount paid at signup: ${money(amountPaid)}`,
    ...(totalRecurring > 0 ? [`Recurring monthly amount: ${money(totalRecurring)}`] : []),
    ...(totalDiscount > 0 ? [`Discounts applied: ${money(totalDiscount)}`] : []),
    ...(additionalDetails.length ? ['', 'Registration details:', ...additionalDetails.map((item) => `• ${item.label}: ${item.value}`)] : []),
  ].join('\n')
  const html = `<h1 style="font-size:22px;margin:0 0 18px">New class registration</h1>
    <table style="border-collapse:collapse;margin-bottom:18px">
      <tr><td style="padding:4px 14px 4px 0;color:#666">Athlete</td><td><strong>${escapeHtml(person.name)}</strong></td></tr>
      <tr><td style="padding:4px 14px 4px 0;color:#666">Email</td><td>${escapeHtml(person.email || 'Not provided')}</td></tr>
      <tr><td style="padding:4px 14px 4px 0;color:#666">Phone</td><td>${escapeHtml(person.phone || 'Not provided')}</td></tr>
    </table>
    <h2 style="font-size:17px;margin:0">Classes</h2>
    <ul style="padding-left:22px">${classLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
    <table style="border-collapse:collapse;margin-top:18px">
      <tr><td style="padding:4px 14px 4px 0;color:#666">Amount paid at signup</td><td><strong>${money(amountPaid)}</strong></td></tr>
      ${totalRecurring > 0 ? `<tr><td style="padding:4px 14px 4px 0;color:#666">Recurring monthly amount</td><td><strong>${money(totalRecurring)}</strong></td></tr>` : ''}
      ${totalDiscount > 0 ? `<tr><td style="padding:4px 14px 4px 0;color:#666">Discounts applied</td><td><strong>${money(totalDiscount)}</strong></td></tr>` : ''}
    </table>
    ${additionalDetails.length ? `<h2 style="font-size:17px;margin:20px 0 6px">Registration details</h2><table style="border-collapse:collapse">${additionalDetails.map((item) => `<tr><td style="padding:4px 14px 4px 0;color:#666">${escapeHtml(item.label)}</td><td>${escapeHtml(item.value)}</td></tr>`).join('')}</table>` : ''}`

  return sendEmail({
    to,
    subject,
    text,
    html,
    category: 'registration_alert',
    templateVersion: 'registration_alert_v1',
    idempotencyKey: `registration-alert-${ids.join('-')}-${String(to).trim().toLowerCase()}`,
    // Operational alerts must not stop after the normal per-recipient transactional cap.
    skipPolicy: true,
  })
}
