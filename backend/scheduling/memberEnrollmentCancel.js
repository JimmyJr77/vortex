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
import { safeRestorePassCreditsForSignup } from '../programs/multiClassPass.js'
import { syncStripeForBillingSource } from '../billing/stripeSubscriptionSync.js'

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

/**
 * Finalize signups whose cancel_effective_date has arrived.
 * @returns {Promise<number[]>} signup ids cancelled
 */
export async function processDueEnrollmentCancellations(pool) {
  try {
    await ensureEnrollmentLifecycleColumns(pool)
  } catch (schemaErr) {
    console.warn('[memberEnrollmentCancel] schema ensure:', schemaErr?.message ?? schemaErr)
  }

  const due = await pool.query(
    `
      SELECT id, member_id, slot_group_id, status
      FROM scheduling_signup
      WHERE cancel_effective_date IS NOT NULL
        AND cancel_effective_date <= CURRENT_DATE
        AND status IN ('confirmed', 'waitlisted', 'paused')
        AND orphaned_at IS NULL
    `,
  )
  const cancelledIds = []
  for (const row of due.rows) {
    try {
      const id = await finalizeEnrollmentCancellation(pool, {
        signupId: Number(row.id),
        previousStatus: row.status,
        slotGroupId: row.slot_group_id != null ? Number(row.slot_group_id) : null,
        memberId: row.member_id != null ? Number(row.member_id) : null,
      })
      if (id != null) cancelledIds.push(id)
    } catch (err) {
      console.warn('[memberEnrollmentCancel] finalize failed for signup', row.id, err?.message ?? err)
    }
  }
  return cancelledIds
}

async function finalizeEnrollmentCancellation(pool, { signupId, previousStatus, slotGroupId, memberId }) {
  const client = await pool.connect()
  let promotedRows = []
  try {
    await client.query('BEGIN')

    await client.query(
      `
        UPDATE scheduling_signup
        SET status = 'cancelled',
            cancel_effective_date = NULL,
            cancel_requested_at = NULL
        WHERE id = $1
      `,
      [signupId],
    )

    const source = { sourceType: 'scheduling_signup', sourceId: signupId }
    await safeCancelSubscriptionsForSource(client, source)
    await safeRestorePassCreditsForSignup(client, {
      signupId,
      reason: 'Enrollment cancelled',
    })

    if (previousStatus === 'confirmed' && slotGroupId != null) {
      promotedRows = (await promoteFromWaitlist(client, slotGroupId, 1)) ?? []
    }

    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  scheduleFamilyDiscountResync(pool, memberId)

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
             COALESCE(o.end_date, sg.active_end, sf.end_date) AS program_end_date,
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
  const programEndDate = signup.program_end_date ? String(signup.program_end_date).slice(0, 10) : null
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
