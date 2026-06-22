import { sendEmail, isEmailConfigured } from './sendEmail.js'

function escapeHtml(str) {
  return String(str ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

function formatTime(value) {
  if (!value) return ''
  const m = String(value).match(/^(\d{1,2}):(\d{2})/)
  if (!m) return String(value)
  let hour = Number(m[1])
  const minute = m[2]
  const period = hour >= 12 ? 'PM' : 'AM'
  hour = hour % 12 || 12
  return `${hour}:${minute} ${period}`
}

/**
 * Confirmation that an athlete has been enrolled in a program/class.
 *
 * @param {{
 *   to: string
 *   athleteName: string
 *   programName: string
 *   selectedDays?: string[]
 *   startTime?: string | null
 *   endTime?: string | null
 * }} params
 */
export async function sendEnrollmentConfirmedEmail({
  to,
  athleteName,
  programName,
  selectedDays = [],
  startTime,
  endTime,
}) {
  const name = athleteName || 'Your athlete'
  const program = programName || 'a Vortex Athletics program'
  const days = Array.isArray(selectedDays) ? selectedDays.filter(Boolean) : []
  const timeRange = startTime ? `${formatTime(startTime)}${endTime ? ` – ${formatTime(endTime)}` : ''}` : ''

  const detailLines = []
  if (days.length) detailLines.push(`Days: ${days.join(', ')}`)
  if (timeRange) detailLines.push(`Time: ${timeRange}`)

  const subject = `Enrollment confirmed: ${name} in ${program}`

  const text = [
    'Hi,',
    '',
    `${name} is now enrolled in ${program} at Vortex Athletics.`,
    ...(detailLines.length ? ['', ...detailLines] : []),
    '',
    'If any required waivers are outstanding, you will receive a separate email to complete them.',
    '',
    '— Vortex Athletics',
  ].join('\n')

  const detailHtml = detailLines.length
    ? `<ul style="margin:12px 0;padding-left:18px;color:#333;">${detailLines
        .map((line) => `<li>${escapeHtml(line)}</li>`)
        .join('')}</ul>`
    : ''

  const html = `
    <p>Hi,</p>
    <p><strong>${escapeHtml(name)}</strong> is now enrolled in <strong>${escapeHtml(program)}</strong> at Vortex Athletics.</p>
    ${detailHtml}
    <p style="color:#555;font-size:14px;">If any required waivers are outstanding, you will receive a separate email to complete them.</p>
    <p>— Vortex Athletics</p>
  `

  if (!isEmailConfigured()) {
    console.warn('[enrollmentConfirmedEmail] SMTP not configured; skipping send to', to)
    return { sent: false }
  }
  if (!to) {
    console.warn('[enrollmentConfirmedEmail] No recipient email; skipping send')
    return { sent: false }
  }

  await sendEmail({ to, subject, text, html })
  return { sent: true }
}

/**
 * Summary email after a full family signup completes.
 *
 * @param {{
 *   to: string
 *   primaryName?: string
 *   athleteNames?: string[]
 *   enrollmentCount?: number
 * }} params
 */
export async function sendFamilySignupSummaryEmail({
  to,
  primaryName,
  athleteNames = [],
  enrollmentCount = 0,
}) {
  if (!isEmailConfigured()) {
    console.warn('[familySignupSummaryEmail] SMTP not configured; skipping send to', to)
    return { sent: false }
  }
  if (!to) {
    console.warn('[familySignupSummaryEmail] No recipient email; skipping send')
    return { sent: false }
  }

  const greeting = primaryName ? `Hi ${primaryName},` : 'Hi,'
  const names = Array.isArray(athleteNames) ? athleteNames.filter(Boolean) : []
  const subject = 'Welcome to Vortex Athletics — your account is set up'

  const text = [
    greeting,
    '',
    'Thanks for signing up with Vortex Athletics. Your family account has been created' +
      (names.length ? ` for: ${names.join(', ')}.` : '.'),
    enrollmentCount > 0
      ? `We recorded ${enrollmentCount} enrollment${enrollmentCount === 1 ? '' : 's'}.`
      : '',
    '',
    'You can log in any time from the Member Portal to manage enrollments and view schedules.',
    '',
    '— Vortex Athletics',
  ]
    .filter((line) => line !== '')
    .join('\n')

  const membersHtml = names.length
    ? `<ul style="margin:12px 0;padding-left:18px;color:#333;">${names
        .map((n) => `<li>${escapeHtml(n)}</li>`)
        .join('')}</ul>`
    : ''

  const html = `
    <p>${escapeHtml(greeting)}</p>
    <p>Thanks for signing up with <strong>Vortex Athletics</strong>. Your family account has been created${
      names.length ? ' for:' : '.'
    }</p>
    ${membersHtml}
    ${
      enrollmentCount > 0
        ? `<p>We recorded <strong>${enrollmentCount}</strong> enrollment${enrollmentCount === 1 ? '' : 's'}.</p>`
        : ''
    }
    <p style="color:#555;font-size:14px;">You can log in any time from the Member Portal to manage enrollments and view schedules.</p>
    <p>— Vortex Athletics</p>
  `

  await sendEmail({ to, subject, text, html })
  return { sent: true }
}
