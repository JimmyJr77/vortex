import { activeLedgerChargePredicate, chargeCreditApplicationSql } from '../billing/billingLedgerSql.js'
import { resolveFamilyEnrollmentPricing } from '../billing/familyEnrollmentPricing.js'

export function revenueForecastMonths(now = new Date()) {
  return Array.from({ length: 3 }, (_, offset) => {
    const date = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + offset, 1))
    return { key: date.toISOString().slice(0, 7), label: date.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' }) }
  })
}

export function summarizeRevenueForecast(months, charges, projections) {
  return months.map((month, index) => {
    const posted = charges.filter((charge) => charge.month_key === month.key)
    const owedCents = posted.reduce((sum, charge) => sum + Math.max(0, Number(charge.remaining_cents)), 0)
    if (index === 0) return { ...month, owedCents, expectedCents: null }
    let expectedCents = posted.reduce((sum, charge) => sum + Math.max(0, Number(charge.amount_cents)), 0)
    for (const projection of projections.filter((item) => item.key === month.key)) {
      for (const line of projection.lines) {
        // A posted subscription bill replaces its forecast, including bills paid early.
        if (line.subscriptionId != null && posted.some((charge) => Number(charge.subscription_id) === Number(line.subscriptionId))) continue
        expectedCents += Math.max(0, Number(line.netCents))
      }
    }
    return { ...month, owedCents, expectedCents }
  })
}

export async function loadRevenueForecast(pool, facilityId, now) {
  const months = revenueForecastMonths(now)
  const [charges, families, annuals] = await Promise.all([
    pool.query(`
      SELECT c.id, c.subscription_id,
        to_char(COALESCE(c.service_period_start, c.created_at::date), 'YYYY-MM') AS month_key,
        c.amount_cents + COALESCE(adjustments.cents, 0) AS amount_cents,
        GREATEST(0, c.amount_cents + COALESCE(adjustments.cents, 0)
          - COALESCE(payments.cents, 0) - COALESCE(credits.applied_cents, 0)) AS remaining_cents
      FROM billing_charge c
      JOIN family_billing_account account ON account.id = c.family_billing_account_id
      JOIN family ON family.id = account.family_id
      LEFT JOIN LATERAL (
        SELECT SUM(a.amount_cents) AS cents FROM billing_charge a
        WHERE (a.related_charge_id = c.id AND a.source_type IN ('charge_adjustment', 'refund_offset'))
           OR (a.subscription_id = c.subscription_id AND a.service_period_start = c.service_period_start
               AND a.source_type IN ('price_adjustment', 'price_adjustment_reversal'))
      ) adjustments ON TRUE
      LEFT JOIN LATERAL (
        SELECT SUM(CASE WHEN application.application_kind = 'reversal' THEN -application.amount_cents ELSE application.amount_cents END) AS cents
        FROM billing_payment_application application
        JOIN billing_payment payment ON payment.id = application.billing_payment_id
        WHERE payment.external_status IN ('settled', 'succeeded')
          AND (application.billing_charge_id = c.id OR application.billing_charge_id IN (
            SELECT a.id FROM billing_charge a
            WHERE (a.related_charge_id = c.id AND a.source_type IN ('charge_adjustment', 'refund_offset'))
               OR (a.subscription_id = c.subscription_id AND a.service_period_start = c.service_period_start
                   AND a.source_type IN ('price_adjustment', 'price_adjustment_reversal'))
          ))
      ) payments ON TRUE
      LEFT JOIN LATERAL (${chargeCreditApplicationSql('c.id')}) credits ON TRUE
      WHERE family.facility_id = $1 AND ${activeLedgerChargePredicate('c')}
        AND c.amount_cents > 0
        AND c.source_type NOT IN ('charge_adjustment', 'refund_offset', 'price_adjustment', 'price_adjustment_reversal', 'membership_bill_recalled', 'membership_transfer_cancelled')
        AND COALESCE(c.service_period_start, c.created_at::date) >= $2::date
        AND COALESCE(c.service_period_start, c.created_at::date) < ($2::date + INTERVAL '3 months')`, [facilityId, `${months[0].key}-01`]),
    pool.query(`SELECT DISTINCT family.id FROM family
      JOIN member ON member.family_id = family.id
      JOIN scheduling_signup signup ON signup.member_id = member.id
      WHERE family.facility_id = $1 AND signup.status = 'confirmed'
        AND signup.orphaned_at IS NULL AND signup.archived_at IS NULL`, [facilityId]),
    pool.query(`SELECT subscription.id AS subscription_id, subscription.net_monthly_cents,
        to_char(subscription.next_bill_date, 'YYYY-MM') AS month_key
      FROM billing_subscription subscription
      JOIN family_billing_account account ON account.id = subscription.family_billing_account_id
      JOIN family ON family.id = account.family_id
      WHERE family.facility_id = $1 AND subscription.status = 'active'
        AND subscription.auto_renewal IS NOT FALSE
        AND (subscription.source_type = 'annual_membership' OR subscription.pricing_option_key = 'annual_membership')
        AND subscription.next_bill_date >= ($2::date + INTERVAL '1 month')
        AND subscription.next_bill_date < ($2::date + INTERVAL '3 months')`, [facilityId, `${months[0].key}-01`]),
  ])
  const projections = []
  // Both months share catalog, household and discount reads. Reuse those reads
  // within this request without retaining stale billing data between refreshes.
  const reads = new Map()
  const pricingDb = { query: async (sql, params = []) => {
    const key = JSON.stringify([sql, params])
    if (!reads.has(key)) reads.set(key, pool.query(sql, params))
    const result = await reads.get(key)
    return { ...result, rows: structuredClone(result.rows) }
  } }

  // Bound database concurrency; pricing includes scheduled lifecycle and discount changes.
  for (let offset = 0; offset < families.rows.length; offset += 4) {
    const batch = await Promise.all(families.rows.slice(offset, offset + 4).flatMap((family) => months.slice(1).map(async (month) => {
      const pricing = await resolveFamilyEnrollmentPricing(pricingDb, { familyId: family.id, periodKey: month.key, strictPricing: true })
      return { key: month.key, lines: pricing.lines }
    })))
    projections.push(...batch)
  }
  projections.push(...annuals.rows.map((row) => ({ key: row.month_key, lines: [{ subscriptionId: row.subscription_id, netCents: row.net_monthly_cents }] })))
  return summarizeRevenueForecast(months, charges.rows, projections)
}
