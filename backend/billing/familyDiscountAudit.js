import { upsertSubscriptionForSource } from '../scheduling/billingSubscriptions.js'
import { firstOfNextMonth, todayDateOnly } from '../scheduling/firstMonthProration.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'
import { billingMonthKey } from './customerBillingPricing.js'
import { resolveFamilyEnrollmentPricing } from './familyEnrollmentPricing.js'

function periodDates(periodValue) {
  const periodKey = billingMonthKey(periodValue)
  const [year, month] = periodKey.split('-').map(Number)
  const next = new Date(Date.UTC(year, month, 1))
  const end = new Date(next.getTime() - 24 * 60 * 60 * 1000)
  return {
    periodKey,
    start: `${periodKey}-01`,
    end: end.toISOString().slice(0, 10),
  }
}

export function underDiscountCreditForCharge({
  chargedGrossCents,
  chargedNetCents,
  expectedGrossCents,
  expectedNetCents,
}) {
  const chargedGross = Math.round(Number(chargedGrossCents) || 0)
  const chargedNet = Math.round(Number(chargedNetCents) || 0)
  const expectedGross = Math.round(Number(expectedGrossCents) || 0)
  const expectedNet = Math.round(Number(expectedNetCents) || 0)
  if (chargedGross <= 0 || expectedGross <= 0 || chargedGross !== expectedGross) return 0
  const chargedDiscount = Math.max(0, chargedGross - chargedNet)
  const expectedDiscount = Math.max(0, expectedGross - expectedNet)
  return Math.max(0, expectedDiscount - chargedDiscount)
}

async function loadAccounts(db, accountIds) {
  const normalized = [...new Set(accountIds.map(Number).filter(Number.isFinite))]
  const result = await db.query(
    `SELECT account.id AS account_id, account.family_id
     FROM family_billing_account account
     WHERE account.is_active = TRUE
       AND ($1::bigint[] IS NULL OR account.id = ANY($1::bigint[]))
       AND EXISTS (
         SELECT 1
         FROM member
         JOIN scheduling_signup signup ON signup.member_id = member.id
         WHERE member.family_id = account.family_id
           AND signup.status = 'confirmed'
           AND signup.orphaned_at IS NULL
       )
     ORDER BY account.id`,
    [normalized.length > 0 ? normalized : null],
  )
  return result.rows
}

async function loadPostedRecurringCharges(db, accountId, { start, end }) {
  const result = await db.query(
    `SELECT charge.*,
            existing_repair.id AS existing_repair_credit_id,
            ABS(existing_repair.amount_cents) AS existing_repair_credit_cents,
            CASE
              WHEN subscription.source_type = 'scheduling_signup' THEN subscription.source_id
              WHEN charge.source_type = 'scheduling_signup' THEN charge.source_id
              ELSE NULL
            END AS signup_id
     FROM billing_charge charge
     LEFT JOIN billing_subscription subscription
       ON subscription.id = charge.subscription_id
       OR (
         charge.subscription_id IS NULL
         AND charge.source_type = 'billing_subscription'
         AND split_part(charge.source_id, ':', 1) = subscription.id::text
       )
     LEFT JOIN LATERAL (
       SELECT repair.id, repair.amount_cents
       FROM billing_charge repair
       WHERE repair.related_charge_id = charge.id
         AND repair.source_type = 'family_discount_repair'
         AND repair.amount_cents < 0
       ORDER BY repair.id
       LIMIT 1
     ) existing_repair ON TRUE
     WHERE charge.family_billing_account_id = $1
       AND charge.charge_type = 'recurring'
       AND charge.amount_cents > 0
       AND COALESCE(charge.service_period_start, charge.created_at::date) >= $2::date
       AND COALESCE(charge.service_period_start, charge.created_at::date) <= $3::date
       AND (
         subscription.source_type = 'scheduling_signup'
         OR charge.source_type = 'scheduling_signup'
       )
     ORDER BY charge.id`,
    [accountId, start, end],
  )
  return result.rows
}

