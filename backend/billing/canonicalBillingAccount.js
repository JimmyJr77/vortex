import { summarizeCustomerBalanceCards } from './billingBalanceCards.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'

export const CANONICAL_SETTLED_PAYMENT_STATUSES = Object.freeze(['settled', 'succeeded'])

export function billingPaymentIsSettled(status) {
  return CANONICAL_SETTLED_PAYMENT_STATUSES.includes(String(status ?? '').trim().toLowerCase())
}

// Only invoices that can still collect money own their charge lines. A paid
// invoice is immutable history; refunds/reversals may make its charges
// collectible again through a new payment attempt.
export const HOUSEHOLD_INVOICE_RESERVING_STATUSES = Object.freeze([
  'draft',
  'open',
  'failed',
  'payment_method_required',
])

export function householdInvoiceReservesCollection(status) {
  return HOUSEHOLD_INVOICE_RESERVING_STATUSES.includes(String(status ?? ''))
}

function billingMonthKey(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 7)
  const match = String(value).match(/^(\d{4}-\d{2})/)
  if (match) return match[1]
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 7)
}

export function canonicalRecurringBillingMonth(subscriptions = [], asOf = new Date()) {
  const currentMonth = billingMonthKey(asOf)
  const nextBillMonth = subscriptions
    .filter((subscription) => subscription.status === 'active')
    .map((subscription) => billingMonthKey(subscription.next_bill_date ?? subscription.nextBillDate))
    .filter(Boolean)
    .sort()[0]
  return nextBillMonth && nextBillMonth > currentMonth ? nextBillMonth : currentMonth
}

export function buildCanonicalFinancialSnapshot({
  totals = {},
  charges = [],
  payments = [],
  subscriptions = [],
  recurringBillingMonth = null,
} = {}) {
  const chargesCents = Number(totals.charges_cents ?? totals.chargesCents ?? 0)
  const paymentsCents = Number(totals.payments_cents ?? totals.paymentsCents ?? 0)
  const refundsCents = Number(totals.refunds_cents ?? totals.refundsCents ?? 0)
  const month = recurringBillingMonth ?? canonicalRecurringBillingMonth(subscriptions)
  const cards = summarizeCustomerBalanceCards({
    charges,
    payments,
    subscriptions,
    refundsCents,
    recurringBillingMonth: month,
  })
  const latest = totals.latest_payment ?? totals.latestPayment ?? null
  const revision = String(totals.revision ?? '') || null
  const balanceCents = chargesCents - paymentsCents + refundsCents

  return {
    chargesCents,
    paymentsCents,
    refundsCents,
    balanceCents,
    outstandingBalanceCents: cards.outstandingBalanceCents,
    currentRecurringSatisfiedCents: cards.currentRecurringSatisfiedCents,
    // A suppressed corrective ledger row still changes the account balance,
    // even though it must not reappear in the customer audit. Never understate
    // the household's spendable credit when that correction makes the net
    // account balance negative.
    futureCreditsCents: Math.max(cards.futureCreditsCents, Math.max(0, -balanceCents)),
    paidThisMonthCents: Number(totals.paid_this_month_cents ?? totals.paidThisMonthCents ?? 0),
    latestPayment: latest
      ? {
          id: Number(latest.id),
          amountCents: Number(latest.amount_cents ?? latest.amountCents ?? 0),
          paidAt: latest.paid_at ?? latest.paidAt,
          method: latest.method ?? null,
        }
      : null,
    revision,
    recurringBillingMonth: month,
  }
}

/**
 * Read the small subset of canonical ledger rows needed for account cards.
 * This intentionally performs no reconciliation and does not touch the legacy
 * account view, billing history, cancelled subscriptions, or audit ledger.
 */
