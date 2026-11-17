import { describeAcquisitionSource } from './acquisitionSource.js'
import { inquiryAttributionFields, inquiryAttributionJoins } from './inquiryAttribution.js'

const outcomeMetric = {
  inquiry: 'inquiries',
  free_trial: 'freeTrials',
  paid_drop_in: 'paidDropIns',
  class_checkout: 'paidClassCheckouts',
  store_sale: 'storePurchases',
}

function emptyCounts(canViewRevenue) {
  return {
    inquiries: 0, freeTrials: 0, paidDropIns: 0, paidClassCheckouts: 0, storePurchases: 0,
    revenueCents: canViewRevenue ? 0 : null,
  }
}

const withoutAcquisitionSource = new Set(['Unknown', 'Internal', 'Direct'])

export function summarizeAcquisition(outcomes, canViewRevenue) {
  const totals = emptyCounts(canViewRevenue)
  const attributed = emptyCounts(canViewRevenue)
  const sources = new Map()
  for (const row of outcomes) {
    const metric = outcomeMetric[row.outcome]
    if (!metric) continue
    const source = describeAcquisitionSource(row)
    const key = JSON.stringify([source.channel, source.source, source.medium, source.campaign])
    if (!sources.has(key)) sources.set(key, { ...source, ...emptyCounts(canViewRevenue) })
    const cents = Number(row.revenue_cents) || 0
    const sourceKnown = !withoutAcquisitionSource.has(source.source)
    for (const counts of [totals, sources.get(key), ...(sourceKnown ? [attributed] : [])]) {
      counts[metric] += 1
      if (canViewRevenue) counts.revenueCents += cents
    }
  }
  const size = (row) => Object.values(outcomeMetric).reduce((sum, metric) => sum + row[metric], 0)
  const rows = [...sources.values()].sort((a, b) => size(b) - size(a) || a.source.localeCompare(b.source))
  return { rows, totals, attributed, canViewRevenue }
}

