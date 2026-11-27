import { randomUUID } from 'node:crypto'
import { buildDailyRoster, validateRosterDate } from './dailyRoster.js'
import { loadSchedulingCalendar } from './calendarQuery.js'
import { dedupeEmails, listMemberGuardianContacts, resolveMemberHouseholdPayerContact } from '../email/memberContact.js'
import { sendEmail } from '../email/sendEmail.js'
import { findPromotionalContent } from '../email/emailCategories.js'

const TEMPLATE = 'calendar-cancellation-v1'
const workers = new WeakMap()
const scopeKey = slotId => slotId == null ? 'day' : `slot:${slotId}`
const fail = (message, statusCode = 400) => Object.assign(new Error(message), { statusCode })
const dateLabel = date => new Intl.DateTimeFormat('en-US', {
  timeZone: 'UTC', weekday: 'long', month: 'long', day: 'numeric', year: 'numeric',
}).format(new Date(`${date}T12:00:00Z`))
const timeLabel = time => {
  const [hour, minute] = String(time).split(':')
  return `${Number(hour) % 12 || 12}:${minute} ${Number(hour) >= 12 ? 'PM' : 'AM'}`
}

export function cancellationEmailBody(sessions, date, { fullDay = false } = {}) {
  return [
    'Dear Vortex families,', '',
    fullDay ? `We are sorry to let you know that all classes and trials on ${dateLabel(date)} have been canceled.`
      : 'We are sorry to let you know that the following class session has been canceled:',
    '', ...sessions.map(session => `${session.className} — ${dateLabel(session.date)}, ${timeLabel(session.startTime)}–${timeLabel(session.endTime)}`),
    '', 'We apologize for the inconvenience and appreciate your understanding. We will work with you to facilitate a make-up date. Please reply to this email with any questions or scheduling needs.',
    '', 'Thank you,', 'The Vortex Athletics Team',
  ].join('\n')
}

export function validateCancellationEmailBody(value) {
  if (value === undefined) return undefined
  if (typeof value !== 'string' || !value.trim() || value.length > 20_000) {
    throw fail('Enter a cancellation email message of 1 to 20,000 characters.')
  }
  if (findPromotionalContent(value).length) throw fail('Please keep the cancellation email focused on the class cancellation and make-up arrangements, without promotional offers.')
  return value
}

/** Read the actual dated roster before the closure is inserted. */
export async function previewCalendarCancellation(db, { facilityId, date, slotId = null }) {
  if (typeof date !== 'string' || validateRosterDate(date) !== date || date.startsWith('0000-') || (slotId != null && (!Number.isSafeInteger(slotId) || slotId <= 0))) {
    throw fail('A valid class date and optional slot are required.')
  }
  let slotGroupIds = null
  if (slotId != null) {
    const slot = (await db.query(`SELECT slot.slot_group_id FROM scheduling_time_slot slot
      JOIN scheduling_form form ON form.id=slot.form_id JOIN program class ON class.id=form.program_id
      WHERE slot.id=$1 AND class.facility_id=$2`, [slotId, facilityId])).rows[0]
    if (!slot) throw fail('Class session not found on that date.', 404)
    slotGroupIds = [Number(slot.slot_group_id)]
  }
  const calendar = await loadSchedulingCalendar(db, { facilityId, startDate: date, endDate: date,
    slotGroupId: slotGroupIds?.[0] ?? null, includeCancelled: true })
  const matching = calendar.events.filter(event => slotId == null || event.timeSlotId === slotId)
  if (slotId != null && !matching.length) throw fail('Class session not found on that date.', 404)
  const affectedSessions = matching.filter(event => !event.isCancelled).map(event => ({
    className: event.className, date: event.date, startTime: event.startTime, endTime: event.endTime,
  }))
  const affectedSlots = new Set(matching.filter(event => !event.isCancelled).map(event => event.timeSlotId))
  const roster = affectedSlots.size ? await buildDailyRoster(db, date, {
    facilityId, slotGroupIds, includeNewRegistrations: false, includeInactiveSessions: true,
  }) : { classes: [] }
  const athletes = new Map()
  for (const item of roster.classes) if (affectedSlots.has(item.timeSlotId)) {
    for (const athlete of item.athletes) athletes.set(athlete.memberId == null
      ? `${athlete.source}:${athlete.signupId}` : `member:${athlete.memberId}`, athlete)
  }
  const groupIds = [...new Set(matching.filter(event => affectedSlots.has(event.timeSlotId)).map(event => event.slotGroupId))]
  // Checkout/account setup holds are not in the confirmed roster, but those
  // families also need to know their requested session is no longer available.
  const pending = groupIds.length ? await db.query(`SELECT booking.id,booking.member_id,booking.email
    FROM drop_in_registration booking JOIN scheduling_form form ON form.id=booking.form_id
    JOIN program class ON class.id=form.program_id AND class.facility_id=$1
    WHERE booking.slot_group_id=ANY($2::bigint[]) AND booking.class_date=$3::date
      AND (booking.status='payment_pending' OR (booking.status='account_required'
        AND (booking.expires_at IS NULL OR booking.expires_at>now())))`, [facilityId,groupIds,date]) : { rows: [] }
  for (const booking of pending.rows) {
    const key = booking.member_id == null ? `drop_in:${booking.id}` : `member:${booking.member_id}`
    if (!athletes.has(key)) athletes.set(key, { memberId: booking.member_id == null ? null : Number(booking.member_id), email: booking.email })
  }
  const recipients = new Map()
  let missingContactCount = 0
  const memberIds = [...athletes.values()].map(athlete => athlete.memberId).filter(id => id != null)
  const scopedMembers = memberIds.length ? new Set((await db.query(`SELECT id FROM member
    WHERE facility_id=$1 AND id=ANY($2::bigint[])`, [facilityId,memberIds])).rows.map(row => Number(row.id))) : new Set()
  for (const athlete of athletes.values()) {
    if (athlete.memberId != null && !scopedMembers.has(athlete.memberId)) { missingContactCount += 1; continue }
    const guardians = athlete.memberId == null ? [] : await listMemberGuardianContacts(db, athlete.memberId)
    const payer = !guardians.length && athlete.memberId != null
      ? await resolveMemberHouseholdPayerContact(db, athlete.memberId) : null
    const contacts = guardians.length ? guardians : payer ? [payer] : [{ email: athlete.email, memberId: athlete.memberId }]
    const emails = dedupeEmails(contacts.map(contact => contact.email))
    if (!emails.length) missingContactCount += 1
    for (const email of emails) {
      const contact = contacts.find(item => String(item.email).trim().toLowerCase() === email.toLowerCase())
      recipients.set(email.toLowerCase(), { email: email.toLowerCase(), memberId: contact?.memberId ?? null })
    }
  }
  const subject = slotId == null ? `Classes canceled — ${dateLabel(date)}`
    : `Class canceled: ${matching[0].className} — ${dateLabel(date)}`
  return { subject, body: cancellationEmailBody(affectedSessions, date, { fullDay: slotId == null }),
    recipientCount: recipients.size, affectedSessions, missingContactCount, recipients: [...recipients.values()] }
}

