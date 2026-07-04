#!/usr/bin/env node
/**
 * One-time backfill for family billing account 461 (Jimmy enrollment checkout).
 *
 * Usage:
 *   cd backend
 *   STRIPE_SECRET_KEY=sk_test_... DATABASE_URL=... node scripts/backfill-billing-account-461.mjs
 *
 * Idempotent — safe to re-run. Uses the same repair logic as the billing account API.
 */

import pg from 'pg'
import { reconcileEnrollmentLedger } from '../billing/enrollmentLedgerReconcile.js'

const ACCOUNT_ID = 461

async function main() {
  const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL })
  try {
    const accountRes = await pool.query(
      `SELECT id, family_id FROM family_billing_account WHERE id = $1`,
      [ACCOUNT_ID],
    )
    const account = accountRes.rows[0]
    if (!account) {
      throw new Error(`Family billing account ${ACCOUNT_ID} not found`)
    }

    const result = await reconcileEnrollmentLedger(pool, account)
    console.log('[backfill] reconcileEnrollmentLedger', result)

    const summary = await pool.query(
      `
        SELECT
          (SELECT COUNT(*)::int FROM billing_charge WHERE family_billing_account_id = $1) AS charges,
          (SELECT COALESCE(SUM(amount_cents), 0)::int FROM billing_charge WHERE family_billing_account_id = $1) AS charge_cents,
          (SELECT COUNT(*)::int FROM billing_payment WHERE family_billing_account_id = $1) AS payments,
          (SELECT COALESCE(SUM(amount_cents), 0)::int FROM billing_payment WHERE family_billing_account_id = $1) AS payment_cents
      `,
      [ACCOUNT_ID],
    )
    console.log('[backfill] ledger summary', summary.rows[0])
  } finally {
    await pool.end()
  }
}

main().catch((err) => {
  console.error(err)
  process.exit(1)
})
