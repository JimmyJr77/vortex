/**
 * Member-initiated enrollment cancellation with billing changes on the 1st of the month.
 *
 * A cancel request keeps the signup active until cancel_effective_date (always a month
 * anchor). The subscription stops renewing on that date (next_bill_date cleared immediately).
 * When the effective date arrives, the signup moves to cancelled and billing/subscriptions
 * are finalized.
 */

import { firstOfNextMonth, todayDateOnly } from './firstMonthProration.js'
import {
  safeCancelSubscriptionsForSource,
} from './billingSubscriptions.js'
import { ensureEnrollmentLifecycleColumns } from './enrollmentLifecycle.js'
import { promoteFromWaitlist } from './waitlist.js'
import { syncFamilyEnrollmentDiscounts } from './pauseEnrollmentBilling.js'
import {
  restorePassCreditsForSignup,
  safeRestorePassCreditsForSignup,
} from '../programs/multiClassPass.js'
import {
  cancelStripeSubscriptionNow,
  syncStripeForBillingSource,
} from '../billing/stripeSubscriptionSync.js'
import { formatDateOnly } from './slotDisplayLabel.js'

/** Discount resync can be slow; never block the cancel HTTP response on it. */
function scheduleFamilyDiscountResync(pool, memberId) {
  if (memberId == null) return
  void (async () => {
    try {
      const famRes = await pool.query(`SELECT family_id FROM member WHERE id = $1`, [memberId])
      const familyId = famRes.rows[0]?.family_id
      if (familyId) await syncFamilyEnrollmentDiscounts(pool, Number(familyId))
    } catch (syncErr) {
      console.warn('[memberEnrollmentCancel] discount resync:', syncErr?.message ?? syncErr)
    }
  })()
}

/** The next billing anchor (1st) after today — when billing/enrollment changes take effect. */
export function nextEnrollmentBillingChangeDate(fromDate = todayDateOnly()) {
  return firstOfNextMonth(fromDate)
}

function dayBefore(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number)
  const dt = new Date(Date.UTC(y, m - 1, d))
  dt.setUTCDate(dt.getUTCDate() - 1)
  return `${dt.getUTCFullYear()}-${String(dt.getUTCMonth() + 1).padStart(2, '0')}-${String(dt.getUTCDate()).padStart(2, '0')}`
}

/** Stop future monthly billing while keeping the subscription row until the effective date. */
export async function scheduleSubscriptionEndAtFirst(db, { sourceType = 'scheduling_signup', sourceId, effectiveDate }) {
  if (sourceId == null || !effectiveDate) return []
  const endDate = dayBefore(effectiveDate)
  const res = await db.query(
    `
      UPDATE billing_subscription
      SET end_date = $3,
          next_bill_date = NULL,
          updated_at = now()
      WHERE source_type = $1 AND source_id = $2 AND status <> 'cancelled'
      RETURNING id
    `,
    [sourceType, String(sourceId), endDate],
  )
  return res.rows.map((r) => Number(r.id))
}

async function safeScheduleSubscriptionEnd(db, opts) {
  try {
    return await scheduleSubscriptionEndAtFirst(db, opts)
  } catch (err) {
    console.warn('[memberEnrollmentCancel] schedule subscription end skipped:', err?.message ?? err)
    return []
  }
}

/** Throttle GET-path cancellation sweeps; billing cron should pass `{ force: true }`. */
let lastDueCancelRunAt = 0
const DUE_CANCEL_MIN_INTERVAL_MS = 5 * 60 * 1000
let dueCancelInFlight = null

/**
 * Finalize signups whose cancel_effective_date has arrived.
 * @param {import('pg').Pool} pool
 * @param {{ force?: boolean }} [options]
 * @returns {Promise<number[]>} signup ids cancelled
 */
