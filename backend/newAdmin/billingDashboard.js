import { ACCOUNTING_LEDGER_CTE } from '../billing/accountingReport.js'
import { settledRefundPredicate } from '../billing/billingLedgerSql.js'
import { id } from './common.js'
import { withFamilyRead } from './familyWorkspace.js'
import { buildBillingDashboard } from './billingDashboardMetrics.js'

// One facility-scoped, read-only snapshot of the shared ledger. No processor
// requests, billing reconciliation, account provisioning or per-family queries.
export async function loadBillingDashboard(pool, facilityId, now = new Date()) {
  return withFamilyRead(pool, async db => {
    const result = await db.query(`/* new-admin:billing-dashboard */
      ${ACCOUNTING_LEDGER_CTE}, clock AS (
        SELECT ($2::timestamptz AT TIME ZONE COALESCE(NULLIF(timezone,''),'America/New_York'))::date AS today
        FROM facility WHERE id=$1
      ), report_refunds AS (
        SELECT refund.*,(refund.created_at AT TIME ZONE refund.timezone)::date::text AS occurred_date
        FROM scoped_refunds refund CROSS JOIN clock
        WHERE ${settledRefundPredicate('refund')}
          AND refund.created_at <= $2::timestamptz
          AND (refund.created_at AT TIME ZONE refund.timezone)::date >= (date_trunc('quarter',clock.today)-interval '12 months')::date
      ), report_payments AS (
        SELECT payment.*,(payment.paid_at AT TIME ZONE payment.timezone)::date::text AS occurred_date
        FROM scoped_payments payment CROSS JOIN clock
        WHERE payment.external_status IN ('settled','succeeded') AND payment.paid_at <= $2::timestamptz
          AND ((payment.paid_at AT TIME ZONE payment.timezone)::date >= (date_trunc('quarter',clock.today)-interval '12 months')::date
            OR payment.id IN (SELECT payment_id FROM report_refunds))
      ), revenue_allocations AS (
        SELECT a.owner_id,a.billing_payment_id,
          SUM(CASE WHEN a.application_kind='reversal' AND EXISTS (
            SELECT 1 FROM scoped_refunds r WHERE r.payment_id=a.billing_payment_id
              AND r.family_billing_account_id=a.family_billing_account_id
              AND a.idempotency_key LIKE ('refund:' || r.id::text || ':%')
              AND ${settledRefundPredicate('r')}
          ) THEN 0 ELSE a.signed_cents END)::bigint AS amount_cents
        FROM applications a JOIN report_payments p ON p.id=a.billing_payment_id
        GROUP BY a.owner_id,a.billing_payment_id
      ), native_charge_totals AS (
        SELECT family_billing_account_id AS account_id,SUM(amount_cents)::bigint AS cents
        FROM charges WHERE NOT historical_only GROUP BY family_billing_account_id
      ), native_payment_totals AS (
        SELECT family_billing_account_id AS account_id,SUM(amount_cents)::bigint AS cents
        FROM scoped_payments WHERE NOT historical_only AND external_status IN ('settled','succeeded') GROUP BY family_billing_account_id
      ), native_refund_totals AS (
        SELECT family_billing_account_id AS account_id,SUM(amount_cents)::bigint AS cents
        FROM scoped_refunds refund WHERE NOT historical_only AND ${settledRefundPredicate('refund')} GROUP BY family_billing_account_id
      )
      SELECT clock.today::text,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',p.id,'amount_cents',p.amount_cents,'occurred_date',p.occurred_date,
          'gender',m.gender,'date_of_birth',m.date_of_birth::text,'class_name',p.record_class_name))
          FROM report_payments p LEFT JOIN member m ON m.id=p.record_member_id AND m.facility_id=$1),'[]') AS payments,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',r.id,'payment_id',r.payment_id,'amount_cents',r.amount_cents,
          'occurred_date',r.occurred_date,'has_charge',line.id IS NOT NULL,'class_name',COALESCE(line.class_name,r.record_class_name),
          'gender',m.gender,'date_of_birth',m.date_of_birth::text)) FROM report_refunds r
          LEFT JOIN mapped charge ON charge.id=r.related_charge_id AND charge.family_billing_account_id=r.family_billing_account_id
          LEFT JOIN lines line ON line.id=charge.owner_id
          LEFT JOIN member m ON m.id=COALESCE(line.member_id,r.record_member_id) AND m.facility_id=$1),'[]') AS refunds,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('billing_payment_id',a.billing_payment_id,'amount_cents',a.amount_cents,
          'class_name',line.class_name,'gender',m.gender,'date_of_birth',m.date_of_birth::text))
          FROM revenue_allocations a JOIN report_payments p ON p.id=a.billing_payment_id
          JOIN lines line ON line.id=a.owner_id LEFT JOIN member m ON m.id=line.member_id AND m.facility_id=$1
          WHERE a.amount_cents>0),'[]') AS allocations,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',line.id,'account_id',line.account_id,'open_cents',line.open_cents,
          'service_month',substring(COALESCE(line.service_period_start,line.billed_date),1,7)))
          FROM lines line WHERE line.open_cents>0),'[]') AS lines,
        COALESCE((SELECT jsonb_agg(jsonb_build_object('id',a.id,'family_id',a.family_id,'family_name',a.family_name,
          'balance_cents',COALESCE(c.cents,0)-COALESCE(p.cents,0)+COALESCE(r.cents,0)))
          FROM scoped_accounts a LEFT JOIN native_charge_totals c ON c.account_id=a.id
          LEFT JOIN native_payment_totals p ON p.account_id=a.id LEFT JOIN native_refund_totals r ON r.account_id=a.id),'[]') AS accounts
      FROM clock`, [id(facilityId, 'facility'), now.toISOString()])
    const row = result.rows[0]
    if (!row) throw Object.assign(new Error('Facility not found.'), { statusCode: 404 })
    return buildBillingDashboard(row)
  })
}
