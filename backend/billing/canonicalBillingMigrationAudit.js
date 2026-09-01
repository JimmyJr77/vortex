import {
  buildEnrollmentBillingPeriodManifest,
  resolveFamilyEnrollmentPricing,
} from './familyEnrollmentPricing.js'
import {
  billingPaymentIsSettled,
  loadCanonicalFinancialSnapshot,
} from './canonicalBillingAccount.js'
import { summarizeCustomerBalanceCards } from './billingBalanceCards.js'
import {
  billingMigrationSnapshotHash,
  billingDateString,
  sanitizeBillingMigrationSnapshot,
  validateBillingTargetMonth,
} from './canonicalBillingMigrationState.js'
import {
  BillingMigrationSafetyError,
  inspectStripeCustomerSubscriptionInventory,
  retrieveStripeCustomerReadiness,
  retrieveStripeSubscriptionSnapshot,
  validateRemoteSubscriptionForMigration,
} from './canonicalBillingMigrationStripe.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'

const ANNUAL_PREDICATE = `(
  subscription.source_type = 'annual_membership'
  OR COALESCE(subscription.pricing_option_key, '') = 'annual_membership'
)`

export const CANONICAL_DROP_IN_CHARGE_SOURCE_TYPES = Object.freeze([
  'drop_in',
  'drop_in_registration',
])
const DROP_IN_CHARGE_SOURCE_SQL = CANONICAL_DROP_IN_CHARGE_SOURCE_TYPES
  .map((value) => `'${value}'`)
  .join(', ')

const ACCOUNT_MEMBERS_CTE = `
  account_scope AS (
    SELECT id, family_id FROM family_billing_account WHERE id = $1
  ),
  account_members AS (
    SELECT DISTINCT member.id AS member_id
      FROM account_scope
      JOIN member ON ${canonicalActiveHouseholdMemberPredicate({
        memberAlias: 'member',
        familyIdReference: 'account_scope.family_id',
        membershipAlias: 'account_membership',
        historyAlias: 'account_membership_history',
      })}
  )`

function exception(code, message, {
  severity = 'blocking',
  sourceId = null,
  details = {},
  repairable = false,
} = {}) {
  return {
    code,
    type: code,
    severity,
    repairable: repairable === true,
    message,
    dedupeKey: sourceId == null ? code : `${code}:${sourceId}`,
    details: sanitizeBillingMigrationSnapshot(details),
  }
}

function cents(value) {
  return Math.round(Number(value) || 0)
}

function compactSubscription(row) {
  return {
    id: Number(row.id),
    memberId: row.member_id == null ? null : Number(row.member_id),
    sourceType: row.source_type,
    sourceId: row.source_id,
    status: row.status,
    startDate: row.start_date ?? null,
    endDate: row.end_date ?? null,
    monthlyAmountCents: cents(row.monthly_amount_cents),
    discountAmountCents: cents(row.discount_amount_cents),
    netMonthlyCents: cents(row.net_monthly_cents),
    anchorDay: Number(row.anchor_day),
    nextBillDate: row.next_bill_date ?? null,
    priceSyncStatus: row.price_sync_status ?? 'not_required',
    stripeSubscriptionId: row.stripe_subscription_id ?? null,
    stripeSubscriptionItemId: row.stripe_subscription_item_id ?? null,
    stripeSubscriptionScheduleId: row.stripe_subscription_schedule_id ?? null,
    signupStatus: row.signup_status ?? null,
    signupId: row.signup_id == null ? null : Number(row.signup_id),
    signupOrphanedAt: row.signup_orphaned_at ?? null,
    pricingBreakdown: row.pricing_breakdown ?? null,
    signupCreatedAt: row.signup_created_at ?? null,
    enrollmentStartDate: row.enrollment_start_date ?? null,
    classActiveStart: row.class_active_start ?? null,
    classActiveEnd: row.class_active_end ?? null,
    cancelEffectiveDate: row.cancel_effective_date ?? null,
    pauseEffectiveDate: row.pause_effective_date ?? null,
  }
}

async function loadAccountFoundation(db, accountId) {
  const result = await db.query(
    `SELECT account.id, account.family_id, account.payer_member_id,
            account.is_active, account.stripe_customer_id,
            account.household_monthly_billing_enabled,
            account.billing_email, account.billing_phone,
            family.family_name, family.facility_id AS family_facility_id,
            payer.id AS payer_id, payer.is_active AS payer_is_active,
            (payer.is_active = TRUE
              AND payer.family_id = account.family_id
              AND NOT EXISTS (
                SELECT 1 FROM family_member payer_history
                 WHERE payer_history.member_id = payer.id
              )) AS payer_direct_family_active,
            payer.facility_id AS payer_facility_id,
            payer.email AS payer_email,
            payer_membership.is_active AS payer_family_membership_active,
            facility.timezone AS facility_timezone,
            (SELECT COUNT(*)::int
               FROM family_billing_account owner
              WHERE account.stripe_customer_id IS NOT NULL
                AND owner.stripe_customer_id = account.stripe_customer_id
                AND owner.is_active = TRUE) AS stripe_customer_active_account_count,
            family_facilities.facility_ids,
            COALESCE(cardinality(family_facilities.facility_ids), 0)::int AS family_facility_count,
            COALESCE(family_facilities.active_member_count, 0)::int AS family_active_member_count,
            COALESCE(family_facilities.member_facility_count, 0)::int AS family_member_facility_count
       FROM family_billing_account account
       JOIN family ON family.id = account.family_id
       LEFT JOIN member payer ON payer.id = account.payer_member_id
       LEFT JOIN family_member payer_membership
         ON payer_membership.family_id = account.family_id
        AND payer_membership.member_id = account.payer_member_id
       LEFT JOIN facility ON facility.id = family.facility_id
       LEFT JOIN LATERAL (
         SELECT array_agg(DISTINCT member.facility_id ORDER BY member.facility_id)
                  FILTER (WHERE member.facility_id IS NOT NULL) AS facility_ids,
                COUNT(*)::int AS active_member_count,
                COUNT(member.facility_id)::int AS member_facility_count
           FROM member
          WHERE ${canonicalActiveHouseholdMemberPredicate({
            memberAlias: 'member',
            familyIdReference: 'account.family_id',
            membershipAlias: 'facility_membership',
            historyAlias: 'facility_membership_history',
          })}
       ) family_facilities ON TRUE
      WHERE account.id = $1
      LIMIT 1`,
    [Number(accountId)],
  )
  return result.rows[0] ?? null
}

async function loadSubscriptions(db, accountId) {
  const result = await db.query(
    `SELECT subscription.*,
            signup.id AS signup_id,
            signup.status AS signup_status,
            signup.orphaned_at AS signup_orphaned_at,
            signup.created_at AS signup_created_at,
            signup.enrollment_start_date,
            signup.pricing_breakdown,
            COALESCE(slot_group.active_start, form.start_date) AS class_active_start,
            COALESCE(slot_group.active_end, form.end_date) AS class_active_end,
            signup.cancel_effective_date,
            signup.pause_effective_date
       FROM billing_subscription subscription
       LEFT JOIN scheduling_signup signup
         ON subscription.source_type = 'scheduling_signup'
        AND subscription.source_id ~ '^[0-9]+$'
        AND signup.id = subscription.source_id::bigint
       LEFT JOIN scheduling_form form ON form.id = signup.form_id
       LEFT JOIN scheduling_slot_group slot_group ON slot_group.id = signup.slot_group_id
      WHERE subscription.family_billing_account_id = $1
        AND subscription.status <> 'cancelled'
        AND NOT ${ANNUAL_PREDICATE}
      ORDER BY subscription.id`,
    [Number(accountId)],
  )
  return result.rows
}

