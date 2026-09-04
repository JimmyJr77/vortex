import {
  buildEnrollmentBillingPeriodManifest,
  resolveFamilyEnrollmentPricing,
} from './familyEnrollmentPricing.js'
import {
  billingDateString,
  facilityDate,
  isValidTimeZone,
  nextBillingMonth,
  sanitizeBillingMigrationSnapshot,
} from './canonicalBillingMigrationState.js'
import { BillingMigrationSafetyError } from './canonicalBillingMigrationStripe.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'

function cents(value) {
  return Math.round(Number(value) || 0)
}

function targetPeriod(billingMonth) {
  const start = billingDateString(billingMonth)
  if (!start || !/^\d{4}-\d{2}-01$/.test(start)) {
    throw new Error('Canonical recurring charge posting requires a billing month in YYYY-MM-01 format.')
  }
  const next = nextBillingMonth(start)
  const end = new Date(`${next}T00:00:00.000Z`)
  end.setUTCDate(end.getUTCDate() - 1)
  return { start, end: end.toISOString().slice(0, 10), periodKey: start.slice(0, 7), next }
}

function earlyPostingWindow(now, facilityTimeZone, period) {
  const today = facilityDate(now, facilityTimeZone)
  const day = Number(today.slice(8, 10))
  const currentMonth = `${today.slice(0, 7)}-01`
  return day >= 5 && nextBillingMonth(currentMonth) === period.start
}

function provisionalChargeValues(line) {
  return {
    memberId: Number(line.memberId),
    description: line.description,
    amountCents: cents(line.netCents),
    grossAmountCents: cents(line.grossCents),
    discountAmountCents: cents(line.discountCents),
    priceAdjustmentId: line.priceAdjustmentId == null ? null : Number(line.priceAdjustmentId),
  }
}

async function chargeIsMutableBeforeCollection(db, chargeId) {
  const result = await db.query(
    `SELECT NOT EXISTS (
       SELECT 1
       FROM billing_monthly_invoice_line line
       WHERE line.billing_charge_id = $1
     )
     AND NOT EXISTS (
       SELECT 1
       FROM billing_payment_application application
       JOIN billing_payment payment ON payment.id = application.billing_payment_id
       WHERE application.billing_charge_id = $1
         AND payment.external_status IN ('settled', 'succeeded', 'processing', 'pending', 'reconciliation_required')
     )
     AND NOT EXISTS (
       SELECT 1
       FROM billing_payment_attempt attempt
       LEFT JOIN billing_payment_attempt_charge reservation
         ON reservation.billing_payment_attempt_id = attempt.id
       WHERE attempt.target_charge_id = $1
          OR reservation.billing_charge_id = $1
     ) AS mutable`,
    [Number(chargeId)],
  )
  return result.rows[0]?.mutable === true
}

