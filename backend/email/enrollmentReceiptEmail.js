import { sendEmail, isEmailConfigured } from './sendEmail.js'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

/**
 * @param {{
 *   to: string
 *   athleteName: string
 *   programName: string
 *   slotLabel?: string
 *   status?: string
 *   selectedDays?: string[]
 *   receiptUrl: string
 *   guardianName?: string | null
 * }} params
 */
export async function sendEnrollmentReceiptEmail({
  to,
  athleteName,
  programName,
  slotLabel = '',
  status = 'confirmed',
  selectedDays = [],
  receiptUrl,
  guardianName = null,
}) {
  if (!isEmailConfigured()) {
    console.warn('[enrollmentReceiptEmail] SMTP not configured; receipt URL:', receiptUrl)
    return { sent: false, receiptUrl }
  }
  if (!to) {
    console.warn('[enrollmentReceiptEmail] No recipient email; skipping send')
    return { sent: false }
  }

  const name = athleteName || 'Your athlete'
  const program = programName || 'a Vortex Athletics class'
  const isWaitlisted = status === 'waitlisted'
  const subject = isWaitlisted
    ? `Waitlist registration: ${name} — ${program}`
    : `Registration confirmed: ${name} — ${program}`

  const greeting = guardianName ? `Hi ${guardianName},` : 'Hi,'
  const days = Array.isArray(selectedDays) ? selectedDays.filter(Boolean) : []
  const detailLines = []
  if (slotLabel) detailLines.push(`Schedule: ${slotLabel}`)
  if (days.length) detailLines.push(`Days: ${days.join(', ')}`)
  detailLines.push(`Status: ${isWaitlisted ? 'Waitlisted' : 'Confirmed'}`)

  const text = [
    greeting,
    '',
    isWaitlisted
      ? `${name} has been added to the waitlist for ${program} at Vortex Athletics.`
      : `${name} is registered for ${program} at Vortex Athletics.`,
    '',
    ...detailLines,
    '',
    `View your registration receipt: ${receiptUrl}`,
    '',
    'If this registration was not authorized, please contact us immediately.',
    '',
    '— Vortex Athletics',
  ].join('\n')

  const detailHtml = detailLines.length
    ? `<ul style="margin:12px 0;padding-left:18px;color:#333;">${detailLines
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('')}</ul>`
    : ''

  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>${
      isWaitlisted
        ? `<strong>${escapeHtml(name)}</strong> has been added to the waitlist for <strong>${escapeHtml(program)}</strong>.`
        : `<strong>${escapeHtml(name)}</strong> is registered for <strong>${escapeHtml(program)}</strong> at Vortex Athletics.`
    }</p>
    ${detailHtml}
    <p style="margin: 28px 0;">
      <a href="${escapeHtml(receiptUrl)}"
         style="display: inline-block; background: #c41e3a; color: #fff; padding: 14px 28px; text-decoration: none; border-radius: 8px; font-weight: bold;">
        View registration receipt
      </a>
    </p>
    <p style="font-size: 14px; color: #555;">Or copy this link: <a href="${escapeHtml(receiptUrl)}">${escapeHtml(receiptUrl)}</a></p>
    <p style="color:#555;font-size:14px;">If this registration was not authorized, please contact us immediately.</p>
    <p>— Vortex Athletics</p>
  `

  await sendEmail({ to, subject, text, html })
  return { sent: true }
}
