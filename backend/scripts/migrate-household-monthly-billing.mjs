/**
 * Dry-run-first migration from legacy per-class Stripe subscriptions to one
 * household monthly invoice. It never creates invoices or charges cards.
 *
 * Usage:
 *   npm run billing:migrate-household-invoices
 *   npm run billing:migrate-household-invoices -- --apply --account=10895
 */
import 'dotenv/config'
import pg from 'pg'
import { getStripeClient, stripeEnabled } from '../billing/stripeBilling.js'
import { recordBillingActivityBestEffort } from '../billing/billingActivity.js'

const apply = process.argv.includes('--apply')
const accountArg = process.argv.find((arg) => arg.startsWith('--account='))?.split('=')[1] ?? null
const limitArg = process.argv.find((arg) => arg.startsWith('--limit='))?.split('=')[1] ?? null
const accountId = accountArg == null ? null : Number(accountArg)
const limit = Math.max(1, Math.min(500, Number(limitArg) || 500))

function ssl(connectionString) {
  return process.env.NODE_ENV === 'production' || /render\.com|neon\.tech|supabase\.co/i.test(String(connectionString ?? ''))
    ? { rejectUnauthorized: false }
    : false
}

function validCandidate(rows) {
  if (rows.length === 0) return { ok: false, reason: 'no legacy class subscriptions' }
  if (rows.some((row) => Number(row.anchor_day) !== 1)) return { ok: false, reason: 'one or more subscriptions are not anchored to the 1st' }
  if (rows.some((row) => !row.stripe_customer_id)) return { ok: false, reason: 'Stripe customer is missing' }
  return { ok: true }
}

async function main() {
  const connectionString = process.env.DATABASE_URL || process.env.DB_URL
  const pool = new pg.Pool({ connectionString, ssl: ssl(connectionString) })
  try {
    await pool.query((await import('fs')).readFileSync(new URL('../migrations/774_household_monthly_invoicing.sql', import.meta.url), 'utf8'))
    const result = await pool.query(
      `SELECT account.id AS account_id, account.family_id, account.stripe_customer_id,
              subscription.id AS billing_subscription_id, subscription.stripe_subscription_id,
              subscription.member_id, subscription.anchor_day, subscription.next_bill_date, subscription.description
         FROM family_billing_account account
         JOIN billing_subscription subscription ON subscription.family_billing_account_id = account.id
        WHERE account.household_monthly_billing_enabled = FALSE
          AND subscription.status = 'active'
          AND subscription.stripe_subscription_id IS NOT NULL
          AND subscription.source_type <> 'annual_membership'
          AND COALESCE(subscription.pricing_option_key, '') <> 'annual_membership'
          AND ($1::bigint IS NULL OR account.id = $1)
        ORDER BY account.id, subscription.id
        LIMIT $2`,
      [Number.isFinite(accountId) ? accountId : null, limit * 20],
    )
    const groups = new Map()
    for (const row of result.rows) groups.set(Number(row.account_id), [...(groups.get(Number(row.account_id)) ?? []), row])
    const candidates = [...groups.entries()].slice(0, limit)
    const report = candidates.map(([id, rows]) => ({ accountId: id, subscriptions: rows.length, ...validCandidate(rows) }))
    console.table(report)
    if (!apply) {
      console.log(`Dry run only. ${report.filter((row) => row.ok).length} account(s) are eligible; rerun with --apply --account=<id> after reviewing.`)
      return
    }
    if (!Number.isFinite(accountId) || accountId <= 0) throw new Error('--apply requires one explicit --account=<billing-account-id>.')
    const group = groups.get(accountId) ?? []
    const candidate = validCandidate(group)
    if (!candidate.ok) throw new Error(`Account ${accountId} cannot migrate: ${candidate.reason}.`)
    if (!stripeEnabled()) throw new Error('Stripe must be enabled to cancel legacy class subscriptions safely.')
    const stripe = await getStripeClient()
    if (!stripe) throw new Error('Stripe client is unavailable.')
    for (const row of group) await stripe.subscriptions.cancel(row.stripe_subscription_id, { prorate: false })
    const client = await pool.connect()
    try {
      await client.query('BEGIN')
      await client.query('SELECT pg_advisory_xact_lock($1)', [accountId])
      await client.query(
        `UPDATE billing_subscription
            SET stripe_subscription_id = NULL, updated_at = now()
          WHERE family_billing_account_id = $1
            AND id = ANY($2::bigint[])`,
        [accountId, group.map((row) => Number(row.billing_subscription_id))],
      )
      await client.query(
        `UPDATE family_billing_account
            SET household_monthly_billing_enabled = TRUE, updated_at = now()
          WHERE id = $1`,
        [accountId],
      )
      await client.query(
        `UPDATE stripe_billing_alert
            SET action_status = 'resolved', resolved_at = now(),
                resolution_note = 'Legacy per-class Stripe subscription retired for household monthly billing.',
                updated_at = now()
          WHERE family_billing_account_id = $1
            AND stripe_object_id = ANY($2::text[])
            AND resolved_at IS NULL`,
        [accountId, group.map((row) => String(row.stripe_subscription_id))],
      ).catch(() => {})
      await client.query('COMMIT')
    } catch (error) {
      await client.query('ROLLBACK').catch(() => {})
      throw error
    } finally {
      client.release()
    }
    for (const row of group) {
      await recordBillingActivityBestEffort(pool, {
        eventKey: `household-monthly-migration:${accountId}:${row.billing_subscription_id}`,
        accountId,
        memberId: row.member_id == null ? null : Number(row.member_id),
        eventType: 'household_monthly_billing_migrated',
        summary: `Legacy class Stripe subscription was retired for household monthly billing.`,
        beforeValue: { stripeSubscriptionId: row.stripe_subscription_id },
        afterValue: { stripeSubscriptionId: null, householdMonthlyBillingEnabled: true },
        details: { billingSubscriptionId: Number(row.billing_subscription_id), cancelledWithoutProration: true },
        stripeObjectId: row.stripe_subscription_id,
        actorType: 'system',
      })
    }
    console.log(`Migrated billing account ${accountId}: ${group.length} legacy Stripe subscription(s) retired. No payment was attempted.`)
  } finally {
    await pool.end()
  }
}

main().catch((error) => {
  console.error('[billing:migrate-household-invoices]', error?.message ?? error)
  process.exitCode = 1
})