export async function loadCanonicalFinancialSnapshot(pool, {
  accountId,
  subscriptions = [],
  asOf = new Date(),
  recurringBillingMonth = null,
}) {
  const effectiveRecurringBillingMonth = recurringBillingMonth
    ?? canonicalRecurringBillingMonth(subscriptions, asOf)
  const currentMonth = billingMonthKey(asOf)
  const [totalsResult, chargeResult, paymentResult, collectibleBalanceCents] = await Promise.all([
    pool.query(
      `/* canonical-billing:financial-totals */
       SELECT
         COALESCE((
           SELECT SUM(charge.amount_cents)
             FROM billing_charge charge
            WHERE charge.family_billing_account_id = $1
         ), 0)::bigint AS charges_cents,
         COALESCE((
           SELECT SUM(payment.amount_cents)
             FROM billing_payment payment
            WHERE payment.family_billing_account_id = $1
              AND payment.external_status IN ('settled', 'succeeded')
         ), 0)::bigint AS payments_cents,
         COALESCE((
           SELECT SUM(refund.amount_cents)
             FROM billing_refund refund
            WHERE refund.family_billing_account_id = $1
              AND COALESCE(refund.external_status, 'succeeded') = 'succeeded'
         ), 0)::bigint AS refunds_cents,
         COALESCE((
           SELECT SUM(payment.amount_cents)
             FROM billing_payment payment
            WHERE payment.family_billing_account_id = $1
              AND payment.external_status IN ('settled', 'succeeded')
              AND to_char(payment.paid_at AT TIME ZONE 'UTC', 'YYYY-MM') = $2
         ), 0)::bigint AS paid_this_month_cents,
         (
           SELECT jsonb_build_object(
             'id', payment.id,
             'amount_cents', payment.amount_cents,
             'paid_at', payment.paid_at,
             'method', payment.method
           )
             FROM billing_payment payment
            WHERE payment.family_billing_account_id = $1
              AND payment.external_status IN ('settled', 'succeeded')
            ORDER BY payment.paid_at DESC, payment.id DESC
           LIMIT 1
         ) AS latest_payment,
         (
           SELECT md5(CONCAT_WS('|',
             account.id::text,
             account.updated_at::text,
             COALESCE((SELECT MAX(charge.created_at)::text FROM billing_charge charge WHERE charge.family_billing_account_id = $1), ''),
             COALESCE((
               SELECT md5(string_agg(CONCAT_WS(':',
                 payment.id::text,
                 payment.amount_cents::text,
                 payment.paid_at::text,
                 payment.external_status
               ), '|' ORDER BY payment.id))
                 FROM billing_payment payment
                WHERE payment.family_billing_account_id = $1
             ), ''),
             COALESCE((SELECT MAX(refund.updated_at)::text FROM billing_refund refund WHERE refund.family_billing_account_id = $1), ''),
             COALESCE((
               SELECT MAX(application.created_at)::text
                 FROM billing_payment_application application
                 JOIN billing_charge charge ON charge.id = application.billing_charge_id
                WHERE charge.family_billing_account_id = $1
             ), ''),
             COALESCE((
               SELECT MAX(application.created_at)::text
                 FROM billing_charge_credit_application application
                 JOIN billing_monthly_invoice invoice
                   ON invoice.id = application.billing_monthly_invoice_id
                WHERE invoice.family_billing_account_id = $1
             ), ''),
             COALESCE((SELECT MAX(subscription.updated_at)::text FROM billing_subscription subscription WHERE subscription.family_billing_account_id = $1), ''),
             COALESCE((SELECT MAX(invoice.updated_at)::text FROM billing_monthly_invoice invoice WHERE invoice.family_billing_account_id = $1), ''),
             COALESCE((
               SELECT md5(string_agg(CONCAT_WS(':',
                 adjustment.id::text,
                 adjustment.status,
                 adjustment.effective_from_month::text,
                 adjustment.effective_through_month::text,
                 adjustment.final_price_cents::text,
                 adjustment.promo_code,
                 adjustment.stripe_synced_at::text,
                 adjustment.revoked_at::text
               ), '|' ORDER BY adjustment.id))
                 FROM enrollment_price_adjustment adjustment
                WHERE adjustment.family_billing_account_id = $1
             ), ''),
             COALESCE((
               SELECT md5(string_agg(CONCAT_WS(':',
                 signup.id::text,
                 signup.status,
                 signup.enrollment_start_date::text,
                 signup.cancel_requested_at::text,
                 signup.cancel_effective_date::text,
                 signup.completed_at::text,
                 signup.paused_at::text,
                 signup.pause_effective_date::text,
                 signup.pause_mode
               ), '|' ORDER BY signup.id))
                 FROM scheduling_signup signup
                 JOIN member ON member.id = signup.member_id
                WHERE ${canonicalActiveHouseholdMemberPredicate({
                  memberAlias: 'member',
                  familyIdReference: 'account.family_id',
                  membershipAlias: 'revision_signup_membership',
                  historyAlias: 'revision_signup_history',
                })}
             ), ''),
             COALESCE((
               SELECT md5(string_agg(CONCAT_WS(':',
                 member.id::text,
                 member.first_name,
                 member.last_name,
                 member.is_active::text
               ), '|' ORDER BY member.id))
                 FROM member
                WHERE ${canonicalActiveHouseholdMemberPredicate({
                  memberAlias: 'member',
                  familyIdReference: 'account.family_id',
                  membershipAlias: 'revision_member_membership',
                  historyAlias: 'revision_member_history',
                })}
             ), ''),
             COALESCE((SELECT MAX(pass.updated_at)::text
                         FROM member_multi_class_pass pass
                         JOIN member ON member.id = pass.member_id
                        WHERE ${canonicalActiveHouseholdMemberPredicate({
                          memberAlias: 'member',
                          familyIdReference: 'account.family_id',
                          membershipAlias: 'revision_pass_membership',
                          historyAlias: 'revision_pass_history',
                        })}), ''),
             COALESCE((SELECT MAX(usage.created_at)::text
                         FROM multi_class_pass_redemption usage
                         JOIN member ON member.id = usage.member_id
                        WHERE ${canonicalActiveHouseholdMemberPredicate({
                          memberAlias: 'member',
                          familyIdReference: 'account.family_id',
                          membershipAlias: 'revision_usage_membership',
                          historyAlias: 'revision_usage_history',
                        })}), '')
           ))
             FROM family_billing_account account
            WHERE account.id = $1
         ) AS revision`,
      [Number(accountId), currentMonth],
    ),
    pool.query(
      `/* canonical-billing:relevant-charges */
       WITH application_totals AS (
         SELECT application.billing_charge_id,
                SUM(CASE
                  WHEN application.application_kind = 'reversal' THEN -application.amount_cents
                  ELSE application.amount_cents
                END)::bigint AS applied_cents,
                MAX(settled_payment.paid_at) FILTER (
                  WHERE application.application_kind = 'application'
                ) AS latest_paid_at
           FROM billing_payment_application application
           JOIN billing_charge scoped_charge ON scoped_charge.id = application.billing_charge_id
           JOIN billing_payment settled_payment ON settled_payment.id = application.billing_payment_id
          WHERE scoped_charge.family_billing_account_id = $1
            AND settled_payment.external_status IN ('settled', 'succeeded')
          GROUP BY application.billing_charge_id
       ), credit_application_totals AS (
         SELECT target_line.billing_charge_id,
                SUM(application.amount_cents)::bigint AS applied_cents
           FROM billing_charge_credit_application application
           JOIN billing_monthly_invoice_line target_line
             ON target_line.id = application.target_invoice_line_id
           JOIN billing_charge scoped_charge
             ON scoped_charge.id = target_line.billing_charge_id
          WHERE scoped_charge.family_billing_account_id = $1
          GROUP BY target_line.billing_charge_id
       ), credit_source_application_totals AS (
         SELECT credit_line.billing_charge_id,
                SUM(application.amount_cents)::bigint AS allocated_cents
           FROM billing_charge_credit_application application
           JOIN billing_monthly_invoice_line credit_line
             ON credit_line.id = application.credit_invoice_line_id
           JOIN billing_charge scoped_credit
             ON scoped_credit.id = credit_line.billing_charge_id
          WHERE scoped_credit.family_billing_account_id = $1
          GROUP BY credit_line.billing_charge_id
       ), linked_adjustment_totals AS (
         -- Customer history and monthly bill cards show a correction as part
         -- of its original class charge. Keep that same effective amount in
         -- the canonical snapshot so a class swap cannot make the card and
         -- ledger disagree.
         SELECT adjustment.related_charge_id AS billing_charge_id,
                SUM(adjustment.amount_cents)::bigint AS adjustment_cents
           FROM billing_charge adjustment
          WHERE adjustment.family_billing_account_id = $1
            AND adjustment.related_charge_id IS NOT NULL
            AND adjustment.source_type IN ('charge_adjustment', 'refund_offset')
          GROUP BY adjustment.related_charge_id
       ), candidate AS (
         SELECT charge.*,
                COALESCE(application.applied_cents, 0)::bigint AS applied_amount_cents,
                application.latest_paid_at,
                COALESCE(credit_application.applied_cents, 0)::bigint AS credit_applied_amount_cents,
                COALESCE(credit_source_application.allocated_cents, 0)::bigint
                  AS credit_allocated_amount_cents,
                COALESCE(linked_adjustment.adjustment_cents, 0)::bigint
                  AS linked_adjustment_cents,
                GREATEST(
                  0,
                  -- Keep the ledger remainder before linked corrections here.
                  -- summarizeCustomerBalanceCards consumes the correction row
                  -- and offsets this parent exactly once. Folding it in at
                  -- this level makes a coupon credit look like unapplied
                  -- household money.
                  charge.amount_cents
                    - COALESCE(application.applied_cents, 0)
                    - COALESCE(credit_application.applied_cents, 0)
                )::bigint AS remaining_amount_cents,
                EXISTS (
                  SELECT 1
                    FROM additional_fee fee
                   WHERE charge.source_type = 'additional_fee'
                     AND split_part(charge.source_id, ':', 1) ~ '^[0-9]+$'
                     AND fee.id = split_part(charge.source_id, ':', 1)::bigint
                     AND (
                       fee.trigger_type = 'once_per_year'
                       OR fee.apply_basis = 'per_year'
                     )
                ) AS is_annual_membership
           FROM billing_charge charge
           LEFT JOIN application_totals application ON application.billing_charge_id = charge.id
           LEFT JOIN credit_application_totals credit_application
             ON credit_application.billing_charge_id = charge.id
           LEFT JOIN credit_source_application_totals credit_source_application
             ON credit_source_application.billing_charge_id = charge.id
           LEFT JOIN linked_adjustment_totals linked_adjustment
             ON linked_adjustment.billing_charge_id = charge.id
          WHERE charge.family_billing_account_id = $1
       )
       SELECT candidate.*
         FROM candidate
        WHERE candidate.amount_cents < 0
           OR candidate.remaining_amount_cents > 0
           OR (
             candidate.charge_type = 'recurring'
             AND to_char(COALESCE(candidate.service_period_start, candidate.created_at::date), 'YYYY-MM') = $2
           )
           -- A paid annual membership belongs on the month-level household
           -- bill that actually collected it, even though it is a one-time
           -- charge rather than recurring tuition. This preserves the exact
           -- household total without inventing a Stripe invoice.
           OR (
             candidate.is_annual_membership
             AND candidate.applied_amount_cents > 0
             AND to_char(candidate.latest_paid_at AT TIME ZONE 'UTC', 'YYYY-MM') = $2
           )
           OR EXISTS (
             SELECT 1
               FROM billing_charge linked_credit
              WHERE linked_credit.family_billing_account_id = $1
                AND linked_credit.related_charge_id = candidate.id
                AND linked_credit.amount_cents < 0
           )
        ORDER BY candidate.created_at DESC, candidate.id DESC`,
      [Number(accountId), effectiveRecurringBillingMonth],
    ),
    pool.query(
      `/* canonical-billing:unapplied-payments */
       WITH application_totals AS (
         SELECT application.billing_payment_id,
                SUM(CASE
                  WHEN application.application_kind = 'reversal' THEN -application.amount_cents
                  ELSE application.amount_cents
                END)::bigint AS applied_cents
           FROM billing_payment_application application
           JOIN billing_payment scoped_payment ON scoped_payment.id = application.billing_payment_id
          WHERE scoped_payment.family_billing_account_id = $1
            AND scoped_payment.external_status IN ('settled', 'succeeded')
          GROUP BY application.billing_payment_id
       ), refund_totals AS (
         SELECT refund.payment_id,
                SUM(refund.amount_cents)::bigint AS refunded_cents
           FROM billing_refund refund
          WHERE refund.family_billing_account_id = $1
            AND COALESCE(refund.external_status, 'succeeded') IN ('pending', 'succeeded')
          GROUP BY refund.payment_id
       )
       SELECT payment.*,
              COALESCE(application.applied_cents, 0)::bigint AS applied_amount_cents,
              GREATEST(
                0,
                payment.amount_cents
                  - COALESCE(application.applied_cents, 0)
                  - COALESCE(refund.refunded_cents, 0)
              )::bigint AS remaining_amount_cents
         FROM billing_payment payment
         LEFT JOIN application_totals application ON application.billing_payment_id = payment.id
         LEFT JOIN refund_totals refund ON refund.payment_id = payment.id
        WHERE payment.family_billing_account_id = $1
          AND payment.external_status IN ('settled', 'succeeded')
          AND payment.amount_cents
                - COALESCE(application.applied_cents, 0)
                - COALESCE(refund.refunded_cents, 0) > 0
        ORDER BY payment.paid_at DESC, payment.id DESC`,
      [Number(accountId)],
    ),
    loadCanonicalCollectibleBalanceCents(pool, accountId),
  ])

  return {
    ...buildCanonicalFinancialSnapshot({
      totals: totalsResult.rows[0] ?? {},
      charges: chargeResult.rows,
      payments: paymentResult.rows,
      subscriptions,
      recurringBillingMonth: effectiveRecurringBillingMonth,
    }),
    // The monthly ledger bill can include paid annual memberships alongside
    // recurring class tuition. Keeping the full relevant charge set here
    // lets the presentation layer distinguish them without another read.
    monthlyLedgerCharges: chargeResult.rows,
    recurringCharges: chargeResult.rows.filter((charge) => charge.charge_type === 'recurring'),
    collectibleBalanceCents,
  }
}