async function reconcileProvisionalTargetCharges(db, {
  accountId,
  period,
  expectedLines,
  charges,
}) {
  const expectedBySubscription = new Map(expectedLines.map((line) => [Number(line.subscriptionId), line]))
  const changes = []

  for (const charge of charges) {
    const expected = expectedBySubscription.get(Number(charge.subscription_id))
    if (!(await chargeIsMutableBeforeCollection(db, charge.id))) continue

    if (!expected) {
      const before = {
        chargeId: Number(charge.id),
        amountCents: cents(charge.amount_cents),
        grossAmountCents: cents(charge.gross_amount_cents),
        discountAmountCents: cents(charge.discount_amount_cents),
      }
      const updated = await db.query(
        `UPDATE billing_charge
            SET amount_cents = 0,
                gross_amount_cents = 0,
                discount_amount_cents = 0,
                collection_status = 'cancelled',
                metadata = COALESCE(metadata, '{}'::jsonb)
                  || '{"customerAuditVisibility":"suppressed","provisionalBillingVoided":true}'::jsonb,
                updated_at = now()
          WHERE id = $1
          RETURNING id`,
        [Number(charge.id)],
      )
      if (updated.rows[0]) {
        changes.push({ kind: 'voided', chargeId: Number(charge.id), before, after: { amountCents: 0 } })
      }
      continue
    }

    const next = provisionalChargeValues(expected)
    const changed =
      Number(charge.member_id) !== next.memberId ||
      String(charge.description ?? '') !== next.description ||
      cents(charge.amount_cents) !== next.amountCents ||
      cents(charge.gross_amount_cents) !== next.grossAmountCents ||
      cents(charge.discount_amount_cents) !== next.discountAmountCents ||
      (charge.price_adjustment_id == null ? null : Number(charge.price_adjustment_id)) !== next.priceAdjustmentId
    if (!changed) continue

    const before = {
      chargeId: Number(charge.id),
      memberId: charge.member_id == null ? null : Number(charge.member_id),
      description: charge.description,
      amountCents: cents(charge.amount_cents),
      grossAmountCents: cents(charge.gross_amount_cents),
      discountAmountCents: cents(charge.discount_amount_cents),
      priceAdjustmentId: charge.price_adjustment_id == null ? null : Number(charge.price_adjustment_id),
    }
    const updated = await db.query(
      `UPDATE billing_charge
          SET member_id = $2,
              description = $3,
              amount_cents = $4,
              gross_amount_cents = $5,
              discount_amount_cents = $6,
              price_adjustment_id = $7,
              collection_status = 'unpaid',
              metadata = (COALESCE(metadata, '{}'::jsonb) - 'customerAuditVisibility' - 'provisionalBillingVoided')
                || '{"provisionalBilling":true}'::jsonb,
              updated_at = now()
        WHERE id = $1
        RETURNING id`,
      [
        Number(charge.id),
        next.memberId,
        next.description,
        next.amountCents,
        next.grossAmountCents,
        next.discountAmountCents,
        next.priceAdjustmentId,
      ],
    )
    if (updated.rows[0]) changes.push({ kind: 'recalculated', chargeId: Number(charge.id), before, after: next })
  }

  for (const change of changes) {
    await recordBillingActivityBestEffort(db, {
      eventKey: `provisional-recurring-charge:${change.kind}:${change.chargeId}:${period.periodKey}`,
      accountId: Number(accountId),
      chargeId: change.chargeId,
      eventType: 'provisional_recurring_charge_recalculated',
      summary: change.kind === 'voided'
        ? `A pre-posted ${period.periodKey} recurring charge was removed before collection.`
        : `A pre-posted ${period.periodKey} recurring charge was recalculated before collection.`,
      beforeValue: change.before,
      afterValue: change.after,
      details: { billingMonth: period.start, mutation: change.kind },
      actorType: 'system',
    })
  }
  return changes
}

function issue(code, message, details = {}) {
  return { code, message, ...sanitizeBillingMigrationSnapshot(details) }
}

function parityError(issues, summary) {
  return new BillingMigrationSafetyError(
    'target_month_recurring_charge_parity_failed',
    `Target-month recurring charge parity failed with ${issues.length} issue(s).`,
    { issues, summary },
    { forwardOnly: true },
  )
}

async function loadAccount(db, accountId) {
  return db.query(
    `SELECT account.id, account.family_id, account.household_monthly_billing_enabled,
            family.facility_id, facility.timezone AS facility_timezone
       FROM family_billing_account account
       JOIN family ON family.id = account.family_id
       JOIN facility ON facility.id = family.facility_id
      WHERE account.id = $1
      LIMIT 1`,
    [Number(accountId)],
  ).then((result) => result.rows[0] ?? null)
}

async function loadSubscriptions(db, accountId) {
  return db.query(
    `SELECT subscription.*,
            signup.id AS signup_id,
            signup.status AS signup_status,
            signup.orphaned_at AS signup_orphaned_at,
            signup.created_at AS signup_created_at,
            signup.enrollment_start_date,
            signup.pricing_breakdown,
            signup.cancel_effective_date,
            signup.pause_effective_date,
            form.start_date AS form_start_date,
            form.end_date AS form_end_date,
            slot_group.active_start AS group_active_start,
            slot_group.active_end AS group_active_end,
            offering.start_date AS offering_start_date,
            offering.end_date AS offering_end_date
       FROM billing_subscription subscription
       LEFT JOIN scheduling_signup signup
         ON subscription.source_type = 'scheduling_signup'
        AND subscription.source_id ~ '^[0-9]+$'
        AND signup.id = subscription.source_id::bigint
       LEFT JOIN scheduling_form form ON form.id = signup.form_id
       LEFT JOIN scheduling_slot_group slot_group ON slot_group.id = signup.slot_group_id
       LEFT JOIN scheduling_offering offering ON offering.id = slot_group.offering_id
      WHERE subscription.family_billing_account_id = $1
        AND subscription.status <> 'cancelled'
        AND subscription.source_type <> 'annual_membership'
        AND COALESCE(subscription.pricing_option_key, '') <> 'annual_membership'
      ORDER BY subscription.id`,
    [Number(accountId)],
  ).then((result) => result.rows)
}