async function loadFinancialSnapshot(db, accountId, targetMonth) {
  const [ledger, monthlyInvoices, ambiguity, manualDiscounts, historical] = await Promise.all([
    db.query(
      `SELECT
         (SELECT COUNT(*)::int FROM billing_charge WHERE family_billing_account_id = $1) AS charge_count,
         (SELECT COALESCE(SUM(amount_cents), 0)::bigint FROM billing_charge WHERE family_billing_account_id = $1) AS charge_cents,
         (SELECT COUNT(*)::int FROM billing_payment
           WHERE family_billing_account_id = $1
             AND external_status IN ('settled', 'succeeded')) AS payment_count,
         (SELECT COALESCE(SUM(amount_cents), 0)::bigint FROM billing_payment
           WHERE family_billing_account_id = $1
             AND external_status IN ('settled', 'succeeded')) AS payment_cents,
         (SELECT COUNT(*)::int FROM billing_refund WHERE family_billing_account_id = $1) AS refund_count,
         (SELECT COALESCE(SUM(amount_cents), 0)::bigint FROM billing_refund
           WHERE family_billing_account_id = $1 AND COALESCE(external_status, 'succeeded') = 'succeeded') AS refund_cents,
         (SELECT COUNT(*)::int FROM billing_charge
           WHERE family_billing_account_id = $1 AND collection_status IN ('checkout_pending', 'processing')) AS processing_charge_count,
         (SELECT COUNT(*)::int FROM billing_payment
           WHERE family_billing_account_id = $1 AND COALESCE(external_status, '') IN ('pending', 'processing')) AS processing_payment_count,
         (SELECT COUNT(*)::int FROM billing_refund
           WHERE family_billing_account_id = $1 AND COALESCE(external_status, '') IN ('pending', 'processing')) AS processing_refund_count,
         (
           COALESCE((SELECT SUM(amount_cents) FROM billing_charge
             WHERE family_billing_account_id = $1), 0)
           - COALESCE((SELECT SUM(amount_cents) FROM billing_payment
             WHERE family_billing_account_id = $1
               AND external_status IN ('settled', 'succeeded')), 0)
           + COALESCE((SELECT SUM(amount_cents) FROM billing_refund
             WHERE family_billing_account_id = $1
               AND COALESCE(external_status, 'succeeded') = 'succeeded'), 0)
         )::bigint AS ledger_running_balance_cents,
         (SELECT COUNT(*)::int
            FROM (
              SELECT charge.id, charge.amount_cents,
                     COALESCE(SUM(CASE WHEN application.application_kind = 'reversal'
                       THEN -application.amount_cents ELSE application.amount_cents END), 0)::bigint AS applied_cents
                FROM billing_charge charge
                LEFT JOIN billing_payment_application application ON application.billing_charge_id = charge.id
                LEFT JOIN billing_payment settled_payment
                  ON settled_payment.id = application.billing_payment_id
                 AND settled_payment.external_status IN ('settled', 'succeeded')
               WHERE charge.family_billing_account_id = $1
                 AND (application.id IS NULL OR settled_payment.id IS NOT NULL)
               GROUP BY charge.id, charge.amount_cents
            ) allocation
           WHERE allocation.applied_cents < 0 OR allocation.applied_cents > GREATEST(0, allocation.amount_cents)) AS charge_allocation_anomaly_count,
         (SELECT COUNT(*)::int
            FROM (
              SELECT payment.id, payment.amount_cents,
                     COALESCE(SUM(CASE WHEN application.application_kind = 'reversal'
                       THEN -application.amount_cents ELSE application.amount_cents END), 0)::bigint AS applied_cents
                FROM billing_payment payment
                LEFT JOIN billing_payment_application application ON application.billing_payment_id = payment.id
               WHERE payment.family_billing_account_id = $1
               GROUP BY payment.id, payment.amount_cents
            ) allocation
           WHERE allocation.applied_cents < 0 OR allocation.applied_cents > allocation.amount_cents) AS payment_allocation_anomaly_count`,
      [Number(accountId)],
    ),
    db.query(
      `SELECT id, billing_month, status, subtotal_cents, credit_cents, total_cents,
              stripe_invoice_id, stripe_payment_intent_id, paid_at
         FROM billing_monthly_invoice
        WHERE family_billing_account_id = $1
          AND (
            billing_month = $2::date
            OR status IN ('draft', 'open', 'failed', 'payment_method_required')
          )
        ORDER BY billing_month, id`,
      [Number(accountId), targetMonth],
    ),
    db.query(
      `SELECT alert_type, severity, stripe_object_id, message
         FROM stripe_billing_alert
        WHERE family_billing_account_id = $1
          AND resolved_at IS NULL
          AND alert_type IN ('membership_owner_review', 'payment_allocation_review')
        ORDER BY id`,
      [Number(accountId)],
    ).catch((error) => {
      if (error?.code === '42P01' || error?.code === '42703') return { rows: [] }
      throw error
    }),
    db.query(
      `WITH ${ACCOUNT_MEMBERS_CTE}
       SELECT signup.id, signup.manual_discount_cents, signup.manual_discount_pct,
              signup.manual_discount_rule_id, signup.manual_discount_reason,
              rule.type AS manual_discount_rule_type,
              rule.config AS manual_discount_rule_config
         FROM scheduling_signup signup
         JOIN account_members ON account_members.member_id = signup.member_id
         LEFT JOIN discount_rule rule ON rule.id = signup.manual_discount_rule_id
        WHERE TRUE
          AND signup.status = 'confirmed'
          AND (
            signup.manual_discount_cents IS NOT NULL
            OR signup.manual_discount_pct IS NOT NULL
            OR signup.manual_discount_rule_id IS NOT NULL
          )
          AND NOT EXISTS (
            SELECT 1 FROM enrollment_price_adjustment adjustment
             WHERE adjustment.signup_id = signup.id
               AND adjustment.status <> 'revoked'
          )
        ORDER BY signup.id`,
      [Number(accountId)],
    ).catch((error) => {
      if (error?.code === '42P01' || error?.code === '42703') return { rows: [] }
      throw error
    }),
    Promise.all([
      db.query(`SELECT COUNT(*)::int AS count FROM billing_statement WHERE family_billing_account_id = $1`, [Number(accountId)]),
      db.query(
        `SELECT COUNT(*)::int AS count
           FROM billing_subscription subscription
          WHERE subscription.family_billing_account_id = $1 AND ${ANNUAL_PREDICATE}`,
        [Number(accountId)],
      ),
      db.query(
        `WITH ${ACCOUNT_MEMBERS_CTE}
         SELECT COUNT(*)::int AS count
           FROM member_multi_class_pass pass
           JOIN account_members ON account_members.member_id = pass.member_id`,
        [Number(accountId)],
      ).catch((error) => {
        if (error?.code === '42P01') return { rows: [{ count: 0 }] }
        throw error
      }),
    ]),
  ])
  return {
    ledger: ledger.rows[0] ?? {},
    monthlyInvoices: monthlyInvoices.rows,
    ambiguityAlerts: ambiguity.rows,
    manualDiscountsMissingAdjustment: manualDiscounts.rows,
    historical: {
      statementCount: Number(historical[0].rows[0]?.count ?? 0),
      annualMembershipCount: Number(historical[1].rows[0]?.count ?? 0),
      bundlePassCount: Number(historical[2].rows[0]?.count ?? 0),
    },
  }
}

async function loadArtifactInventory(db, accountId) {
  const optional = (promise) => promise.catch((error) => {
    if (error?.code === '42P01' || error?.code === '42703') return { rows: [] }
    throw error
  })
  const [charges, payments, refunds, annualMemberships, passes, usage, statements, dropIns] = await Promise.all([
    db.query(
      `SELECT id, member_id, source_type, source_id, charge_type, billing_interval,
              description, amount_cents, discount_amount_cents, related_charge_id,
              subscription_id,
              service_period_start, service_period_end, collection_status, metadata,
              COALESCE(app.applied_cents, 0)::bigint AS applied_amount_cents,
              COALESCE(credit_app.applied_cents, 0)::bigint AS credit_applied_amount_cents,
              GREATEST(
                0,
                amount_cents
                  - COALESCE(app.applied_cents, 0)
                  - COALESCE(credit_app.applied_cents, 0)
              )::bigint AS remaining_amount_cents,
              created_at
         FROM billing_charge charge
         LEFT JOIN LATERAL (
           SELECT SUM(CASE WHEN application.application_kind = 'reversal'
             THEN -application.amount_cents ELSE application.amount_cents END)::bigint AS applied_cents
             FROM billing_payment_application application
             JOIN billing_payment settled_payment
               ON settled_payment.id = application.billing_payment_id
            WHERE application.billing_charge_id = charge.id
              AND settled_payment.external_status IN ('settled', 'succeeded')
         ) app ON TRUE
         LEFT JOIN LATERAL (
           SELECT SUM(application.amount_cents)::bigint AS applied_cents
             FROM billing_charge_credit_application application
             JOIN billing_monthly_invoice_line target_line
               ON target_line.id = application.target_invoice_line_id
            WHERE target_line.billing_charge_id = charge.id
         ) credit_app ON TRUE
        WHERE family_billing_account_id = $1 ORDER BY id`,
      [Number(accountId)],
    ),
    db.query(
      `SELECT payment.id, payment.amount_cents, payment.paid_at, payment.method,
              payment.external_processor, payment.external_status,
              stripe_payment_intent_id IS NOT NULL AS has_stripe_payment_intent,
              stripe_invoice_id IS NOT NULL AS has_stripe_invoice,
              COALESCE(app.applied_cents, 0)::bigint AS applied_amount_cents,
              GREATEST(0, payment.amount_cents - COALESCE(app.applied_cents, 0)
                - COALESCE(refund.refunded_cents, 0))::bigint AS remaining_amount_cents
         FROM billing_payment payment
         LEFT JOIN LATERAL (
           SELECT SUM(CASE WHEN application.application_kind = 'reversal'
             THEN -application.amount_cents ELSE application.amount_cents END)::bigint AS applied_cents
             FROM billing_payment_application application
            WHERE application.billing_payment_id = payment.id
         ) app ON TRUE
         LEFT JOIN LATERAL (
           SELECT SUM(item.amount_cents)::bigint AS refunded_cents
             FROM billing_refund item
            WHERE item.payment_id = payment.id
              AND COALESCE(item.external_status, 'succeeded') IN ('pending', 'succeeded')
         ) refund ON TRUE
        WHERE payment.family_billing_account_id = $1 ORDER BY payment.id`,
      [Number(accountId)],
    ),
    db.query(
      `SELECT id, payment_id, amount_cents, reason, external_status, created_at
         FROM billing_refund WHERE family_billing_account_id = $1 ORDER BY id`,
      [Number(accountId)],
    ),
    db.query(
      `SELECT subscription.id, subscription.member_id, subscription.source_id,
              subscription.status, subscription.start_date, subscription.end_date,
              subscription.next_bill_date, subscription.net_monthly_cents,
              subscription.stripe_subscription_id
         FROM billing_subscription subscription
        WHERE subscription.family_billing_account_id = $1 AND ${ANNUAL_PREDICATE}
        ORDER BY subscription.id`,
      [Number(accountId)],
    ),
    optional(db.query(
      `WITH ${ACCOUNT_MEMBERS_CTE}
       SELECT pass.id, pass.member_id, pass.programs_id, pass.package_id,
              pass.class_count_purchased, pass.classes_remaining, pass.price_cents,
              pass.billing_charge_id, pass.status, pass.expires_at, pass.purchased_at
         FROM member_multi_class_pass pass
         JOIN account_members ON account_members.member_id = pass.member_id
        ORDER BY pass.id`,
      [Number(accountId)],
    )),
    optional(db.query(
      `WITH ${ACCOUNT_MEMBERS_CTE}
       SELECT redemption.id, redemption.member_pass_id, redemption.signup_id,
              redemption.member_id, redemption.programs_id, redemption.entry_type,
              redemption.classes_used, redemption.classes_remaining_after,
              redemption.credit_delta, redemption.created_at
         FROM multi_class_pass_redemption redemption
         JOIN member_multi_class_pass pass ON pass.id = redemption.member_pass_id
         JOIN account_members ON account_members.member_id = pass.member_id
        ORDER BY redemption.id`,
      [Number(accountId)],
    )),
    db.query(
      `SELECT statement.id, statement.statement_date, statement.due_date,
              statement.total_cents, statement.status, statement.created_at
         FROM billing_statement statement
        WHERE statement.family_billing_account_id = $1 ORDER BY statement.id`,
      [Number(accountId)],
    ),
    optional(db.query(
      `WITH ${ACCOUNT_MEMBERS_CTE}
       SELECT registration.id, registration.member_id, registration.amount_cents,
              registration.class_date, registration.status,
              registration.created_at, 'drop_in'::text AS record_type
         FROM drop_in_registration registration
         JOIN account_members ON account_members.member_id = registration.member_id
        WHERE TRUE
          AND registration.status IN ('confirmed', 'attended')
          AND NOT EXISTS (
            SELECT 1 FROM billing_charge charge
             WHERE charge.family_billing_account_id = $1
               AND charge.source_type IN (${DROP_IN_CHARGE_SOURCE_SQL})
               AND charge.source_id = registration.id::text
          )
        ORDER BY registration.id`,
      [Number(accountId)],
    )),
  ])
  const map = (itemType, rows) => rows.map((row) => ({
    itemType,
    sourceId: String(row.id),
    targetId: String(row.id),
    state: 'verified',
    sourceSnapshot: sanitizeBillingMigrationSnapshot(row),
    targetSnapshot: { retainedInCanonicalStore: true, targetId: Number(row.id) },
  }))
  return [
    ...map('billing_charge', charges.rows),
    ...map('billing_payment', payments.rows),
    ...map('billing_refund', refunds.rows),
    ...map('annual_membership', annualMemberships.rows),
    ...map('bundle_pass', passes.rows),
    ...map('bundle_usage', usage.rows),
    ...map('statement', statements.rows),
    ...map('other', dropIns.rows),
  ]
}

