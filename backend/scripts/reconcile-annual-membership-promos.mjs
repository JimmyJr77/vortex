#!/usr/bin/env node
/**
 * Reconcile annual-membership promo redemptions whose linked ledger credit was
 * lost by an interrupted historical write. Defaults to a read-only report.
 *
 * Usage:
 *   node --env-file=.env.local scripts/reconcile-annual-membership-promos.mjs
 *   node --env-file=.env.local scripts/reconcile-annual-membership-promos.mjs --apply
 *   node --env-file=.env.local scripts/reconcile-annual-membership-promos.mjs --apply --account=10910
 */
import pg from 'pg'
import { allocateHouseholdPayments } from '../billing/paymentAllocation.js'

const apply = process.argv.includes('--apply')
const accountArg = process.argv.find((value) => value.startsWith('--account='))
const accountId = accountArg ? Number(accountArg.slice('--account='.length)) : null
if (accountArg && (!Number.isInteger(accountId) || accountId <= 0)) {
  throw new Error('--account must be a positive billing account ID.')
}

const connectionString = process.env.DATABASE_URL || process.env.DB_URL
if (!connectionString) throw new Error('DATABASE_URL or DB_URL is required.')
const host = new URL(connectionString).hostname.toLowerCase()
const pool = new pg.Pool({
  connectionString,
  ssl: ['localhost', '127.0.0.1', '::1'].includes(host) ? false : { rejectUnauthorized: false },
})

try {
  const candidates = await pool.query(
    `SELECT DISTINCT c.family_billing_account_id AS account_id,
            family.id AS family_id,
            family.family_name,
            COUNT(*)::int AS affected_fees
       FROM billing_charge c
       JOIN family_billing_account account ON account.id = c.family_billing_account_id
       JOIN family ON family.id = account.family_id
       JOIN discount_redemption redemption
         ON redemption.member_id = c.member_id
        AND redemption.kind = 'discount'
        AND redemption.amount_cents > 0
        AND redemption.created_at BETWEEN c.created_at - interval '15 minutes' AND c.created_at + interval '15 minutes'
       JOIN discount_rule rule
         ON rule.id = redemption.rule_id
        AND rule.type = 'promo_code'
        AND (rule.config->>'benefit_type' = 'annual_membership'
          OR rule.config->>'amount_applies_to' = 'annual_membership')
      WHERE c.source_type = 'additional_fee'
        AND c.amount_cents > 0
        AND ($1::bigint IS NULL OR c.family_billing_account_id = $1)
        AND (
          NOT EXISTS (
            SELECT 1
            FROM billing_charge adjustment
            WHERE adjustment.related_charge_id = c.id
              AND adjustment.source_type = 'charge_adjustment'
              AND adjustment.metadata->>'discountRuleId' = redemption.rule_id::text
          )
          OR c.collection_status <> 'paid'
          OR NOT EXISTS (
            SELECT 1
            FROM additional_fee_redemption fee_redemption
            WHERE fee_redemption.billing_charge_id = c.id
              AND fee_redemption.ended_at IS NULL
          )
        )
      GROUP BY c.family_billing_account_id, family.id, family.family_name
      ORDER BY c.family_billing_account_id`,
    [accountId],
  )
  if (!apply) {
    console.table(candidates.rows.map((row) => ({
      accountId: Number(row.account_id),
      familyId: Number(row.family_id),
      family: row.family_name,
      affectedAnnualFees: Number(row.affected_fees),
    })))
    console.log(`Dry run: ${candidates.rows.length} billing account(s) would be reconciled. Re-run with --apply to repair.`)
  } else {
    const results = []
    for (const candidate of candidates.rows) {
      const result = await allocateHouseholdPayments(pool, {
        accountId: Number(candidate.account_id),
        actorType: 'system',
        idempotencyNamespace: 'annual-membership-promo-repair',
      })
      results.push({
        accountId: Number(candidate.account_id),
        family: candidate.family_name,
        restoredCredits: result.restoredMembershipPromoCredits.length,
        activatedMemberships: result.activatedMemberships.length,
      })
    }
    console.table(results)
    console.log(`Applied annual-membership promo reconciliation to ${results.length} billing account(s).`)
  }
} finally {
  await pool.end()
}
