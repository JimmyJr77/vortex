#!/usr/bin/env node

/**
 * Retire explicitly identified test enrollment charges from a lifetime-owner
 * household without deleting the immutable payment trail. The charge rows are
 * suppressed and offset with linked adjustments; each former payment
 * allocation receives an append-only reversal so settled test payments become
 * reusable household credit.
 *
 * Dry-run by default. Example:
 *   node backend/scripts/repair-lifetime-owner-test-account.mjs \
 *     --account-id=461 --family-id=21 --charge-ids=6,7,8,9 \
 *     --settle-payment-ids=6 --apply
 */

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import dotenv from 'dotenv'
import pg from 'pg'
import { recordBillingActivity } from '../billing/billingActivity.js'

const scriptDir = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.join(scriptDir, '..', '.env.local') })
dotenv.config({ path: path.join(scriptDir, '..', '.env') })

function option(name) {
  return String(process.argv.find((entry) => entry.startsWith(`--${name}=`))?.slice(name.length + 3) ?? '')
}

function positiveInteger(value, label) {
  const normalized = Number(value)
  if (!Number.isInteger(normalized) || normalized <= 0) throw new Error(`Pass a positive --${label}.`)
  return normalized
}

function idList(name) {
  const values = option(name)
    .split(',')
    .filter(Boolean)
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0)
  if (values.length === 0) throw new Error(`Pass --${name}=<comma-separated ids> to keep this repair explicitly scoped.`)
  return [...new Set(values)]
}

const accountId = positiveInteger(option('account-id'), 'account-id')
const familyId = positiveInteger(option('family-id'), 'family-id')
const chargeIds = idList('charge-ids')
const settlePaymentIds = option('settle-payment-ids')
  ? idList('settle-payment-ids')
  : []
const apply = process.argv.includes('--apply')
const connectionString = process.env.EXTERNAL_DB_URL || process.env.DATABASE_URL || process.env.DB_URL

if (!connectionString) throw new Error('A database connection URL is required.')

const pool = new pg.Pool({
  connectionString,
  ssl: /render\.com|neon\.tech|supabase\.co|rds\.amazonaws\.com/i.test(connectionString)
    ? { rejectUnauthorized: false }
    : false,
})