function validBillingEmail(value) {
  return /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(String(value ?? '').trim())
}

export function payerExceptions(account, { runFacilityId = null } = {}) {
  const issues = []
  if (account.is_active !== true) {
    issues.push(exception('billing_account_inactive', 'Billing account is inactive.'))
  }
  if (!account.payer_member_id || !account.payer_id) {
    issues.push(exception('payer_missing', 'Billing account does not have a valid payer member.'))
  } else {
    if (account.payer_is_active !== true || account.payer_family_membership_active !== true) {
      issues.push(exception(
        'payer_not_active_family_member',
        'The payer is not an active member of this family.',
        {
          repairable: account.payer_is_active === true &&
            account.payer_direct_family_active === true,
        },
      ))
    }
  }
  const configuredBillingEmail = String(account.billing_email ?? '').trim()
  const effectiveBillingEmail = configuredBillingEmail || String(account.payer_email ?? '').trim()
  if (!effectiveBillingEmail) {
    issues.push(exception('billing_contact_email_missing', 'The account does not have a usable billing email address.'))
  } else if (!validBillingEmail(effectiveBillingEmail)) {
    issues.push(exception(
      'billing_contact_email_invalid',
      'The configured billing contact email is invalid.',
      { details: { source: configuredBillingEmail ? 'billing_account' : 'payer' } },
    ))
  }
  if (account.stripe_customer_id && Number(account.stripe_customer_active_account_count ?? 0) > 1) {
    issues.push(exception(
      'stripe_customer_shared_between_accounts',
      'The Stripe customer is linked to more than one active family billing account.',
      {
        details: {
          stripeCustomerId: account.stripe_customer_id,
          activeAccountCount: Number(account.stripe_customer_active_account_count ?? 0),
        },
      },
    ))
  }
  const familyFacilityId = Number(account.family_facility_id)
  const payerFacilityId = Number(account.payer_facility_id)
  const memberFacilityIds = (account.facility_ids ?? [])
    .map(Number)
    .filter((value) => Number.isInteger(value) && value > 0)
  const activeMemberCount = account.family_active_member_count == null
    ? memberFacilityIds.length
    : Number(account.family_active_member_count)
  const memberFacilityCount = account.family_member_facility_count == null
    ? memberFacilityIds.length
    : Number(account.family_member_facility_count)
  const normalizedRunFacilityId = runFacilityId == null ? null : Number(runFacilityId)
  const facilityMismatches = []
  if (!Number.isInteger(familyFacilityId) || familyFacilityId <= 0) {
    facilityMismatches.push('family_facility_missing')
  }
  if (
    account.payer_id != null &&
    (!Number.isInteger(payerFacilityId) || payerFacilityId !== familyFacilityId)
  ) {
    facilityMismatches.push('payer_facility_mismatch')
  }
  if (
    activeMemberCount <= 0 ||
    memberFacilityCount !== activeMemberCount ||
    memberFacilityIds.length !== 1 ||
    memberFacilityIds[0] !== familyFacilityId
  ) {
    facilityMismatches.push('active_member_facility_mismatch')
  }
  if (
    runFacilityId != null &&
    (!Number.isInteger(normalizedRunFacilityId) || normalizedRunFacilityId !== familyFacilityId)
  ) {
    facilityMismatches.push('migration_run_facility_mismatch')
  }
  if (facilityMismatches.length > 0) {
    issues.push(exception(
      'facility_scope_mismatch',
      'The family, payer, active members, and migration run must resolve to the same facility.',
      {
        details: {
          familyFacilityId: Number.isInteger(familyFacilityId) ? familyFacilityId : null,
          payerFacilityId: Number.isInteger(payerFacilityId) ? payerFacilityId : null,
          activeMemberFacilityIds: memberFacilityIds,
          activeMemberCount,
          memberFacilityCount,
          runFacilityId: Number.isInteger(normalizedRunFacilityId) ? normalizedRunFacilityId : null,
          mismatches: facilityMismatches,
        },
      },
    ))
  }
  if (!account.facility_timezone) {
    issues.push(exception(
      'facility_timezone_missing',
      'The family facility does not have a timezone for the billing boundary.',
      { details: { familyFacilityId: Number.isInteger(familyFacilityId) ? familyFacilityId : null } },
    ))
  }
  return issues
}

function financialExceptions(financial, targetMonth) {
  const issues = []
  const processing =
    Number(financial.ledger.processing_charge_count ?? 0) +
    Number(financial.ledger.processing_payment_count ?? 0) +
    Number(financial.ledger.processing_refund_count ?? 0)
  if (processing > 0) {
    issues.push(exception(
      'financial_activity_processing',
      'Charges, payments, or refunds are still processing.',
      { details: { processing } },
    ))
  }
  const expectedBalance = cents(financial.ledger.charge_cents) -
    cents(financial.ledger.payment_cents) + cents(financial.ledger.refund_cents)
  if (
    financial.ledger.ledger_running_balance_cents != null &&
    cents(financial.ledger.ledger_running_balance_cents) !== expectedBalance
  ) {
    issues.push(exception(
      'ledger_balance_mismatch',
      'Canonical ledger running balance does not match charges minus payments plus settled refunds.',
      {
        details: {
          expectedBalanceCents: expectedBalance,
          runningBalanceCents: cents(financial.ledger.ledger_running_balance_cents),
        },
      },
    ))
  }
  const allocationAnomalies = Number(financial.ledger.charge_allocation_anomaly_count ?? 0) +
    Number(financial.ledger.payment_allocation_anomaly_count ?? 0)
  if (allocationAnomalies > 0) {
    issues.push(exception(
      'payment_allocation_invariant_failed',
      'One or more effective payment applications are negative or exceed their charge/payment.',
      { details: { allocationAnomalies } },
    ))
  }
  for (const invoice of financial.monthlyInvoices) {
    if (billingDateString(invoice.billing_month) === targetMonth) {
      issues.push(exception(
        invoice.status === 'paid' ? 'target_household_invoice_already_paid' : 'target_household_invoice_exists',
        `A ${invoice.status} household invoice already exists for the target month.`,
        { sourceId: invoice.id, details: { invoiceId: Number(invoice.id), status: invoice.status, totalCents: cents(invoice.total_cents) } },
      ))
    } else if (['draft', 'open', 'failed', 'payment_method_required'].includes(invoice.status)) {
      issues.push(exception(
        'prior_household_invoice_unsettled',
        'A prior household invoice is unsettled and must be resolved before cutover.',
        { sourceId: invoice.id, details: { invoiceId: Number(invoice.id), status: invoice.status, billingMonth: invoice.billing_month } },
      ))
    }
  }
  for (const alert of financial.ambiguityAlerts) {
    issues.push(exception(
      'billing_ownership_ambiguous',
      alert.message || 'Billing ownership or allocation needs review.',
      { sourceId: alert.stripe_object_id ?? alert.alert_type, details: alert },
    ))
  }
  for (const signup of financial.manualDiscountsMissingAdjustment) {
    let ruleConfig = signup.manual_discount_rule_config ?? {}
    if (typeof ruleConfig === 'string') {
      try { ruleConfig = JSON.parse(ruleConfig) } catch { ruleConfig = {} }
    }
    const hasProvablePromo = signup.manual_discount_rule_type === 'promo_code' &&
      Boolean(String(ruleConfig.code ?? ruleConfig.promo_code ?? '').trim()) &&
      Boolean(String(signup.manual_discount_reason ?? '').trim())
    issues.push(exception(
      'legacy_discount_not_canonical',
      `Enrollment ${signup.id} has a legacy discount without a canonical price adjustment.`,
      {
        sourceId: signup.id,
        details: signup,
        repairable: hasProvablePromo,
      },
    ))
  }
  return issues
}