export async function processDueEnrollmentCancellations(pool, {
  force = false,
  strict = false,
  accountId = null,
  facilityId = null,
  asOfDate = null,
  stripeCanceller = cancelStripeSubscriptionNow,
} = {}) {
  if (
    strict &&
    (accountId == null || facilityId == null || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate ?? '')))
  ) {
    const error = new Error('Strict enrollment cancellation requires an account, facility, and civil as-of date.')
    error.code = 'strict_enrollment_cancellation_scope_required'
    throw error
  }
  if (strict || accountId != null || facilityId != null || asOfDate != null) {
    return runDueEnrollmentCancellations(pool, {
      strict,
      accountId,
      facilityId,
      asOfDate: asOfDate ?? todayDateOnly(),
      stripeCanceller,
    })
  }
  const now = Date.now()
  if (!force && now - lastDueCancelRunAt < DUE_CANCEL_MIN_INTERVAL_MS) {
    return []
  }
  if (dueCancelInFlight) return dueCancelInFlight

  dueCancelInFlight = (async () => {
    try {
      return await runDueEnrollmentCancellations(pool)
    } finally {
      lastDueCancelRunAt = Date.now()
      dueCancelInFlight = null
    }
  })()

  return dueCancelInFlight
}

async function runDueEnrollmentCancellations(pool, {
  strict = false,
  accountId = null,
  facilityId = null,
  asOfDate = null,
  stripeCanceller = cancelStripeSubscriptionNow,
} = {}) {
  try {
    await ensureEnrollmentLifecycleColumns(pool)
  } catch (schemaErr) {
    if (strict) throw schemaErr
    console.warn('[memberEnrollmentCancel] schema ensure:', schemaErr?.message ?? schemaErr)
  }

  const scoped = accountId != null || facilityId != null
  const due = await pool.query(
    `
      SELECT DISTINCT signup.id, signup.member_id, signup.slot_group_id, signup.status,
             signup.cancel_effective_date
      FROM scheduling_signup signup
      ${scoped ? `JOIN billing_subscription subscription
        ON subscription.source_type = 'scheduling_signup'
       AND subscription.source_id = signup.id::text
       AND subscription.status <> 'cancelled'
      JOIN family_billing_account account
        ON account.id = subscription.family_billing_account_id
      JOIN family ON family.id = account.family_id` : ''}
      WHERE signup.cancel_effective_date IS NOT NULL
        AND signup.cancel_effective_date <= COALESCE($1::date, CURRENT_DATE)
        AND signup.status IN ('confirmed', 'waitlisted', 'paused')
        AND signup.orphaned_at IS NULL
        ${scoped ? 'AND ($2::bigint IS NULL OR account.id = $2) AND ($3::bigint IS NULL OR family.facility_id = $3)' : ''}
      ORDER BY signup.id
    `,
    scoped ? [asOfDate, accountId, facilityId] : [asOfDate],
  )
  const cancelledIds = []
  for (const row of due.rows) {
    try {
      const id = await finalizeEnrollmentCancellation(pool, {
        signupId: Number(row.id),
        previousStatus: row.status,
        slotGroupId: row.slot_group_id != null ? Number(row.slot_group_id) : null,
        memberId: row.member_id != null ? Number(row.member_id) : null,
        strictBilling: strict,
        accountId: accountId == null ? null : Number(accountId),
        asOfDate: asOfDate ?? todayDateOnly(),
        stripeCanceller,
      })
      if (id != null) cancelledIds.push(id)
    } catch (err) {
      if (strict) throw err
      console.warn('[memberEnrollmentCancel] finalize failed for signup', row.id, err?.message ?? err)
    }
  }
  return cancelledIds
}