const client = await pool.connect()
try {
  await client.query('BEGIN')
  await client.query('SELECT pg_advisory_xact_lock($1::bigint)', [accountId])

  const account = await client.query(
    `SELECT id, family_id
       FROM family_billing_account
      WHERE id = $1
        AND family_id = $2
        AND is_active = TRUE
      FOR UPDATE`,
    [accountId, familyId],
  ).then((result) => result.rows[0] ?? null)
  if (!account) throw new Error('The active billing account does not belong to the supplied family.')

  const charges = await client.query(
    `SELECT id, member_id, description, amount_cents, service_period_start, metadata
       FROM billing_charge
      WHERE family_billing_account_id = $1
        AND id = ANY($2::bigint[])
        AND amount_cents > 0
      ORDER BY id
      FOR UPDATE`,
    [accountId, chargeIds],
  )
  if (charges.rows.length !== chargeIds.length) {
    throw new Error('Every requested charge must be a positive charge on the supplied account.')
  }

  const paymentsToSettle = settlePaymentIds.length === 0
    ? { rows: [] }
    : await client.query(
      `SELECT id, amount_cents, external_status, stripe_payment_intent_id, stripe_checkout_session_id
         FROM billing_payment
        WHERE family_billing_account_id = $1
          AND id = ANY($2::bigint[])
        ORDER BY id
        FOR UPDATE`,
      [accountId, settlePaymentIds],
    )
  if (paymentsToSettle.rows.length !== settlePaymentIds.length) {
    throw new Error('Every requested payment must belong to the supplied account.')
  }
  const invalidPayment = paymentsToSettle.rows.find((payment) => !['settled', 'succeeded', 'reconciliation_required'].includes(payment.external_status))
  if (invalidPayment) throw new Error(`Payment #${invalidPayment.id} is not eligible for owner test-payment settlement.`)

  const applications = await client.query(
    `SELECT application.id, application.billing_payment_id, application.billing_charge_id, application.amount_cents
       FROM billing_payment_application application
      WHERE application.billing_charge_id = ANY($1::bigint[])
        AND application.application_kind = 'application'
        AND NOT EXISTS (
          SELECT 1
            FROM billing_payment_application reversal
           WHERE reversal.application_kind = 'reversal'
             AND reversal.reverses_application_id = application.id
        )
      ORDER BY application.id
      FOR UPDATE`,
    [chargeIds],
  )
  const adjustmentCents = charges.rows.reduce((sum, charge) => sum + Number(charge.amount_cents), 0)
  const releasedPaymentCents = applications.rows.reduce((sum, application) => sum + Number(application.amount_cents), 0)
  const plan = {
    accountId,
    familyId,
    chargeIds: charges.rows.map((charge) => Number(charge.id)),
    adjustmentCents,
    reversalApplicationIds: applications.rows.map((application) => Number(application.id)),
    releasedPaymentCents,
    settlePaymentIds: paymentsToSettle.rows.map((payment) => Number(payment.id)),
  }

  if (!apply) {
    await client.query('ROLLBACK')
    console.log(JSON.stringify({ apply: false, plan }, null, 2))
  } else {
    if (paymentsToSettle.rows.length > 0) {
      await client.query(
        `UPDATE billing_payment
            SET external_status = 'settled',
                note = CASE
                  WHEN COALESCE(note, '') LIKE '%owner-lifetime-test-payment-settled%' THEN note
                  ELSE CONCAT_WS(' ', note, '[owner-lifetime-test-payment-settled]')
                END
          WHERE family_billing_account_id = $1
            AND id = ANY($2::bigint[])`,
        [accountId, paymentsToSettle.rows.map((payment) => Number(payment.id))],
      )
    }

    for (const charge of charges.rows) {
      const sourceId = `owner-lifetime-test-waiver:${accountId}:${charge.id}`
      await client.query(
        `INSERT INTO billing_charge (
           family_billing_account_id, member_id, source_type, source_id, description,
           amount_cents, charge_type, billing_interval, related_charge_id,
           service_period_start, collection_status, metadata
         ) VALUES (
           $1, $2, 'charge_adjustment', $3, $4,
           $5, 'adjustment', 'one_time', $6,
           $7::date, 'none', $8::jsonb
         ) ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING`,
        [
          accountId,
          charge.member_id,
          sourceId,
          `Lifetime owner test-charge waiver — ${charge.description}`,
          -Math.abs(Number(charge.amount_cents)),
          charge.id,
          charge.service_period_start,
          JSON.stringify({
            adjustmentKind: 'owner_lifetime_test_waiver',
            adjustmentLabel: 'Lifetime member waiver',
            reason: 'Test enrollment and annual-fee charge retired for a lifetime owner household.',
            originalChargeId: Number(charge.id),
            customerAuditVisibility: 'suppressed',
          }),
        ],
      )
    }

    await client.query(
      `UPDATE billing_charge
          SET metadata = COALESCE(metadata, '{}'::jsonb) || jsonb_build_object(
            'customerAuditVisibility', 'suppressed',
            'ownerLifetimeTestCleanup', true
          )
        WHERE family_billing_account_id = $1
          AND id = ANY($2::bigint[])`,
      [accountId, chargeIds],
    )

    for (const application of applications.rows) {
      await client.query(
        `INSERT INTO billing_payment_application (
           billing_payment_id, billing_charge_id, amount_cents, application_kind,
           reverses_application_id, idempotency_key, allocation_reason
         ) VALUES ($1, $2, $3, 'reversal', $4, $5, 'owner_lifetime_test_credit')
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
        [
          application.billing_payment_id,
          application.billing_charge_id,
          application.amount_cents,
          application.id,
          `owner-lifetime-test-credit:${accountId}:${application.id}`,
        ],
      )
    }

    await client.query(
      `UPDATE stripe_billing_alert
          SET resolved_at = now(),
              updated_at = now(),
              action_status = 'resolved',
              resolution_note = 'Resolved: checkout came from a retired lifetime-owner test enrollment; payment is retained as household credit.'
        WHERE family_billing_account_id = $1
          AND alert_type = 'durable_stripe_owner_reconciliation_failed'
          AND resolved_at IS NULL`,
      [accountId],
    )

    await recordBillingActivity(client, {
      eventKey: `owner-lifetime-test-account-repair:${accountId}`,
      accountId,
      eventType: 'owner_lifetime_test_account_repaired',
      summary: 'Lifetime owner test charges were retired and their settled payments were retained as household credit.',
      beforeValue: { testChargeCents: adjustmentCents, appliedTestPaymentCents: releasedPaymentCents },
      afterValue: { recurringChargesCents: 0, releasedCreditCents: releasedPaymentCents },
      details: plan,
      actorType: 'system',
    })
    await client.query('COMMIT')
    console.log(JSON.stringify({ apply: true, plan }, null, 2))
  }
} catch (error) {
  await client.query('ROLLBACK').catch(() => {})
  throw error
} finally {
  client.release()
  await pool.end()
}