export function authoritativeBillingDateExceptions({ subscriptions = [], artifacts = [] } = {}) {
  const issues = []
  for (const subscription of subscriptions) {
    if (subscription.status !== 'active') continue
    const hasSourceSelector = subscription.sourceType === 'scheduling_signup' &&
      /^\d+$/.test(String(subscription.sourceId ?? ''))
    if (hasSourceSelector && subscription.signupStatus == null) {
      issues.push(exception(
        'recurring_signup_link_missing',
        `Subscription ${subscription.id} points to a scheduling signup that does not exist.`,
        { sourceId: subscription.id, details: { sourceId: subscription.sourceId } },
      ))
      continue
    }
    if (!hasSourceSelector) continue
    if (subscription.signupStatus !== 'confirmed') {
      issues.push(exception(
        'recurring_signup_status_mismatch',
        `Active subscription ${subscription.id} is linked to a ${subscription.signupStatus} signup.`,
        { sourceId: subscription.id, details: { signupStatus: subscription.signupStatus } },
      ))
      continue
    }
    if (!subscription.signupCreatedAt) {
      issues.push(exception(
        'recurring_signup_timestamp_missing',
        `Enrollment signup timestamp is missing for subscription ${subscription.id}.`,
        { sourceId: subscription.id },
      ))
    }
    if (!subscription.enrollmentStartDate) {
      issues.push(exception(
        'enrollment_effective_date_missing',
        `Enrollment effective date is missing for subscription ${subscription.id}.`,
        { sourceId: subscription.id },
      ))
    }
    const classStart = comparableDate(subscription.classActiveStart)
    const classEnd = comparableDate(subscription.classActiveEnd)
    if (classStart && classEnd && classEnd < classStart) {
      issues.push(exception(
        'class_active_dates_invalid',
        `Class dates are invalid for subscription ${subscription.id}.`,
        { sourceId: subscription.id, details: { classStart, classEnd } },
      ))
    }
  }
  for (const charge of artifactRows(artifacts, 'billing_charge')) {
    if (charge.charge_type !== 'recurring' && charge.billing_interval !== 'month') continue
    const start = comparableDate(charge.service_period_start)
    const end = comparableDate(charge.service_period_end)
    if (!start || !end) {
      const deterministicallyRepairable = !start && !end &&
        charge.subscription_id != null && charge.source_type === 'scheduling_signup'
      issues.push(exception(
        'recurring_charge_service_period_missing',
        `Recurring charge ${charge.id} does not have a complete authoritative service period.`,
        {
          sourceId: charge.id,
          repairable: deterministicallyRepairable,
          details: {
            servicePeriodStart: start,
            servicePeriodEnd: end,
            subscriptionId: charge.subscription_id == null ? null : Number(charge.subscription_id),
          },
        },
      ))
    } else if (end < start) {
      issues.push(exception(
        'recurring_charge_service_period_invalid',
        `Recurring charge ${charge.id} has an invalid service period.`,
        { sourceId: charge.id, details: { servicePeriodStart: start, servicePeriodEnd: end } },
      ))
    }
  }
  return issues
}

export function evaluateBillingMigrationParity({ pricing, subscriptions, targetMonth = null }) {
  const missingSignupIds = [...new Set((pricing?.missingSubscriptionSignupIds ?? []).map(Number))]
  const lines = (pricing?.lines ?? []).map((line) => ({
    signupId: Number(line.signupId),
    subscriptionId: line.subscriptionId == null ? null : Number(line.subscriptionId),
    grossCents: cents(line.grossCents),
    discountCents: cents(line.discountCents),
    netCents: cents(line.netCents),
    localGrossCents: line.localGrossCents == null ? null : cents(line.localGrossCents),
    localDiscountCents: line.localDiscountCents == null ? null : cents(line.localDiscountCents),
    localNetCents: line.localNetCents == null ? null : cents(line.localNetCents),
  }))
  const localEligible = lines.reduce((total, line) => ({
    grossCents: total.grossCents + cents(line.localGrossCents),
    discountCents: total.discountCents + cents(line.localDiscountCents),
    netCents: total.netCents + cents(line.localNetCents),
  }), { grossCents: 0, discountCents: 0, netCents: 0 })
  const canonical = {
    grossCents: cents(pricing?.grossCents),
    discountCents: cents(pricing?.discountCents),
    netCents: cents(pricing?.netCents),
  }
  const lifecycleManifest = targetMonth
    ? buildEnrollmentBillingPeriodManifest(subscriptions, targetMonth, {
        requireSubscriptionMapping: true,
      })
    : subscriptions.map((subscription) => ({
        subscriptionId: Number(subscription.id),
        signupId: /^\d+$/.test(String(subscription.sourceId ?? subscription.source_id ?? ''))
          ? Number(subscription.sourceId ?? subscription.source_id)
          : null,
        subscriptionStatus: subscription.status,
        valid: true,
        billable: subscription.status === 'active',
        reason: subscription.status === 'active' ? 'billable' : 'subscription_not_active',
      }))
  const invalidActiveSubscriptions = lifecycleManifest.filter((entry) => (
    entry.subscriptionStatus === 'active' && (
      entry.valid !== true ||
      (entry.billable === false && entry.exclusionScheduleValid !== true)
    )
  ))
  const activeLocalIds = lifecycleManifest
    .filter((entry) => entry.subscriptionStatus === 'active' && entry.valid === true && entry.billable === true)
    .map((entry) => Number(entry.subscriptionId))
  const targetLocalIds = lines.map((line) => line.subscriptionId).filter(Number.isFinite)
  const extraActiveSubscriptionIds = activeLocalIds.filter((id) => !targetLocalIds.includes(id))
  const matched = missingSignupIds.length === 0 &&
    invalidActiveSubscriptions.length === 0 &&
    extraActiveSubscriptionIds.length === 0 &&
    canonical.grossCents === localEligible.grossCents &&
    canonical.discountCents === localEligible.discountCents &&
    canonical.netCents === localEligible.netCents &&
    lines.every((line) =>
      line.grossCents === line.localGrossCents &&
      line.discountCents === line.localDiscountCents &&
      line.netCents === line.localNetCents,
    )
  return {
    matched,
    canonical,
    localEligible,
    missingSignupIds,
    extraActiveSubscriptionIds,
    invalidActiveSubscriptions,
    lifecycleManifest,
    lines,
  }
}

function pricingMismatchIsMissingLocalOnly(parity) {
  return (parity?.missingSignupIds ?? []).length > 0 &&
    (parity?.invalidActiveSubscriptions ?? []).length === 0 &&
    (parity?.extraActiveSubscriptionIds ?? []).length === 0 &&
    (parity?.lines ?? []).every((line) =>
      line.subscriptionId == null || (
        cents(line.grossCents) === cents(line.localGrossCents) &&
        cents(line.discountCents) === cents(line.localDiscountCents) &&
        cents(line.netCents) === cents(line.localNetCents)
      ),
    )
}

function normalizedTimestamp(value) {
  if (!value) return null
  const parsed = value instanceof Date ? value : new Date(value)
  return Number.isNaN(parsed.getTime()) ? String(value) : parsed.toISOString()
}

function comparableDate(value) {
  return billingDateString(value)
}

function comparableMonth(value) {
  if (value == null) return null
  const direct = String(value).match(/^(\d{4}-\d{2})/)
  if (direct) return direct[1]
  return normalizedTimestamp(value)?.slice(0, 7) ?? null
}

function artifactRows(artifacts, itemType) {
  return artifacts
    .filter((item) => item.itemType === itemType)
    .map((item) => item.sourceSnapshot ?? {})
}

export function missingDropInChargeExceptions({ artifacts = [] } = {}) {
  return artifactRows(artifacts, 'other')
    .filter((registration) => (
      registration.record_type === 'drop_in' && cents(registration.amount_cents) > 0
    ))
    .map((registration) => exception(
      'drop_in_charge_missing',
      `Drop-in registration ${registration.id} has a positive amount but no canonical billing charge.`,
      {
        sourceId: registration.id,
        details: {
          memberId: registration.member_id == null ? null : Number(registration.member_id),
          amountCents: cents(registration.amount_cents),
          classDate: comparableDate(registration.class_date),
          status: registration.status ?? null,
        },
      },
    ))
}

function parityDimension(legacy, canonical, matched = null) {
  const safeLegacy = sanitizeBillingMigrationSnapshot(legacy)
  const safeCanonical = sanitizeBillingMigrationSnapshot(canonical)
  const legacyHash = billingMigrationSnapshotHash(safeLegacy)
  const canonicalHash = billingMigrationSnapshotHash(safeCanonical)
  return {
    legacy: safeLegacy,
    canonical: safeCanonical,
    legacyHash,
    canonicalHash,
    matched: matched == null ? legacyHash === canonicalHash : matched === true,
  }
}

