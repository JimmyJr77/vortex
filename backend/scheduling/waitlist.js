import { billConfirmedRegistration } from './registrationBilling.js'
import { buildGroupDisplayLabel } from './slotDisplayLabel.js'
import { persistEnrollmentPauseBilling } from './pauseEnrollmentBilling.js'
import { recordBillingActivity } from '../billing/billingActivity.js'

async function activateWaitlistBilling(db, signup) {
  const context = (await db.query(`SELECT m.facility_id,a.id AS account_id,
      (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(f.timezone,''),'America/New_York'))::date::text AS today,
      EXISTS(SELECT 1 FROM billing_subscription s WHERE s.source_type='scheduling_signup' AND s.source_id=$1::text) AS had_tuition
    FROM member m JOIN facility f ON f.id=m.facility_id
    LEFT JOIN family_billing_account a ON a.family_id=m.family_id AND a.is_active=TRUE WHERE m.id=$2`,[signup.id,signup.member_id])).rows[0]
  if (!context) throw new Error('The waitlisted student has no facility.')
  if (!context.had_tuition) {
    await db.query('UPDATE scheduling_signup SET enrollment_start_date=$2::date WHERE id=$1',[signup.id,context.today])
    signup.enrollment_start_date = context.today
  }
  return context
}

const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function formatTime(t) {
  if (!t) return null
  const s = String(t)
  return s.length >= 5 ? s.slice(0, 5) : s
}

function formatDateOnly(value) {
  if (value == null || value === '') return null
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return null
    const y = value.getUTCFullYear()
    const m = String(value.getUTCMonth() + 1).padStart(2, '0')
    const d = String(value.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }
  const s = String(value).trim()
  if (/^\d{4}-\d{2}-\d{2}$/.test(s)) return s
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10)
  return null
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} slotGroupId
 * @param {number} signupId
 */
export async function computeSignupPositions(client, slotGroupId, signupId) {
  const maxRes = await client.query(
    'SELECT max_participants FROM scheduling_slot_group WHERE id = $1',
    [slotGroupId],
  )
  const maxParticipants = Number(maxRes.rows[0]?.max_participants ?? 0)

  const signupRes = await client.query('SELECT status FROM scheduling_signup WHERE id = $1', [signupId])
  const status = signupRes.rows[0]?.status ?? 'confirmed'

  let signupNumber = null
  let waitlistPosition = null

  if (status === 'confirmed') {
    const posRes = await client.query(
      `
      SELECT rn FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY created_at, id) AS rn
        FROM scheduling_signup
        WHERE slot_group_id = $1 AND status = 'confirmed'
      ) ranked
      WHERE id = $2
      `,
      [slotGroupId, signupId],
    )
    signupNumber = posRes.rows[0] ? Number(posRes.rows[0].rn) : null
  } else if (status === 'waitlisted') {
    const posRes = await client.query(
      `
      SELECT rn FROM (
        SELECT id, ROW_NUMBER() OVER (ORDER BY COALESCE(waitlisted_at,created_at), id) AS rn
        FROM scheduling_signup
        WHERE slot_group_id = $1 AND status = 'waitlisted'
      ) ranked
      WHERE id = $2
      `,
      [slotGroupId, signupId],
    )
    waitlistPosition = posRes.rows[0] ? Number(posRes.rows[0].rn) : null
  }

  return { signupNumber, maxParticipants, waitlistPosition, status }
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} slotGroupId
 * @param {number} slotsToFill
 */
export async function promoteFromWaitlist(client, slotGroupId, slotsToFill, { billRegistration = billConfirmedRegistration, prepareActivation = activateWaitlistBilling } = {}) {
  if (slotsToFill <= 0) return []

  const capacity = await client.query(`SELECT GREATEST(0,g.max_participants-
    (SELECT COUNT(*)::int FROM scheduling_signup s WHERE s.slot_group_id=g.id AND s.status='confirmed')-
    pending_registration_holds(g.id)) AS available FROM scheduling_slot_group g WHERE g.id=$1 FOR UPDATE`,[slotGroupId])
  slotsToFill = Math.min(slotsToFill,Number(capacity.rows[0]?.available ?? 0))
  if (slotsToFill <= 0) return []
  const waitlisted = await client.query(
    `
    SELECT id FROM scheduling_signup
    WHERE slot_group_id = $1 AND status = 'waitlisted' AND archived_at IS NULL AND orphaned_at IS NULL
      AND NOT EXISTS(SELECT 1 FROM enrollment_action a WHERE a.signup_id=scheduling_signup.id AND a.status='pending')
    ORDER BY COALESCE(waitlisted_at,created_at), id
    LIMIT $2
    FOR UPDATE
    `,
    [slotGroupId, slotsToFill],
  )

  const promoted = []
  for (const row of waitlisted.rows) {
    const updated = await client.query(
      `UPDATE scheduling_signup SET status = 'confirmed' WHERE id = $1 RETURNING *`,
      [row.id],
    )
    const signup = updated.rows[0]
    const context = await prepareActivation(client,signup)
    await billRegistration(client, signup)
    if (context) {
      if (context.had_tuition) await persistEnrollmentPauseBilling(client,{signupId:signup.id,enteringPaused:false,leavingPaused:true,effectiveDate:context.today})
      const action = (await client.query(`INSERT INTO enrollment_action(signup_id,facility_id,requested_status,previous_status,effective_date,request_key,status,applied_at)
        VALUES($1,$2,'confirmed','waitlisted',$3,$4,'applied',now()) RETURNING id`,
      [signup.id,context.facility_id,context.today,`waitlist-promotion:${signup.id}:${Date.now()}`])).rows[0]
      if (context.account_id) await recordBillingActivity(client,{eventKey:`enrollment-action:${action.id}`,accountId:Number(context.account_id),memberId:Number(signup.member_id),signupId:Number(signup.id),
        eventType:'enrollment_status_changed',summary:`Waitlist activation effective ${context.today}.`,actorType:'system',beforeValue:{status:'waitlisted'},afterValue:{status:'confirmed'},details:{effectiveDate:context.today,actionId:Number(action.id)}})
    }
    promoted.push(updated.rows[0])
  }
  return promoted
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} slotGroupId
 * @param {number} slotsToRemove
 */