async function lockEnrollmentLifecycleRows(db, accountId) {
  await db.query(
    `SELECT signup.id
       FROM scheduling_signup signup
       JOIN billing_subscription subscription
         ON subscription.source_type = 'scheduling_signup'
        AND subscription.source_id ~ '^[0-9]+$'
        AND signup.id = subscription.source_id::bigint
      WHERE subscription.family_billing_account_id = $1
        AND subscription.status <> 'cancelled'
        AND subscription.source_type <> 'annual_membership'
        AND COALESCE(subscription.pricing_option_key, '') <> 'annual_membership'
      ORDER BY signup.id
      FOR UPDATE OF signup`,
    [Number(accountId)],
  )
  await db.query(
    `SELECT subscription.id
       FROM billing_subscription subscription
      WHERE subscription.family_billing_account_id = $1
        AND subscription.status <> 'cancelled'
        AND subscription.source_type <> 'annual_membership'
        AND COALESCE(subscription.pricing_option_key, '') <> 'annual_membership'
      ORDER BY subscription.id
      FOR UPDATE OF subscription`,
    [Number(accountId)],
  )
}

async function loadTargetCharges(db, { accountId, period, facilityTimeZone }) {
  return db.query(
    `SELECT charge.*
       FROM billing_charge charge
      WHERE charge.family_billing_account_id = $1
        AND (charge.charge_type = 'recurring' OR charge.billing_interval = 'month')
        AND COALESCE(charge.metadata->>'customerAuditVisibility', 'visible') <> 'suppressed'
        AND NOT EXISTS (
          SELECT 1
            FROM billing_subscription annual
           WHERE annual.id = charge.subscription_id
             AND (
               annual.source_type = 'annual_membership'
               OR COALESCE(annual.pricing_option_key, '') = 'annual_membership'
             )
        )
        AND (
          (
            charge.service_period_start IS NOT NULL
            AND charge.service_period_end IS NOT NULL
            AND charge.service_period_start <= $3::date
            AND charge.service_period_end >= $2::date
          )
          OR (
            (charge.service_period_start IS NULL OR charge.service_period_end IS NULL)
            AND COALESCE(
              charge.service_period_start,
              charge.service_period_end,
              (charge.created_at AT TIME ZONE $4::text)::date
            ) BETWEEN $2::date AND $3::date
          )
        )
      ORDER BY charge.id`,
    [Number(accountId), period.start, period.end, facilityTimeZone],
  ).then((result) => result.rows)
}

