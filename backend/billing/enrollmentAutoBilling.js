import { billingHouseholdAutoActivateEnabled } from './billingFeatureFlags.js'
import { facilityDate } from './canonicalBillingMigrationState.js'
import { getStripeClient } from './stripeBilling.js'
import { BILLING_DEPLOY_MANIFEST_CHECKSUM } from './billingReleaseManifest.js'

/** Provision collection authority only through the existing audited saga.
 * A saved customer, exact household ownership and a clean remote collector
 * inventory are prerequisites; a missing card remains a visible exception. */
export async function activateEnrollmentHouseholdBilling(pool, {
  accountId, stripe, environment = process.env, now = new Date(),
}) {
  if (!billingHouseholdAutoActivateEnabled(environment)) return { status: 'feature_disabled' }
  const account = (await pool.query(`SELECT account.*, facility.timezone,
      (SELECT state FROM billing_account_migration WHERE family_billing_account_id=account.id ORDER BY id DESC LIMIT 1) AS migration_state,
      EXISTS (SELECT 1 FROM billing_account_migration WHERE family_billing_account_id=account.id AND state='verified'
        AND verified_at IS NOT NULL AND cutover_month <= (now() AT TIME ZONE facility.timezone)::date) AS verified_collection
    FROM family_billing_account account JOIN family ON family.id=account.family_id
    JOIN facility ON facility.id=family.facility_id WHERE account.id=$1 AND account.is_active=TRUE`, [accountId])).rows[0]
  if (!account) throw new Error('An active enrollment billing account is required.')
  if (account.household_monthly_billing_enabled && account.migration_state === 'verified' && account.verified_collection) return { status: 'ready', account }
  if (!account.stripe_customer_id) return { status: 'payment_method_required', account }
  if (account.migration_state) return { status: 'migration_review_required', account }
  const targetMonth = `${facilityDate(now, account.timezone).slice(0, 7)}-01`
  const { auditCanonicalBillingMigration, adoptCanonicalHouseholdBillingMigration } = await import('./canonicalBillingMigration.js')
  const audit = await auditCanonicalBillingMigration(pool, {
    accountIds: [Number(accountId)], targetMonth, stripe, apply: true,
    cohort: 'enrollment-automatic-billing', forwardAdoption: true,
    idempotencyKey: `enrollment-autobilling:${accountId}:${targetMonth}:v1`,
    codeVersion: environment.RENDER_GIT_COMMIT || 'enrollment-autobilling-v1',
    manifestChecksum: BILLING_DEPLOY_MANIFEST_CHECKSUM,
  })
  const adoption = await adoptCanonicalHouseholdBillingMigration(pool, {
    runId: audit.runId, accountIds: [Number(accountId)], stripe, apply: true, environment, now,
  })
  if (!adoption.accounts?.[0]?.verified) throw new Error(`Automatic household setup requires review for account ${accountId}.`)
  return { status: 'ready', account: { ...account, household_monthly_billing_enabled: true } }
}

/** Collect only the initial bills for this committed enrollment. Never sweep
 * old balances, future provisional tuition, or paid Checkout purchases here. */