async function persistExpectedSubscription(db, {
  accountId,
  line,
  periodKey,
  now,
}) {
  const nextCalendarBill = firstOfNextMonth(todayDateOnly(now))
  const requestedStart = `${periodKey}-01`
  const firstBillDate = requestedStart > nextCalendarBill ? requestedStart : nextCalendarBill
  const subscription = await upsertSubscriptionForSource(db, {
    familyBillingAccountId: accountId,
    memberId: Number(line.memberId),
    sourceType: 'scheduling_signup',
    sourceId: Number(line.signupId),
    description: 'Class enrollment',
    monthlyAmountCents: Number(line.grossCents),
    discountAmountCents: Number(line.discountCents),
    fromDate: now,
    firstBillDate,
  })
  if (!subscription) return null

  const hasStripeSubscription = Boolean(line.stripeSubscriptionId)
  await db.query(
    `UPDATE billing_subscription
     SET price_sync_status = $2,
         price_sync_error = NULL,
         updated_at = now()
     WHERE id = $1`,
    [subscription.id, hasStripeSubscription ? 'pending' : 'not_required'],
  )
  await recordBillingActivityBestEffort(db, {
    eventKey: `family-discount-rate-repair:${line.signupId}:${periodKey}:${line.grossCents}:${line.netCents}`,
    accountId,
    memberId: Number(line.memberId),
    signupId: Number(line.signupId),
    eventType: 'family_discount_rate_repaired',
    summary: 'Family-wide recurring class price repaired',
    beforeValue: line.hasLocalSubscription
      ? {
          billingSubscriptionId: line.subscriptionId,
          status: line.localSubscriptionStatus,
        }
      : null,
    afterValue: {
      billingSubscriptionId: Number(subscription.id),
      grossCents: Number(line.grossCents),
      discountCents: Number(line.discountCents),
      netCents: Number(line.netCents),
      firstBillDate,
    },
    details: { periodKey, source: 'family_discount_audit' },
    actorType: 'system',
  })
  return Number(subscription.id)
}

async function postUnderDiscountCredit(db, {
  accountId,
  line,
  charge,
  creditCents,
  periodKey,
}) {
  const sourceId = `${charge.id}:${periodKey}:v1`
  const result = await db.query(
    `INSERT INTO billing_charge (
       family_billing_account_id, member_id, source_type, source_id,
       description, amount_cents, gross_amount_cents, discount_amount_cents,
       service_period_start, service_period_end, charge_type, billing_interval,
       related_charge_id, collection_status, metadata
     ) VALUES (
       $1, $2, 'family_discount_repair', $3,
       $4, $5, $5, 0,
       $6, $7, 'credit', 'one_time', $8, 'none', $9::jsonb
     )
     ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
     DO NOTHING
     RETURNING id`,
    [
      accountId,
      Number(line.memberId),
      sourceId,
      `Family class discount correction — ${periodKey}`,
      -Math.abs(creditCents),
      charge.service_period_start ?? `${periodKey}-01`,
      charge.service_period_end ?? null,
      Number(charge.id),
      JSON.stringify({
        periodKey,
        signupId: Number(line.signupId),
        originalChargeId: Number(charge.id),
        expectedGrossCents: Number(line.grossCents),
        expectedNetCents: Number(line.netCents),
        originalNetCents: Number(charge.amount_cents),
        creditCents,
      }),
    ],
  )
  const creditId = result.rows[0]?.id == null ? null : Number(result.rows[0].id)
  if (creditId != null) {
    await recordBillingActivityBestEffort(db, {
      eventKey: `family-discount-credit:${charge.id}:${periodKey}:v1`,
      accountId,
      memberId: Number(line.memberId),
      signupId: Number(line.signupId),
      chargeId: creditId,
      eventType: 'family_discount_credit_posted',
      summary: 'Posted an exact credit for a missing family class discount',
      beforeValue: {
        originalChargeId: Number(charge.id),
        chargedCents: Number(charge.amount_cents),
      },
      afterValue: { creditChargeId: creditId, creditCents },
      details: { periodKey, source: 'family_discount_audit' },
      actorType: 'system',
    })
  }
  return creditId
}