function expectedLinesFromPricing(pricing, subscriptions, period) {
  const issues = []
  const subscriptionsById = new Map(subscriptions.map((row) => [Number(row.id), row]))
  const lifecycleManifest = buildEnrollmentBillingPeriodManifest(subscriptions, period.periodKey, {
    requireSubscriptionMapping: true,
  })
  const lifecycleBySubscription = new Map(
    lifecycleManifest.map((entry) => [Number(entry.subscriptionId), entry]),
  )
  const seenSubscriptions = new Set()
  const seenSignups = new Set()
  const lines = []
  const excludedSubscriptions = []

  for (const line of pricing?.lines ?? []) {
    const subscriptionId = Number(line.subscriptionId)
    const signupId = Number(line.signupId)
    if (!Number.isSafeInteger(subscriptionId) || subscriptionId <= 0) {
      issues.push(issue(
        'target_month_subscription_missing',
        `Enrollment ${Number.isSafeInteger(signupId) ? signupId : '(unknown)'} has no canonical billing subscription for ${period.periodKey}.`,
        { signupId: Number.isSafeInteger(signupId) ? signupId : null },
      ))
      continue
    }
    if (seenSubscriptions.has(subscriptionId) || (Number.isSafeInteger(signupId) && seenSignups.has(signupId))) {
      issues.push(issue(
        'target_month_subscription_mapping_duplicate',
        `Target-month pricing contains a duplicate enrollment/subscription mapping for subscription ${subscriptionId}.`,
        { subscriptionId, signupId: Number.isSafeInteger(signupId) ? signupId : null },
      ))
      continue
    }
    seenSubscriptions.add(subscriptionId)
    if (Number.isSafeInteger(signupId)) seenSignups.add(signupId)

    const subscription = subscriptionsById.get(subscriptionId)
    if (!subscription) {
      issues.push(issue(
        'target_month_subscription_outside_account',
        `Subscription ${subscriptionId} is not an active canonical subscription on this billing account.`,
        { subscriptionId, signupId: Number.isSafeInteger(signupId) ? signupId : null },
      ))
      continue
    }
    const expectedSourceId = Number.isSafeInteger(signupId) ? String(signupId) : null
    const lifecycle = lifecycleBySubscription.get(subscriptionId)
    if (
      subscription.status !== 'active' ||
      subscription.source_type !== 'scheduling_signup' ||
      expectedSourceId == null ||
      String(subscription.source_id) !== expectedSourceId ||
      lifecycle?.valid !== true ||
      lifecycle?.billable !== true
    ) {
      issues.push(issue(
        'target_month_subscription_mapping_invalid',
        `Subscription ${subscriptionId} is not the active subscription for enrollment ${expectedSourceId ?? '(unknown)'}.`,
        {
          subscriptionId,
          signupId: Number.isSafeInteger(signupId) ? signupId : null,
          status: subscription.status,
          sourceType: subscription.source_type,
          sourceId: subscription.source_id,
          lifecycleReason: lifecycle?.reason ?? null,
        },
      ))
      continue
    }

    const expected = {
      subscriptionId,
      signupId,
      memberId: Number(line.memberId ?? subscription.member_id),
      description: subscription.description,
      grossCents: cents(line.grossCents),
      discountCents: cents(line.discountCents),
      netCents: cents(line.netCents),
      priceAdjustmentId: line.priceAdjustmentId == null ? null : Number(line.priceAdjustmentId),
      subscription,
      lifecycle,
    }
    if (!Number.isSafeInteger(expected.memberId) || expected.memberId <= 0) {
      issues.push(issue(
        'target_month_subscription_member_missing',
        `Subscription ${subscriptionId} has no authoritative member for ${period.periodKey}.`,
        { subscriptionId, signupId },
      ))
    }
    if (
      expected.grossCents < 0 ||
      expected.netCents < 0 ||
      // `discountCents` is signed here. A negative value is a deliberate,
      // confirmed manual surcharge; a positive value is a discount. Both are
      // represented on the original recurring bill rather than by a separate
      // customer-facing debit/credit row.
      expected.netCents !== expected.grossCents - expected.discountCents
    ) {
      issues.push(issue(
        'target_month_canonical_pricing_invalid',
        `Canonical pricing is internally inconsistent for subscription ${subscriptionId}.`,
        {
          subscriptionId,
          grossCents: expected.grossCents,
          discountCents: expected.discountCents,
          netCents: expected.netCents,
        },
      ))
    }
    if (
      cents(subscription.monthly_amount_cents) !== expected.grossCents ||
      cents(subscription.discount_amount_cents) !== expected.discountCents ||
      cents(subscription.net_monthly_cents) !== expected.netCents
    ) {
      issues.push(issue(
        'target_month_subscription_pricing_mismatch',
        `Canonical pricing no longer matches subscription ${subscriptionId} for ${period.periodKey}.`,
        {
          subscriptionId,
          canonical: {
            grossCents: expected.grossCents,
            discountCents: expected.discountCents,
            netCents: expected.netCents,
          },
          subscription: {
            grossCents: cents(subscription.monthly_amount_cents),
            discountCents: cents(subscription.discount_amount_cents),
            netCents: cents(subscription.net_monthly_cents),
          },
        },
      ))
    }
    lines.push(expected)
  }

  const expectedIds = new Set(lines.map((line) => line.subscriptionId))
  for (const subscription of subscriptions) {
    if (subscription.status === 'active' && !expectedIds.has(Number(subscription.id))) {
      const lifecycle = lifecycleBySubscription.get(Number(subscription.id))
      if (lifecycle?.valid === true && lifecycle.billable === false) {
        if (lifecycle.exclusionScheduleValid !== true) {
          issues.push(issue(
            lifecycle.exclusionScheduleReason === 'excluded_subscription_prior_period_due'
              ? 'target_month_subscription_prior_period_due'
              : 'target_month_subscription_exclusion_schedule_invalid',
            `Subscription ${subscription.id} cannot be excluded from ${period.periodKey} while its recurring schedule is stale or incomplete.`,
            {
              subscriptionId: Number(subscription.id),
              signupId: lifecycle.signupId,
              lifecycleReason: lifecycle.reason,
              scheduleReason: lifecycle.exclusionScheduleReason,
              nextBillDate: lifecycle.exclusionNextBillDate,
              minimumNextBillDate: lifecycle.exclusionMinimumNextBillDate,
            },
          ))
          continue
        }
        excludedSubscriptions.push({
          subscriptionId: Number(subscription.id),
          signupId: lifecycle.signupId,
          reason: lifecycle.reason,
        })
        continue
      }
      issues.push(issue(
        'target_month_subscription_extra',
        `Active subscription ${subscription.id} has no eligible enrollment line for ${period.periodKey}.`,
        {
          subscriptionId: Number(subscription.id),
          sourceId: subscription.source_id,
          lifecycleReason: lifecycle?.reason ?? null,
        },
      ))
    }
  }
  return { lines, issues, excludedSubscriptions, lifecycleManifest }
}

