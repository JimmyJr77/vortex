import { auditCanonicalBillingMigration } from './canonicalBillingMigration.js'
import { facilityMonth, nextBillingMonth } from './canonicalBillingMigrationState.js'
import { getStripeClient, stripeEnabled } from './stripeBilling.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'

const ADVISORY_LOCK_ID = 810202609
const SCHEDULER_INTERVAL_MS = 5 * 1000
const MAX_JOBS_PER_PASS = 8
const MAX_ATTEMPTS = 5

function paymentFactStatus(value) {
  const status = String(value ?? '').trim().toLowerCase()
  if (['settled', 'succeeded'].includes(status)) return 'settled'
  if (['canceled', 'cancelled'].includes(status)) return 'canceled'
  if (status === 'failed') return 'failed'
  if (status === 'reconciliation_required') return 'reconciliation_required'
  if (status === 'processing') return 'processing'
  if (status === 'pending') return 'pending'
  return status || 'unknown'
}

function retryDelayMs(attemptCount) {
  return Math.min(15 * 60 * 1000, 5_000 * (2 ** Math.max(0, attemptCount - 1)))
}

function auditSummary(report) {
  const accounts = Array.isArray(report?.accounts) ? report.accounts : []
  const notReady = accounts.filter((account) => account.classification !== 'ready')
  return {
    activeFamilyCount: Number(report?.inventory?.activeFamilyCount ?? 0),
    billingAccountCount: Number(report?.inventory?.billingAccountCount ?? 0),
    missingBillingAccountCount: Number(report?.inventory?.missingBillingAccountCount ?? 0),
    readyAccountCount: accounts.length - notReady.length,
    nonReadyAccountCount: notReady.length,
    nonReadyAccounts: notReady.map((account) => ({
      familyId: account.familyId ?? null,
      accountId: account.accountId ?? null,
      classification: account.classification ?? null,
      exceptionCodes: (account.exceptions ?? []).map((exception) => exception.code),
    })),
  }
}

async function claimNextJob(pool) {
  const result = await pool.query(
    `WITH candidate AS (
       SELECT id
         FROM billing_payment_fact_audit_job
        WHERE (
          run_status = 'pending'
          OR (run_status = 'failed' AND attempt_count < $1 AND next_attempt_at <= now())
        )
        ORDER BY requested_at, id
        FOR UPDATE SKIP LOCKED
        LIMIT 1
     )
     UPDATE billing_payment_fact_audit_job job
        SET run_status = 'running',
            started_at = now(),
            attempt_count = job.attempt_count + 1,
            error_message = NULL,
            updated_at = now()
       FROM candidate
      WHERE job.id = candidate.id
      RETURNING job.*`,
    [MAX_ATTEMPTS],
  )
  return result.rows[0] ?? null
}

async function loadPaymentFact(pool, job) {
  const result = await pool.query(
    `SELECT payment.id, payment.family_billing_account_id, payment.amount_cents,
            COALESCE(NULLIF(BTRIM(payment.external_status), ''), 'settled') AS external_status,
            payment.paid_at, payment.created_at, payment.stripe_payment_intent_id,
            payment.stripe_invoice_id, payment.external_processor, payment.external_reference
       FROM billing_payment payment
      WHERE payment.id = $1
        AND payment.family_billing_account_id = $2`,
    [Number(job.billing_payment_id), Number(job.family_billing_account_id)],
  )
  if (!result.rows[0]) throw new Error(`Payment #${job.billing_payment_id} no longer exists for this audit job.`)
  const payment = result.rows[0]
  return {
    paymentId: Number(payment.id),
    accountId: Number(payment.family_billing_account_id),
    amountCents: Number(payment.amount_cents),
    status: paymentFactStatus(payment.external_status),
    rawStatus: payment.external_status,
    paidAt: payment.paid_at ?? null,
    createdAt: payment.created_at ?? null,
    stripePaymentIntentId: payment.stripe_payment_intent_id ?? null,
    stripeInvoiceId: payment.stripe_invoice_id ?? null,
    externalProcessor: payment.external_processor ?? null,
    externalReference: payment.external_reference ?? null,
  }
}

async function loadAuditTargetMonth(pool, accountId, now) {
  const row = await pool.query(
    `SELECT facility.timezone
       FROM family_billing_account account
       JOIN family ON family.id = account.family_id
       JOIN facility ON facility.id = family.facility_id
      WHERE account.id = $1`,
    [Number(accountId)],
  ).then((result) => result.rows[0] ?? null)
  if (!row?.timezone) throw new Error(`Payment audit cannot determine the facility timezone for account ${accountId}.`)
  return nextBillingMonth(facilityMonth(now, row.timezone))
}

