import crypto from 'node:crypto'
import { billingDateKey } from '../billing/customerBillingPricing.js'

const inputError = message => Object.assign(new Error(message), { statusCode: 400 })

export function validateEnrollmentActionDate(value, { today, signup, latestDate = null, targetStatus }) {
  const date = billingDateKey(value ?? today)
  if (!date || String(value ?? today) !== date) throw inputError('Choose a valid action date.')
  if (latestDate && date < latestDate) throw inputError(`This action cannot precede the last recorded action (${latestDate}).`)
  const start = billingDateKey(signup.enrollment_start_date)
  if (targetStatus !== 'confirmed' && start && date < start) throw inputError('This action cannot occur before the enrollment starts.')
  if (targetStatus === 'paused' && !['confirmed', 'paused'].includes(signup.status)) throw inputError('Only active enrollments can be paused.')
  if (targetStatus === 'waitlisted' && !['confirmed', 'paused', 'waitlisted'].includes(signup.status)) throw inputError('Reenroll this student before adding them to a waitlist.')
  return date
}

/** The caller holds the enrollment lock and transaction; dates and history commit with billing. */
export async function prepareDatedEnrollmentAction(db, { signup, targetStatus, effectiveDate, requestKey, actorUserId, scheduledActionId = null }) {
  const context = (await db.query(`SELECT m.facility_id,
      (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(f.timezone,''),'America/New_York'))::date::text AS today
    FROM member m JOIN facility f ON f.id=m.facility_id WHERE m.id=$1`, [signup.member_id])).rows[0]
  if (!context) throw inputError('The enrollment facility is unavailable.')
  if (scheduledActionId) {
    const action = (await db.query('SELECT *,effective_date::text AS effective_date FROM enrollment_action WHERE id=$1 AND signup_id=$2 FOR UPDATE', [scheduledActionId, signup.id])).rows[0]
    if (!action || action.status !== 'pending') return { replayed: true }
    if (action.effective_date > context.today) throw inputError('The scheduled action is not due yet.')
    if (action.previous_status !== signup.status) throw inputError('Enrollment status changed after this action was scheduled. Cancel it and review the enrollment.')
    return { action, today: context.today }
  }
  const key = requestKey ?? crypto.randomUUID()
  if (!/^[A-Za-z0-9_.:-]{8,120}$/.test(key)) throw inputError('Invalid action request key.')
  const existing = (await db.query('SELECT *,effective_date::text AS effective_date FROM enrollment_action WHERE signup_id=$1 AND request_key=$2', [signup.id, key])).rows[0]
  if (existing) {
    if (existing.requested_status !== targetStatus || existing.effective_date !== effectiveDate) throw inputError('This request key belongs to a different enrollment action.')
    return { action: existing, replayed: true }
  }
  const pending = (await db.query("SELECT id FROM enrollment_action WHERE signup_id=$1 AND status='pending'", [signup.id])).rows[0]
  if (pending) throw inputError('Cancel the scheduled action before choosing a different action.')
  const latest = (await db.query("SELECT MAX(effective_date)::text AS date FROM enrollment_action WHERE signup_id=$1 AND status='applied'", [signup.id])).rows[0]?.date
  const date = validateEnrollmentActionDate(effectiveDate, { today: context.today, signup, latestDate: latest, targetStatus })
  const action = (await db.query(`INSERT INTO enrollment_action(signup_id,facility_id,requested_status,previous_status,effective_date,requested_by_user_id,request_key)
    VALUES($1,$2,$3,$4,$5,$6,$7) RETURNING *,effective_date::text AS effective_date`,
  [signup.id, context.facility_id, targetStatus, signup.status, date, actorUserId, key])).rows[0]
  return { action, scheduled: date > context.today, today: context.today }
}

/** Execute the same lifecycle/billing handler used by staff, before recurring collection. */
export async function processDueEnrollmentActions(db, { accountId = null, facilityId = null, memberId = null } = {}) {
  const pending = await db.query(`SELECT a.id,a.signup_id,a.requested_status,a.effective_date::text,a.requested_by_user_id,a.facility_id
    FROM enrollment_action a JOIN scheduling_signup s ON s.id=a.signup_id
    JOIN member m ON m.id=s.member_id JOIN facility f ON f.id=a.facility_id
    WHERE a.status='pending' AND a.effective_date <= (CURRENT_TIMESTAMP AT TIME ZONE COALESCE(NULLIF(f.timezone,''),'America/New_York'))::date
      AND ($1::bigint IS NULL OR EXISTS (SELECT 1 FROM family_billing_account account WHERE account.id=$1 AND account.family_id=m.family_id))
      AND ($2::bigint IS NULL OR a.facility_id=$2)
      AND ($3::bigint IS NULL OR s.member_id=$3) ORDER BY a.effective_date,a.id`, [accountId, facilityId, memberId])
  if (!pending.rows.length) return 0
  const { createSchedulingHandlers } = await import('./handlers.js')
  const pool = typeof db.connect === 'function' && typeof db.release !== 'function' ? db : {
    query: (...args) => db.query(...args), connect: async () => ({ query: (...args) => db.query(...args), release() {} }),
  }
  const handlers = createSchedulingHandlers(pool)
  for (const action of pending.rows) {
    let status = 200, result
    await handlers.updateSignupStatus({ params: { id: action.signup_id },
      body: { status: action.requested_status, effectiveDate: action.effective_date, pauseMode: 'prorated' },
      scheduledEnrollmentActionId: action.id, skipNotifications: true,
      canonicalAccess: { userId: action.requested_by_user_id, facilityId: action.facility_id },
    }, { status(code) { status = code; return this }, json(body) { result = body; return this } })
    if (status >= 400 || !result?.success) {
      const message = result?.message ?? 'Scheduled enrollment action failed.'
      await db.query('UPDATE enrollment_action SET last_error=$2 WHERE id=$1', [action.id, message.slice(0, 1000)])
      throw Object.assign(new Error(message), { code: 'scheduled_enrollment_action_failed', actionId: action.id })
    }
  }
  return pending.rows.length
}