function compareTargetCharges(expectedLines, charges, period) {
  const issues = []
  const expectedById = new Map(expectedLines.map((line) => [line.subscriptionId, line]))
  const chargesBySubscription = new Map()

  for (const charge of charges) {
    const subscriptionId = Number(charge.subscription_id)
    if (!Number.isSafeInteger(subscriptionId) || !expectedById.has(subscriptionId)) {
      issues.push(issue(
        'target_month_recurring_charge_extra',
        `Recurring charge ${charge.id} does not belong to an expected ${period.periodKey} enrollment subscription.`,
        { chargeId: Number(charge.id), subscriptionId: Number.isSafeInteger(subscriptionId) ? subscriptionId : null },
      ))
      continue
    }
    const grouped = chargesBySubscription.get(subscriptionId) ?? []
    grouped.push(charge)
    chargesBySubscription.set(subscriptionId, grouped)
  }

  const missing = []
  for (const expected of expectedLines) {
    const found = chargesBySubscription.get(expected.subscriptionId) ?? []
    if (found.length === 0) {
      missing.push(expected)
      continue
    }
    if (found.length !== 1) {
      issues.push(issue(
        'target_month_recurring_charge_duplicate',
        `Subscription ${expected.subscriptionId} has ${found.length} recurring charges overlapping ${period.periodKey}.`,
        { subscriptionId: expected.subscriptionId, chargeIds: found.map((row) => Number(row.id)) },
      ))
      continue
    }
    const charge = found[0]
    const actualAdjustmentId = charge.price_adjustment_id == null ? null : Number(charge.price_adjustment_id)
    const exact =
      billingDateString(charge.service_period_start) === period.start &&
      billingDateString(charge.service_period_end) === period.end &&
      Number(charge.member_id) === expected.memberId &&
      cents(charge.gross_amount_cents) === expected.grossCents &&
      cents(charge.discount_amount_cents) === expected.discountCents &&
      cents(charge.amount_cents) === expected.netCents &&
      actualAdjustmentId === expected.priceAdjustmentId
    if (!exact) {
      issues.push(issue(
        'target_month_recurring_charge_mismatch',
        `Recurring charge ${charge.id} does not exactly match subscription ${expected.subscriptionId} for ${period.periodKey}.`,
        {
          chargeId: Number(charge.id),
          subscriptionId: expected.subscriptionId,
          expected: {
            memberId: expected.memberId,
            grossCents: expected.grossCents,
            discountCents: expected.discountCents,
            netCents: expected.netCents,
            servicePeriodStart: period.start,
            servicePeriodEnd: period.end,
            priceAdjustmentId: expected.priceAdjustmentId,
          },
          actual: {
            memberId: charge.member_id == null ? null : Number(charge.member_id),
            grossCents: cents(charge.gross_amount_cents),
            discountCents: cents(charge.discount_amount_cents),
            netCents: cents(charge.amount_cents),
            servicePeriodStart: billingDateString(charge.service_period_start),
            servicePeriodEnd: billingDateString(charge.service_period_end),
            priceAdjustmentId: actualAdjustmentId,
          },
        },
      ))
    }
  }
  return { issues, missing }
}

function scheduleIssues(expectedLines, missingLines, period, {
  allowTerminalNormalization = false,
} = {}) {
  const issues = []
  const missingIds = new Set(missingLines.map((line) => line.subscriptionId))
  for (const line of expectedLines) {
    const nextBillDate = billingDateString(line.subscription.next_bill_date)
    const targetChargeExists = !missingIds.has(line.subscriptionId)
    const allowsNoNextBill = line.lifecycle?.allowsNoNextBill === true
    if (nextBillDate && nextBillDate < period.start) {
      issues.push(issue(
        'target_month_subscription_prior_period_due',
        `Subscription ${line.subscriptionId} is still due before ${period.periodKey}; cutover cannot skip an earlier billing period.`,
        { subscriptionId: line.subscriptionId, nextBillDate },
      ))
      continue
    }
    if (allowsNoNextBill) {
      if (!targetChargeExists && nextBillDate === period.start) continue
      if (targetChargeExists && nextBillDate == null) continue
      if (
        allowTerminalNormalization &&
        targetChargeExists &&
        [period.start, period.next].includes(nextBillDate)
      ) continue
      issues.push(issue(
        'target_month_terminal_subscription_schedule_invalid',
        `Terminal subscription ${line.subscriptionId} must stop billing after its ${period.periodKey} charge.`,
        {
          subscriptionId: line.subscriptionId,
          nextBillDate,
          expectedNextBillDate: null,
          terminalReason: line.lifecycle?.terminalReason ?? null,
        },
      ))
      continue
    }
    if (!targetChargeExists && nextBillDate === period.start) continue
    if (targetChargeExists && nextBillDate === period.next) continue
    if (line.netCents === 0 && nextBillDate && nextBillDate > period.start) continue

    if (!targetChargeExists && nextBillDate && nextBillDate > period.start) {
      issues.push(issue(
        'target_month_subscription_not_due',
        `Subscription ${line.subscriptionId} is deferred past ${period.periodKey} but canonical pricing expects a positive charge.`,
        { subscriptionId: line.subscriptionId, nextBillDate, netCents: line.netCents },
      ))
    } else {
      issues.push(issue(
        targetChargeExists
          ? 'target_month_subscription_schedule_not_advanced'
          : 'target_month_subscription_schedule_missing',
        targetChargeExists
          ? `Subscription ${line.subscriptionId} has a target-month charge but its next bill date is not the next valid billing date.`
          : `Subscription ${line.subscriptionId} has no valid target-month renewal schedule.`,
        {
          subscriptionId: line.subscriptionId,
          nextBillDate,
          expectedNextBillDate: period.next,
          allowsNoNextBill,
          terminalReason: line.lifecycle?.terminalReason ?? null,
        },
      ))
    }
  }
  return issues
}