/**
 * Amount safe to collect outside the household-invoice flow. Active invoice
 * lines are reservations and cannot also be paid by a balance checkout.
 */
export async function loadCanonicalCollectibleBalanceCents(pool, accountId) {
  const result = await pool.query(
    `/* canonical-billing:collectible-balance */
     WITH account_totals AS (
       SELECT
         COALESCE((SELECT SUM(amount_cents) FROM billing_charge WHERE family_billing_account_id = $1), 0)::bigint
         - COALESCE((
             SELECT SUM(amount_cents)
               FROM billing_payment
              WHERE family_billing_account_id = $1
                AND external_status IN ('settled', 'succeeded')
           ), 0)::bigint
         + COALESCE((
             SELECT SUM(amount_cents)
               FROM billing_refund
              WHERE family_billing_account_id = $1
                AND COALESCE(external_status, 'succeeded') = 'succeeded'
           ), 0)::bigint AS balance_cents
     ), application_totals AS (
       SELECT application.billing_charge_id,
              SUM(CASE
                WHEN application.application_kind = 'reversal' THEN -application.amount_cents
                ELSE application.amount_cents
              END)::bigint AS applied_cents
         FROM billing_payment_application application
         JOIN billing_charge charge ON charge.id = application.billing_charge_id
         JOIN billing_payment settled_payment ON settled_payment.id = application.billing_payment_id
        WHERE charge.family_billing_account_id = $1
          AND settled_payment.external_status IN ('settled', 'succeeded')
        GROUP BY application.billing_charge_id
     ), reserved_charge_ids AS (
       SELECT DISTINCT line.billing_charge_id
         FROM billing_monthly_invoice_line line
         JOIN billing_monthly_invoice invoice ON invoice.id = line.billing_monthly_invoice_id
        WHERE invoice.family_billing_account_id = $1
          AND invoice.status = ANY($2::text[])
          AND line.billing_charge_id IS NOT NULL
    ), invoice_reservations AS (
       SELECT COALESCE(SUM(GREATEST(
                0,
                charge.amount_cents
                  + COALESCE(linked_adjustment.adjustment_cents, 0)
                  - COALESCE(application.applied_cents, 0)
              )), 0)::bigint AS amount_cents
         FROM reserved_charge_ids reserved
         JOIN billing_charge charge ON charge.id = reserved.billing_charge_id
         LEFT JOIN application_totals application ON application.billing_charge_id = charge.id
         LEFT JOIN LATERAL (
           SELECT COALESCE(SUM(adjustment.amount_cents), 0)::bigint AS adjustment_cents
             FROM billing_charge adjustment
            WHERE adjustment.related_charge_id = charge.id
              AND adjustment.source_type IN ('charge_adjustment', 'refund_offset')
         ) linked_adjustment ON TRUE
     ), payment_attempt_reservations AS (
       SELECT COALESCE(SUM(reservation.amount_cents), 0)::bigint AS amount_cents
         FROM billing_payment_attempt_charge reservation
         JOIN billing_payment_attempt attempt ON attempt.id = reservation.billing_payment_attempt_id
        WHERE attempt.family_billing_account_id = $1
          AND (
            attempt.status IN ('pending', 'processing', 'reconciliation_required')
            OR (attempt.status = 'reserved' AND attempt.expires_at > now())
          )
     )
     SELECT GREATEST(
              0,
              account_totals.balance_cents
                - invoice_reservations.amount_cents
                - payment_attempt_reservations.amount_cents
            )::bigint AS collectible_balance_cents,
            account_totals.balance_cents,
            invoice_reservations.amount_cents + payment_attempt_reservations.amount_cents AS reserved_balance_cents
       FROM account_totals
       CROSS JOIN invoice_reservations
       CROSS JOIN payment_attempt_reservations`,
    [Number(accountId), HOUSEHOLD_INVOICE_RESERVING_STATUSES],
  )
  return Number(result.rows[0]?.collectible_balance_cents ?? 0)
}
