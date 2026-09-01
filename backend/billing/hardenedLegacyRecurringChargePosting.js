import {
  buildEnrollmentBillingPeriodManifest,
  resolveFamilyEnrollmentPricing,
} from './familyEnrollmentPricing.js'
import {
  billingDateString,
  facilityDate,
  isValidTimeZone,
  nextBillingMonth,
} from './canonicalBillingMigrationState.js'
import { BillingMigrationSafetyError } from './canonicalBillingMigrationStripe.js'

function cents(value) {
  return Math.round(Number(value) || 0)
}

function periodBounds(billingMonth) {
  const start = billingDateString(billingMonth)
  if (!start || !/^\d{4}-\d{2}-01$/.test(start)) {
    throw new Error('Legacy recurring posting requires a billing month in YYYY-MM-01 format.')
  }
  const next = nextBillingMonth(start)
  const end = new Date(`${next}T00:00:00.000Z`)
  end.setUTCDate(end.getUTCDate() - 1)
  return { start, next, end: end.toISOString().slice(0, 10), periodKey: start.slice(0, 7) }
}

function safety(code, message, details = {}) {
  return new BillingMigrationSafetyError(code, message, details)
}

async function lockLegacyLifecycle(db, accountId) {
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

async function loadLegacySubscriptions(db, accountId) {
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

async function loadPeriodCharges(db, accountId, period) {
  return db.query(
    `SELECT charge.*
       FROM billing_charge charge
      WHERE charge.family_billing_account_id = $1
        AND charge.source_type = 'billing_subscription'
        AND charge.charge_type = 'recurring'
        AND charge.service_period_start <= $3::date
        AND charge.service_period_end >= $2::date
      ORDER BY charge.id`,
    [Number(accountId), period.start, period.end],
  ).then((result) => result.rows)
}

/**
 * Preserve legacy collection during staged rollout while using the same
 * authoritative lifecycle classifier and monthly pricing engine as shadow
 * parity. This function performs local ledger work only; it never calls Stripe.
 */
export async function postHardenedLegacyRecurringChargesForMonth(db, {
  accountId,
  billingMonth,
  facilityTimeZone,
  now = new Date(),
  pricingResolver = resolveFamilyEnrollmentPricing,
} = {}) {
  const period = periodBounds(billingMonth)
  if (!isValidTimeZone(facilityTimeZone)) {
    throw safety('facility_timezone_missing', 'Legacy recurring posting requires a valid facility timezone.', {
      accountId,
      billingMonth: period.start,
      facilityTimeZone,
    })
  }
  if (facilityDate(now, facilityTimeZone) < period.start) {
    throw safety('recurring_charge_before_facility_boundary', 'Legacy recurring tuition cannot post before the facility month boundary.', {
      accountId,
      billingMonth: period.start,
    })
  }

  const ownsClient = typeof db.release !== 'function' && typeof db.connect === 'function'
  const client = ownsClient ? await db.connect() : db
  let transactionOpen = false
  try {
    await client.query('BEGIN')
    transactionOpen = true
    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(accountId)])
    const account = await client.query(
      `SELECT account.id, account.family_id, account.is_active,
              account.household_monthly_billing_enabled,
              facility.timezone AS facility_timezone
         FROM family_billing_account account
         JOIN family ON family.id = account.family_id
         JOIN facility ON facility.id = family.facility_id
        WHERE account.id = $1
        FOR UPDATE OF account`,
      [Number(accountId)],
    ).then((result) => result.rows[0] ?? null)
    if (
      !account ||
      account.is_active !== true ||
      account.household_monthly_billing_enabled === true
    ) {
      throw safety('legacy_recurring_account_state_invalid', 'Legacy recurring posting requires an active non-household account.', { accountId })
    }
    if (account.facility_timezone !== facilityTimeZone) {
      throw safety('facility_timezone_drift', 'The facility timezone changed during legacy recurring posting.', {
        accountId,
        expected: facilityTimeZone,
        actual: account.facility_timezone,
      })
    }

    await lockLegacyLifecycle(client, accountId)
    const subscriptions = await loadLegacySubscriptions(client, accountId)
    const allCharges = await client.query(
      `SELECT * FROM billing_charge
        WHERE family_billing_account_id = $1
          AND source_type = 'billing_subscription'
        ORDER BY id`,
      [Number(accountId)],
    ).then((result) => result.rows)
    const pricing = await pricingResolver(client, {
      familyId: Number(account.family_id),
      periodKey: period.periodKey,
      subscriptions,
      charges: allCharges,
      ensureSchema: false,
      strictPricing: true,
    })
    const manifest = buildEnrollmentBillingPeriodManifest(subscriptions, period.periodKey, {
      requireSubscriptionMapping: true,
    })
    const lifecycleById = new Map(manifest.map((entry) => [Number(entry.subscriptionId), entry]))
    const pricingById = new Map()
    for (const line of pricing?.lines ?? []) {
      const subscriptionId = Number(line.subscriptionId)
      if (!Number.isSafeInteger(subscriptionId) || pricingById.has(subscriptionId)) {
        throw safety('legacy_recurring_pricing_mapping_invalid', 'Legacy recurring pricing has a missing or duplicate subscription mapping.', {
          accountId,
          billingMonth: period.start,
          subscriptionId: Number.isSafeInteger(subscriptionId) ? subscriptionId : null,
        })
      }
      pricingById.set(subscriptionId, line)
    }
    const activeById = new Map(
      subscriptions
        .filter((subscription) => subscription.status === 'active')
        .map((subscription) => [Number(subscription.id), subscription]),
    )
    for (const [subscriptionId] of pricingById) {
      const lifecycle = lifecycleById.get(subscriptionId)
      if (!activeById.has(subscriptionId) || lifecycle?.valid !== true || lifecycle?.billable !== true) {
        throw safety('legacy_recurring_pricing_mapping_invalid', 'Legacy recurring pricing contains a non-billable subscription mapping.', {
          accountId,
          billingMonth: period.start,
          subscriptionId,
          lifecycleReason: lifecycle?.reason ?? null,
        })
      }
    }
    for (const [subscriptionId] of activeById) {
      const lifecycle = lifecycleById.get(subscriptionId)
      if (lifecycle?.valid !== true) {
        throw safety('legacy_recurring_lifecycle_blocked', `Subscription ${subscriptionId} has an invalid lifecycle mapping.`, {
          accountId,
          subscriptionId,
          lifecycleReason: lifecycle?.reason ?? null,
        })
      }
      if (lifecycle.billable === true && !pricingById.has(subscriptionId)) {
        throw safety('legacy_recurring_pricing_line_missing', `Subscription ${subscriptionId} has no authoritative ${period.periodKey} pricing line.`, {
          accountId,
          subscriptionId,
        })
      }
      if (lifecycle.billable === false && lifecycle.exclusionScheduleValid !== true) {
        throw safety('legacy_recurring_exclusion_schedule_invalid', `Subscription ${subscriptionId} has an unsafe non-billable schedule.`, {
          accountId,
          subscriptionId,
          lifecycleReason: lifecycle.reason,
          scheduleReason: lifecycle.exclusionScheduleReason,
          nextBillDate: lifecycle.exclusionNextBillDate,
        })
      }
    }

    const due = subscriptions.filter((subscription) => (
      subscription.status === 'active' &&
      billingDateString(subscription.next_bill_date) === period.start
    ))
    const existingCharges = await loadPeriodCharges(client, accountId, period)
    const existingBySubscription = new Map()
    for (const charge of existingCharges) {
      const subscriptionId = Number(charge.subscription_id)
      const rows = existingBySubscription.get(subscriptionId) ?? []
      rows.push(charge)
      existingBySubscription.set(subscriptionId, rows)
    }

    const postedChargeIds = []
    const processedSubscriptionIds = []
    for (const subscription of due) {
      const subscriptionId = Number(subscription.id)
      const lifecycle = lifecycleById.get(subscriptionId)
      if (lifecycle?.valid !== true || lifecycle?.billable !== true) {
        throw safety('legacy_recurring_lifecycle_blocked', `Subscription ${subscriptionId} is not billable for ${period.periodKey}.`, {
          accountId,
          subscriptionId,
          lifecycleReason: lifecycle?.reason ?? null,
          exclusionScheduleReason: lifecycle?.exclusionScheduleReason ?? null,
        })
      }
      const line = pricingById.get(subscriptionId)
      if (!line) {
        throw safety('legacy_recurring_pricing_line_missing', `Subscription ${subscriptionId} has no authoritative ${period.periodKey} pricing line.`, {
          accountId,
          subscriptionId,
        })
      }
      const grossCents = cents(line.grossCents)
      const discountCents = cents(line.discountCents)
      const netCents = cents(line.netCents)
      if (
        grossCents < 0 ||
        discountCents < 0 ||
        netCents < 0 ||
        netCents !== Math.max(0, grossCents - discountCents)
      ) {
        throw safety('legacy_recurring_pricing_invalid', `Subscription ${subscriptionId} has inconsistent canonical-safe pricing.`, {
          accountId,
          subscriptionId,
          grossCents,
          discountCents,
          netCents,
        })
      }
      const memberId = Number(line.memberId ?? subscription.member_id)
      if (!Number.isSafeInteger(memberId) || memberId <= 0) {
        throw safety('legacy_recurring_member_missing', `Subscription ${subscriptionId} has no authoritative member.`, {
          accountId,
          subscriptionId,
        })
      }

      const found = existingBySubscription.get(subscriptionId) ?? []
      if (found.length > 1) {
        throw safety('legacy_recurring_charge_duplicate', `Subscription ${subscriptionId} has duplicate ${period.periodKey} charges.`, {
          accountId,
          subscriptionId,
          chargeIds: found.map((row) => Number(row.id)),
        })
      }
      if (found.length === 1) {
        const charge = found[0]
        const exact =
          billingDateString(charge.service_period_start) === period.start &&
          billingDateString(charge.service_period_end) === period.end &&
          Number(charge.member_id) === memberId &&
          cents(charge.gross_amount_cents) === grossCents &&
          cents(charge.discount_amount_cents) === discountCents &&
          cents(charge.amount_cents) === netCents &&
          (charge.price_adjustment_id == null ? null : Number(charge.price_adjustment_id)) ===
            (line.priceAdjustmentId == null ? null : Number(line.priceAdjustmentId))
        if (!exact) {
          throw safety('legacy_recurring_charge_mismatch', `Existing charge for subscription ${subscriptionId} does not match authoritative pricing.`, {
            accountId,
            subscriptionId,
            chargeId: Number(charge.id),
          })
        }
      } else {
        const inserted = await client.query(
          `INSERT INTO billing_charge (
             family_billing_account_id, member_id, source_type, source_id, description,
             amount_cents, gross_amount_cents, discount_amount_cents,
             charge_type, billing_interval, subscription_id,
             service_period_start, service_period_end, price_adjustment_id
           ) VALUES (
             $1, $2, 'billing_subscription', $3, $4,
             $5, $6, $7, 'recurring', 'month', $8, $9::date, $10::date, $11
           )
           ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL DO NOTHING
           RETURNING id`,
          [
            Number(accountId),
            memberId,
            `${subscriptionId}:${period.periodKey}`,
            subscription.description,
            netCents,
            grossCents,
            discountCents,
            subscriptionId,
            period.start,
            period.end,
            line.priceAdjustmentId == null ? null : Number(line.priceAdjustmentId),
          ],
        )
        if (!inserted.rows[0]) {
          throw safety('legacy_recurring_charge_insert_conflict', `Subscription ${subscriptionId} could not post idempotently.`, {
            accountId,
            subscriptionId,
          })
        }
        postedChargeIds.push(Number(inserted.rows[0].id))
      }

      const nextBillDate = lifecycle.allowsNoNextBill === true ? null : period.next
      const advanced = await client.query(
        `UPDATE billing_subscription
            SET next_bill_date = $2::date, updated_at = now()
          WHERE id = $1
            AND status = 'active'
            AND next_bill_date = $3::date
          RETURNING id`,
        [subscriptionId, nextBillDate, period.start],
      )
      if (!advanced.rows[0]) {
        throw safety('legacy_recurring_schedule_cas_failed', `Subscription ${subscriptionId} changed while its charge was posting.`, {
          accountId,
          subscriptionId,
          expectedNextBillDate: period.start,
        })
      }
      processedSubscriptionIds.push(subscriptionId)
    }

    await client.query('COMMIT')
    transactionOpen = false
    return {
      verified: true,
      billingMonth: period.start,
      postedChargeIds,
      processedSubscriptionIds,
      periodsAdvanced: processedSubscriptionIds.length,
    }
  } catch (error) {
    if (transactionOpen) await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    if (ownsClient && typeof client.release === 'function') client.release()
  }
}