function summaryFor(
  accountId,
  period,
  expectedLines,
  charges,
  postedChargeIds = [],
  excludedSubscriptions = [],
) {
  return sanitizeBillingMigrationSnapshot({
    accountId: Number(accountId),
    billingMonth: period.start,
    expectedChargeCount: expectedLines.length,
    expectedGrossCents: expectedLines.reduce((sum, line) => sum + line.grossCents, 0),
    expectedDiscountCents: expectedLines.reduce((sum, line) => sum + line.discountCents, 0),
    expectedNetCents: expectedLines.reduce((sum, line) => sum + line.netCents, 0),
    expectedLines: expectedLines.map((line) => ({
      subscriptionId: line.subscriptionId,
      signupId: line.signupId,
      grossCents: line.grossCents,
      discountCents: line.discountCents,
      netCents: line.netCents,
    })),
    actualChargeCount: charges.length,
    chargeIds: charges.map((row) => Number(row.id)),
    postedChargeIds,
    excludedSubscriptions,
  })
}

/**
 * Post or verify every canonical enrollment charge for one account/month.
 *
 * Apply mode is one local transaction. The cutover caller additionally holds
 * the household invoice session lock across this transaction and the later
 * Stripe invoice orchestration, so no database transaction crosses a remote
 * Stripe request.
 */
