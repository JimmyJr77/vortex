import { loadSchedulingCalendar } from './calendarQuery.js'
import { sendEmail } from '../email/sendEmail.js'

export const ROSTER_TIME_ZONE = 'America/New_York'
export const DEFAULT_ROSTER_RECIPIENT = 'team@vortexathletics.com'

function cents(value) {
  return Math.round(Number(value) || 0)
}

export function dateInTimeZone(now = new Date(), timeZone = ROSTER_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now)
  const value = Object.fromEntries(parts.map((part) => [part.type, part.value]))
  return `${value.year}-${value.month}-${value.day}`
}

export function validateRosterDate(value) {
  const date = String(value || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return null
  const parsed = new Date(`${date}T12:00:00Z`)
  return Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== date ? null : date
}

function athleteIdentity(row) {
  if (row.memberId != null) return `member:${row.memberId}`
  const email = String(row.email || '').trim().toLowerCase()
  if (email) return `email:${email}`
  return `name:${String(row.name || '').trim().toLowerCase()}`
}

export function mergeDailyEnrollmentAthletes(schedulingAthletes, dropInAthletes) {
  const byIdentity = new Map()
  for (const athlete of schedulingAthletes || []) byIdentity.set(athleteIdentity(athlete), athlete)
  // A same-day drop-in is the more specific attendance record when the member also
  // has a recurring enrollment for the class, so it wins the display row.
  for (const athlete of dropInAthletes || []) byIdentity.set(athleteIdentity(athlete), athlete)
  return [...byIdentity.values()].sort((a, b) =>
    String(a.lastName || '').localeCompare(String(b.lastName || '')) ||
    String(a.firstName || '').localeCompare(String(b.firstName || '')),
  )
}

function formatTime(value) {
  if (!value) return ''
  const [hourText, minute = '00'] = String(value).split(':')
  const hour = Number(hourText)
  if (!Number.isFinite(hour)) return String(value)
  return `${hour % 12 || 12}:${minute} ${hour >= 12 ? 'PM' : 'AM'}`
}

function displayDate(date) {
  return new Intl.DateTimeFormat('en-US', {
    timeZone: 'UTC',
    weekday: 'long',
    month: 'long',
    day: 'numeric',
    year: 'numeric',
  }).format(new Date(`${date}T12:00:00Z`))
}

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

export async function loadRegistrationDetails(pool, { signupIds = null, registeredSince = null, registrationDate = null } = {}) {
  const ids = Array.isArray(signupIds) ? signupIds.map(Number).filter(Number.isFinite) : null
  const { resolveProgramsSchema } = await import('../programs/schema.js')
  const schema = await resolveProgramsSchema(pool)
  const result = await pool.query(
    `
      SELECT
        s.id,
        s.member_id,
        s.status,
        s.created_at,
        s.responses,
        s.field_responses,
        COALESCE(NULLIF(TRIM(m.first_name), ''), NULLIF(TRIM(s.first_name), ''), '') AS first_name,
        COALESCE(NULLIF(TRIM(m.last_name), ''), NULLIF(TRIM(s.last_name), ''), '') AS last_name,
        COALESCE(NULLIF(TRIM(m.email), ''), NULLIF(TRIM(s.email), ''), '') AS email,
        COALESCE(NULLIF(TRIM(m.phone), ''), NULLIF(TRIM(s.phone), ''), '') AS phone,
        COALESCE(NULLIF(TRIM(p.display_name), ''), NULLIF(TRIM(sf.title), ''), 'Class') AS class_name,
        COALESCE(NULLIF(TRIM(pr.display_name), ''), NULLIF(TRIM(pr.name), '')) AS program_name,
        ts.schedule_mode,
        ts.specific_date,
        ts.day_of_week,
        ts.start_time,
        ts.end_time,
        COALESCE(c.amount_cents, 0)::int AS charged_cents,
        COALESCE(c.gross_amount_cents, c.amount_cents, 0)::int AS gross_cents,
        COALESCE(c.discount_amount_cents, 0)::int AS discount_cents,
        COALESCE(bs.net_monthly_cents, 0)::int AS recurring_monthly_cents
      FROM scheduling_signup s
      JOIN scheduling_form sf ON sf.id = s.form_id
      LEFT JOIN member m ON m.id = s.member_id
      LEFT JOIN program p ON p.id = sf.program_id
      LEFT JOIN ${schema.programsTable} pr ON pr.id = COALESCE(sf.programs_id, p.${schema.programFkColumn})
      LEFT JOIN scheduling_time_slot ts ON ts.id = s.time_slot_id
      LEFT JOIN billing_charge c
        ON c.source_type = 'scheduling_signup' AND c.source_id = s.id::text
      LEFT JOIN billing_subscription bs
        ON bs.source_type = 'scheduling_signup' AND bs.source_id = s.id::text AND bs.status = 'active'
      WHERE s.orphaned_at IS NULL
        AND s.archived_at IS NULL
        AND ($1::bigint[] IS NULL OR s.id = ANY($1::bigint[]))
        AND ($2::timestamptz IS NULL OR s.created_at >= $2::timestamptz)
        AND ($3::date IS NULL OR (s.created_at AT TIME ZONE '${ROSTER_TIME_ZONE}')::date = $3::date)
      ORDER BY s.created_at, s.id
    `,
    [ids, registeredSince, registrationDate],
  )

  return result.rows.map((row) => {
    const responses = row.responses && Object.keys(row.responses).length
      ? row.responses
      : row.field_responses || {}
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const scheduleDate = row.schedule_mode === 'date' && row.specific_date
      ? String(row.specific_date).slice(0, 10)
      : row.day_of_week != null
        ? dayNames[Number(row.day_of_week)]
        : null
    const scheduleTime = row.start_time
      ? `${formatTime(row.start_time)}${row.end_time ? `–${formatTime(row.end_time)}` : ''}`
      : null
    return {
      signupId: Number(row.id),
      memberId: row.member_id != null ? Number(row.member_id) : null,
      name: `${row.first_name || ''} ${row.last_name || ''}`.trim() || 'Unnamed athlete',
      email: row.email || responses.email || responses.parent_email || '',
      phone: row.phone || responses.phone || responses.parent_phone || '',
      className: row.class_name,
      programName: row.program_name || null,
      status: row.status,
      registeredAt: row.created_at,
      chargedCents: cents(row.charged_cents),
      grossCents: cents(row.gross_cents),
      discountCents: cents(row.discount_cents),
      recurringMonthlyCents: cents(row.recurring_monthly_cents),
      scheduleLabel: [scheduleDate, scheduleTime].filter(Boolean).join(' · '),
      details: responses,
    }
  })
}

export async function buildDailyRoster(pool, date = dateInTimeZone(), { registeredSince = null } = {}) {
  const rosterDate = validateRosterDate(date)
  if (!rosterDate) throw new Error('Roster date must be a valid YYYY-MM-DD date')

  const calendar = await loadSchedulingCalendar(pool, {
    startDate: rosterDate,
    endDate: rosterDate,
    formActive: 'active',
  })
  const events = calendar.events.filter(
    (event) => event.formActive && event.classActive && event.slotGroupActive && event.slotActive,
  )
  const groupIds = [...new Set(events.map((event) => event.slotGroupId))]
  const signups = groupIds.length
    ? await pool.query(
        `
          SELECT
            s.id,
            s.form_id,
            s.slot_group_id,
            s.time_slot_id,
            s.member_id,
            COALESCE(NULLIF(TRIM(m.first_name), ''), NULLIF(TRIM(s.first_name), ''), '') AS first_name,
            COALESCE(NULLIF(TRIM(m.last_name), ''), NULLIF(TRIM(s.last_name), ''), '') AS last_name
            ,COALESCE(NULLIF(TRIM(m.email), ''), NULLIF(TRIM(s.email), ''), '') AS email
            ,COALESCE(NULLIF(TRIM(m.phone), ''), NULLIF(TRIM(s.phone), ''), '') AS phone
            ,CASE
               WHEN one_time.id IS NOT NULL THEN 'one_time'
               WHEN sg.offering_id IS NOT NULL THEN 'temporary_block'
               ELSE 'monthly'
             END AS enrollment_type
            ,CASE WHEN one_time.id IS NOT NULL THEN 'one_time' ELSE 'recurring' END AS billing_type
            ,COALESCE(one_time.amount_cents, 0)::int AS amount_cents
          FROM scheduling_signup s
          LEFT JOIN member m ON m.id = s.member_id
          LEFT JOIN scheduling_slot_group sg ON sg.id = s.slot_group_id
          LEFT JOIN LATERAL (
            SELECT c.id, c.amount_cents
              FROM billing_charge c
             WHERE c.source_type = 'scheduling_signup'
               AND c.source_id = s.id::text
               AND c.billing_interval = 'one_time'
             ORDER BY c.id DESC LIMIT 1
          ) one_time ON TRUE
          WHERE s.slot_group_id = ANY($1::bigint[])
            AND s.status = 'confirmed'
            AND s.orphaned_at IS NULL
            AND s.archived_at IS NULL
            AND (s.cancel_effective_date IS NULL OR s.cancel_effective_date > $2::date)
          ORDER BY last_name, first_name, s.id
        `,
        [groupIds, rosterDate],
      )
    : { rows: [] }

  const dropIns = groupIds.length
    ? await pool.query(
        `SELECT d.id, d.form_id, d.slot_group_id, d.member_id,
                d.first_name, d.last_name, d.email, d.phone, d.status,
                d.amount_cents, d.benefit_type
           FROM drop_in_registration d
          WHERE d.slot_group_id = ANY($1::bigint[])
            AND d.class_date = $2::date
            AND d.status IN ('confirmed', 'attended')
          ORDER BY d.last_name, d.first_name, d.id`,
        [groupIds, rosterDate],
      )
    : { rows: [] }

  const classes = events.map((event) => {
    const schedulingAthletes = signups.rows
      .filter(
        (signup) =>
          Number(signup.form_id) === event.formId &&
          Number(signup.slot_group_id) === event.slotGroupId &&
          (signup.time_slot_id == null || Number(signup.time_slot_id) === event.timeSlotId),
      )
      .map((signup) => ({
        signupId: Number(signup.id),
        source: 'scheduling',
        memberId: signup.member_id != null ? Number(signup.member_id) : null,
        firstName: signup.first_name || '',
        lastName: signup.last_name || '',
        name: `${signup.first_name || ''} ${signup.last_name || ''}`.trim() || 'Unnamed athlete',
        email: signup.email || '',
        phone: signup.phone || '',
        status: 'confirmed',
        enrollmentType: signup.enrollment_type,
        billingType: signup.billing_type,
        amountCents: Number(signup.amount_cents || 0),
        benefitType: null,
      }))

    const dropInAthletes = dropIns.rows
      .filter((dropIn) =>
        Number(dropIn.form_id) === event.formId && Number(dropIn.slot_group_id) === event.slotGroupId,
      )
      .map((dropIn) => ({
        signupId: Number(dropIn.id),
        source: 'drop_in',
        memberId: dropIn.member_id != null ? Number(dropIn.member_id) : null,
        firstName: dropIn.first_name || '',
        lastName: dropIn.last_name || '',
        name: `${dropIn.first_name || ''} ${dropIn.last_name || ''}`.trim() || 'Unnamed athlete',
        email: dropIn.email || '',
        phone: dropIn.phone || '',
        status: dropIn.status,
        enrollmentType: 'drop_in',
        billingType: 'one_time',
        amountCents: Number(dropIn.amount_cents || 0),
        benefitType: dropIn.benefit_type || null,
      }))
    const athletes = mergeDailyEnrollmentAthletes(schedulingAthletes, dropInAthletes)

    return {
      eventId: event.id,
      formId: event.formId,
      slotGroupId: event.slotGroupId,
      timeSlotId: event.timeSlotId,
      programName: event.programName,
      className: event.className,
      offeringLabel: event.offeringLabel,
      startTime: event.startTime,
      endTime: event.endTime,
      timeLabel: `${formatTime(event.startTime)}–${formatTime(event.endTime)}`,
      athletes,
      athleteCount: athletes.length,
    }
  })

  const newRegistrations = await loadRegistrationDetails(pool, registeredSince
    ? { registeredSince }
    : { registrationDate: rosterDate })

  return {
    date: rosterDate,
    dateLabel: displayDate(rosterDate),
    timeZone: ROSTER_TIME_ZONE,
    classes,
    classCount: classes.length,
    athleteCount: classes.reduce((total, item) => total + item.athleteCount, 0),
    newRegistrations,
    newRegistrationCount: newRegistrations.length,
  }
}

export function renderDailyRosterEmail(roster) {
  const subject = `Daily roster — ${roster.dateLabel}`
  const textLines = [
    subject,
    `${roster.classCount} classes · ${roster.athleteCount} enrollments`,
    '',
  ]
  textLines.push(`New registrations: ${roster.newRegistrationCount || 0}`, '')
  for (const registration of roster.newRegistrations || []) {
    textLines.push(`• ${registration.name} — ${registration.className} (${registration.status})`)
  }
  if (!(roster.newRegistrations || []).length) textLines.push('No new registrations.')
  textLines.push('')

  const newRegistrationsHtml = (roster.newRegistrations || []).length
    ? `<ul style="margin:10px 0 22px;padding-left:22px">${roster.newRegistrations.map((registration) => `<li style="padding:3px 0"><strong>${escapeHtml(registration.name)}</strong> — ${escapeHtml(registration.className)} (${escapeHtml(registration.status)})</li>`).join('')}</ul>`
    : '<p style="margin:8px 0 22px;color:#6b7280">No new registrations.</p>'
  const sections = roster.classes.map((item) => {
    const heading = [item.startTime ? item.timeLabel : null, item.className, item.programName]
      .filter(Boolean)
      .join(' · ')
    textLines.push(heading, `${item.athleteCount} enrolled`)
    if (item.athletes.length) item.athletes.forEach((athlete, index) => textLines.push(`${index + 1}. ${athlete.name}`))
    else textLines.push('No enrolled athletes')
    textLines.push('')

    const athletesHtml = item.athletes.length
      ? `<ol style="margin:10px 0 0;padding-left:22px">${item.athletes.map((athlete) => `<li style="padding:2px 0">${escapeHtml(athlete.name)}</li>`).join('')}</ol>`
      : '<p style="margin:10px 0 0;color:#6b7280">No enrolled athletes</p>'
    return `<section style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 14px">
      <h2 style="font-size:17px;margin:0;color:#111827">${escapeHtml(heading)}</h2>
      <p style="margin:5px 0 0;color:#4b5563">${item.athleteCount} enrolled</p>
      ${athletesHtml}
    </section>`
  })

  if (!roster.classes.length) textLines.push('No classes are scheduled for this date.')
  return {
    subject,
    text: textLines.join('\n').trim(),
    html: `<h1 style="font-size:24px;margin:0 0 6px">Daily roster</h1>
      <p style="margin:0 0 22px;color:#4b5563">${escapeHtml(roster.dateLabel)} · ${roster.classCount} classes · ${roster.athleteCount} enrollments</p>
      <h2 style="font-size:18px;margin:0">New registrations (${roster.newRegistrationCount || 0})</h2>
      ${newRegistrationsHtml}
      ${sections.join('') || '<p>No classes are scheduled for this date.</p>'}`,
  }
}

export async function emailDailyRoster(pool, {
  date = dateInTimeZone(),
  to = process.env.DAILY_ROSTER_EMAIL || DEFAULT_ROSTER_RECIPIENT,
} = {}) {
  const roster = await buildDailyRoster(pool, date, {
    registeredSince: new Date(Date.now() - 24 * 60 * 60 * 1000),
  })
  const message = renderDailyRosterEmail(roster)
  const delivery = await sendEmail({
    to,
    ...message,
    category: 'daily_roster',
    templateVersion: 'daily_roster_v1',
    idempotencyKey: `daily-roster-${roster.date}-${String(to).trim().toLowerCase()}`,
  })
  return { roster, delivery, recipient: to }
}