async function completeJob(pool, job, { result, error = null }) {
  const succeeded = error == null
  const nextAttemptAt = succeeded
    ? null
    : new Date(Date.now() + retryDelayMs(Number(job.attempt_count)))
  await pool.query(
    `UPDATE billing_payment_fact_audit_job
        SET run_status = $2,
            completed_at = CASE WHEN $2 = 'succeeded' THEN now() ELSE NULL END,
            next_attempt_at = COALESCE($3::timestamptz, next_attempt_at),
            result = $4::jsonb,
            error_message = $5,
            updated_at = now()
      WHERE id = $1`,
    [
      Number(job.id),
      succeeded ? 'succeeded' : 'failed',
      nextAttemptAt,
      JSON.stringify(result ?? {}),
      error == null ? null : String(error?.message ?? error),
    ],
  )
}

async function runClaimedPaymentFactAudit(pool, job, { now = new Date(), stripe = undefined } = {}) {
  const payment = await loadPaymentFact(pool, job)
  try {
    const targetMonth = await loadAuditTargetMonth(pool, payment.accountId, now)
    const client = stripe === undefined
      ? (stripeEnabled() ? await getStripeClient() : null)
      : stripe
    const report = await auditCanonicalBillingMigration(pool, {
      includeAllActiveFamilies: true,
      targetMonth,
      stripe: client,
      now,
      apply: false,
      requestedByType: 'system',
      cohort: 'automatic_payment_fact_audit',
    })
    const result = {
      payment,
      targetMonth,
      audit: auditSummary(report),
      verifiedAt: new Date().toISOString(),
    }
    await completeJob(pool, job, { result })
    await recordBillingActivityBestEffort(pool, {
      eventKey: `payment-fact-audit-completed:${job.id}`,
      accountId: payment.accountId,
      paymentId: payment.paymentId,
      eventType: 'payment_fact_audit_completed',
      summary: `Automatic all-account audit recorded payment #${payment.paymentId} as ${payment.status}.`,
      afterValue: result,
      details: { jobId: Number(job.id), paymentStatus: payment.status },
      actorType: 'system',
    })
    return { status: 'succeeded', jobId: Number(job.id), result }
  } catch (error) {
    const failure = {
      payment,
      failedAt: new Date().toISOString(),
      error: String(error?.message ?? error),
    }
    await completeJob(pool, job, { result: failure, error })
    await recordBillingActivityBestEffort(pool, {
      eventKey: `payment-fact-audit-failed:${job.id}:${Number(job.attempt_count)}`,
      accountId: payment.accountId,
      paymentId: payment.paymentId,
      eventType: 'payment_fact_audit_failed',
      summary: `Automatic all-account audit could not complete after payment #${payment.paymentId}; payment remains recorded as ${payment.status}.`,
      afterValue: failure,
      details: { jobId: Number(job.id), paymentStatus: payment.status },
      actorType: 'system',
    })
    throw error
  }
}

/** Run queued payment fact audits. A database advisory lock prevents multiple Render instances from duplicating work. */
export async function runDuePaymentFactAudits(pool, { now = new Date(), stripe = undefined } = {}) {
  const lock = await pool.query('SELECT pg_try_advisory_lock($1) AS acquired', [ADVISORY_LOCK_ID])
  if (!lock.rows[0]?.acquired) return { processed: 0, skipped: 'lock_not_acquired' }
  let processed = 0
  let failed = 0
  try {
    while (processed < MAX_JOBS_PER_PASS) {
      const job = await claimNextJob(pool)
      if (!job) break
      try {
        await runClaimedPaymentFactAudit(pool, job, { now, stripe })
      } catch (error) {
        failed += 1
        console.warn('[billing-payment-fact-audit] job failed:', error?.message ?? error)
      }
      processed += 1
    }
    return { processed, failed }
  } finally {
    await pool.query('SELECT pg_advisory_unlock($1)', [ADVISORY_LOCK_ID]).catch(() => {})
  }
}

/** Start the durable worker. Payment writes are already queued by the database trigger. */
export function startPaymentFactAuditScheduler(pool) {
  const run = () => {
    void runDuePaymentFactAudits(pool).catch((error) => {
      console.warn('[billing-payment-fact-audit] scheduler failed:', error?.message ?? error)
    })
  }
  setTimeout(run, 1_000)
  const timer = setInterval(run, SCHEDULER_INTERVAL_MS)
  if (typeof timer.unref === 'function') timer.unref()
}

export { paymentFactStatus, auditSummary }