/** Caller owns the cancellation transaction and its day/group locks. */
export async function queueCalendarCancellation(db, { facilityId, date, slotId = null, emailBody }) {
  const preview = await previewCalendarCancellation(db, { facilityId, date, slotId })
  const body = validateCancellationEmailBody(emailBody) ?? preview.body
  const notice = (await db.query(`INSERT INTO scheduling_cancellation_notice
    (facility_id,occurrence_date,time_slot_id,scope_key,subject,body,affected_sessions,missing_contact_count)
    VALUES ($1,$2::date,$3,$4,$5,$6,$7::jsonb,$8) RETURNING id`,
  [facilityId,date,slotId,scopeKey(slotId),preview.subject,body,JSON.stringify(preview.affectedSessions),preview.missingContactCount])).rows[0]
  for (const recipient of preview.recipients) await db.query(`INSERT INTO scheduling_cancellation_delivery
    (notice_id,recipient_email,member_id) VALUES ($1,$2,$3)`, [notice.id,recipient.email,recipient.memberId])
  return Number(notice.id)
}

/** Restoring cancels unsent mail; a later cancellation gets a fresh episode. */
export async function retireCalendarCancellation(db, { facilityId, date, slotId = null }) {
  await db.query(`WITH restored AS (UPDATE scheduling_cancellation_notice SET restored_at=now()
    WHERE facility_id=$1 AND occurrence_date=$2::date AND scope_key=$3 AND restored_at IS NULL RETURNING id)
    UPDATE scheduling_cancellation_delivery SET status='cancelled',claim_token=NULL,claimed_until=NULL
    WHERE notice_id IN (SELECT id FROM restored) AND status<>'sent'`, [facilityId,date,scopeKey(slotId)])
}

export async function calendarCancellationSummary(db, { facilityId, date, slotId = null }) {
  const row = (await db.query(`SELECT notice.missing_contact_count,
    COUNT(delivery.id)::int AS recipient_count,COUNT(delivery.id) FILTER (WHERE delivery.status='sent')::int AS sent,
    COUNT(delivery.id) FILTER (WHERE delivery.status IN ('pending','sending'))::int AS pending,
    COUNT(delivery.id) FILTER (WHERE delivery.status='failed')::int AS failed
    FROM scheduling_cancellation_notice notice LEFT JOIN scheduling_cancellation_delivery delivery ON delivery.notice_id=notice.id
    WHERE notice.facility_id=$1 AND notice.occurrence_date=$2::date AND notice.scope_key=$3 AND notice.restored_at IS NULL
    GROUP BY notice.id`, [facilityId,date,scopeKey(slotId)])).rows[0]
  return { sent: Number(row?.sent ?? 0), pending: Number(row?.pending ?? 0), failed: Number(row?.failed ?? 0),
    recipientCount: Number(row?.recipient_count ?? 0), missingContactCount: Number(row?.missing_contact_count ?? 0) }
}

