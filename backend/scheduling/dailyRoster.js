import { loadSchedulingCalendar } from './calendarQuery.js'
import { sendEmail } from '../email/sendEmail.js'
import { listMemberGuardianOutreachContacts, submittedGuardianContact } from '../email/memberContact.js'
import { formatDateOnly, loadGroupDisplayLabels } from './slotDisplayLabel.js'
import { loadDailyReportActivity } from './dailyReportActivity.js'
import { loadDailyReportInquiries } from './dailyReportInquiries.js'
import { loadDailyReportUnpaid } from './dailyReportBilling.js'

export const ROSTER_TIME_ZONE = 'America/New_York'
export const DEFAULT_ROSTER_RECIPIENT = 'team@vortexathletics.com'
const DAY_MS = 24 * 60 * 60 * 1000

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

function ageOnDate(birthDate, date) {
  const dob = validateRosterDate(birthDate)
  if (!dob || dob > date) return null
  return Number(date.slice(0, 4)) - Number(dob.slice(0, 4))
    - (date.slice(5) < dob.slice(5) ? 1 : 0)
}

export async function loadRegistrationDetails(pool, {
  signupIds = null, registeredSince = null, registrationDate = null, registeredThrough = null,
  includeGroupSchedule = false, ageAsOf = null,
} = {}) {
  const ids = Array.isArray(signupIds) ? signupIds.map(Number).filter(Number.isFinite) : null
  const { resolveProgramsSchema } = await import('../programs/schema.js')
  const schema = await resolveProgramsSchema(pool)
  // Existing invitation holds are promoted in place. Initial charge creation can
  // identify a recently completed checkout even when the hold itself is older.
  const registeredAtSql = registeredThrough
    ? 'CASE WHEN s.account_invite_id IS NOT NULL THEN COALESCE(c.created_at, s.created_at) ELSE s.created_at END'
    : 's.created_at'
  const result = await pool.query(
    `
      SELECT
        s.id,
        s.member_id,
        s.slot_group_id,
        s.status,
        ${registeredAtSql} AS registered_at,
        s.enrollment_start_date::text AS enrollment_start_date,
        m.date_of_birth::text AS date_of_birth,
        s.responses,
        s.field_responses,
        COALESCE(NULLIF(TRIM(m.first_name), ''), NULLIF(TRIM(s.first_name), ''), '') AS first_name,
        COALESCE(NULLIF(TRIM(m.last_name), ''), NULLIF(TRIM(s.last_name), ''), '') AS last_name,
        COALESCE(NULLIF(TRIM(m.email), ''), NULLIF(TRIM(s.email), ''), '') AS email,
        COALESCE(NULLIF(TRIM(m.phone), ''), NULLIF(TRIM(s.phone), ''), '') AS phone,
        COALESCE(NULLIF(TRIM(p.display_name), ''), NULLIF(TRIM(sf.title), ''), 'Class') AS class_name,
        COALESCE(NULLIF(TRIM(pr.display_name), ''), NULLIF(TRIM(pr.name), '')) AS program_name,
        ts.schedule_mode,
        ts.specific_date::text AS specific_date,
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
        AND ($2::timestamptz IS NULL OR (${registeredAtSql}) >= $2::timestamptz)
        AND ($3::date IS NULL OR (s.created_at AT TIME ZONE '${ROSTER_TIME_ZONE}')::date = $3::date)
        AND ($4::timestamptz IS NULL OR (${registeredAtSql}) < $4::timestamptz)
      ORDER BY registered_at, s.id
    `,
    [ids, registeredSince, registrationDate, registeredThrough],
  )

  const groupLabels = includeGroupSchedule
    ? (await loadGroupDisplayLabels(pool, result.rows.map((row) => row.slot_group_id), { activeOnly: true })).labels
    : new Map()

  return result.rows.map((row) => {
    const responses = row.responses && Object.keys(row.responses).length
      ? row.responses
      : row.field_responses || {}
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']
    const scheduleDate = row.schedule_mode === 'date' && row.specific_date
      ? formatDateOnly(row.specific_date)
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
      registeredAt: row.registered_at,
      enrollmentStartDate: formatDateOnly(row.enrollment_start_date),
      ...(ageAsOf ? { age: ageOnDate(row.date_of_birth || responses.date_of_birth, ageAsOf) } : {}),
      chargedCents: cents(row.charged_cents),
      grossCents: cents(row.gross_cents),
      discountCents: cents(row.discount_cents),
      recurringMonthlyCents: cents(row.recurring_monthly_cents),
      scheduleLabel: groupLabels.get(Number(row.slot_group_id)) || [scheduleDate, scheduleTime].filter(Boolean).join(' · '),
      details: responses,
    }
  })
}

