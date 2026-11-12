import { sendEmail } from '../email/sendEmail.js'
import { findPromotionalContent } from '../email/emailCategories.js'
import { listMemberGuardianOutreachContacts } from '../email/memberContact.js'
import { DEFAULT_ROSTER_RECIPIENT } from './dailyRoster.js'
import { formatDateOnly } from './slotActiveDates.js'

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

function money(cents) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' })
    .format((Number(cents) || 0) / 100)
}

function dateLabel(value) {
  const date = formatDateOnly(value)
  if (!date) return ''
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`))
}

function timeLabel(value) {
  if (!value) return ''
  const [hourText, minute = '00'] = String(value).split(':')
  const hour = Number(hourText)
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`
}

function benefitLabel(value) {
  return ({
    free_trial: 'Free trial', annual_credit: 'Annual member credit',
    admin_credit: 'Admin credit', free_pass: 'Free pass', promo_code: 'Registration code',
    paid: 'Paid',
  })[value] ?? String(value || 'Paid')
}

export async function loadDropInNotificationDetails(pool, dropInId) {
  const result = await pool.query(
    `SELECT d.id, d.member_id, d.first_name, d.last_name, d.email, d.phone,
            d.class_date::text AS class_date, d.status, d.benefit_type, d.promo_code,
            d.base_price_cents, d.discount_percent, d.amount_cents,
            d.member_confirmation_email_sent_at, d.team_notification_email_sent_at,
            COALESCE(NULLIF(TRIM(p.display_name), ''), NULLIF(TRIM(sf.title), ''), 'Class') AS class_name,
            COALESCE(NULLIF(TRIM(top.display_name), ''), NULLIF(TRIM(top.name), '')) AS program_name,
            occurrence.start_time, occurrence.end_time
       FROM drop_in_registration d
       JOIN scheduling_form sf ON sf.id = d.form_id
       LEFT JOIN program p ON p.id = sf.program_id
       LEFT JOIN programs top ON top.id = COALESCE(sf.programs_id, p.programs_id)
       LEFT JOIN LATERAL (
         SELECT ts.start_time, ts.end_time
           FROM scheduling_time_slot ts
          WHERE ts.slot_group_id = d.slot_group_id
            AND (
              ts.specific_date = d.class_date
              OR (ts.specific_date IS NULL AND ts.day_of_week = EXTRACT(DOW FROM d.class_date)::int)
            )
          ORDER BY ts.is_active DESC NULLS LAST, (ts.specific_date IS NOT NULL) DESC, ts.start_time
          LIMIT 1
       ) occurrence ON TRUE
      WHERE d.id = $1`,
    [dropInId],
  )
  return result.rows[0] ?? null
}

function teamContactDetails(row, guardians) {
  const details = guardians.flatMap((guardian) => [
    ['Parent or guardian', guardian.name || 'Not provided'],
    ...(guardian.email ? [['Parent or guardian email', guardian.email]] : []),
    ...(guardian.phone ? [['Parent or guardian phone', guardian.phone]] : []),
  ])
  if (!guardians.some((guardian) => guardian.email)) details.push(['Booking email', row.email || 'Not provided'])
  if (!guardians.some((guardian) => guardian.phone)) details.push(['Booking phone', row.phone || 'Not provided'])
  return details
}