export async function completeEnrollmentAutoBilling(pool, {
  accountId, signupIds = null, stripe = null, environment = process.env, now = new Date(), scheduledRecovery = false,
}) {
  if (!billingHouseholdAutoActivateEnabled(environment)) return { status: 'feature_disabled' }
  stripe ??= await getStripeClient()
  if (!stripe) return { status: 'stripe_unavailable' }
  const activation = await activateEnrollmentHouseholdBilling(pool, { accountId, stripe, environment, now })
  if (activation.status !== 'ready') return activation
  const { checkoutAmountForBillingCharge, collectLedgerChargeWithSavedCard } = await import('./customerBillingPayments.js')
  const { account } = activation
  const today = facilityDate(now, account.timezone)
  if (scheduledRecovery && ![1, 4].includes(Number(today.slice(8, 10)))) {
    return { status: 'outside_automatic_collection_window' }
  }
  const { resolveDefaultPaymentMethod } = await import('./customerBillingPayments.js')
  try { await resolveDefaultPaymentMethod(stripe, account.stripe_customer_id, { billingMonth: facilityDate(now, account.timezone) }) }
  catch (error) {
    if (error.code === 'STRIPE_PAYMENT_METHOD_NOT_READY') return { status: 'payment_method_required' }
    throw error
  }
  const charges = (await pool.query(`SELECT charge.* FROM billing_charge charge
    WHERE charge.family_billing_account_id=$1
      AND ((charge.source_type='scheduling_signup' AND charge.source_id IN (
          SELECT id::text FROM scheduling_signup WHERE status='confirmed'
            AND ($2::text[] IS NULL OR id::text=ANY($2::text[]))))
        OR (charge.source_type='additional_fee' AND charge.member_id IN (
          SELECT id FROM member WHERE family_id=$3 AND is_active=TRUE
            AND ($2::text[] IS NULL OR id IN (SELECT member_id FROM scheduling_signup WHERE id::text=ANY($2::text[]))))))
      AND charge.amount_cents>0
      AND ($4::date IS NULL OR COALESCE(charge.service_period_start, charge.created_at::date) <= $4::date)
      -- A transfer replaces an existing bill; it is not a new enrollment
      -- authorization. Its settlement belongs to the class-transfer flow.
      AND NOT (COALESCE(charge.metadata, '{}'::jsonb) ? 'classMoveFromSignupId')
      AND COALESCE(charge.metadata->'classTransfer'->>'direction', '') <> 'in'
      AND charge.stripe_checkout_session_id IS NULL
      AND charge.collection_status NOT IN ('paid','failed','processing')
      AND NOT EXISTS (SELECT 1 FROM billing_monthly_invoice_line line
        JOIN billing_monthly_invoice invoice ON invoice.id=line.billing_monthly_invoice_id
        WHERE line.billing_charge_id=charge.id AND invoice.status IN ('draft','open','paid','failed','payment_method_required'))
    ORDER BY charge.id`, [accountId, signupIds == null ? null : signupIds.map(String), account.family_id,
    scheduledRecovery ? today : null])).rows
  const payments = []
  for (const charge of charges) {
    let amountCents
    try { amountCents = await checkoutAmountForBillingCharge(pool, { account, charge, requireManualCharge: false }) }
    catch (error) {
      if (error.message === 'This bill is already paid or fully credited.') continue
      throw error
    }
    payments.push(await collectLedgerChargeWithSavedCard(pool, {
      account, charge, stripeClient: stripe, attemptKey: `enrollment-auto:${charge.id}:v1`,
      authorization: { source: 'enrollment_automatic_billing', date: facilityDate(now, account.timezone),
        note: 'Enrollment policy: collect the enrollment or annual membership bill using the household saved payment method.',
        confirmed: true, confirmedAmountCents: amountCents },
    }))
  }
  return { status: 'complete', paymentCount: payments.length }
}

export async function recordEnrollmentAutoBillingAttention(pool, { memberId, signupIds, reason }) {
  await pool.query(`INSERT INTO stripe_billing_alert (
    stripe_event_id, family_billing_account_id, alert_type, severity, message, details
  ) SELECT $1, account.id, 'enrollment_automatic_billing', 'critical', $2, $3::jsonb
    FROM member JOIN family_billing_account account ON account.family_id=member.family_id
    WHERE member.id=$4 AND account.is_active=TRUE
    ON CONFLICT (stripe_event_id) DO UPDATE SET message=EXCLUDED.message, details=EXCLUDED.details,
      action_status='open', resolved_at=NULL`,
  [`enrollment-auto:${memberId}:${signupIds.join(',')}`, `Enrollment billing needs attention: ${String(reason).slice(0,400)}`,
    JSON.stringify({ memberId, signupIds, reason: String(reason).slice(0,400) }), memberId])
}