export async function buildDailyRoster(pool, date = dateInTimeZone(), {
  registeredSince = null,
  registeredThrough = null,
  includeNewRegistrations = true,
} = {}) {
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
            COALESCE(NULLIF(TRIM(m.last_name), ''), NULLIF(TRIM(s.last_name), ''), '') AS last_name,
            CASE
              WHEN m.date_of_birth IS NULL THEN NULL
              ELSE EXTRACT(YEAR FROM AGE($2::date, m.date_of_birth))::int
            END AS age,
            COALESCE(NULLIF(TRIM(m.email), ''), NULLIF(TRIM(s.email), ''), '') AS email,
            COALESCE(NULLIF(TRIM(m.phone), ''), NULLIF(TRIM(s.phone), ''), '') AS phone,
            CASE
               WHEN one_time.id IS NOT NULL THEN 'one_time'
               WHEN sg.offering_id IS NOT NULL THEN 'temporary_block'
               ELSE 'monthly'
             END AS enrollment_type,
            CASE WHEN one_time.id IS NOT NULL THEN 'one_time' ELSE 'recurring' END AS billing_type,
            COALESCE(one_time.amount_cents, 0)::int AS amount_cents
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
            AND s.enrollment_start_date <= $2::date
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
                d.amount_cents, d.benefit_type,
                CASE
                  WHEN m.date_of_birth IS NULL THEN NULL
                  ELSE EXTRACT(YEAR FROM AGE($2::date, m.date_of_birth))::int
                END AS age
           FROM drop_in_registration d
           LEFT JOIN member m ON m.id = d.member_id
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
        age: signup.age != null ? Number(signup.age) : null,
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
        age: dropIn.age != null ? Number(dropIn.age) : null,
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

  const newRegistrations = includeNewRegistrations
    ? await loadRegistrationDetails(pool, registeredSince
      ? {
          registeredSince,
          registeredThrough,
          includeGroupSchedule: registeredThrough != null,
          ageAsOf: registeredThrough ? rosterDate : null,
        }
      : { registrationDate: rosterDate })
    : []

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

export async function buildVortexDailyReport(pool, date, { through = new Date() } = {}) {
  const since = new Date(through.getTime() - DAY_MS)
  const [roster, inquiries, unpaid] = await Promise.all([
    buildDailyRoster(pool, date, { registeredSince: since, registeredThrough: through }),
    loadDailyReportInquiries(pool, { since, through }),
    loadDailyReportUnpaid(pool, { date }),
  ])
  const newEnrollees = roster.newRegistrations.filter(({ status }) => status === 'confirmed')
  const guardiansByMemberId = new Map()
  const registrationDetails = Promise.all(newEnrollees.map(async (registration) => {
    if (!guardiansByMemberId.has(registration.memberId)) {
      guardiansByMemberId.set(registration.memberId, listMemberGuardianOutreachContacts(pool, registration.memberId))
    }
    const contacts = await guardiansByMemberId.get(registration.memberId)
    const submitted = submittedGuardianContact(registration.details)
    const guardians = !contacts.some(({ email, phone }) => email || phone) && (submitted.email || submitted.phone)
      ? [submitted]
      : contacts.length ? contacts : [submitted].filter(({ name }) => name)
    return { ...registration, guardians }
  }))
  const [enrollees, { adds, drops }] = await Promise.all([
    registrationDetails,
    loadDailyReportActivity(pool, { since, through, newSignupIds: newEnrollees.map(({ signupId }) => signupId) }),
  ])
  return { ...roster, report: { inquiries, enrollees, adds, drops, unpaid } }
}

function reportSections(roster, textLines) {
  const { inquiries, enrollees, adds, drops, unpaid } = roster.report
  const missing = 'Not recorded'
  const money = (cents) => new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100)
  const age = (years) => years == null ? 'Age not recorded' : `Age ${years}`
  const formatActivity = ({ name, className, scheduleLabel, effectiveDate, status }) => ({
    heading: [name, className].filter(Boolean).join(' — '),
    details: [scheduleLabel, effectiveDate && `Effective ${effectiveDate}`, status].filter(Boolean),
  })
  const section = (title, rows, empty) => {
    textLines.push(`${title} (${rows.length})`)
    for (const { heading, details } of rows) textLines.push(`• ${heading}`, ...details.map((detail) => `  ${detail}`))
    if (!rows.length) textLines.push(empty)
    textLines.push('')
    const content = rows.length
      ? `<ul style="margin:8px 0 20px;padding-left:22px">${rows.map(({ heading, details }) => `<li style="padding:4px 0"><strong>${escapeHtml(heading)}</strong>${details.map((detail) => `<br>${escapeHtml(detail)}`).join('')}</li>`).join('')}</ul>`
      : `<p style="margin:8px 0 20px;color:#6b7280">${escapeHtml(empty)}</p>`
    return `<h2 style="font-size:18px;margin:0">${escapeHtml(title)} (${rows.length})</h2>${content}`
  }
  const month = new Intl.DateTimeFormat('en-US', { timeZone: 'UTC', month: 'long', year: 'numeric' })
    .format(new Date(`${roster.date}T12:00:00Z`))
  return [
    section('Inquiries in the last 24 hours', inquiries.map((inquiry) => ({
      heading: inquiry.contactName || 'Unnamed contact',
      details: [
        [inquiry.contactRole, inquiry.contactEmail || 'Email not recorded', inquiry.contactPhone || 'Phone not recorded'].filter(Boolean).join(' · '),
        `Children: ${inquiry.children.map((child) => `${child.name || 'Name not recorded'} (${age(child.age)})`).join(' / ') || missing}`,
        `Interested in: ${inquiry.interest || missing}`,
      ],
    })), 'No new inquiries recorded.'),
    section('New enrollees and adds', [
      ...enrollees.map((enrollment) => ({
        heading: `${enrollment.name} (${age(enrollment.age)}) — ${enrollment.className}`,
        details: [
          [enrollment.programName, enrollment.scheduleLabel || 'Schedule not recorded'].filter(Boolean).join(' · '),
          `Start date: ${enrollment.enrollmentStartDate || missing}`,
          ...enrollment.guardians.map(({ name, email, phone }) =>
            `Parent or guardian: ${name || 'Name not recorded'} · ${email || 'Email not recorded'} · ${phone || 'Phone not recorded'}`),
          ...(!enrollment.guardians.length ? [`Parent or guardian: ${missing}`] : []),
        ],
      })),
      ...adds.map(formatActivity),
    ], 'No new enrollees or adds recorded.'),
    section('Drops', drops.map(formatActivity), 'No drops recorded.'),
    section(`Unpaid tuition due for ${month}`, unpaid.map((account) => ({
      heading: `${account.payerName || account.payerEmail || `Billing account ${account.accountId}`} — ${money(account.remainingCents)} due`,
      details: account.charges.map((charge) => [
        charge.memberName, charge.description, money(charge.remainingCents), charge.reason,
      ].filter(Boolean).join(' · ')),
    })), 'No outstanding tuition due for this month.'),
  ].join('')
}