function messageParts(row, audience, guardians = []) {
  const athlete = `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Member'
  const schedule = [dateLabel(row.class_date), row.start_time ? `${timeLabel(row.start_time)}${row.end_time ? `–${timeLabel(row.end_time)}` : ''}` : '']
    .filter(Boolean).join(' · ')
  const classLabel = [row.class_name, row.program_name ? `(${row.program_name})` : ''].filter(Boolean).join(' ')
  const benefit = benefitLabel(row.benefit_type)
  const subject = audience === 'team'
    ? `New single-day enrollment: ${row.class_name}`
    : `Single-day enrollment confirmed: ${athlete} — ${row.class_name}`
  const intro = audience === 'team'
    ? 'A single-day enrollment has been accepted.'
    : `${athlete} is confirmed for a single-day class at Vortex Athletics.`
  const appliedCode = row.promo_code && !findPromotionalContent(row.promo_code).length ? row.promo_code : null
  const details = [
    ['Athlete', athlete], ['Class', classLabel], ['Date and time', schedule],
    ['Status', 'Confirmed'], ['Enrollment type', 'Single-day'], ['Benefit', benefit],
    ['Amount', money(row.amount_cents)],
    ...(appliedCode ? [['Applied code', appliedCode]] : []),
    ...(audience === 'team' ? teamContactDetails(row, guardians) : []),
  ]
  return {
    subject,
    text: [subject, '', intro, '', ...details.map(([label, value]) => `${label}: ${value}`), '', '— Vortex Athletics'].join('\n'),
    html: `<h1 style="font-size:22px;margin:0 0 16px">${escapeHtml(subject)}</h1><p>${escapeHtml(intro)}</p><table style="border-collapse:collapse">${details.map(([label, value]) => `<tr><td style="padding:4px 16px 4px 0;color:#666">${escapeHtml(label)}</td><td><strong>${escapeHtml(value)}</strong></td></tr>`).join('')}</table>`,
  }
}

async function wasAccepted(pool, delivery, idempotencyKey) {
  if (delivery?.sent === true) return true
  if (delivery?.reason !== 'duplicate') return false
  const result = await pool.query(
    `SELECT 1 FROM email_delivery WHERE idempotency_key = $1 AND accepted_at IS NOT NULL`,
    [idempotencyKey],
  )
  return result.rows.length > 0
}

export async function sendDropInConfirmationNotifications(pool, dropInId, {
  teamEmail = process.env.DAILY_ROSTER_EMAIL || DEFAULT_ROSTER_RECIPIENT,
  send = sendEmail,
} = {}) {
  const row = await loadDropInNotificationDetails(pool, dropInId)
  if (!row || row.status !== 'confirmed') return { memberSent: false, teamSent: false, skipped: true }

  let memberSent = Boolean(row.member_confirmation_email_sent_at)
  let teamSent = Boolean(row.team_notification_email_sent_at)
  const failures = []

  if (!memberSent && row.email) {
    try {
      const idempotencyKey = `drop-in-member-confirmation-${row.id}`
      const delivery = await send({
        to: row.email,
        ...messageParts(row, 'member'),
        category: 'enrollment_receipt',
        templateVersion: 'drop_in_confirmation_v1',
        idempotencyKey,
      })
      if (await wasAccepted(pool, delivery, idempotencyKey)) {
        await pool.query(
          'UPDATE drop_in_registration SET member_confirmation_email_sent_at = now() WHERE id = $1',
          [row.id],
        )
        memberSent = true
      }
    } catch (error) {
      failures.push(error)
    }
  }

  if (!teamSent) {
    try {
      const guardians = await listMemberGuardianOutreachContacts(pool, row.member_id)
      const idempotencyKey = `drop-in-team-notification-${row.id}-${String(teamEmail).trim().toLowerCase()}`
      const delivery = await send({
        to: teamEmail,
        ...messageParts(row, 'team', guardians),
        category: 'registration_alert',
        templateVersion: 'drop_in_registration_alert_v2',
        idempotencyKey,
        skipPolicy: true,
      })
      if (await wasAccepted(pool, delivery, idempotencyKey)) {
        await pool.query(
          'UPDATE drop_in_registration SET team_notification_email_sent_at = now() WHERE id = $1',
          [row.id],
        )
        teamSent = true
      }
    } catch (error) {
      failures.push(error)
    }
  }

  if (failures.length === 1) throw failures[0]
  if (failures.length > 1) {
    throw new AggregateError(failures, failures.map((error) => error?.message || String(error)).join(' | '))
  }
  return { memberSent, teamSent, skipped: false }
}