// Count real inquiries, confirmed trials, and settled purchases. Attribution is a
// left join: an untracked or historical record remains in the facility's totals.
export async function getBusinessAcquisitionReport(pool, range, facilityId, { canViewRevenue }) {
  const { rows } = await pool.query(`
    WITH drop_ins AS (
      SELECT d.id, d.benefit_type, d.amount_cents, d.created_at
      FROM drop_in_registration d
      JOIN scheduling_form f ON f.id = d.form_id
      JOIN program p ON p.id = f.program_id AND p.facility_id = $3
      WHERE d.status IN ('confirmed', 'attended')
        AND ((d.benefit_type = 'free_trial' AND d.amount_cents = 0 AND d.created_at BETWEEN $1 AND $2)
          OR (d.benefit_type = 'paid' AND d.amount_cents > 0 AND d.created_at <= $2))
    ), paid_drop_ins AS (
      SELECT d.id, LEAST(d.amount_cents, SUM(app.amount_cents)) AS revenue_cents
      FROM drop_ins d
      JOIN billing_charge bc ON bc.source_type = 'drop_in' AND bc.source_id = d.id::text
      JOIN billing_payment_application app ON app.billing_charge_id = bc.id AND app.application_kind = 'application'
      JOIN billing_payment bp ON bp.id = app.billing_payment_id
        AND bp.family_billing_account_id = bc.family_billing_account_id
        AND bp.external_status IN ('settled', 'succeeded')
      WHERE d.benefit_type = 'paid'
      GROUP BY d.id, d.amount_cents
      HAVING MAX(bp.paid_at) BETWEEN $1 AND $2
    ), paid_enrollments AS (
      SELECT e.id, SUM(app.amount_cents) AS revenue_cents
      FROM billing_payment bp
      JOIN stripe_pending_enrollment e ON e.stripe_checkout_session_id = bp.stripe_checkout_session_id
        AND e.family_billing_account_id = bp.family_billing_account_id AND e.status = 'completed'
      JOIN family_billing_account a ON a.id = e.family_billing_account_id
      JOIN family f ON f.id = a.family_id AND f.facility_id = $3
      JOIN billing_payment_application app ON app.billing_payment_id = bp.id
        AND app.application_kind = 'application'
      JOIN billing_charge bc ON bc.id = app.billing_charge_id
        AND bc.stripe_checkout_session_id = e.stripe_checkout_session_id AND bc.family_billing_account_id = a.id
      WHERE bp.external_status IN ('settled', 'succeeded')
        AND bp.paid_at BETWEEN $1 AND $2
      GROUP BY e.id
    ), store_card_payments AS (
      SELECT entity_id, MIN(occurred_at) AS first_payment_at
      FROM store_action_audit
      WHERE facility_id = $3 AND entity_type = 'sale' AND action = 'sale_card_payment_completed'
      GROUP BY entity_id
    ), store_card_or_external AS (
      SELECT o.id, o.source = 'admin' AS staff_entry, o.total_cents AS revenue_cents
      FROM store_order o
      LEFT JOIN store_card_payments payment ON payment.entity_id = o.id AND o.payment_status = 'paid'
      WHERE o.facility_id = $3 AND o.status IN ('placed', 'fulfilled')
        AND o.payment_status IN ('paid', 'external') AND o.total_cents > 0 AND o.created_at <= $2
        AND COALESCE(payment.first_payment_at, o.created_at) BETWEEN $1 AND $2
    ), settled_store_accounts AS (
      SELECT o.id, o.source = 'admin' AS staff_entry, o.total_cents AS revenue_cents
      FROM store_order o
      JOIN billing_payment_application app ON app.billing_charge_id = o.billing_charge_id
        AND app.application_kind = 'application'
      JOIN billing_payment bp ON bp.id = app.billing_payment_id
        AND bp.family_billing_account_id = o.family_billing_account_id
        AND bp.external_status IN ('settled', 'succeeded')
      WHERE o.facility_id = $3 AND o.status IN ('placed', 'fulfilled')
        AND o.payment_status = 'billed_to_account' AND o.total_cents > 0 AND o.created_at <= $2
      GROUP BY o.id
      HAVING SUM(app.amount_cents) >= o.total_cents AND MAX(bp.paid_at) BETWEEN $1 AND $2
    ), outcomes AS (
      SELECT 'free_trial' AS outcome, 'drop_in' AS record_kind, id, 0 AS revenue_cents,
        false AS staff_entry FROM drop_ins WHERE benefit_type = 'free_trial'
      UNION ALL SELECT 'paid_drop_in', 'drop_in', id, revenue_cents, false FROM paid_drop_ins
      UNION ALL SELECT 'class_checkout', 'enrollment_checkout', id, revenue_cents, false FROM paid_enrollments
      UNION ALL SELECT 'store_sale', 'store_order', id, revenue_cents, staff_entry FROM store_card_or_external
      UNION ALL SELECT 'store_sale', 'store_order', id, revenue_cents, staff_entry FROM settled_store_accounts
    )
    SELECT o.outcome, CASE WHEN $4::boolean THEN o.revenue_cents END AS revenue_cents,
      t.source, t.medium, t.campaign, t.referrer_host, NULL AS legacy_referrer,
      t.landing_path IS NOT NULL AS has_visit, o.staff_entry
    FROM outcomes o
    LEFT JOIN business_acquisition t ON t.record_kind = o.record_kind AND t.record_id = o.id
    UNION ALL
    SELECT 'inquiry', CASE WHEN $4::boolean THEN 0 END, ${inquiryAttributionFields}
    FROM registrations r
    ${inquiryAttributionJoins}
    WHERE r.facility_id = $3 AND r.archived IS NOT TRUE AND r.created_at BETWEEN $1 AND $2`,
  [range.from, range.to, facilityId, canViewRevenue])
  return summarizeAcquisition(rows, canViewRevenue)
}
