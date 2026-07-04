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

  if (memberId != null) {
    try {
      const famRes = await pool.query(`SELECT family_id FROM member WHERE id = $1`, [memberId])
      const familyId = famRes.rows[0]?.family_id
      if (familyId) await syncFamilyEnrollmentDiscounts(pool, Number(familyId))
    } catch (syncErr) {
      console.warn('[memberEnrollmentCancel] discount resync:', syncErr?.message ?? syncErr)
    }
  }

  return signupId
}

/**
 * Schedule or immediately cancel a scheduling signup on behalf of a family member.
 * @returns {{ signupId:number, effectiveDate:string|null, immediate:boolean }}
 */
export async function requestMemberEnrollmentCancellation(pool, {
  signupId,
  allowedMemberIds,
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
      SELECT id, member_id, status, slot_group_id, cancel_effective_date, orphaned_at
      FROM scheduling_signup
      WHERE id = $1
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

  const effectiveDate = nextEnrollmentBillingChangeDate()
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    await client.query(
      `
        UPDATE scheduling_signup
        SET cancel_effective_date = $2,
            cancel_requested_at = now()
        WHERE id = $1
      `,
      [signupId, effectiveDate],
    )
    await safeScheduleSubscriptionEnd(client, {
      sourceType: 'scheduling_signup',
      sourceId: signupId,
      effectiveDate,
    })
    await client.query('COMMIT')
  } catch (err) {
    await client.query('ROLLBACK')
    throw err
  } finally {
    client.release()
  }

  await syncStripeForBillingSource(pool, {
    sourceType: 'scheduling_signup',
    sourceId: signupId,
    effectiveDate,
    immediate: false,
  })

  if (signup.member_id != null) {
    try {
      const famRes = await pool.query(`SELECT family_id FROM member WHERE id = $1`, [signup.member_id])
      const familyId = famRes.rows[0]?.family_id
      if (familyId) await syncFamilyEnrollmentDiscounts(pool, Number(familyId))
    } catch (syncErr) {
      console.warn('[memberEnrollmentCancel] discount resync:', syncErr?.message ?? syncErr)
    }
  }

  return { signupId: Number(signup.id), effectiveDate, immediate: false }
}
