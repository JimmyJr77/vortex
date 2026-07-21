import { scheduleSubscriptionEndAtFirst } from '../scheduling/memberEnrollmentCancel.js'
import { syncStripeForBillingSource } from './stripeSubscriptionSync.js'

export async function listCancellationRequests(pool, { status = 'pending' } = {}) {
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
     WHERE ($1::text IS NULL OR r.status = $1)
     ORDER BY r.created_at ASC`,
    [status || null],
  )
  return result.rows
}

export async function reviewCancellationRequest(pool, {
  requestId,
  decision,
  effectiveDate = null,
  reviewNote,
  reviewedByUserId = null,
}) {
  if (!['approved', 'declined'].includes(decision)) throw new Error('Decision must be approved or declined.')
  if (!String(reviewNote || '').trim()) throw new Error('A review note is required.')

  const client = await pool.connect()
  let request
  try {
    await client.query('BEGIN')
    const claimed = await client.query(
      `SELECT * FROM enrollment_cancellation_request
       WHERE id = $1 AND status = 'pending' FOR UPDATE`,
      [requestId],
    )
    request = claimed.rows[0]
    if (!request) throw new Error('Pending cancellation request not found.')

    const approvedDate = decision === 'approved'
      ? (effectiveDate || String(request.recommended_effective_date).slice(0, 10))
      : null

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
       WHERE id = $1 RETURNING *`,
      [requestId, decision, approvedDate, String(reviewNote).trim(), reviewedByUserId],
    )
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
      effectiveDate: String(request.approved_effective_date).slice(0, 10), immediate: false,
    }).catch((error) => console.warn('[cancellationReview] stripe sync:', error?.message ?? error))
  }
  return request
}