async function finalizeEnrollmentCancellation(pool, {
  signupId,
  previousStatus,
  slotGroupId,
  memberId,
  strictBilling = false,
  accountId = null,
  asOfDate = null,
  stripeCanceller = cancelStripeSubscriptionNow,
}) {
  const ownsClient = typeof pool.release !== 'function' && typeof pool.connect === 'function'
  const client = ownsClient ? await pool.connect() : pool
  let promotedRows = []
  let subscriptionEndDate = asOfDate == null ? null : dayBefore(asOfDate)
  try {
    if (strictBilling) {
      const remoteSubscriptions = await client.query(
        `SELECT stripe_subscription_id
           FROM billing_subscription
          WHERE family_billing_account_id = $1
            AND source_type = 'scheduling_signup'
            AND source_id = $2
            AND status <> 'cancelled'
            AND stripe_subscription_id IS NOT NULL
          ORDER BY id`,
        [accountId, String(signupId)],
      )
      for (const subscription of remoteSubscriptions.rows) {
        const outcome = await stripeCanceller(subscription.stripe_subscription_id)
        if (!['cancelled', 'already_cancelled'].includes(outcome?.status)) {
          const error = new Error(`Stripe subscription ${subscription.stripe_subscription_id} could not be retired for enrollment ${signupId}.`)
          error.code = 'enrollment_cancellation_stripe_retirement_failed'
          error.details = outcome
          throw error
        }
      }
    }
    await client.query('BEGIN')

    if (strictBilling) {
      const locked = await client.query(
        `SELECT id, cancel_effective_date
           FROM scheduling_signup
          WHERE id = $1
            AND cancel_effective_date IS NOT NULL
            AND cancel_effective_date <= $2::date
            AND status IN ('confirmed', 'waitlisted', 'paused')
            AND orphaned_at IS NULL
          FOR UPDATE`,
        [signupId, asOfDate],
      )
      if (!locked.rows[0]) {
        await client.query('COMMIT')
        return null
      }
      const effectiveDate = formatDateOnly(locked.rows[0].cancel_effective_date)
      if (effectiveDate) subscriptionEndDate = dayBefore(effectiveDate)
      const lockedSubscriptions = await client.query(
        `SELECT id
           FROM billing_subscription
          WHERE family_billing_account_id = $1
            AND source_type = 'scheduling_signup'
            AND source_id = $2
            AND status <> 'cancelled'
          ORDER BY id
          FOR UPDATE`,
        [accountId, String(signupId)],
      )
      if (lockedSubscriptions.rows.length === 0) {
        const error = new Error(`Enrollment ${signupId} lost its billing subscription before cancellation.`)
        error.code = 'enrollment_cancellation_subscription_missing'
        throw error
      }
    }

    const cancelledSignup = await client.query(
      `
        UPDATE scheduling_signup
        SET status = 'cancelled',
            cancel_effective_date = NULL,
            cancel_requested_at = NULL
        WHERE id = $1
          ${strictBilling ? "AND status IN ('confirmed', 'waitlisted', 'paused')" : ''}
        RETURNING id
      `,
      [signupId],
    )
    if (strictBilling && !cancelledSignup.rows[0]) {
      const error = new Error(`Enrollment ${signupId} changed while its cancellation was being finalized.`)
      error.code = 'enrollment_cancellation_cas_failed'
      throw error
    }

    const source = { sourceType: 'scheduling_signup', sourceId: signupId }
    if (strictBilling) {
      await client.query(
        `UPDATE billing_subscription
            SET status = 'cancelled',
                end_date = COALESCE(end_date, $3::date),
                next_bill_date = NULL,
                updated_at = now()
          WHERE family_billing_account_id = $1
            AND source_type = 'scheduling_signup'
            AND source_id = $2
            AND status <> 'cancelled'`,
        [accountId, String(signupId), subscriptionEndDate],
      )
      const remaining = await client.query(
        `SELECT id
           FROM billing_subscription
          WHERE family_billing_account_id = $1
            AND source_type = 'scheduling_signup'
            AND source_id = $2
            AND status <> 'cancelled'
          LIMIT 1`,
        [accountId, String(signupId)],
      )
      if (remaining.rows[0]) {
        const error = new Error(`Enrollment ${signupId} retained a live subscription after cancellation.`)
        error.code = 'enrollment_cancellation_postcondition_failed'
        throw error
      }
    } else await safeCancelSubscriptionsForSource(client, source)
    const restoreOptions = { signupId, reason: 'Enrollment cancelled' }
    if (strictBilling) await restorePassCreditsForSignup(client, restoreOptions)
    else await safeRestorePassCreditsForSignup(client, restoreOptions)

    if (previousStatus === 'confirmed' && slotGroupId != null) {
      promotedRows = (await promoteFromWaitlist(client, slotGroupId, 1)) ?? []
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    if (ownsClient) client.release()
  }

  if (!strictBilling) scheduleFamilyDiscountResync(pool, memberId)

  return signupId
}

/**
 * Schedule or immediately cancel a scheduling signup on behalf of a family member.
 * @returns {{ signupId:number, effectiveDate:string|null, immediate:boolean }}
 */
export async function requestMemberEnrollmentCancellation(pool, {
  signupId,
  allowedMemberIds,
  requestedByUserId = null,
  reason = null,
}) {
  if (!allowedMemberIds?.length) {
    const err = new Error('Not authorized to cancel this enrollment')
    err.statusCode = 403
    throw err
  }

  try {
    await ensureEnrollmentLifecycleColumns(pool)
  } catch (schemaErr) {
    console.warn('[memberEnrollmentCancel] schema ensure:', schemaErr?.message ?? schemaErr)
  }

  const existing = await pool.query(
    `
      SELECT s.id, s.member_id, s.status, s.slot_group_id, s.cancel_effective_date, s.orphaned_at,
             TO_CHAR(COALESCE(o.end_date, sg.active_end, sf.end_date), 'YYYY-MM-DD') AS program_end_date,
             bs.family_billing_account_id
      FROM scheduling_signup s
      JOIN scheduling_form sf ON sf.id = s.form_id
      LEFT JOIN scheduling_slot_group sg ON sg.id = s.slot_group_id
      LEFT JOIN scheduling_offering o ON o.id = sg.offering_id
      LEFT JOIN LATERAL (
        SELECT family_billing_account_id
        FROM billing_subscription
        WHERE source_type = 'scheduling_signup' AND source_id = s.id::text
        ORDER BY id DESC LIMIT 1
      ) bs ON TRUE
      WHERE s.id = $1
    `,
    [signupId],
  )
  if (existing.rows.length === 0 || existing.rows[0].orphaned_at != null) {
    const err = new Error('Enrollment not found')
    err.statusCode = 404
    throw err
  }

  const signup = existing.rows[0]
  if (!allowedMemberIds.map(Number).includes(Number(signup.member_id))) {
    const err = new Error('Not authorized to cancel this enrollment')
    err.statusCode = 403
    throw err
  }

  if (signup.status === 'cancelled' || signup.status === 'completed') {
    const err = new Error('This enrollment is already cancelled')
    err.statusCode = 400
    throw err
  }

  if (signup.cancel_effective_date) {
    const err = new Error('Cancellation is already scheduled for this enrollment')
    err.statusCode = 400
    throw err
  }

  // Waitlisted athletes have no active billing — cancel immediately.
  if (signup.status === 'waitlisted') {
    await finalizeEnrollmentCancellation(pool, {
      signupId: Number(signup.id),
      previousStatus: signup.status,
      slotGroupId: signup.slot_group_id != null ? Number(signup.slot_group_id) : null,
      memberId: signup.member_id != null ? Number(signup.member_id) : null,
    })
    return { signupId: Number(signup.id), effectiveDate: null, immediate: true }
  }

  const duplicate = await pool.query(
    `SELECT id FROM enrollment_cancellation_request WHERE signup_id = $1 AND status = 'pending'`,
    [signupId],
  )
  if (duplicate.rows[0]) {
    const err = new Error('A cancellation request is already awaiting billing review')
    err.statusCode = 400
    throw err
  }

  const effectiveDate = nextEnrollmentBillingChangeDate()
  const programEndDate = formatDateOnly(signup.program_end_date)
  const isFixedTerm = Boolean(programEndDate)
  const inserted = await pool.query(
    `INSERT INTO enrollment_cancellation_request (
       signup_id, family_billing_account_id, requested_by_user_id, request_reason,
       recommended_effective_date, is_fixed_term, program_end_date
     ) VALUES ($1, $2, $3, $4, $5, $6, $7)
     RETURNING id`,
    [signupId, signup.family_billing_account_id ?? null, requestedByUserId, reason, effectiveDate, isFixedTerm, programEndDate],
  )

  return {
    signupId: Number(signup.id),
    requestId: Number(inserted.rows[0].id),
    effectiveDate,
    immediate: false,
    pendingReview: true,
    isFixedTerm,
  }
}