const SINGLE_DAY_BENEFIT_LABELS = {
  free_trial: 'Free trial',
  annual_credit: 'Annual member credit',
  admin_credit: 'Admin credit',
  free_pass: 'Free pass',
  promo_code: 'Registration code',
}

export function renderDailyRosterEmail(roster, { includeNewRegistrations = true } = {}) {
  const title = roster.report ? 'Vortex Daily Report' : 'Daily roster'
  const subject = `${title} — ${roster.dateLabel}`
  const textLines = [
    subject,
    `${roster.classCount} classes · ${roster.athleteCount} enrollments`,
    '',
  ]
  let summaryHtml = ''
  if (roster.report) {
    summaryHtml = reportSections(roster, textLines)
  } else if (includeNewRegistrations) {
    textLines.push(`New registrations: ${roster.newRegistrationCount || 0}`, '')
    for (const registration of roster.newRegistrations || []) {
      textLines.push(`• ${registration.name} — ${registration.className} (${registration.status})`)
    }
    if (!(roster.newRegistrations || []).length) textLines.push('No new registrations.')
    textLines.push('')
    const newRegistrationsHtml = (roster.newRegistrations || []).length
      ? `<ul style="margin:10px 0 22px;padding-left:22px">${roster.newRegistrations.map((registration) => `<li style="padding:3px 0"><strong>${escapeHtml(registration.name)}</strong> — ${escapeHtml(registration.className)} (${escapeHtml(registration.status)})</li>`).join('')}</ul>`
      : '<p style="margin:8px 0 22px;color:#6b7280">No new registrations.</p>'
    summaryHtml = `<h2 style="font-size:18px;margin:0">New registrations (${roster.newRegistrationCount || 0})</h2>${newRegistrationsHtml}`
  }

  if (roster.report) textLines.push("Today's class roster", '')
  const sections = roster.classes.map((item) => {
    const heading = [item.startTime ? item.timeLabel : null, item.className, item.programName]
      .filter(Boolean)
      .join(' · ')
    textLines.push(heading, `${item.athleteCount} enrolled`)
    const scheduled = item.athletes.filter((athlete) => athlete.source !== 'drop_in')
    const singleDay = item.athletes.filter((athlete) => athlete.source === 'drop_in')
    if (scheduled.length) scheduled.forEach((athlete, index) => textLines.push(`${index + 1}. ${athlete.name}`))
    else textLines.push(singleDay.length ? 'No recurring or class enrollments' : 'No enrolled athletes')
    const singleDayNames = singleDay.map((athlete) => {
      const label = SINGLE_DAY_BENEFIT_LABELS[athlete.benefitType]
      return label ? `${athlete.name} (${label})` : athlete.name
    })
    if (singleDayNames.length) textLines.push(`Drop-ins and make-ups (${singleDayNames.length})`, ...singleDayNames.map((name) => `• ${name}`))
    textLines.push('')

    const athletesHtml = scheduled.length
      ? `<ol style="margin:10px 0 0;padding-left:22px">${scheduled.map((athlete) => `<li style="padding:2px 0">${escapeHtml(athlete.name)}</li>`).join('')}</ol>`
      : `<p style="margin:10px 0 0;color:#6b7280">${singleDay.length ? 'No recurring or class enrollments' : 'No enrolled athletes'}</p>`
    const singleDayHtml = singleDayNames.length
      ? `<div style="background:#eff6ff;border-left:3px solid #2563eb;padding:8px 12px;margin-top:12px"><strong>Drop-ins and make-ups (${singleDayNames.length})</strong><ul style="margin:4px 0 0;padding-left:18px">${singleDayNames.map((name) => `<li>${escapeHtml(name)}</li>`).join('')}</ul></div>`
      : ''
    return `<section style="border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:0 0 14px">
      <h2 style="font-size:17px;margin:0;color:#111827">${escapeHtml(heading)}</h2>
      <p style="margin:5px 0 0;color:#4b5563">${item.athleteCount} enrolled</p>
      ${athletesHtml}
      ${singleDayHtml}
    </section>`
  })

  if (!roster.classes.length) textLines.push('No classes are scheduled for this date.')
  return {
    subject,
    text: textLines.join('\n').trim(),
    html: `<h1 style="font-size:24px;margin:0 0 6px">${title}</h1>
      <p style="margin:0 0 22px;color:#4b5563">${escapeHtml(roster.dateLabel)} · ${roster.classCount} classes · ${roster.athleteCount} enrollments</p>
      ${summaryHtml}
      ${roster.report ? '<h2 style="font-size:18px;margin:0 0 12px">Today’s class roster</h2>' : ''}
      ${sections.join('') || '<p>No classes are scheduled for this date.</p>'}`,
  }
}