export async function demoteToWaitlist(client, slotGroupId, slotsToRemove) {
  if (slotsToRemove <= 0) return []

  const confirmed = await client.query(
    `
    SELECT id FROM scheduling_signup
    WHERE slot_group_id = $1 AND status = 'confirmed'
    ORDER BY created_at DESC, id DESC
    LIMIT $2
    FOR UPDATE
    `,
    [slotGroupId, slotsToRemove],
  )

  const demoted = []
  for (const row of confirmed.rows) {
    const updated = await client.query(
      `UPDATE scheduling_signup SET status = 'waitlisted' WHERE id = $1 RETURNING *`,
      [row.id],
    )
    demoted.push(updated.rows[0])
  }
  return demoted
}

/**
 * @param {import('pg').PoolClient} client
 * @param {number} slotGroupId
 * @param {number} oldMax
 * @param {number} newMax
 */
export async function rebalanceCapacity(client, slotGroupId, oldMax, newMax) {
  const countRes = await client.query(
    `SELECT COUNT(*)::int AS c FROM scheduling_signup WHERE slot_group_id = $1 AND status = 'confirmed'`,
    [slotGroupId],
  )
  const confirmedCount = Number(countRes.rows[0].c)

  if (newMax > confirmedCount) {
    const slotsToFill = newMax - confirmedCount
    const promoted = await promoteFromWaitlist(client, slotGroupId, slotsToFill)
    return { promoted, demoted: [] }
  }

  if (newMax < confirmedCount) {
    const slotsToRemove = confirmedCount - newMax
    const demoted = await demoteToWaitlist(client, slotGroupId, slotsToRemove)
    return { promoted: [], demoted }
  }

  return { promoted: [], demoted: [] }
}

/**
 * @param {import('pg').Pool | import('pg').PoolClient} db
 * @param {number} signupId
 */
export async function loadSignupContext(db, signupId) {
  const result = await db.query(
    `
    SELECT s.*, f.title AS form_title, f.mandate_waiver,
      (
        SELECT COALESCE(json_agg(
          json_build_object(
            'week_letter', o.week_letter,
            'day_of_week', o.day_of_week,
            'specific_date', o.specific_date,
            'start_time', o.start_time,
            'end_time', o.end_time,
            'schedule_mode', o.schedule_mode
          )
          ORDER BY o.week_letter NULLS LAST, o.day_of_week NULLS LAST, o.specific_date NULLS LAST, o.start_time
        ), '[]'::json)
        FROM scheduling_time_slot o
        WHERE o.slot_group_id = s.slot_group_id
      ) AS group_occurrences
    FROM scheduling_signup s
    JOIN scheduling_form f ON f.id = s.form_id
    WHERE s.id = $1
    `,
    [signupId],
  )
  if (result.rows.length === 0) return null

  const row = result.rows[0]
  const responses = row.responses && Object.keys(row.responses).length > 0
    ? row.responses
    : row.field_responses || {}
  const occurrences = Array.isArray(row.group_occurrences) ? row.group_occurrences : []
  const slotLabel = buildGroupDisplayLabel(occurrences)

  return {
    signup: row,
    registrantFirstName: String(responses.first_name || row.first_name || ''),
    registrantEmail: String(responses.email || row.email || ''),
    parentFirstName: String(responses.parent_first_name || ''),
    parentEmail: String(responses.parent_email || ''),
    formTitle: row.form_title || '',
    slotLabel,
    mandateWaiver: Boolean(row.mandate_waiver ?? false),
  }
}

export function buildSignupPositionMessage({ status, signupNumber, maxParticipants, waitlistPosition }) {
  if (status === 'waitlisted' && waitlistPosition != null) {
    return `You are #${waitlistPosition} on the waitlist`
  }
  if (status === 'confirmed' && signupNumber != null && maxParticipants != null) {
    return `You are number ${signupNumber} of ${maxParticipants}`
  }
  return status === 'waitlisted' ? 'You have been added to the waitlist' : 'Signup confirmed'
}