function visibleLegacyTransactionManifest(artifacts) {
  const charges = artifactRows(artifacts, 'billing_charge')
    .filter((row) => row.metadata?.customerAuditVisibility !== 'suppressed')
    .map((row) => ({
      entryKind: 'charge',
      refId: Number(row.id),
      memberId: row.member_id == null ? null : Number(row.member_id),
      amountCents: cents(row.amount_cents),
      occurredAt: normalizedTimestamp(row.created_at),
    }))
  const payments = artifactRows(artifacts, 'billing_payment').map((row) => ({
    entryKind: 'payment',
    refId: Number(row.id),
    memberId: null,
    amountCents: -cents(row.amount_cents),
    occurredAt: normalizedTimestamp(row.paid_at),
  }))
  const refunds = artifactRows(artifacts, 'billing_refund')
    .filter((row) => (row.external_status ?? 'succeeded') === 'succeeded')
    .map((row) => ({
      entryKind: 'refund',
      refId: Number(row.id),
      memberId: null,
      amountCents: cents(row.amount_cents),
      occurredAt: normalizedTimestamp(row.created_at),
    }))
  const dropIns = artifactRows(artifacts, 'other')
    .filter((row) => row.record_type === 'drop_in')
    .map((row) => ({
      entryKind: 'drop_in',
      refId: Number(row.id),
      memberId: row.member_id == null ? null : Number(row.member_id),
      amountCents: cents(row.amount_cents),
      // A class date is a facility-local calendar date, not an instant. node-postgres
      // can materialize DATE values at the process timezone while a UNION cast to
      // timestamptz uses the database timezone. Comparing the logical date avoids a
      // false four-hour parity delta without changing the customer-visible record.
      occurredAt: comparableDate(row.class_date),
    }))
  return [...charges, ...payments, ...refunds, ...dropIns]
    .sort((left, right) =>
      String(left.occurredAt).localeCompare(String(right.occurredAt)) ||
      left.entryKind.localeCompare(right.entryKind) || left.refId - right.refId,
    )
}

function canonicalTransactionManifest(rows) {
  return rows.map((row) => ({
    entryKind: row.entry_kind,
    refId: Number(row.ref_id),
    memberId: row.member_id == null ? null : Number(row.member_id),
    amountCents: cents(row.amount_cents),
    occurredAt: row.entry_kind === 'drop_in'
      ? comparableDate(row.billing_month ?? row.occurred_at)
      : normalizedTimestamp(row.occurred_at),
  })).sort((left, right) =>
    String(left.occurredAt).localeCompare(String(right.occurredAt)) ||
    left.entryKind.localeCompare(right.entryKind) || left.refId - right.refId,
  )
}

function recentMonthKeys(now, count = 12) {
  const date = now instanceof Date ? new Date(now.getTime()) : new Date(now)
  if (Number.isNaN(date.getTime())) throw new Error('A valid audit timestamp is required.')
  const result = []
  const cursor = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1))
  for (let index = 0; index < count; index += 1) {
    result.push(cursor.toISOString().slice(0, 7))
    cursor.setUTCMonth(cursor.getUTCMonth() - 1)
  }
  return result
}

function historyManifestFromLegacy(artifacts, now) {
  const months = recentMonthKeys(now)
  const values = new Map(months.map((month) => [month, {
    month, chargeCount: 0, chargeCents: 0, paymentCount: 0, paymentCents: 0, netCents: 0,
  }]))
  for (const charge of artifactRows(artifacts, 'billing_charge')) {
    if (charge.metadata?.customerAuditVisibility === 'suppressed') continue
    const month = comparableMonth(charge.service_period_start ?? charge.created_at)
    const row = values.get(month)
    if (!row) continue
    row.chargeCount += 1
    row.chargeCents += cents(charge.amount_cents)
  }
  for (const payment of artifactRows(artifacts, 'billing_payment')) {
    if (!billingPaymentIsSettled(payment.external_status)) continue
    const month = comparableMonth(payment.paid_at)
    const row = values.get(month)
    if (!row) continue
    row.paymentCount += 1
    row.paymentCents += cents(payment.amount_cents)
  }
  for (const row of values.values()) row.netCents = row.chargeCents - row.paymentCents
  return [...values.values()]
}

function historyManifestFromCanonical(rows, now) {
  const months = recentMonthKeys(now)
  const values = new Map(months.map((month) => [month, {
    month, chargeCount: 0, chargeCents: 0, paymentCount: 0, paymentCents: 0, netCents: 0,
  }]))
  for (const entry of rows) {
    if (!['charge', 'payment'].includes(entry.entry_kind)) continue
    if (entry.entry_kind === 'payment' && !billingPaymentIsSettled(entry.entry_status)) continue
    const month = comparableMonth(entry.billing_month ?? entry.occurred_at)
    const row = values.get(month)
    if (!row) continue
    if (entry.entry_kind === 'charge') {
      row.chargeCount += 1
      row.chargeCents += cents(entry.amount_cents)
    } else {
      row.paymentCount += 1
      row.paymentCents += Math.abs(cents(entry.amount_cents))
    }
  }
  for (const row of values.values()) row.netCents = row.chargeCents - row.paymentCents
  return [...values.values()]
}

async function loadLockedParityEvidence(db, {
  accountId,
  subscriptions,
  now,
} = {}) {
  const [canonicalFinancial, visibleTransactions, membershipOwnership, paidThrough] = await Promise.all([
    loadCanonicalFinancialSnapshot(db, {
      accountId,
      subscriptions: subscriptions.map((row) => ({
        id: row.id,
        status: row.status,
        next_bill_date: row.nextBillDate,
        net_monthly_cents: row.netMonthlyCents,
        discount_amount_cents: row.discountAmountCents,
        source_type: row.sourceType,
      })),
      asOf: now,
    }),
    db.query(
      `WITH ${ACCOUNT_MEMBERS_CTE},
       entries AS (
         SELECT 'charge'::text AS entry_kind, charge.id::bigint AS ref_id,
                charge.member_id::bigint AS member_id, charge.amount_cents::int AS amount_cents,
                charge.created_at::timestamptz AS occurred_at,
                COALESCE(charge.service_period_start, charge.created_at::date)::date AS billing_month,
                COALESCE(charge.collection_status, 'none')::text AS entry_status
           FROM billing_charge charge
          WHERE charge.family_billing_account_id = $1
            AND COALESCE(charge.metadata->>'customerAuditVisibility', 'visible') <> 'suppressed'
         UNION ALL
         SELECT 'payment'::text, payment.id::bigint, NULL::bigint,
                -payment.amount_cents::int, payment.paid_at::timestamptz,
                payment.paid_at::date, payment.external_status::text
           FROM billing_payment payment
          WHERE payment.family_billing_account_id = $1
         UNION ALL
         SELECT 'refund'::text, refund.id::bigint, NULL::bigint,
                refund.amount_cents::int, refund.created_at::timestamptz,
                refund.created_at::date, COALESCE(refund.external_status, 'succeeded')::text
           FROM billing_refund refund
          WHERE refund.family_billing_account_id = $1
            AND COALESCE(refund.external_status, 'succeeded') = 'succeeded'
         UNION ALL
         SELECT 'drop_in'::text, registration.id::bigint, registration.member_id::bigint,
                registration.amount_cents::int, registration.class_date::timestamptz,
                registration.class_date::date, registration.status::text
           FROM drop_in_registration registration
           JOIN account_members ON account_members.member_id = registration.member_id
          WHERE registration.status IN ('confirmed', 'attended')
            AND NOT EXISTS (
              SELECT 1 FROM billing_charge charged
               WHERE charged.family_billing_account_id = $1
                 AND charged.source_type IN (${DROP_IN_CHARGE_SOURCE_SQL})
                 AND charged.source_id = registration.id::text
            )
       )
       SELECT * FROM entries ORDER BY occurred_at, entry_kind, ref_id`,
      [Number(accountId)],
    ).then((result) => result.rows),
    db.query(
      `SELECT charge.id AS charge_id, charge.member_id AS charge_member_id,
              CASE WHEN split_part(charge.source_id, ':', 1) ~ '^[0-9]+$'
                THEN split_part(charge.source_id, ':', 1)::bigint END AS fee_id,
              CASE WHEN split_part(charge.source_id, ':', 2) ~ '^[0-9]+$'
                THEN split_part(charge.source_id, ':', 2)::bigint END AS source_member_id,
              split_part(charge.source_id, ':', 3) AS period_key,
              charge.amount_cents, charge.collection_status,
              COALESCE(app.applied_cents, 0)::bigint AS applied_cents,
              redemption.member_id AS redemption_member_id,
              redemption.billing_charge_id AS redemption_charge_id,
              subscription.id AS annual_subscription_id,
              subscription.member_id AS subscription_member_id
         FROM billing_charge charge
         JOIN additional_fee fee
           ON charge.source_type = 'additional_fee'
          AND split_part(charge.source_id, ':', 1) ~ '^[0-9]+$'
          AND fee.id = split_part(charge.source_id, ':', 1)::bigint
          AND (fee.trigger_type = 'once_per_year' OR fee.apply_basis = 'per_year'
            OR lower(fee.name) LIKE '%annual%' OR lower(fee.name) LIKE '%membership%')
         LEFT JOIN LATERAL (
           SELECT SUM(CASE WHEN application.application_kind = 'reversal'
             THEN -application.amount_cents ELSE application.amount_cents END)::bigint AS applied_cents
             FROM billing_payment_application application
             JOIN billing_payment settled_payment
               ON settled_payment.id = application.billing_payment_id
            WHERE application.billing_charge_id = charge.id
              AND settled_payment.external_status IN ('settled', 'succeeded')
         ) app ON TRUE
         LEFT JOIN additional_fee_redemption redemption ON redemption.billing_charge_id = charge.id
         LEFT JOIN LATERAL (
           SELECT candidate.id, candidate.member_id
             FROM billing_subscription candidate
            WHERE candidate.family_billing_account_id = charge.family_billing_account_id
              AND (candidate.source_type = 'annual_membership'
                OR COALESCE(candidate.pricing_option_key, '') = 'annual_membership')
              AND candidate.source_id = concat(split_part(charge.source_id, ':', 1), ':', charge.member_id::text)
            ORDER BY candidate.start_date DESC NULLS LAST, candidate.id DESC
            LIMIT 1
         ) subscription ON TRUE
        WHERE charge.family_billing_account_id = $1
        ORDER BY charge.id`,
      [Number(accountId)],
    ).then((result) => result.rows),
    db.query(
      `SELECT subscription.id AS subscription_id, subscription.member_id,
              subscription.source_id, subscription.next_bill_date,
              paid.paid_through_date,
              CASE WHEN paid.paid_through_date IS NULL THEN NULL
                ELSE paid.paid_through_date + 1 END AS derived_next_bill_date,
              COALESCE(paid.owner_mismatch_count, 0)::int AS owner_mismatch_count
         FROM billing_subscription subscription
         LEFT JOIN LATERAL (
           SELECT MAX(charge.service_period_end) FILTER (
                    WHERE COALESCE(app.applied_cents, 0) >= GREATEST(0, charge.amount_cents)
                  ) AS paid_through_date,
                  COUNT(*) FILTER (
                    WHERE charge.member_id IS DISTINCT FROM subscription.member_id
                  )::int AS owner_mismatch_count
             FROM billing_charge charge
             LEFT JOIN LATERAL (
               SELECT SUM(CASE WHEN application.application_kind = 'reversal'
                 THEN -application.amount_cents ELSE application.amount_cents END)::bigint AS applied_cents
                 FROM billing_payment_application application
                 JOIN billing_payment settled_payment
                   ON settled_payment.id = application.billing_payment_id
                WHERE application.billing_charge_id = charge.id
                  AND settled_payment.external_status IN ('settled', 'succeeded')
             ) app ON TRUE
            WHERE charge.subscription_id = subscription.id
              AND charge.charge_type = 'recurring'
         ) paid ON TRUE
        WHERE subscription.family_billing_account_id = $1
          AND subscription.source_type = 'scheduling_signup'
          AND subscription.status IN ('active', 'paused')
        ORDER BY subscription.id`,
      [Number(accountId)],
    ).then((result) => result.rows),
  ])
  return { canonicalFinancial, visibleTransactions, membershipOwnership, paidThrough }
}