export async function sendDailyRoster(pool, {
  date = dateInTimeZone(),
  to = process.env.DAILY_ROSTER_EMAIL || DEFAULT_ROSTER_RECIPIENT,
  reportThrough = null,
  includeNewRegistrations = true,
  category = 'daily_roster',
  templateVersion = 'daily_roster_v1',
  idempotencyKey,
} = {}) {
  const roster = reportThrough
    ? await buildVortexDailyReport(pool, date, { through: reportThrough })
    : await buildDailyRoster(pool, date, { includeNewRegistrations })
  const message = renderDailyRosterEmail(roster, { includeNewRegistrations })
  const delivery = await sendEmail({
    to,
    ...message,
    category,
    templateVersion,
    idempotencyKey,
  })
  return { roster, delivery, recipient: to }
}

/** Sends the once-daily operations report and class roster. */
export async function emailDailyRoster(pool, {
  now = new Date(),
  date = dateInTimeZone(now),
  to = process.env.DAILY_ROSTER_EMAIL || DEFAULT_ROSTER_RECIPIENT,
} = {}) {
  return sendDailyRoster(pool, {
    date,
    to,
    reportThrough: now,
    templateVersion: 'vortex_daily_report_v1',
    idempotencyKey: `daily-roster-${date}-${String(to).trim().toLowerCase()}`,
  })
}

/**
 * Sends the selected day's schedule from Daily Enrollments. This deliberately uses
 * its own category so an on-demand message never suppresses the scheduled daily
 * operational roster (or vice versa).
 */
export async function emailDailyRosterManually(pool, {
  date = dateInTimeZone(),
  to,
  idempotencyKey,
} = {}) {
  return sendDailyRoster(pool, {
    date,
    to,
    includeNewRegistrations: false,
    category: 'daily_roster_manual',
    templateVersion: 'daily_roster_manual_v1',
    idempotencyKey,
  })
}
