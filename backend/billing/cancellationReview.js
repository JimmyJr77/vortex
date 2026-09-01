import { scheduleSubscriptionEndAtFirst } from '../scheduling/memberEnrollmentCancel.js'
import { formatDateOnly } from '../scheduling/slotDisplayLabel.js'
import { requireAdminFacilityScope } from './adminFacilityScope.js'
import { syncStripeForBillingSource } from './stripeSubscriptionSync.js'

export async function listCancellationRequests(pool, {
  status = 'pending',
  facilityId = null,
  allowGlobal = false,
} = {}) {
  const scopedFacilityId = requireAdminFacilityScope({ facilityId, allowGlobal })
  const result = await pool.query(
    `SELECT r.*,
            NULLIF(TRIM(CONCAT(m.first_name, ' ', m.last_name)), '') AS member_name,
            COALESCE(p.display_name, p.name, sf.title) AS class_name,
            fba.billing_email
     FROM enrollment_cancellation_request r
     JOIN scheduling_signup s ON s.id = r.signup_id
     LEFT JOIN member m ON m.id = s.member_id
     JOIN scheduling_form sf ON sf.id = s.form_id
     LEFT JOIN program p ON p.id = sf.program_id
     LEFT JOIN family_billing_account fba ON fba.id = r.family_billing_account_id
     LEFT JOIN family f ON f.id = fba.family_id
     WHERE ($1::text IS NULL OR r.status = $1)
       AND ($2::bigint IS NULL OR f.facility_id = $2)
     ORDER BY r.created_at ASC`,
    [status || null, scopedFacilityId],
  )
  return result.rows
}

export async function reviewCancellationRequest(pool, {
  requestId,
  decision,
  effectiveDate = null,
  reviewNote,
  reviewedByUserId = null,
  facilityId = null,
  allowGlobal = false,
}) {
  if (!['approved', 'declined'].includes(decision)) throw new Error('Decision must be approved or declined.')
  if (!String(reviewNote || '').trim()) throw new Error('A review note is required.')
  const scopedFacilityId = requireAdminFacilityScope({ facilityId, allowGlobal })

  const client = await pool.connect()
  let request
  try {
    await client.query('BEGIN')
    const claimed = await client.query(
      `SELECT r.*
       FROM enrollment_cancellation_request r
       LEFT JOIN family_billing_account fba ON fba.id = r.family_billing_account_id
       LEFT JOIN family f ON f.id = fba.family_id
       WHERE r.id = $1
         AND r.status = 'pending'
         AND ($2::bigint IS NULL OR f.facility_id = $2)
       FOR UPDATE OF r`,
      [requestId, scopedFacilityId],
    )
    request = claimed.rows[0]
    if (!request) throw new Error('Pending cancellation request not found.')

    const approvedDate = decision === 'approved'
      ? formatDateOnly(effectiveDate || request.recommended_effective_date)
      : null
    if (decision === 'approved' && !approvedDate) {
      throw new Error('A valid cancellation effective date is required.')
    }

    if (decision === 'approved') {
      await client.query(
        `UPDATE scheduling_signup
         SET cancel_effective_date = $2, cancel_requested_at = COALESCE(cancel_requested_at, now())
         WHERE id = $1 AND status IN ('confirmed', 'paused')`,
        [request.signup_id, approvedDate],
      )
      await scheduleSubscriptionEndAtFirst(client, {
        sourceType: 'scheduling_signup', sourceId: request.signup_id, effectiveDate: approvedDate,
      })
    }

    const updated = await client.query(
      `UPDATE enrollment_cancellation_request
       SET status = $2, approved_effective_date = $3, review_note = $4,
           reviewed_by_user_id = $5, reviewed_at = now(), updated_at = now()
       WHERE id = $1
         AND ($6::bigint IS NULL OR EXISTS (
           SELECT 1
           FROM family_billing_account scoped_account
           JOIN family scoped_family ON scoped_family.id = scoped_account.family_id
           WHERE scoped_account.id = enrollment_cancellation_request.family_billing_account_id
             AND scoped_family.facility_id = $6
         ))
       RETURNING *`,
      [requestId, decision, approvedDate, String(reviewNote).trim(), reviewedByUserId, scopedFacilityId],
    )
    if (!updated.rows[0]) throw new Error('Pending cancellation request not found.')
    await client.query('COMMIT')
    request = updated.rows[0]
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }

  if (decision === 'approved') {
    void syncStripeForBillingSource(pool, {
      sourceType: 'scheduling_signup', sourceId: request.signup_id,
      effectiveDate: formatDateOnly(request.approved_effective_date), immediate: false,
    }).catch((error) => console.warn('[cancellationReview] stripe sync:', error?.message ?? error))
  }
  return request
}