/**
 * Produce explicit, stable legacy-vs-canonical results for every value locked
 * before collection cutover.  `matched` is never inferred from an overall
 * artifact count: every dimension records its own values/hashes and verdict.
 */
export function buildLockedBillingParityDimensions({
  artifacts,
  financial,
  pricingParity,
  subscriptions,
  evidence,
  targetMonth,
  now,
} = {}) {
  const chargeRows = artifactRows(artifacts, 'billing_charge')
  const paymentRows = artifactRows(artifacts, 'billing_payment')
    .filter((row) => billingPaymentIsSettled(row.external_status))
  const refundRows = artifactRows(artifacts, 'billing_refund')
  const refundsCents = refundRows
    .filter((row) => (row.external_status ?? 'succeeded') === 'succeeded')
    .reduce((sum, row) => sum + cents(row.amount_cents), 0)
  const legacyCards = summarizeCustomerBalanceCards({
    charges: chargeRows,
    payments: paymentRows,
    subscriptions,
    refundsCents,
    recurringBillingMonth: evidence.canonicalFinancial.recurringBillingMonth,
  })

  const legacyBalance = {
    chargeCents: cents(financial.ledger.charge_cents),
    paymentCents: cents(financial.ledger.payment_cents),
    refundCents: cents(financial.ledger.refund_cents),
    balanceCents: cents(financial.ledger.charge_cents) -
      cents(financial.ledger.payment_cents) + cents(financial.ledger.refund_cents),
  }
  const canonicalBalance = {
    chargeCents: cents(evidence.canonicalFinancial.chargesCents),
    paymentCents: cents(evidence.canonicalFinancial.paymentsCents),
    refundCents: cents(evidence.canonicalFinancial.refundsCents),
    balanceCents: cents(evidence.canonicalFinancial.balanceCents),
    ledgerRunningBalanceCents: financial.ledger.ledger_running_balance_cents == null
      ? null
      : cents(financial.ledger.ledger_running_balance_cents),
  }
  const balanceMatched = legacyBalance.chargeCents === canonicalBalance.chargeCents &&
    legacyBalance.paymentCents === canonicalBalance.paymentCents &&
    legacyBalance.refundCents === canonicalBalance.refundCents &&
    legacyBalance.balanceCents === canonicalBalance.balanceCents &&
    (canonicalBalance.ledgerRunningBalanceCents == null ||
      canonicalBalance.ledgerRunningBalanceCents === legacyBalance.balanceCents)

  const legacyOutstanding = { outstandingAmountCents: cents(legacyCards.outstandingBalanceCents) }
  const canonicalOutstanding = {
    outstandingAmountCents: cents(evidence.canonicalFinancial.outstandingBalanceCents),
  }

  const lifecycleManifest = pricingParity.lifecycleManifest ?? buildEnrollmentBillingPeriodManifest(
    subscriptions,
    targetMonth,
    { requireSubscriptionMapping: true },
  )
  const effectiveLocalEnrollments = lifecycleManifest
    .filter((entry) => (
      entry.subscriptionStatus === 'active' && entry.valid === true && entry.billable === true
    ))
    .map((entry) => ({
      signupId: entry.signupId == null ? null : Number(entry.signupId),
      subscriptionId: Number(entry.subscriptionId),
    }))
    .sort((left, right) => left.subscriptionId - right.subscriptionId)
  const canonicalEnrollments = (pricingParity.lines ?? []).map((line) => ({
    signupId: Number(line.signupId),
    subscriptionId: Number(line.subscriptionId),
  })).sort((left, right) => left.subscriptionId - right.subscriptionId)

  const annualSubscriptions = artifactRows(artifacts, 'annual_membership').map((row) => ({
    id: Number(row.id),
    memberId: row.member_id == null ? null : Number(row.member_id),
    sourceId: row.source_id ?? null,
    nextBillDate: comparableDate(row.next_bill_date),
  }))
  const annualOwnership = (evidence.membershipOwnership ?? []).map((row) => ({
    chargeId: Number(row.charge_id),
    chargeMemberId: row.charge_member_id == null ? null : Number(row.charge_member_id),
    sourceMemberId: row.source_member_id == null ? null : Number(row.source_member_id),
    redemptionMemberId: row.redemption_member_id == null ? null : Number(row.redemption_member_id),
    subscriptionMemberId: row.subscription_member_id == null ? null : Number(row.subscription_member_id),
    paid: row.collection_status === 'paid' ||
      cents(row.applied_cents) >= Math.max(0, cents(row.amount_cents)),
  }))
  const paidThrough = (evidence.paidThrough ?? []).map((row) => ({
    subscriptionId: Number(row.subscription_id),
    memberId: row.member_id == null ? null : Number(row.member_id),
    nextBillDate: comparableDate(row.next_bill_date),
    paidThroughDate: comparableDate(row.paid_through_date),
    derivedNextBillDate: comparableDate(row.derived_next_bill_date),
    ownerMismatchCount: Number(row.owner_mismatch_count ?? 0),
  }))
  const membershipMatched = annualSubscriptions.every((row) => {
    const sourceMemberId = /^\d+:\d+/.test(String(row.sourceId ?? ''))
      ? Number(String(row.sourceId).split(':')[1])
      : row.memberId
    return sourceMemberId === row.memberId
  }) && annualOwnership.every((row) =>
    (row.sourceMemberId == null || row.sourceMemberId === row.chargeMemberId) &&
    (row.redemptionMemberId == null || row.redemptionMemberId === row.chargeMemberId) &&
    (row.subscriptionMemberId == null || row.subscriptionMemberId === row.chargeMemberId) &&
    (!row.paid || row.redemptionMemberId != null),
  ) && paidThrough.every((row) =>
    row.ownerMismatchCount === 0 &&
    (row.derivedNextBillDate == null || row.nextBillDate >= row.derivedNextBillDate),
  )

  const legacyTransactions = visibleLegacyTransactionManifest(artifacts)
  const canonicalTransactions = canonicalTransactionManifest(evidence.visibleTransactions ?? [])
  const legacyHistory = historyManifestFromLegacy(artifacts, now)
  const canonicalHistory = historyManifestFromCanonical(evidence.visibleTransactions ?? [], now)

  const passRows = artifactRows(artifacts, 'bundle_pass')
  const usageRows = artifactRows(artifacts, 'bundle_usage')
  const canonicalBundles = passRows.map((pass) => {
    const creditDelta = usageRows
      .filter((usage) => Number(usage.member_pass_id) === Number(pass.id))
      .reduce((sum, usage) => sum + Number(
        usage.credit_delta ?? (usage.classes_used == null ? 0 : -Number(usage.classes_used)),
      ), 0)
    return {
      passId: Number(pass.id),
      memberId: Number(pass.member_id),
      recomputedEntitlementBalance: Number(pass.class_count_purchased ?? 0) + creditDelta,
    }
  }).sort((left, right) => left.passId - right.passId)
  const legacyBundles = passRows.map((pass) => ({
    passId: Number(pass.id),
    memberId: Number(pass.member_id),
    storedEntitlementBalance: Number(pass.classes_remaining ?? 0),
  })).sort((left, right) => left.passId - right.passId)
  const bundlesMatched = legacyBundles.every((legacy, index) =>
    legacy.passId === canonicalBundles[index]?.passId &&
    legacy.memberId === canonicalBundles[index]?.memberId &&
    legacy.storedEntitlementBalance === canonicalBundles[index]?.recomputedEntitlementBalance,
  )

  return {
    balance: parityDimension(legacyBalance, canonicalBalance, balanceMatched),
    outstandingAmount: parityDimension(
      legacyOutstanding,
      canonicalOutstanding,
      legacyOutstanding.outstandingAmountCents === canonicalOutstanding.outstandingAmountCents,
    ),
    nextMonthRecurringFee: parityDimension(
      { targetMonth, ...pricingParity.localEligible },
      { targetMonth, ...pricingParity.canonical },
      pricingParity.matched,
    ),
    enrollments: parityDimension(
      effectiveLocalEnrollments,
      canonicalEnrollments,
      billingMigrationSnapshotHash(effectiveLocalEnrollments) === billingMigrationSnapshotHash(canonicalEnrollments) &&
        (pricingParity.missingSignupIds ?? []).length === 0 &&
        (pricingParity.extraActiveSubscriptionIds ?? []).length === 0,
    ),
    membershipsAndPaidThroughOwnership: parityDimension(
      { annualSubscriptions, enrollmentNextBillDates: paidThrough.map((row) => ({
        subscriptionId: row.subscriptionId, memberId: row.memberId, nextBillDate: row.nextBillDate,
      })) },
      { annualOwnership, recomputedPaidThrough: paidThrough },
      membershipMatched,
    ),
    transactionsVisibleRecordManifest: parityDimension(
      { count: legacyTransactions.length, manifestHash: billingMigrationSnapshotHash(legacyTransactions) },
      { count: canonicalTransactions.length, manifestHash: billingMigrationSnapshotHash(canonicalTransactions) },
      billingMigrationSnapshotHash(legacyTransactions) === billingMigrationSnapshotHash(canonicalTransactions),
    ),
    twelveMonthHistory: parityDimension(legacyHistory, canonicalHistory),
    bundlesAndRecomputedEntitlementBalance: parityDimension(
      legacyBundles,
      canonicalBundles,
      bundlesMatched,
    ),
  }
}

