import { getStripeClient, recordStripePayment, stripeEnabled } from './stripeBilling.js'
import { ensureStripeOperationsSchema, recordStripeBillingAlert } from './stripeOperations.js'

let schemaEnsured = false

async function ensureSchema(pool) {
  if (schemaEnsured) return
  await ensureStripeOperationsSchema(pool)
  const fs = await import('fs')
  const migrationPath = new URL('../migrations/231_stripe_reconciliation.sql', import.meta.url)
  await pool.query(fs.readFileSync(migrationPath, 'utf8'))
  schemaEnsured = true
}

function stripeId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

export function paymentAmountsMismatch(localAmountCents, stripeAmountCents) {
  return Number(localAmountCents) !== Number(stripeAmountCents)
}

async function accountIdForPaymentIntent(pool, intent) {
  const metadataId = Number(intent?.metadata?.familyBillingAccountId)
  if (Number.isFinite(metadataId) && metadataId > 0) return metadataId
  const customerId = stripeId(intent?.customer)
  if (!customerId) return null
  const result = await pool.query(
    `SELECT id FROM family_billing_account WHERE stripe_customer_id = $1 LIMIT 1`,
    [customerId],
  )
  return result.rows[0]?.id ? Number(result.rows[0].id) : null
}

async function createReconciliationAlert(pool, key, type, severity, message, objectId, details = {}) {
  return recordStripeBillingAlert(pool, {
    event: { id: `reconciliation:${key}` },
    object: { id: objectId, metadata: {}, ...details },
    alertType: type,
    severity,
    message,
  })
}

export async function runStripeReconciliation(pool, { lookbackHours = 48 } = {}) {
  if (!stripeEnabled()) throw new Error('Stripe is disabled or not configured.')
  await ensureSchema(pool)
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Stripe SDK is unavailable.')

  const endedAt = new Date()
  const startedAt = new Date(endedAt.getTime() - Math.max(1, Number(lookbackHours)) * 60 * 60 * 1000)
  const runResult = await pool.query(
    `INSERT INTO stripe_reconciliation_run (status, window_started_at, window_ended_at)
     VALUES ('running', $1, $2) RETURNING id`,
    [startedAt, endedAt],
  )
  const runId = runResult.rows[0].id
  const summary = { stripePaymentsChecked: 0, paymentsInserted: 0, mismatchesFound: 0, disputesChecked: 0 }

  try {
    for await (const intent of stripe.paymentIntents.list({
      created: { gte: Math.floor(startedAt.getTime() / 1000), lte: Math.floor(endedAt.getTime() / 1000) },
      limit: 100,
    })) {
      if (intent.status !== 'succeeded') continue
      summary.stripePaymentsChecked += 1
      const local = await pool.query(
        `SELECT id, amount_cents, family_billing_account_id FROM billing_payment
         WHERE stripe_payment_intent_id = $1 LIMIT 1`,
        [intent.id],
      )
      const stripeAmount = Number(intent.amount_received ?? intent.amount ?? 0)
      if (local.rows[0]) {
        if (paymentAmountsMismatch(local.rows[0].amount_cents, stripeAmount)) {
          summary.mismatchesFound += 1
          await createReconciliationAlert(
            pool, `${intent.id}:amount`, 'reconciliation_mismatch', 'critical',
            `Stripe payment ${intent.id} does not match the local ledger amount`, intent.id,
            { amount: stripeAmount, reason: `local_amount_cents:${local.rows[0].amount_cents}` },
          )
        }
        continue
      }

      const accountId = await accountIdForPaymentIntent(pool, intent)
      if (accountId) {
        const inserted = await recordStripePayment(pool, {
          paymentIntentId: intent.id,
          amountCents: stripeAmount,
          accountId,
          customerId: stripeId(intent.customer),
        })
        if (inserted) summary.paymentsInserted += 1
      } else {
        summary.mismatchesFound += 1
        await createReconciliationAlert(
          pool, `${intent.id}:unmapped`, 'unmapped_stripe_payment', 'critical',
          `Stripe payment ${intent.id} could not be mapped to a family`, intent.id,
          { amount: stripeAmount },
        )
      }
    }

    for await (const dispute of stripe.disputes.list({
      created: { gte: Math.floor(startedAt.getTime() / 1000) },
      limit: 100,
    })) {
      summary.disputesChecked += 1
      if (['won', 'lost'].includes(dispute.status)) continue
      await createReconciliationAlert(
        pool, `dispute:${dispute.id}`, 'dispute', 'critical',
        `Stripe dispute ${dispute.status ?? 'requires attention'} (${dispute.reason ?? 'reason unavailable'})`,
        dispute.id, { status: dispute.status, reason: dispute.reason, amount: dispute.amount },
      )
    }

    const staleWebhooks = await pool.query(
      `SELECT event_id, event_type, status, last_error FROM stripe_webhook_event
       WHERE status = 'failed' OR (status = 'processing' AND updated_at < now() - interval '15 minutes')`,
    )
    for (const webhook of staleWebhooks.rows) {
      await createReconciliationAlert(
        pool, `webhook:${webhook.event_id}`, 'webhook_failure', 'critical',
        `Stripe webhook ${webhook.event_type} is ${webhook.status}`, webhook.event_id,
        { status: webhook.status, reason: webhook.last_error },
      )
    }

    await pool.query(
      `UPDATE stripe_reconciliation_run SET status = 'succeeded', stripe_payments_checked = $2,
       payments_inserted = $3, mismatches_found = $4, disputes_checked = $5, completed_at = now()
       WHERE id = $1`,
      [runId, summary.stripePaymentsChecked, summary.paymentsInserted, summary.mismatchesFound, summary.disputesChecked],
    )
    console.log(JSON.stringify({ level: 'info', message: 'Stripe reconciliation completed', runId, ...summary }))
    return { runId: Number(runId), ...summary, status: 'succeeded', windowStartedAt: startedAt, windowEndedAt: endedAt }
  } catch (error) {
    await pool.query(
      `UPDATE stripe_reconciliation_run SET status = 'failed', error_message = $2, completed_at = now() WHERE id = $1`,
      [runId, String(error?.message ?? error).slice(0, 1000)],
    )
    await createReconciliationAlert(pool, `run:${runId}`, 'reconciliation_failed', 'critical',
      `Daily Stripe reconciliation failed: ${error?.message ?? error}`, String(runId))
    throw error
  }
}

export async function getStripeOperationsDashboard(pool) {
  await ensureSchema(pool)
  const [alerts, latestRun, webhookCounts] = await Promise.all([
    pool.query(`SELECT * FROM stripe_billing_alert WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 100`),
    pool.query(`SELECT * FROM stripe_reconciliation_run ORDER BY started_at DESC LIMIT 1`),
    pool.query(`SELECT status, COUNT(*)::int AS count FROM stripe_webhook_event
      WHERE received_at >= now() - interval '7 days' GROUP BY status`),
  ])
  return {
    stripeEnabled: stripeEnabled(),
    emailDomain: process.env.STRIPE_EMAIL_DOMAIN || null,
    emailDomainVerified: process.env.STRIPE_EMAIL_DOMAIN_VERIFIED === 'true',
    alerts: alerts.rows,
    latestReconciliation: latestRun.rows[0] ?? null,
    webhookCounts: Object.fromEntries(webhookCounts.rows.map((row) => [row.status, Number(row.count)])),
  }
}