export async function reconcileCanonicalRecurringChargesForMonth(db, {
  accountId,
  billingMonth,
  facilityTimeZone,
  now = new Date(),
  apply = false,
  allowEarlyPosting = false,
  pricingResolver = resolveFamilyEnrollmentPricing,
} = {}) {
  const period = targetPeriod(billingMonth)
  if (!isValidTimeZone(facilityTimeZone)) {
    throw new BillingMigrationSafetyError(
      'facility_timezone_missing',
      'A valid frozen facility timezone is required for canonical recurring charge posting.',
      { accountId, billingMonth: period.start, facilityTimeZone },
      { forwardOnly: true },
    )
  }
  const facilityToday = facilityDate(now, facilityTimeZone)
  const provisional = facilityToday < period.start
  if (provisional && !(allowEarlyPosting === true && earlyPostingWindow(now, facilityTimeZone, period))) {
    throw new BillingMigrationSafetyError(
      'target_month_charge_posting_before_boundary',
      'Canonical recurring charges can be pre-posted only on or after the facility fifth-day billing cutoff for the following month.',
      { accountId, billingMonth: period.start, facilityTimeZone, facilityDate: facilityToday },
      { forwardOnly: true },
    )
  }

  // Cutover may pass the PoolClient that already owns the account session
  // lock. Keep the local charge transaction on that same connection.
  const ownsClient = apply && typeof db.connect === 'function' && typeof db.release !== 'function'
  const client = ownsClient ? await db.connect() : db
  let transactionOpen = false
  try {
    if (apply) {
      await client.query('BEGIN')
      transactionOpen = true
      await client.query('SELECT pg_advisory_xact_lock($1)', [Number(accountId)])
      // Enrollment lifecycle actions lock signup before subscription. Match that
      // order and reload joined state afterwards so a stale due-row snapshot can
      // never resurrect a cancellation, pause, or future enrollment schedule.
      await lockEnrollmentLifecycleRows(client, accountId)
    }
    const account = await loadAccount(client, accountId)
    if (!account) {
      throw new BillingMigrationSafetyError(
        'billing_account_not_found',
        `Billing account ${accountId} was not found while posting target-month charges.`,
        { accountId, billingMonth: period.start },
        { forwardOnly: true },
      )
    }
    if (account.facility_timezone !== facilityTimeZone) {
      throw new BillingMigrationSafetyError(
        'facility_timezone_drift',
        'The billing account facility timezone changed after cutover preparation.',
        {
          accountId: Number(accountId),
          billingMonth: period.start,
          frozenFacilityTimeZone: facilityTimeZone,
          actualFacilityTimeZone: account.facility_timezone,
        },
        { forwardOnly: true },
      )
    }

    const subscriptions = await loadSubscriptions(client, accountId)
    let charges = await loadTargetCharges(client, { accountId, period, facilityTimeZone })
    const pricing = await pricingResolver(client, {
      familyId: Number(account.family_id),
      periodKey: period.periodKey,
      subscriptions,
      charges,
      ensureSchema: false,
      strictPricing: true,
    })
    const expected = expectedLinesFromPricing(pricing, subscriptions, period)
    let comparison = compareTargetCharges(expected.lines, charges, period)
    if (apply && provisional) {
      await reconcileProvisionalTargetCharges(client, {
        accountId,
        period,
        expectedLines: expected.lines,
        charges,
      })
      charges = await loadTargetCharges(client, { accountId, period, facilityTimeZone })
      comparison = compareTargetCharges(expected.lines, charges, period)
    }
    const issues = [
      ...expected.issues,
      ...comparison.issues,
      ...scheduleIssues(expected.lines, comparison.missing, period, {
        allowTerminalNormalization: apply,
      }),
    ]
    const beforeSummary = summaryFor(
      accountId,
      period,
      expected.lines,
      charges,
      [],
      expected.excludedSubscriptions,
    )
    if (issues.length > 0) throw parityError(issues, beforeSummary)

    if (!apply) {
      const dryIssues = comparison.missing.map((line) => issue(
        'target_month_recurring_charge_missing',
        `Subscription ${line.subscriptionId} is missing its ${period.periodKey} recurring charge.`,
        { subscriptionId: line.subscriptionId, signupId: line.signupId },
      ))
      return {
        verified: dryIssues.length === 0,
        issues: dryIssues,
        ...summaryFor(
          accountId,
          period,
          expected.lines,
          charges,
          [],
          expected.excludedSubscriptions,
        ),
      }
    }

    if (comparison.missing.length > 0) {
      const targetInvoices = await client.query(
        `SELECT id, status, stripe_invoice_id
           FROM billing_monthly_invoice
          WHERE family_billing_account_id = $1
            AND billing_month = $2::date
          ORDER BY id
          FOR UPDATE`,
        [Number(accountId), period.start],
      )
      if (targetInvoices.rows.length > 0) {
        throw new BillingMigrationSafetyError(
          'target_month_invoice_precedes_recurring_charges',
          'A target-month household invoice already exists before all expected recurring charges were posted.',
          {
            accountId: Number(accountId),
            billingMonth: period.start,
            missingSubscriptionIds: comparison.missing.map((line) => line.subscriptionId),
            invoiceIds: targetInvoices.rows.map((row) => Number(row.id)),
          },
          { forwardOnly: true },
        )
      }
    }

    const postedChargeIds = []
    for (const line of comparison.missing) {
      const existingVoided = provisional
        ? await client.query(
            `SELECT id
               FROM billing_charge
              WHERE source_type = 'billing_subscription'
                AND source_id = $1
                AND amount_cents = 0
                AND COALESCE(metadata->>'provisionalBillingVoided', 'false') = 'true'
              FOR UPDATE`,
            [`${line.subscriptionId}:${period.periodKey}`],
          ).then((result) => result.rows[0] ?? null)
        : null
      if (existingVoided && await chargeIsMutableBeforeCollection(client, existingVoided.id)) {
        const restored = await client.query(
          `UPDATE billing_charge
              SET member_id = $2,
                  description = $3,
                  amount_cents = $4,
                  gross_amount_cents = $5,
                  discount_amount_cents = $6,
                  charge_type = 'recurring',
                  billing_interval = 'month',
                  subscription_id = $7,
                  service_period_start = $8::date,
                  service_period_end = $9::date,
                  price_adjustment_id = $10,
                  collection_status = 'unpaid',
                  metadata = (COALESCE(metadata, '{}'::jsonb) - 'customerAuditVisibility' - 'provisionalBillingVoided')
                    || '{"provisionalBilling":true}'::jsonb,
                  updated_at = now()
            WHERE id = $1
            RETURNING id`,
          [
            Number(existingVoided.id),
            line.memberId,
            line.description,
            line.netCents,
            line.grossCents,
            line.discountCents,
            line.subscriptionId,
            period.start,
            period.end,
            line.priceAdjustmentId,
          ],
        )
        if (restored.rows[0]?.id != null) {
          postedChargeIds.push(Number(restored.rows[0].id))
          continue
        }
      }
      const inserted = await client.query(
        `INSERT INTO billing_charge (
           family_billing_account_id, member_id, source_type, source_id, description,
           amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval, subscription_id,
           service_period_start, service_period_end, price_adjustment_id, metadata
         ) VALUES (
           $1, $2, 'billing_subscription', $3, $4,
           $5, $6, $7, 'recurring', 'month', $8, $9::date, $10::date, $11,
           CASE WHEN $12::boolean THEN '{"provisionalBilling":true}'::jsonb ELSE '{}'::jsonb END
         )
         ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
         RETURNING id`,
        [
          Number(accountId),
          line.memberId,
          `${line.subscriptionId}:${period.periodKey}`,
          line.description,
          line.netCents,
          line.grossCents,
          line.discountCents,
          line.subscriptionId,
          period.start,
          period.end,
          line.priceAdjustmentId,
          provisional,
        ],
      )
      if (inserted.rows[0]?.id != null) postedChargeIds.push(Number(inserted.rows[0].id))
    }

    for (const line of expected.lines) {
      const currentNextBillDate = billingDateString(line.subscription.next_bill_date)
      if (line.lifecycle?.allowsNoNextBill === true) {
        if (![period.start, period.next].includes(currentNextBillDate)) continue
        await client.query(
          `UPDATE billing_subscription
              SET next_bill_date = NULL, updated_at = now()
            WHERE id = $1
              AND status = 'active'
              AND next_bill_date = $2::date
            RETURNING id`,
          [line.subscriptionId, currentNextBillDate],
        )
        continue
      }
      if (currentNextBillDate !== period.start) continue
      await client.query(
        `UPDATE billing_subscription
            SET next_bill_date = $2::date, updated_at = now()
          WHERE id = $1
            AND status = 'active'
            AND next_bill_date = $3::date
          RETURNING id`,
        [line.subscriptionId, period.next, period.start],
      )
    }

    const finalSubscriptions = await loadSubscriptions(client, accountId)
    charges = await loadTargetCharges(client, { accountId, period, facilityTimeZone })
    const finalPricing = await pricingResolver(client, {
      familyId: Number(account.family_id),
      periodKey: period.periodKey,
      subscriptions: finalSubscriptions,
      charges,
      ensureSchema: false,
      strictPricing: true,
    })
    const finalExpected = expectedLinesFromPricing(finalPricing, finalSubscriptions, period)
    comparison = compareTargetCharges(finalExpected.lines, charges, period)
    const finalIssues = [
      ...finalExpected.issues,
      ...comparison.issues,
      ...comparison.missing.map((line) => issue(
        'target_month_recurring_charge_missing',
        `Subscription ${line.subscriptionId} is still missing its ${period.periodKey} recurring charge after idempotent posting.`,
        { subscriptionId: line.subscriptionId, signupId: line.signupId },
      )),
      ...scheduleIssues(finalExpected.lines, comparison.missing, period),
    ]
    const finalSummary = summaryFor(
      accountId,
      period,
      finalExpected.lines,
      charges,
      postedChargeIds,
      finalExpected.excludedSubscriptions,
    )
    if (finalIssues.length > 0) throw parityError(finalIssues, finalSummary)

    await client.query('COMMIT')
    transactionOpen = false
    return { verified: true, issues: [], ...finalSummary }
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    if (ownsClient && typeof client.release === 'function') client.release()
  }
}

/**
 * Recalculate the pre-posted upcoming household bill after a pricing or
 * enrollment change. It is intentionally a no-op before the facility fifth
 * day and after collection has reserved the charge; the lower-level
 * reconciler records every permitted before/after change in Activity.
 */
export async function reconcileUpcomingProvisionalChargesForAccount(db, {
  accountId,
  now = new Date(),
} = {}) {
  const account = await loadAccount(db, Number(accountId))
  if (!account || !isValidTimeZone(account.facility_timezone)) {
    return { status: 'skipped', reason: 'billing_account_or_facility_timezone_missing' }
  }
  const today = facilityDate(now, account.facility_timezone)
  if (Number(today.slice(8, 10)) < 5) return { status: 'skipped', reason: 'before_fifth_day_cutoff' }
  const billingMonth = nextBillingMonth(`${today.slice(0, 7)}-01`)
  const result = await reconcileCanonicalRecurringChargesForMonth(db, {
    accountId: Number(accountId),
    billingMonth,
    facilityTimeZone: account.facility_timezone,
    now,
    apply: true,
    allowEarlyPosting: true,
  })
  return { status: 'reconciled', result }
}