function unavailableLockedParityDimensions(error) {
  const legacy = { status: 'unavailable' }
  const canonical = { status: 'unavailable', error: error?.message ?? String(error) }
  return Object.fromEntries([
    'balance',
    'outstandingAmount',
    'nextMonthRecurringFee',
    'enrollments',
    'membershipsAndPaidThroughOwnership',
    'transactionsVisibleRecordManifest',
    'twelveMonthHistory',
    'bundlesAndRecomputedEntitlementBalance',
  ].map((name) => [name, parityDimension(legacy, canonical, false)]))
}

export function classifyBillingMigrationIssues(issues = []) {
  const blocking = issues.filter((item) => ['blocking', 'critical'].includes(item.severity))
  if (blocking.length === 0) return 'ready'
  return blocking.every((item) => item.repairable === true) ? 'repairable' : 'blocked'
}

export async function auditCanonicalBillingAccount(db, {
  accountId,
  targetMonth,
  stripe = null,
  now = new Date(),
  allowScheduledCancellation = false,
  runFacilityId = null,
} = {}) {
  const account = await loadAccountFoundation(db, accountId)
  if (!account) {
    return {
      accountId: Number(accountId),
      eligible: false,
      classification: 'blocked',
      account: null,
      exceptions: [exception('billing_account_not_found', `Billing account ${accountId} was not found.`)],
      items: [],
      sourceCollectionMode: 'unknown',
      payerValidationStatus: 'invalid',
      parityStatus: 'pending',
      snapshotHash: null,
    }
  }

  const issues = payerExceptions(account, { runFacilityId })
  const timezone = account.facility_timezone
  let boundary = null
  if (timezone && !issues.some((issue) => issue.code === 'facility_scope_mismatch')) {
    try {
      boundary = validateBillingTargetMonth(targetMonth, { timeZone: timezone, now })
    } catch (error) {
      issues.push(exception('target_month_invalid', error.message, { details: { targetMonth, timezone } }))
    }
  }
  const subscriptions = (await loadSubscriptions(db, accountId)).map(compactSubscription)
  const legacySubscriptions = subscriptions.filter((row) => row.stripeSubscriptionId)
  const sourceCollectionMode = account.household_monthly_billing_enabled === true
    ? 'household_monthly'
    : legacySubscriptions.length > 0 ? 'legacy_per_class' : 'manual'

  if (subscriptions.filter((row) => row.status === 'active').length === 0) {
    issues.push(exception(
      'no_active_recurring_enrollments',
      'Account has no active recurring class enrollment to migrate.',
      { severity: 'warning' },
    ))
  }
  for (const subscription of subscriptions) {
    if (subscription.anchorDay !== 1) {
      issues.push(exception(
        'billing_anchor_not_first',
        `Subscription ${subscription.id} is not anchored to the first of the month.`,
        { sourceId: subscription.id, details: { anchorDay: subscription.anchorDay } },
      ))
    }
    if (subscription.sourceType !== 'scheduling_signup' || !/^\d+$/.test(String(subscription.sourceId ?? ''))) {
      issues.push(exception(
        'recurring_source_ambiguous',
        `Subscription ${subscription.id} is not linked to one scheduling signup.`,
        { sourceId: subscription.id, details: { sourceType: subscription.sourceType, sourceId: subscription.sourceId } },
      ))
    }
    if (subscription.priceSyncStatus === 'failed') {
      issues.push(exception(
        'subscription_price_sync_failed',
        `Subscription ${subscription.id} has an unresolved price synchronization failure.`,
        { sourceId: subscription.id },
      ))
    }
  }

  const financial = await loadFinancialSnapshot(db, accountId, targetMonth)
  const artifacts = await loadArtifactInventory(db, accountId)
  issues.push(...financialExceptions(financial, targetMonth))
  issues.push(...authoritativeBillingDateExceptions({ subscriptions, artifacts }))
  issues.push(...missingDropInChargeExceptions({ artifacts }))

  let pricing = null
  let parity = { matched: false, canonical: {}, localEligible: {}, missingSignupIds: [], extraActiveSubscriptionIds: [], lines: [] }
  try {
    pricing = await resolveFamilyEnrollmentPricing(db, {
      familyId: Number(account.family_id),
      periodKey: String(targetMonth).slice(0, 7),
      // Migration auditing is a read path. Required billing schema is deployed
      // and checked at startup; an audit must never attempt compatibility DDL.
      ensureSchema: false,
      subscriptions: subscriptions.map((row) => ({
        id: row.id,
        member_id: row.memberId,
        source_type: row.sourceType,
        source_id: row.sourceId,
        status: row.status,
        monthly_amount_cents: row.monthlyAmountCents,
        discount_amount_cents: row.discountAmountCents,
        net_monthly_cents: row.netMonthlyCents,
        start_date: row.enrollmentStartDate,
        next_bill_date: row.nextBillDate,
        stripe_subscription_id: row.stripeSubscriptionId,
      })),
      strictPricing: true,
    })
    parity = evaluateBillingMigrationParity({ pricing, subscriptions, targetMonth })
    if (!parity.matched) {
      issues.push(exception(
        'target_month_pricing_mismatch',
        'Canonical target-month pricing does not match the persisted recurring schedule.',
        { details: parity, repairable: pricingMismatchIsMissingLocalOnly(parity) },
      ))
    }
  } catch (error) {
    issues.push(exception('target_month_pricing_failed', `Target-month pricing could not be resolved: ${error.message}`))
  }

  const remoteItems = []
  let customerReadiness = null
  let customerSubscriptionInventory = null
  if (stripe && account.stripe_customer_id) {
    const localStripeInventory = [
      ...subscriptions.map((subscription) => ({
        id: subscription.id,
        status: subscription.status,
        sourceType: subscription.sourceType,
        stripeSubscriptionId: subscription.stripeSubscriptionId,
        isAnnualMembership: false,
      })),
      ...artifactRows(artifacts, 'annual_membership').map((subscription) => ({
        id: Number(subscription.id),
        status: subscription.status,
        stripeSubscriptionId: subscription.stripe_subscription_id ?? null,
        isAnnualMembership: true,
      })),
    ]
    try {
      customerSubscriptionInventory = await inspectStripeCustomerSubscriptionInventory(stripe, {
        stripeCustomerId: account.stripe_customer_id,
        accountId: Number(account.id),
        localSubscriptions: localStripeInventory,
      })
      for (const inventoryIssue of customerSubscriptionInventory.issues) {
        issues.push(exception(inventoryIssue.code, inventoryIssue.message, {
          sourceId: inventoryIssue.stripeSubscriptionId ?? null,
          details: inventoryIssue,
        }))
      }
    } catch (error) {
      issues.push(exception(
        error.code ?? 'stripe_customer_subscription_inventory_failed',
        `Stripe customer subscription inventory failed: ${error.message}`,
        { details: error.details ?? {} },
      ))
      customerSubscriptionInventory = {
        verified: false,
        issues: [{ code: error.code ?? 'stripe_customer_subscription_inventory_failed' }],
        snapshot: { customerId: account.stripe_customer_id, status: 'unavailable' },
      }
    }
  }
  if (sourceCollectionMode === 'legacy_per_class') {
    if (!stripe) {
      issues.push(exception('stripe_unavailable', 'Stripe is required to audit legacy collection subscriptions.'))
    } else {
      try {
        customerReadiness = await retrieveStripeCustomerReadiness(stripe, account.stripe_customer_id)
        if (!customerReadiness.ready) {
          issues.push(exception(customerReadiness.reason, 'A reusable Stripe payment method is required before household cutover.'))
        }
      } catch (error) {
        issues.push(exception('stripe_customer_audit_failed', `Stripe customer readiness failed: ${error.message}`))
      }
      for (const subscription of legacySubscriptions) {
        try {
          const remote = await retrieveStripeSubscriptionSnapshot(stripe, subscription.stripeSubscriptionId)
          const remoteErrors = validateRemoteSubscriptionForMigration({
            remoteSnapshot: remote.snapshot,
            expectedCustomerId: account.stripe_customer_id,
            expectedItemId: subscription.stripeSubscriptionItemId,
            boundaryUnix: boundary?.boundaryUnix,
            allowExpectedCancellation: allowScheduledCancellation,
            facilityTimezone: timezone,
          })
          for (const remoteError of remoteErrors) {
            issues.push(exception(remoteError.code, remoteError.message, {
              sourceId: subscription.stripeSubscriptionId,
              details: remoteError,
            }))
          }
          const remoteCents = remote.snapshot.items.reduce(
            (sum, item) => sum + cents(item.unitAmount) * Math.max(1, Number(item.quantity) || 1),
            0,
          )
          if (remoteCents !== subscription.netMonthlyCents) {
            issues.push(exception(
              'stripe_local_price_mismatch',
              `Stripe and local monthly amounts differ for subscription ${subscription.id}.`,
              {
                sourceId: subscription.stripeSubscriptionId,
                details: { stripeCents: remoteCents, localNetCents: subscription.netMonthlyCents },
              },
            ))
          }
          remoteItems.push({ local: subscription, remote: remote.snapshot })
        } catch (error) {
          const code = error instanceof BillingMigrationSafetyError ? error.code : 'stripe_subscription_audit_failed'
          issues.push(exception(code, error.message, {
            sourceId: subscription.stripeSubscriptionId,
            details: error.details ?? {},
          }))
          remoteItems.push({ local: subscription, remote: null })
        }
      }
    }
  } else if (sourceCollectionMode === 'manual' && subscriptions.some((row) => row.status === 'active')) {
    issues.push(exception(
      'manual_collection_requires_review',
      'Active recurring enrollments have no Stripe subscription; confirm that enabling automatic household collection is intended.',
    ))
  }

  let lockedDimensions
  try {
    const evidence = await loadLockedParityEvidence(db, { accountId, subscriptions, now })
    lockedDimensions = buildLockedBillingParityDimensions({
      artifacts,
      financial,
      pricingParity: parity,
      subscriptions,
      evidence,
      targetMonth,
      now,
    })
  } catch (error) {
    lockedDimensions = unavailableLockedParityDimensions(error)
    issues.push(exception(
      'locked_parity_evidence_failed',
      `Locked billing parity evidence could not be built: ${error.message}`,
    ))
  }
  for (const [dimension, result] of Object.entries(lockedDimensions)) {
    if (result.matched) continue
    issues.push(exception(
      `parity_${dimension.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`)}_mismatch`,
      `Legacy and canonical billing values do not match for ${dimension}.`,
      {
        repairable: dimension === 'bundlesAndRecomputedEntitlementBalance' ||
          (pricingMismatchIsMissingLocalOnly(parity) && [
            'nextMonthRecurringFee',
            'enrollments',
          ].includes(dimension)),
        details: {
          legacyHash: result.legacyHash,
          canonicalHash: result.canonicalHash,
          legacy: result.legacy,
          canonical: result.canonical,
        },
      },
    ))
  }
  const lockedParityMatched = Object.values(lockedDimensions).every((result) => result.matched === true)

  const blocking = issues.filter((item) => ['blocking', 'critical'].includes(item.severity))
  const classification = classifyBillingMigrationIssues(issues)
  const payerValidationStatus = issues.some((item) => item.code.startsWith('facility_'))
    ? 'ambiguous'
    : issues.some((item) =>
        item.code.startsWith('payer_') ||
        item.code.startsWith('billing_contact_') ||
        item.code === 'stripe_customer_shared_between_accounts' ||
        item.code === 'billing_account_inactive'
      )
      ? 'invalid'
      : 'verified'
  const pricingSnapshot = sanitizeBillingMigrationSnapshot({
    targetMonth,
    timezone,
    boundary,
    parity,
    dateEvidence: {
      enrollments: subscriptions.map((row) => ({
        subscriptionId: row.id,
        signupId: /^\d+$/.test(String(row.sourceId ?? '')) ? Number(row.sourceId) : null,
        signupTimestamp: normalizedTimestamp(row.signupCreatedAt),
        enrollmentEffectiveDate: comparableDate(row.enrollmentStartDate),
        classActiveStart: comparableDate(row.classActiveStart),
        classActiveEnd: comparableDate(row.classActiveEnd),
      })),
      recurringChargeServicePeriods: artifactRows(artifacts, 'billing_charge')
        .filter((row) => row.charge_type === 'recurring' || row.billing_interval === 'month')
        .map((row) => ({
          chargeId: Number(row.id),
          subscriptionId: row.subscription_id == null ? null : Number(row.subscription_id),
          servicePeriodStart: comparableDate(row.service_period_start),
          servicePeriodEnd: comparableDate(row.service_period_end),
        })),
    },
  })
  const ledgerSnapshot = sanitizeBillingMigrationSnapshot({
    ledger: financial.ledger,
    monthlyInvoices: financial.monthlyInvoices,
    historical: financial.historical,
    lockedDimensions,
    artifactCount: artifacts.length,
    artifactManifestHash: billingMigrationSnapshotHash(
      artifacts.map((item) => [item.itemType, item.sourceId, item.sourceSnapshot]),
    ),
  })
  const accountSnapshot = sanitizeBillingMigrationSnapshot({
    id: Number(account.id),
    familyId: Number(account.family_id),
    facilityId: account.family_facility_id == null ? null : Number(account.family_facility_id),
    facilityTimezone: timezone,
    payerMemberId: account.payer_member_id == null ? null : Number(account.payer_member_id),
    stripeCustomerId: account.stripe_customer_id ?? null,
    stripeCustomerActiveAccountCount: Number(account.stripe_customer_active_account_count ?? 0),
    billingContactEmailValid: !issues.some((item) => item.code.startsWith('billing_contact_')),
    billingPhonePresent: Boolean(String(account.billing_phone ?? '').trim()),
    householdMonthlyBillingEnabled: account.household_monthly_billing_enabled === true,
    migrationClassification: classification,
    sourceCollectionMode,
    subscriptionCount: subscriptions.length,
    legacyStripeSubscriptionCount: legacySubscriptions.length,
  })
  const stripeSnapshot = sanitizeBillingMigrationSnapshot({
    customer: customerReadiness?.snapshot ?? { customerId: account.stripe_customer_id ?? null },
    subscriptions: remoteItems.map((item) => item.remote),
    customerSubscriptionInventory: customerSubscriptionInventory?.snapshot ?? null,
  })
  const rollbackSnapshot = sanitizeBillingMigrationSnapshot({
    account: {
      id: Number(account.id),
      householdMonthlyBillingEnabled: account.household_monthly_billing_enabled === true,
      stripeCustomerId: account.stripe_customer_id ?? null,
    },
    subscriptions: subscriptions.map((row) => ({
      id: row.id,
      status: row.status,
      nextBillDate: row.nextBillDate,
      priceSyncStatus: row.priceSyncStatus,
      stripeSubscriptionId: row.stripeSubscriptionId,
      stripeSubscriptionItemId: row.stripeSubscriptionItemId,
      stripeSubscriptionScheduleId: row.stripeSubscriptionScheduleId,
    })),
  })
  const snapshotHash = billingMigrationSnapshotHash({
    accountSnapshot,
    pricingSnapshot,
    ledgerSnapshot,
    initialStripeSnapshot: stripeSnapshot,
    rollbackSnapshot,
  })
  const paritySnapshot = sanitizeBillingMigrationSnapshot({
    ...pricingSnapshot,
    ledger: ledgerSnapshot,
    dimensions: lockedDimensions,
    matched: lockedParityMatched,
    classification,
    snapshotHash,
  })
  const remoteByLocalSubscription = new Map(
    remoteItems.map((item) => [Number(item.local.id), item.remote]),
  )
  const collectionItems = subscriptions.map((local) => ({
    itemType: 'billing_subscription',
    local,
    remote: remoteByLocalSubscription.get(Number(local.id)) ?? null,
  }))

  return {
    accountId: Number(account.id),
    familyId: Number(account.family_id),
    facilityTimezone: timezone,
    targetMonth,
    boundary,
    eligible: blocking.length === 0,
    classification,
    alreadyHousehold: sourceCollectionMode === 'household_monthly' && legacySubscriptions.length === 0,
    sourceCollectionMode,
    targetCollectionMode: 'household_monthly',
    payerValidationStatus,
    parityStatus: lockedParityMatched ? 'matched' : 'mismatched',
    accountSnapshot,
    pricingSnapshot,
    ledgerSnapshot,
    initialStripeSnapshot: stripeSnapshot,
    paritySnapshot,
    stripeSnapshot,
    rollbackSnapshot,
    snapshotHash,
    exceptions: issues,
    items: collectionItems,
    artifacts,
    account: accountSnapshot,
  }
}
