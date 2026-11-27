import { randomUUID } from 'node:crypto'
import { validateRosterDate } from './dailyRoster.js'
import { formatDateOnly } from './slotActiveDates.js'
import { dedupeEmails, listMemberGuardianContacts, resolveMemberHouseholdPayerContact } from '../email/memberContact.js'
import { sendEmail } from '../email/sendEmail.js'
import { findPromotionalContent } from '../email/emailCategories.js'
import { EMAIL_SIGNATURE, plainTextToEmailHtml } from '../email/emailHtml.js'

const TEMPLATE = 'class-swap-update-v1'
const workers = new WeakMap()
const dayNames = ['Sunday','Monday','Tuesday','Wednesday','Thursday','Friday','Saturday']
const fail = message => Object.assign(new Error(message), { statusCode: 400 })
const dateLabel = date => new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
}).format(new Date(`${date}T12:00:00Z`))
const timeLabel = time => {
  const [hour, minute] = String(time).split(':')
  return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) >= 12 ? 'PM' : 'AM'}`
}

export function validateClassSwapEmailBody(value) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim() || value.length > 20_000) throw fail('Enter a class change email message of 1 to 20,000 characters.')
  if (findPromotionalContent(value).length) throw fail('Please keep the class change email focused on the updated schedule, without promotional offers.')
  return value
}

export function classSwapEmailBody({ mode, athleteName, effectiveDate, originalSessions, replacementSessions }) {
  const name = athleteName || 'your child'
  return [
    `Dear ${athleteName ? `${athleteName}’s` : 'Vortex'} family,`,
    mode === 'temporary' ? `We’re writing to confirm a one-time class change for ${name}.`
      : `We’re writing to confirm ${athleteName ? `${athleteName}’s` : 'your child’s'} updated class schedule, effective ${dateLabel(effectiveDate)}.`,
    mode === 'temporary' ? `Original session: ${originalSessions.join('; ')}`
      : ['Previous schedule:', ...originalSessions.map(session => `• ${session}`)].join('\n'),
    mode === 'temporary' ? `Replacement session: ${replacementSessions.join('; ')}`
      : ['Updated schedule:', ...replacementSessions.map(session => `• ${session}`)].join('\n'),
    mode === 'temporary' ? `This change applies only to the session listed above. ${athleteName ? `${athleteName}’s` : 'Your child’s'} regular enrollment and tuition remain unchanged.`
      : 'Please follow the updated schedule for classes on and after this date.',
    'Thank you for your flexibility. Please reply if you have any questions or need help with the updated schedule.',
    'Warmly,\nThe Vortex Athletics Team',
  ].join('\n\n')
}

function sessionLabel(row, rows, occurrenceDate = null) {
  const rotation = row.schedule_mode === 'day' && new Set(rows.filter(item => Number(item.slot_group_id) === Number(row.slot_group_id)
    && item.schedule_mode === 'day').map(item => item.week_letter || 'A')).size > 1
  const day = occurrenceDate ? dateLabel(occurrenceDate) : row.specific_date ? dateLabel(formatDateOnly(row.specific_date))
    : dayNames[Number(row.day_of_week)] || 'Scheduled day'
  return `${row.class_name || row.form_title}, ${day}${rotation ? ` (${row.week_letter || 'A'}-week)` : ''}, ${timeLabel(row.start_time)}–${timeLabel(row.end_time)}`
}

/** Resolve only explicit guardian/payer or submitted booking contact details. */
export async function previewClassSwapNotification(db, {
  facilityId, mode, source = 'scheduling', signupId, sourceDate = null, sourceTimeSlotId = null,
  effectiveDate, targetSelections, billingAccountId = null,
}) {
  if (!['temporary','permanent'].includes(mode) || validateRosterDate(effectiveDate) !== effectiveDate) throw fail('Choose a valid class change type and date.')
  const table = source === 'drop_in' ? 'drop_in_registration' : 'scheduling_signup'
  const registration = (await db.query(`SELECT booking.member_id,booking.email,booking.first_name,booking.last_name,
      booking.form_id,booking.slot_group_id,${source === 'drop_in' ? 'NULL::bigint' : 'booking.time_slot_id'} AS time_slot_id,
      athlete.id AS scoped_member_id,athlete.first_name AS athlete_first_name,athlete.last_name AS athlete_last_name
    FROM ${table} booking JOIN scheduling_form form ON form.id=booking.form_id
    JOIN program class ON class.id=form.program_id AND class.facility_id=$2
    LEFT JOIN member athlete ON athlete.id=booking.member_id AND athlete.facility_id=$2
    WHERE booking.id=$1`, [signupId,facilityId])).rows[0]
  if (!registration) throw fail('The original enrollment could not be found.')
  const groups = [...new Set([Number(registration.slot_group_id), ...targetSelections.map(target => Number(target.targetSlotGroupId))])]
  // A valid Billing move can replace an old inactive/archived class. Read its
  // saved schedule directly rather than applying the calendar's display filters.
  const rows = (await db.query(`SELECT slot.id,slot.form_id,slot.slot_group_id,slot.is_active,slot.schedule_mode,
      slot.specific_date,slot.day_of_week,slot.week_letter,slot.start_time,slot.end_time,form.title AS form_title,
      COALESCE(NULLIF(class.display_name,''),NULLIF(class.name,''),form.title) AS class_name
    FROM scheduling_time_slot slot JOIN scheduling_slot_group schedule ON schedule.id=slot.slot_group_id AND schedule.form_id=slot.form_id
    JOIN scheduling_form form ON form.id=schedule.form_id
    JOIN program class ON class.id=form.program_id AND class.facility_id=$1
    WHERE schedule.id=ANY($2::bigint[]) ORDER BY slot.start_time,slot.id`, [facilityId,groups])).rows
  let original = rows.filter(row => Number(row.slot_group_id) === Number(registration.slot_group_id)
    && (mode === 'temporary' ? Number(row.id) === Number(sourceTimeSlotId)
      : registration.time_slot_id == null ? row.is_active : Number(row.id) === Number(registration.time_slot_id)))
  if (mode === 'permanent' && registration.time_slot_id == null && !original.length) {
    original = rows.filter(row => Number(row.slot_group_id) === Number(registration.slot_group_id))
  }
  const replacements = targetSelections.flatMap(target => rows.filter(row => Number(row.form_id) === Number(target.targetFormId)
    && Number(row.slot_group_id) === Number(target.targetSlotGroupId)
    && (target.targetTimeSlotId == null ? row.is_active : Number(row.id) === Number(target.targetTimeSlotId)))
    .sort((a,b) => Number(a.id)-Number(b.id)).slice(0,1))
  if (!original.length || replacements.length !== targetSelections.length) throw fail('The class change schedule could not be prepared for the parent email.')
  const athleteName = [registration.athlete_first_name || registration.first_name,registration.athlete_last_name || registration.last_name].filter(Boolean).join(' ')
  const foreignMember = registration.member_id != null && registration.scoped_member_id == null
  const memberId = registration.member_id == null ? null : Number(registration.member_id)
  const guardians = foreignMember || memberId == null ? [] : await listMemberGuardianContacts(db, memberId)
  const payer = !foreignMember && !guardians.length && memberId != null ? await resolveMemberHouseholdPayerContact(db, memberId) : null
  const billingContact = !foreignMember && !guardians.length && !payer && memberId != null
    ? (await db.query(`SELECT NULLIF(TRIM(account.billing_email),'') AS email
      FROM member athlete JOIN family household ON household.facility_id=athlete.facility_id AND household.archived=FALSE
        AND (EXISTS(SELECT 1 FROM family_member membership WHERE membership.member_id=athlete.id
          AND membership.family_id=household.id AND membership.is_active=TRUE)
          OR (household.id=athlete.family_id AND NOT EXISTS(SELECT 1 FROM family_member history WHERE history.member_id=athlete.id)))
      JOIN family_billing_account account ON account.family_id=household.id AND account.is_active=TRUE
      WHERE athlete.id=$1 AND athlete.facility_id=$2 AND athlete.is_active=TRUE
        AND ($3::bigint IS NULL OR account.id=$3)
      ORDER BY account.id LIMIT 1`, [memberId,facilityId,billingAccountId])).rows[0] : null
  const billingEmail = dedupeEmails([billingContact?.email])[0]
  const contacts = foreignMember ? [] : guardians.length ? guardians : payer ? [payer]
    : billingEmail ? [{email:billingEmail,memberId}]
    : [{ email: registration.email, memberId }]
  const recipients = dedupeEmails(contacts.map(contact => contact.email)).map(email => ({ email: email.toLowerCase(),
    memberId: contacts.find(contact => String(contact.email).trim().toLowerCase() === email.toLowerCase())?.memberId ?? null }))
  const subject = `${mode === 'temporary' ? 'One-time' : 'Permanent'} class change for ${athleteName || 'your child'}`
  return { subject, body: classSwapEmailBody({ mode, athleteName, effectiveDate,
    originalSessions: original.map(row => sessionLabel(row, rows, mode === 'temporary' ? sourceDate : null)),
    replacementSessions: replacements.map(row => sessionLabel(row, rows, mode === 'temporary' ? effectiveDate : null)),
  }), signature: EMAIL_SIGNATURE, recipientCount: recipients.length, missingContactCount: recipients.length ? 0 : 1, recipients }
}

export function publicClassSwapNotification(preview) {
  const { recipients: _recipients, ...safe } = preview
  return safe
}

/** Caller owns the successful swap transaction; SMTP never runs here. */
export async function queueClassSwapNotification(db, { eventKey, facilityId, mode, preview, emailBody }) {
  const body = validateClassSwapEmailBody(emailBody) ?? preview.body
  const notice = (await db.query(`INSERT INTO scheduling_class_swap_notice
    (facility_id,event_key,swap_mode,subject,body,missing_contact_count) VALUES($1,$2,$3,$4,$5,$6) RETURNING id`,
  [facilityId,eventKey,mode,preview.subject,body,preview.missingContactCount])).rows[0]
  for (const recipient of preview.recipients) await db.query(`INSERT INTO scheduling_class_swap_delivery
    (notice_id,recipient_email,member_id) VALUES($1,$2,$3)`, [notice.id,recipient.email,recipient.memberId])
}

export async function classSwapNotificationSummary(db, { eventKey, facilityId = null }) {
  const row = (await db.query(`SELECT notice.missing_contact_count,COUNT(delivery.id)::int AS recipient_count,
    COUNT(delivery.id) FILTER(WHERE delivery.status='sent')::int AS sent,
    COUNT(delivery.id) FILTER(WHERE delivery.status IN ('pending','sending'))::int AS pending,
    COUNT(delivery.id) FILTER(WHERE delivery.status='failed')::int AS failed
    FROM scheduling_class_swap_notice notice LEFT JOIN scheduling_class_swap_delivery delivery ON delivery.notice_id=notice.id
    WHERE notice.event_key=$1 AND ($2::bigint IS NULL OR notice.facility_id=$2) GROUP BY notice.id`, [eventKey,facilityId])).rows[0]
  return { sent:Number(row?.sent ?? 0), pending:Number(row?.pending ?? 0), failed:Number(row?.failed ?? 0),
    recipientCount:Number(row?.recipient_count ?? 0), missingContactCount:Number(row?.missing_contact_count ?? 0) }
}

export async function completeClassSwapNotification(pool, scope) {
  wakeClassSwapNotifier(pool)
  try { return { notifications: await classSwapNotificationSummary(pool, scope) } }
  catch { return { notificationSummaryUnavailable: true } }
}

const htmlBody = plainTextToEmailHtml

export async function dispatchClassSwapNotifications(pool, { send = sendEmail, limit = 10 } = {}) {
  let processed = 0
  while (processed < limit) {
    const token = randomUUID()
    const delivery = (await pool.query(`WITH due AS (SELECT id FROM scheduling_class_swap_delivery
      WHERE (status='pending' AND next_attempt_at<=now()) OR (status='sending' AND claimed_until<now())
      ORDER BY next_attempt_at,id FOR UPDATE SKIP LOCKED LIMIT 1), claimed AS (
      UPDATE scheduling_class_swap_delivery delivery SET status='sending',claim_token=$1,
        claimed_until=now()+interval '15 minutes',attempt_count=attempt_count+1
      FROM due WHERE delivery.id=due.id RETURNING delivery.*)
      SELECT claimed.*,notice.subject,notice.body,notice.facility_id FROM claimed
      JOIN scheduling_class_swap_notice notice ON notice.id=claimed.notice_id`, [token])).rows[0]
    if (!delivery) break
    processed += 1
    const key = `class-swap-update:${delivery.id}`
    try {
      let sent = Boolean((await pool.query('SELECT accepted_at FROM email_delivery WHERE idempotency_key=$1', [key])).rows[0]?.accepted_at)
      if (!sent) {
        await pool.query(`UPDATE email_delivery SET status='failed',updated_at=now() WHERE idempotency_key=$1
          AND category='schedule_change' AND template_version=$2 AND status='queued' AND accepted_at IS NULL`, [key,TEMPLATE])
        const active = (await pool.query(`SELECT id FROM scheduling_class_swap_delivery
          WHERE id=$1 AND claim_token=$2 AND status='sending'`, [delivery.id,token])).rows.length
        if (!active) continue
        const result = await send({ to:delivery.recipient_email,subject:delivery.subject,text:delivery.body,html:htmlBody(delivery.body),
          category:'schedule_change',templateVersion:TEMPLATE,idempotencyKey:key,facilityId:Number(delivery.facility_id),
          memberId:delivery.member_id == null ? null : Number(delivery.member_id),skipPolicy:true })
        sent = result.sent === true
        if (!sent) throw Object.assign(new Error('Email delivery is unavailable.'), { permanent:result.suppressed === true })
      }
      await pool.query(`UPDATE scheduling_class_swap_delivery SET status='sent',sent_at=now(),last_error=NULL,
        claim_token=NULL,claimed_until=NULL WHERE id=$1 AND claim_token=$2 AND status='sending'`, [delivery.id,token])
    } catch (error) {
      await pool.query(`UPDATE scheduling_class_swap_delivery SET status=$3,last_error=$4,
        next_attempt_at=now()+LEAST(60,POWER(2,LEAST(attempt_count,6)))*interval '1 minute',claim_token=NULL,claimed_until=NULL
        WHERE id=$1 AND claim_token=$2 AND status='sending'`, [delivery.id,token,error?.permanent ? 'failed':'pending',
      error?.permanent ? 'The recipient address is suppressed; please confirm a working parent email address.' : 'Email could not be delivered; an automatic retry is scheduled.'])
    }
  }
  return { processed }
}

export function startClassSwapNotifier(pool, options = {}) {
  if (workers.has(pool)) return workers.get(pool)
  let running = false, stopped = false
  const run = () => {
    if (running || stopped) return
    running = true
    void dispatchClassSwapNotifications(pool,options).catch(error => console.warn('[class-swap-email] Notification retry failed:',error?.code ?? 'database_unavailable'))
      .finally(() => { running=false })
  }
  const timer = setInterval(run,15_000)
  timer.unref?.()
  const worker = { wake:run,stop() { stopped=true;clearInterval(timer);workers.delete(pool) } }
  workers.set(pool,worker);run()
  return worker
}

export function wakeClassSwapNotifier(pool) { workers.get(pool)?.wake() }
