import { sendEmail } from '../email/sendEmail.js'
import { listMemberGuardianOutreachContacts, submittedGuardianContact } from '../email/memberContact.js'
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
    'parent_first_name', 'parent_last_name', 'parent_email', 'parent_phone',
  ])
  return Object.entries(details || {})
    .filter(([key, value]) => !excluded.has(key) && value != null && value !== '' && typeof value !== 'object')
    .map(([key, value]) => ({ label: detailLabel(key), value: String(value) }))
}

// A family may enroll several athletes at once. Keep each athlete's details in
// their own alert, and isolate failures from the family's receipt/welcome flow.
export async function notifyFamilyEnrollmentRegistrations(pool, receipts, {
  send = sendRegistrationNotification,
  logger = console,
} = {}) {
  const byMember = new Map()
  for (const receipt of receipts) {
    const id = Number(receipt.schedulingSignupId)
    if (!Number.isSafeInteger(id) || id <= 0) continue
    const key = receipt.memberId ?? id
    if (!byMember.has(key)) byMember.set(key, new Set())
    byMember.get(key).add(id)
  }
  for (const ids of byMember.values()) {
    try {
      const result = await send(pool, { signupIds: [...ids] })
      if (!result?.sent && result?.reason !== 'duplicate') {
        logger.warn('[signup] team registration alert not sent:', result?.reason || 'unknown')
      }
    } catch (error) {
      logger.warn('[signup] team registration alert failed:', error?.message || error)
    }
  }
}

export async function sendRegistrationNotification(pool, {
  signupIds,
  paidCents = null,
  to = process.env.DAILY_ROSTER_EMAIL || DEFAULT_ROSTER_RECIPIENT,
  send = sendEmail,
} = {}) {
  const ids = [...new Set((signupIds || []).map(Number).filter(Number.isFinite))].sort((a, b) => a - b)
  if (!ids.length) return { sent: false, skipped: true, reason: 'no_signups' }
  const registrations = await loadRegistrationDetails(pool, { signupIds: ids, includeGroupSchedule: true })
  if (!registrations.length) return { sent: false, skipped: true, reason: 'not_found' }

  const person = registrations[0]
  let guardians = await listMemberGuardianOutreachContacts(pool, person.memberId)
  if (!guardians.some((contact) => contact.email || contact.phone)) {
    const submitted = registrations.map((item) => submittedGuardianContact(item.details))
    const contact = submitted.find((item) => item.email || item.phone) || submitted.find((item) => item.name)
    if (contact) guardians = [contact]
  }
  const contactRows = [
    ['Athlete', person.name],
    ...guardians.map(({ name, email, phone }) => ['Parent or guardian', [name, email, phone].filter(Boolean).join(' · ')]),
  ]
  if (!guardians.some((contact) => contact.email || contact.phone)) {
    contactRows.push(['Registration email', person.email || 'Not provided'], ['Registration phone', person.phone || 'Not provided'])
  }
  const totalCharged = registrations.reduce((sum, item) => sum + item.chargedCents, 0)
  const totalDiscount = registrations.reduce((sum, item) => sum + item.discountCents, 0)
  const totalRecurring = registrations.reduce((sum, item) => sum + item.recurringMonthlyCents, 0)
  const amountPaid = paidCents == null ? totalCharged : Math.max(0, Math.round(Number(paidCents) || 0))
  const additionalDetails = safeRegistrationDetails(person.details)
  const subject = 'New class registration'
  const classLines = registrations.map((item) => [
    item.programName ? `${item.className} (${item.programName})` : item.className,
    item.scheduleLabel,
    item.enrollmentStartDate && `Starts ${item.enrollmentStartDate}`,
    item.status,
  ].filter(Boolean).join(' — '))
  const text = [
    subject,
    '',
    ...contactRows.map(([label, value]) => `${label}: ${value}`),
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
      ${contactRows.map(([label, value]) => `<tr><td style="padding:4px 14px 4px 0;color:#666">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`).join('')}
    </table>
    <h2 style="font-size:17px;margin:0">Classes</h2>
    <ul style="padding-left:22px">${classLines.map((line) => `<li>${escapeHtml(line)}</li>`).join('')}</ul>
    <table style="border-collapse:collapse;margin-top:18px">
      <tr><td style="padding:4px 14px 4px 0;color:#666">Amount paid at signup</td><td><strong>${money(amountPaid)}</strong></td></tr>
      ${totalRecurring > 0 ? `<tr><td style="padding:4px 14px 4px 0;color:#666">Recurring monthly amount</td><td><strong>${money(totalRecurring)}</strong></td></tr>` : ''}
      ${totalDiscount > 0 ? `<tr><td style="padding:4px 14px 4px 0;color:#666">Discounts applied</td><td><strong>${money(totalDiscount)}</strong></td></tr>` : ''}
    </table>
    ${additionalDetails.length ? `<h2 style="font-size:17px;margin:20px 0 6px">Registration details</h2><table style="border-collapse:collapse">${additionalDetails.map((item) => `<tr><td style="padding:4px 14px 4px 0;color:#666">${escapeHtml(item.label)}</td><td>${escapeHtml(item.value)}</td></tr>`).join('')}</table>` : ''}`

  return send({
    to,
    subject,
    text,
    html,
    category: 'registration_alert',
    templateVersion: 'registration_alert_v2',
    idempotencyKey: `registration-alert-${ids.join('-')}-${String(to).trim().toLowerCase()}`,
    // Operational alerts must not stop after the normal per-recipient transactional cap.
    skipPolicy: true,
  })
}