/** Dry-run by default; writes only when apply=true. */
export async function auditFamilyDiscounts(db, {
  periodKey = billingMonthKey(new Date()),
  accountIds = [],
  apply = false,
  now = new Date(),
} = {}) {
  const bounds = periodDates(periodKey)
  const accounts = await loadAccounts(db, accountIds)
  const report = {
    mode: apply ? 'apply' : 'dry_run',
    periodKey: bounds.periodKey,
    accountCount: accounts.length,
    enrollmentCount: 0,
    missingLocalSubscriptions: 0,
    subscriptionPriceMismatches: 0,
    underDiscountedCharges: 0,
    plannedCreditCents: 0,
    subscriptionsRepaired: 0,
    creditsPosted: 0,
    creditsPostedCents: 0,
    accounts: [],
  }

  for (const account of accounts) {
    const accountId = Number(account.account_id)
    const familyId = Number(account.family_id)
    const pricing = await resolveFamilyEnrollmentPricing(db, {
      familyId,
      periodKey: bounds.periodKey,
    })
    const charges = await loadPostedRecurringCharges(db, accountId, bounds)
    const chargesBySignup = new Map()
    for (const charge of charges) {
      const signupId = Number(charge.signup_id)
      if (!Number.isFinite(signupId)) continue
      const list = chargesBySignup.get(signupId) ?? []
      list.push(charge)
      chargesBySignup.set(signupId, list)
    }

    const accountReport = {
      accountId,
      familyId,
      grossCents: Number(pricing.grossCents),
      discountCents: Number(pricing.discountCents),
      netCents: Number(pricing.netCents),
      enrollmentCount: pricing.lines.length,
      needsStripePriceSync: false,
      lines: [],
    }
    report.enrollmentCount += pricing.lines.length

    for (const line of pricing.lines) {
      const localGross = Number(line.localGrossCents)
      const localNet = Number(line.localNetCents)
      const missingLocal = !line.hasLocalSubscription
      const priceMismatch = Boolean(
        line.hasLocalSubscription &&
        (localGross !== Number(line.grossCents) || localNet !== Number(line.netCents)),
      )
      if (missingLocal) report.missingLocalSubscriptions += 1
      if (priceMismatch) report.subscriptionPriceMismatches += 1
      if (priceMismatch && line.stripeSubscriptionId) accountReport.needsStripePriceSync = true

      const chargeRepairs = []
      for (const charge of chargesBySignup.get(Number(line.signupId)) ?? []) {
        const creditCents = underDiscountCreditForCharge({
          chargedGrossCents: charge.gross_amount_cents,
          chargedNetCents: charge.amount_cents,
          expectedGrossCents: line.grossCents,
          expectedNetCents: line.netCents,
        })
        if (creditCents <= 0) continue
        const existingCreditCents = Number(charge.existing_repair_credit_cents) || 0
        if (existingCreditCents >= creditCents) {
          chargeRepairs.push({
            originalChargeId: Number(charge.id),
            chargedCents: Number(charge.amount_cents),
            creditCents,
            creditChargeId: Number(charge.existing_repair_credit_id),
            status: 'resolved',
          })
          continue
        }
        report.underDiscountedCharges += 1
        report.plannedCreditCents += creditCents
        let creditChargeId = null
        if (apply) {
          creditChargeId = await postUnderDiscountCredit(db, {
            accountId,
            line,
            charge,
            creditCents,
            periodKey: bounds.periodKey,
          })
          if (creditChargeId != null) {
            report.creditsPosted += 1
            report.creditsPostedCents += creditCents
          }
        }
        chargeRepairs.push({
          originalChargeId: Number(charge.id),
          chargedCents: Number(charge.amount_cents),
          creditCents,
          creditChargeId,
          status: creditChargeId == null ? 'planned' : 'posted',
        })
      }

      let repairedSubscriptionId = null
      if (apply && (missingLocal || priceMismatch)) {
        repairedSubscriptionId = await persistExpectedSubscription(db, {
          accountId,
          line,
          periodKey: bounds.periodKey,
          now,
        })
        if (repairedSubscriptionId != null) report.subscriptionsRepaired += 1
      }
      accountReport.lines.push({
        signupId: Number(line.signupId),
        memberId: Number(line.memberId),
        grossCents: Number(line.grossCents),
        discountCents: Number(line.discountCents),
        netCents: Number(line.netCents),
        missingLocalSubscription: missingLocal,
        subscriptionPriceMismatch: priceMismatch,
        repairedSubscriptionId,
        chargeRepairs,
      })
    }
    report.accounts.push(accountReport)
  }
  return report
}
