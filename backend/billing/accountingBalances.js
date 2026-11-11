import { settledRefundPredicate } from './billingLedgerSql.js'

// Read-only presentation layered over ACCOUNTING_LEDGER_CTE. Compute household
// funds before any report filters or pagination, so a class/date filter cannot
// reuse the same credit or transfer another household's credit to a bill.
export const ACCOUNTING_BALANCES_CTE = `, account_charge_totals AS (
  SELECT family_billing_account_id AS account_id,SUM(amount_cents)::bigint AS cents
  FROM charges WHERE NOT historical_only GROUP BY family_billing_account_id
), account_payment_totals AS (
  SELECT family_billing_account_id AS account_id,SUM(amount_cents)::bigint AS cents
  FROM scoped_payments WHERE NOT historical_only AND external_status IN ('settled','succeeded') GROUP BY family_billing_account_id
), account_refund_totals AS (
  SELECT family_billing_account_id AS account_id,SUM(amount_cents)::bigint AS cents
  FROM scoped_refunds refund WHERE NOT historical_only AND ${settledRefundPredicate('refund')} GROUP BY family_billing_account_id
), account_open_totals AS (
  SELECT account_id,SUM(open_cents)::bigint AS cents FROM lines GROUP BY account_id
), account_balances AS (
  SELECT a.id,a.family_id,COALESCE(c.cents,0)-COALESCE(p.cents,0)+COALESCE(r.cents,0) AS balance_cents,
    COALESCE(o.cents,0) AS open_cents
  FROM scoped_accounts a LEFT JOIN account_charge_totals c ON c.account_id=a.id
  LEFT JOIN account_payment_totals p ON p.account_id=a.id
  LEFT JOIN account_refund_totals r ON r.account_id=a.id LEFT JOIN account_open_totals o ON o.account_id=a.id
), ordered_balances AS (
  SELECT line.*,
    COALESCE(SUM(line.open_cents) OVER(PARTITION BY line.account_id
      ORDER BY substring(COALESCE(line.service_period_start,line.billed_date),1,7),line.id
      ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING),0)::bigint AS earlier_open_cents,
    GREATEST(0,COALESCE(account.open_cents,0)-GREATEST(0,COALESCE(account.balance_cents,0)))::bigint AS account_funds_available,
    CASE WHEN line.status='historical' THEN 'historical'
      WHEN COALESCE(line.service_period_start,line.billed_date)::date < (date_trunc('month',now() AT TIME ZONE line.timezone)+interval '1 month')::date
      THEN 'current' ELSE 'upcoming' END AS balance_period
  FROM lines line LEFT JOIN account_balances account ON account.id=line.account_id
), funded_balances AS (
  SELECT ordered_balances.*,LEAST(open_cents,GREATEST(0,account_funds_available-earlier_open_cents))::bigint AS account_funds_cents
  FROM ordered_balances
), report_lines AS (
  SELECT funded_balances.*,(open_cents-account_funds_cents)::bigint AS remaining_cents FROM funded_balances
), account_period_balances AS (
  SELECT account_id,
    COALESCE(SUM(remaining_cents) FILTER(WHERE balance_period='current'),0)::bigint AS current_cents,
    COALESCE(SUM(remaining_cents) FILTER(WHERE balance_period='upcoming'),0)::bigint AS upcoming_cents
  FROM report_lines GROUP BY account_id
)`

export const ACCOUNT_BALANCE_SUMMARY = `jsonb_build_object(
  'currentCents',COALESCE(SUM(p.current_cents),0),
  'currentFamilies',COUNT(*) FILTER(WHERE p.current_cents>0),
  'upcomingCents',COALESCE(SUM(p.upcoming_cents),0),
  'upcomingFamilies',COUNT(*) FILTER(WHERE p.upcoming_cents>0),
  'creditCents',COALESCE(SUM(GREATEST(0,-a.balance_cents)),0),
  'creditFamilies',COUNT(*) FILTER(WHERE a.balance_cents<0),
  'reviewCents',COALESCE(SUM(GREATEST(0,a.balance_cents-a.open_cents)),0)
)`