const htmlBody = body => `<div style="white-space:pre-wrap">${String(body).replaceAll('&','&amp;').replaceAll('<','&lt;')
  .replaceAll('>','&gt;').replaceAll('"','&quot;').replaceAll("'",'&#039;')}</div>`

/** A durable lease prevents concurrent workers claiming the same recipient. */
export async function dispatchCalendarCancellationNotifications(pool, { send = sendEmail, limit = 10 } = {}) {
  let processed = 0
  while (processed < limit) {
    const token = randomUUID()
    const delivery = (await pool.query(`WITH due AS (
      SELECT delivery.id FROM scheduling_cancellation_delivery delivery
      JOIN scheduling_cancellation_notice notice ON notice.id=delivery.notice_id AND notice.restored_at IS NULL
      WHERE (delivery.status='pending' AND delivery.next_attempt_at<=now())
        OR (delivery.status='sending' AND delivery.claimed_until<now())
      ORDER BY delivery.next_attempt_at,delivery.id FOR UPDATE OF delivery SKIP LOCKED LIMIT 1
    ), claimed AS (UPDATE scheduling_cancellation_delivery delivery SET status='sending',claim_token=$1,
      claimed_until=now()+interval '15 minutes',attempt_count=attempt_count+1 FROM due WHERE delivery.id=due.id RETURNING delivery.*)
    SELECT claimed.*,notice.subject,notice.body,notice.facility_id FROM claimed
    JOIN scheduling_cancellation_notice notice ON notice.id=claimed.notice_id`, [token])).rows[0]
    if (!delivery) break
    processed += 1
    const key = `calendar-cancellation:${delivery.id}`
    try {
      const accepted = (await pool.query('SELECT accepted_at FROM email_delivery WHERE idempotency_key=$1', [key])).rows[0]?.accepted_at
      let sent = Boolean(accepted)
      if (!sent) {
        // A lease recovered after process loss may leave the mail log queued.
        // This worker now owns the attempt; accepted mail is never requeued.
        await pool.query(`UPDATE email_delivery SET status='failed',updated_at=now()
          WHERE idempotency_key=$1 AND category='schedule_change' AND template_version=$2
            AND status='queued' AND accepted_at IS NULL`, [key,TEMPLATE])
        const activeClaim = (await pool.query(`SELECT delivery.id FROM scheduling_cancellation_delivery delivery
          JOIN scheduling_cancellation_notice notice ON notice.id=delivery.notice_id AND notice.restored_at IS NULL
          WHERE delivery.id=$1 AND delivery.claim_token=$2 AND delivery.status='sending'`, [delivery.id,token])).rows.length > 0
        if (!activeClaim) continue
        const result = await send({ to: delivery.recipient_email, subject: delivery.subject, text: delivery.body,
          html: htmlBody(delivery.body), category: 'schedule_change', templateVersion: TEMPLATE,
          idempotencyKey: key, facilityId: Number(delivery.facility_id), memberId: delivery.member_id == null ? null : Number(delivery.member_id), skipPolicy: true })
        sent = result.sent === true
        if (!sent) throw Object.assign(new Error('Email delivery is unavailable.'), { permanent: result.suppressed === true })
      }
      await pool.query(`UPDATE scheduling_cancellation_delivery SET status='sent',sent_at=now(),last_error=NULL,
        claim_token=NULL,claimed_until=NULL WHERE id=$1 AND claim_token=$2 AND status='sending'`, [delivery.id,token])
    } catch (error) {
      // Keep recipient details and SMTP credentials out of the queue's error.
      await pool.query(`UPDATE scheduling_cancellation_delivery SET status=$3,
        last_error=$4,
        next_attempt_at=now()+LEAST(60,POWER(2,LEAST(attempt_count,6))) * interval '1 minute',
        claim_token=NULL,claimed_until=NULL WHERE id=$1 AND claim_token=$2 AND status='sending'`,
      [delivery.id,token,error?.permanent ? 'failed' : 'pending',error?.permanent
        ? 'The recipient address is suppressed; please confirm a working parent email address.'
        : 'Email could not be delivered; an automatic retry is scheduled.'])
    }
  }
  return { processed }
}

export function startCalendarCancellationNotifier(pool, options = {}) {
  if (workers.has(pool)) return workers.get(pool)
  let running = false, stopped = false
  const run = () => {
    if (running || stopped) return
    running = true
    void dispatchCalendarCancellationNotifications(pool, options).catch(error => {
      console.warn('[calendar-cancellation] Notification retry failed:', error?.code ?? 'database_unavailable')
    }).finally(() => { running = false })
  }
  const timer = setInterval(run, 15_000)
  timer.unref?.()
  const worker = { wake: run, stop() { stopped=true; clearInterval(timer); workers.delete(pool) } }
  workers.set(pool, worker)
  run()
  return worker
}

export function wakeCalendarCancellationNotifier(pool) { workers.get(pool)?.wake() }
