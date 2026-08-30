import {
  buildSignupOrderPreview,
  computeExistingEnrollmentDiscounts,
} from '../scheduling/orderPricing.js'
import {
  toDateString,
  upsertSubscriptionForSource,
} from '../scheduling/billingSubscriptions.js'
import { firstOfNextMonth, todayDateOnly } from '../scheduling/firstMonthProration.js'
import { createEnrollmentStripeSubscriptions } from './stripeEnrollmentCheckout.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'

function asDateOnly(value) {
  if (!value) return null
  if (value instanceof Date) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, '0')}-${String(value.getDate()).padStart(2, '0')}`
  }
  const match = String(value).match(/^(\d{4})-(\d{2})-(\d{2})/)
  return match ? `${match[1]}-${match[2]}-${match[3]}` : null
}

function firstOfMonth(value) {
  const date = asDateOnly(value)
  return date ? `${date.slice(0, 7)}-01` : null
}

export function promoCodeFromLegacyRule(rule) {
  if (!rule || rule.type !== 'promo_code') return null
  let config = rule.config ?? {}
  if (typeof config === 'string') {
    try {
      config = JSON.parse(config)
    } catch {
      config = {}
    }
  }
  const code = String(config.code ?? config.promo_code ?? '').trim().toUpperCase()
  return code || null
}

export function enrollmentRepairFirstBillDate({ now = new Date(), enrollmentStartDate = null } = {}) {
  const nextMonth = firstOfNextMonth(todayDateOnly(now))
  const enrollmentMonth = firstOfMonth(enrollmentStartDate)
  return enrollmentMonth && enrollmentMonth > nextMonth ? enrollmentMonth : nextMonth
}

export function defaultSavedPaymentMethodId(customer) {
  if (!customer || customer.deleted) return null
  const value = customer.invoice_settings?.default_payment_method
  if (!value) return null
  return typeof value === 'string' ? value : value.id ?? null
}

const BASE_GAPS_SQL = `
  SELECT
    signup.id AS signup_id,
    signup.member_id,
    signup.form_id,
    signup.slot_group_id,
    signup.time_slot_id,
    signup.enrollment_start_date,
    signup.pricing_breakdown,
    signup.manual_discount_cents,
    signup.manual_discount_pct,
    signup.manual_discount_reason,
    signup.manual_discount_rule_id,
    member.family_id,
    account.id AS account_id,
    account.stripe_customer_id,
    form.title AS form_title,
    subscription.id AS billing_subscription_id,
    subscription.stripe_subscription_id,
    subscription.next_bill_date,
    subscription.net_monthly_cents,
    COALESCE(
      NULLIF(signup.pricing_breakdown ->> 'billingType', ''),
      NULLIF(signup.pricing_breakdown ->> 'billing_type', ''),
      NULLIF(signup.pricing_breakdown -> 'line' ->> 'billingType', ''),
      NULLIF(signup.pricing_breakdown -> 'line' ->> 'billing_type', ''),
      'recurring'
    ) AS billing_type
  FROM scheduling_signup signup
  JOIN member ON member.id = signup.member_id
  JOIN scheduling_form form ON form.id = signup.form_id
  JOIN scheduling_slot_group slot_group ON slot_group.id = signup.slot_group_id
  LEFT JOIN scheduling_offering offering ON offering.id = slot_group.offering_id
  LEFT JOIN family_billing_account account ON account.family_id = member.family_id
  LEFT JOIN LATERAL (
    SELECT billing_subscription.*
    FROM billing_subscription
    WHERE billing_subscription.source_type = 'scheduling_signup'
      AND billing_subscription.source_id = signup.id::text
      AND billing_subscription.status <> 'cancelled'
    ORDER BY
      CASE billing_subscription.status WHEN 'active' THEN 0 WHEN 'paused' THEN 1 ELSE 2 END,
      billing_subscription.id DESC
    LIMIT 1
  ) subscription ON TRUE
  WHERE signup.status = 'confirmed'
    AND signup.orphaned_at IS NULL
    AND form.deleted_at IS NULL
    AND (signup.cancel_effective_date IS NULL OR signup.cancel_effective_date > CURRENT_DATE)
    AND (
      COALESCE(offering.end_date, slot_group.active_end, form.end_date) IS NULL
      OR COALESCE(offering.end_date, slot_group.active_end, form.end_date) >= CURRENT_DATE
    )
    AND COALESCE(
      NULLIF(signup.pricing_breakdown ->> 'billingType', ''),
      NULLIF(signup.pricing_breakdown ->> 'billing_type', ''),
      NULLIF(signup.pricing_breakdown -> 'line' ->> 'billingType', ''),
      NULLIF(signup.pricing_breakdown -> 'line' ->> 'billing_type', ''),
      'recurring'
    ) <> 'one_time'
    AND (subscription.id IS NULL OR subscription.stripe_subscription_id IS NULL)
`

export async function findEnrollmentSubscriptionGaps(db, {
  accountIds = [],
  signupIds = [],
} = {}) {
  const params = []
  const filters = []
  const normalizedAccountIds = accountIds.map(Number).filter(Number.isFinite)
  const normalizedSignupIds = signupIds.map(Number).filter(Number.isFinite)
  if (normalizedAccountIds.length > 0) {
    params.push(normalizedAccountIds)
    filters.push(`account.id = ANY($${params.length}::bigint[])`)
  }
  if (normalizedSignupIds.length > 0) {
    params.push(normalizedSignupIds)
    filters.push(`signup.id = ANY($${params.length}::bigint[])`)
  }
  const result = await db.query(
    `${BASE_GAPS_SQL}
     ${filters.length > 0 ? `AND ${filters.join(' AND ')}` : ''}
     ORDER BY account.id NULLS LAST, signup.id`,
    params,
  )
  return result.rows
}

function parseResponses(value) {
  if (!value) return {}
  if (typeof value === 'object') return value
  try {
    return JSON.parse(value)
  } catch {
    return {}
  }
}

async function loadFamilyMemberPricingRows(db, familyId) {
  const result = await db.query(
    `SELECT member.id, member.billing_city, member.graduation_year, latest.responses
     FROM member
     LEFT JOIN LATERAL (
       SELECT signup.responses
       FROM scheduling_signup signup
       WHERE signup.member_id = member.id AND signup.orphaned_at IS NULL
       ORDER BY signup.created_at DESC, signup.id DESC
       LIMIT 1
     ) latest ON TRUE
     WHERE member.family_id = $1 AND member.is_active = TRUE
     ORDER BY member.id`,
    [familyId],
  )
  return result.rows
}

function pricingContextForMember(member, familyId) {
  const responses = parseResponses(member.responses)
  const graduationYear = member.graduation_year ?? responses.graduation_year ?? null
  return {
    city: member.billing_city ?? null,
    school: responses.current_school ? String(responses.current_school).trim() : null,
    graduationYear:
      graduationYear == null || graduationYear === '' ? null : Number(graduationYear),
    familyId: Number(familyId),
  }
}

/** Resolve the same gross/net lines shown by Customer Billing before creating subscriptions. */
export async function resolveEnrollmentRepairPrices(db, candidates) {
  const result = new Map()
  const candidatesByFamily = new Map()
  for (const candidate of candidates) {
    const familyId = Number(candidate.family_id)
    if (!Number.isFinite(familyId)) continue
    if (!candidatesByFamily.has(familyId)) candidatesByFamily.set(familyId, [])
    candidatesByFamily.get(familyId).push(candidate)
  }

  for (const [familyId, familyCandidates] of candidatesByFamily) {
    const members = await loadFamilyMemberPricingRows(db, familyId)
    const previewExistingLines = []
    let anchorMemberId = null
    let anchorContext = { familyId }

    for (const member of members) {
      const memberId = Number(member.id)
      const memberContext = pricingContextForMember(member, familyId)
      const preview = await buildSignupOrderPreview(db, {
        memberId,
        newSignups: [],
        promoCodes: [],
        memberContext,
      })
      for (const enrollment of preview?.existingClasses ?? []) {
        if (enrollment.id == null || !(Number(enrollment.monthlyPrice) > 0)) continue
        const grossCents = Math.round(Number(enrollment.monthlyPrice) * 100)
        anchorMemberId = anchorMemberId ?? memberId
        if (anchorMemberId === memberId) anchorContext = memberContext
        previewExistingLines.push({
          key: `repair-existing-${enrollment.id}`,
          signupId: Number(enrollment.id),
          formId: enrollment.formId,
          programId: enrollment.programsId ?? null,
          sportId: null,
          memberId,
          familyId,
          memberCity: memberContext.city,
          memberSchool: memberContext.school,
          memberGraduationYear: memberContext.graduationYear,
          baseCents: grossCents,
          listCents: grossCents,
          finalCents: grossCents,
          includeInSubtotal: false,
          shadowOnly: true,
        })
      }
    }

    if (anchorMemberId == null || previewExistingLines.length === 0) continue
    const discounts = await computeExistingEnrollmentDiscounts(db, {
      memberId: anchorMemberId,
      promoCodes: [],
      memberContext: anchorContext,
      previewExistingLines,
      formRows: new Map(),
      scopeMeta: new Map(),
    })
    const targetIds = new Set(familyCandidates.map((row) => Number(row.signup_id)))
    for (const line of discounts?.accountLines ?? []) {
      const signupId = Number(line.signupId)
      if (!targetIds.has(signupId)) continue
      const grossCents = Math.max(0, Math.round(Number(line.baseCents ?? line.listCents) || 0))
      const netCents = Math.max(0, Math.round(Number(line.finalCents) || 0))
      result.set(signupId, {
        grossCents,
        discountCents: Math.max(0, grossCents - netCents),
        netCents,
        discountComponents: line.applied ?? [],
      })
    }
  }

  return result
}

export function buildEnrollmentRepairPlans(candidates, prices, { now = new Date() } = {}) {
  const plans = []
  const skipped = []
  for (const candidate of candidates) {
    const signupId = Number(candidate.signup_id)
    const price = prices.get(signupId)
    if (!price || price.grossCents <= 0 || price.netCents <= 0) {
      skipped.push({
        accountId: Number(candidate.account_id),
        signupId,
        reason: !price ? 'price_unresolved' : 'nonpositive_recurring_price',
      })
      continue
    }
    plans.push({
      candidate,
      price,
      nextBillDate: enrollmentRepairFirstBillDate({
        now,
        enrollmentStartDate: candidate.enrollment_start_date,
      }),
    })
  }
  return { plans, skipped }
}

async function upsertRepairAlert(db, candidate, { type, severity = 'warning', message, details = {} }) {
  const eventId = `enrollment-autopay:${candidate.signup_id}`
  try {
    await db.query(
      `INSERT INTO stripe_billing_alert (
         stripe_event_id, family_billing_account_id, alert_type,
         severity, message, details, resolved_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6::jsonb, NULL, now())
       ON CONFLICT (stripe_event_id) DO UPDATE SET
         family_billing_account_id = EXCLUDED.family_billing_account_id,
         alert_type = EXCLUDED.alert_type,
         severity = EXCLUDED.severity,
         message = EXCLUDED.message,
         details = EXCLUDED.details,
         resolved_at = NULL,
         updated_at = now()`,
      [eventId, candidate.account_id, type, severity, message, JSON.stringify(details)],
    )
  } catch (error) {
    if (error?.code !== '42P01' && error?.code !== '42703') throw error
  }
}

async function resolveRepairAlert(db, signupId) {
  try {
    await db.query(
      `UPDATE stripe_billing_alert
       SET resolved_at = COALESCE(resolved_at, now()), updated_at = now()
       WHERE stripe_event_id = $1`,
      [`enrollment-autopay:${signupId}`],
    )
  } catch (error) {
    if (error?.code !== '42P01' && error?.code !== '42703') throw error
  }
}

async function markSubscriptionSync(db, subscriptionId, status, error = null) {
  try {
    await db.query(
      `UPDATE billing_subscription
       SET price_sync_status = $2,
           price_sync_error = $3,
           price_synced_at = CASE WHEN $2 = 'synced' THEN now() ELSE price_synced_at END,
           updated_at = now()
       WHERE id = $1`,
      [subscriptionId, status, error ? String(error).slice(0, 500) : null],
    )
  } catch (dbError) {
    if (dbError?.code !== '42703') throw dbError
  }
}

async function createLocalRepairSubscriptions(pool, plans, now) {
  const client = await pool.connect()
  const created = []
  try {
    await client.query('BEGIN')
    for (const plan of plans) {
      const candidate = plan.candidate
      const nextBillDate = plan.nextBillDate
      const enrollmentStartDate =
        asDateOnly(candidate.enrollment_start_date) ?? todayDateOnly(now)
      const subscription = await upsertSubscriptionForSource(client, {
        familyBillingAccountId: Number(candidate.account_id),
        memberId: Number(candidate.member_id),
        sourceType: 'scheduling_signup',
        sourceId: Number(candidate.signup_id),
        description: candidate.form_title || 'Class enrollment',
        monthlyAmountCents: plan.price.grossCents,
        discountAmountCents: plan.price.discountCents,
        fromDate: now,
        firstBillDate: nextBillDate,
        subscriptionStartDate: enrollmentStartDate,
      })
      if (!subscription) throw new Error(`Could not create subscription for signup ${candidate.signup_id}.`)
      await client.query(
        `UPDATE billing_subscription
         SET next_bill_date = $2::date, updated_at = now()
         WHERE id = $1`,
        [subscription.id, nextBillDate],
      )
      await markSubscriptionSync(client, subscription.id, 'pending')
      await recordBillingActivityBestEffort(client, {
        eventKey: `enrollment-subscription-repair:${candidate.signup_id}:${subscription.id}`,
        accountId: Number(candidate.account_id),
        memberId: Number(candidate.member_id),
        signupId: Number(candidate.signup_id),
        eventType: 'enrollment_subscription_repaired',
        summary: 'Recurring enrollment billing record restored',
        afterValue: {
          billingSubscriptionId: subscription.id,
          grossCents: plan.price.grossCents,
          discountCents: plan.price.discountCents,
          netCents: plan.price.netCents,
          nextBillDate,
        },
        details: { source: 'saved_card_enrollment_repair' },
        actorType: 'system',
      })
      created.push({ ...plan, billingSubscriptionId: subscription.id })
    }
    await client.query('COMMIT')
    return created
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

async function createRemoteRepairSubscriptions(pool, stripe, account, plans, paymentMethodId) {
  const signupIds = plans.map((plan) => Number(plan.candidate.signup_id))
  const created = await createEnrollmentStripeSubscriptions(pool, stripe, {
    preview: {
      newSignups: [],
      firstMonth: { enabled: false, periodStart: todayDateOnly(new Date()), items: [] },
    },
    stripeSession: null,
    signupIds,
    familyBillingAccountId: Number(account.accountId),
    customerId: account.stripeCustomerId,
    defaultPaymentMethodId: paymentMethodId,
  })
  return new Map(created.map((entry) => [Number(entry.signupId), entry]))
}

/**
 * Repair confirmed recurring enrollments only when the Stripe Customer has a
 * reusable default payment method. No ledger charge is created and Stripe is
 * trialed to the next calendar billing month, so this never performs catch-up collection.
 */
export async function repairSavedCardEnrollmentSubscriptions(pool, stripe, {
  apply = false,
  accountIds = [],
  signupIds = [],
  now = new Date(),
} = {}) {
  if (!stripe) throw new Error('Stripe is required to verify saved cards and enable auto-payment.')
  const candidates = await findEnrollmentSubscriptionGaps(pool, { accountIds, signupIds })
  const byAccount = new Map()
  for (const candidate of candidates) {
    const accountId = Number(candidate.account_id)
    if (!Number.isFinite(accountId)) continue
    if (!byAccount.has(accountId)) byAccount.set(accountId, [])
    byAccount.get(accountId).push(candidate)
  }

  const summary = {
    apply,
    candidateEnrollments: candidates.length,
    savedCardAccounts: 0,
    plannedEnrollments: 0,
    localSubscriptionsCreated: 0,
    stripeSubscriptionsCreated: 0,
    skipped: [],
    failed: [],
    plans: [],
  }

  for (const [accountId, accountCandidates] of byAccount) {
    const stripeCustomerId = accountCandidates[0]?.stripe_customer_id
    if (!stripeCustomerId) {
      summary.skipped.push({ accountId, reason: 'missing_stripe_customer', signupIds: accountCandidates.map((row) => Number(row.signup_id)) })
      continue
    }

    let customer
    try {
      customer = await stripe.customers.retrieve(stripeCustomerId, {
        expand: ['invoice_settings.default_payment_method'],
      })
    } catch (error) {
      summary.failed.push({ accountId, reason: 'stripe_customer_lookup_failed', error: error?.message ?? String(error) })
      continue
    }
    const paymentMethodId = defaultSavedPaymentMethodId(customer)
    if (!paymentMethodId) {
      summary.skipped.push({ accountId, reason: 'no_default_saved_card', signupIds: accountCandidates.map((row) => Number(row.signup_id)) })
      for (const candidate of accountCandidates) {
        if (apply) {
          await upsertRepairAlert(pool, candidate, {
            type: 'enrollment_autopay_setup_required',
            message: `Enrollment ${candidate.signup_id} needs a default saved payment method before auto-payment can be enabled.`,
          })
        }
      }
      continue
    }

    summary.savedCardAccounts += 1
    let prices
    try {
      prices = await resolveEnrollmentRepairPrices(pool, accountCandidates)
    } catch (error) {
      summary.failed.push({ accountId, reason: 'pricing_resolution_failed', error: error?.message ?? String(error) })
      continue
    }

    const built = buildEnrollmentRepairPlans(accountCandidates, prices, { now })
    const plans = built.plans
    summary.skipped.push(...built.skipped)
    for (const { candidate, price, nextBillDate } of plans) {
      summary.plans.push({
        accountId,
        signupId: Number(candidate.signup_id),
        grossCents: price.grossCents,
        discountCents: price.discountCents,
        netCents: price.netCents,
        nextBillDate,
        action: candidate.billing_subscription_id == null ? 'create_local_and_stripe' : 'create_stripe',
      })
    }
    summary.plannedEnrollments += plans.length
    if (!apply || plans.length === 0) continue

    let localPlans
    try {
      localPlans = await createLocalRepairSubscriptions(pool, plans, now)
      summary.localSubscriptionsCreated += localPlans.filter(
        (plan) => plan.candidate.billing_subscription_id == null,
      ).length
    } catch (error) {
      summary.failed.push({ accountId, reason: 'local_subscription_create_failed', error: error?.message ?? String(error) })
      continue
    }

    let remoteBySignup
    try {
      remoteBySignup = await createRemoteRepairSubscriptions(
        pool,
        stripe,
        { accountId, stripeCustomerId },
        localPlans,
        paymentMethodId,
      )
    } catch (error) {
      for (const plan of localPlans) {
        await markSubscriptionSync(pool, plan.billingSubscriptionId, 'failed', error?.message ?? String(error))
        await upsertRepairAlert(pool, plan.candidate, {
          type: 'enrollment_autopay_sync_failed',
          severity: 'critical',
          message: `Auto-payment setup failed for enrollment ${plan.candidate.signup_id}.`,
          details: { error: String(error?.message ?? error).slice(0, 500) },
        })
      }
      summary.failed.push({ accountId, reason: 'stripe_subscription_create_failed', error: error?.message ?? String(error) })
      continue
    }

    for (const plan of localPlans) {
      const remote = remoteBySignup.get(Number(plan.candidate.signup_id))
      if (!remote) {
        const error = 'Stripe did not create a recurring subscription.'
        await markSubscriptionSync(pool, plan.billingSubscriptionId, 'failed', error)
        await upsertRepairAlert(pool, plan.candidate, {
          type: 'enrollment_autopay_sync_failed',
          severity: 'critical',
          message: `Auto-payment setup did not complete for enrollment ${plan.candidate.signup_id}.`,
        })
        summary.failed.push({ accountId, signupId: Number(plan.candidate.signup_id), reason: 'stripe_subscription_not_created' })
        continue
      }
      await markSubscriptionSync(pool, plan.billingSubscriptionId, 'synced')
      await resolveRepairAlert(pool, plan.candidate.signup_id)
      await recordBillingActivityBestEffort(pool, {
        eventKey: `enrollment-autopay-enabled:${plan.candidate.signup_id}:${remote.stripeSubscriptionId}`,
        accountId,
        memberId: Number(plan.candidate.member_id),
        signupId: Number(plan.candidate.signup_id),
        eventType: 'enrollment_autopay_enabled',
        summary: 'Saved-card auto-payment enabled for enrollment',
        afterValue: {
          billingSubscriptionId: plan.billingSubscriptionId,
          stripeSubscriptionId: remote.stripeSubscriptionId,
          netCents: plan.price.netCents,
          nextBillDate: plan.nextBillDate,
        },
        stripeObjectId: remote.stripeSubscriptionId,
        actorType: 'system',
      })
      summary.stripeSubscriptionsCreated += 1
    }
  }

  return summary
}

export async function backfillLegacyEnrollmentPromo(pool, {
  accountId,
  signupIds,
  ruleId,
  reason,
  actorUserId = null,
} = {}) {
  const ids = [...new Set((signupIds ?? []).map(Number).filter(Number.isFinite))]
  if (!Number.isFinite(Number(accountId)) || ids.length === 0 || !Number.isFinite(Number(ruleId))) {
    throw new Error('Account, signup IDs, and discount rule are required for legacy promo backfill.')
  }
  const label = String(reason ?? '').trim()
  if (!label) throw new Error('A legacy promo reason is required.')

  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const rule = (
      await client.query(
        `SELECT * FROM discount_rule
         WHERE id = $1 AND active = TRUE AND type = 'promo_code'
         FOR SHARE`,
        [Number(ruleId)],
      )
    ).rows[0]
    if (!rule) throw new Error('The requested active promotional rule was not found.')
    if (rule.amount_type !== 'percent' || Number(rule.amount_value) <= 0) {
      throw new Error('Legacy enrollment promo backfill currently requires a percentage rule.')
    }
    const percent = Number(rule.amount_value) / 100
    const promoCode = promoCodeFromLegacyRule(rule)
    if (!promoCode) throw new Error('The legacy promotional rule does not have a promo code.')

    const rows = (
      await client.query(
        `SELECT signup.*, account.id AS account_id
         FROM scheduling_signup signup
         JOIN member ON member.id = signup.member_id
         JOIN family_billing_account account ON account.family_id = member.family_id
         WHERE signup.id = ANY($1::bigint[]) AND account.id = $2
         ORDER BY signup.id
         FOR UPDATE OF signup`,
        [ids, Number(accountId)],
      )
    ).rows
    if (rows.length !== ids.length) throw new Error('One or more promo-backfill enrollments do not belong to the account.')

    for (const row of rows) {
      const hasConflict =
        (row.manual_discount_rule_id != null && Number(row.manual_discount_rule_id) !== Number(ruleId)) ||
        (row.manual_discount_pct != null && Number(row.manual_discount_pct) !== percent) ||
        row.manual_discount_cents != null
      if (hasConflict) throw new Error(`Enrollment ${row.id} already has a different manual discount.`)
      await client.query(
        `UPDATE scheduling_signup
         SET manual_discount_cents = NULL,
             manual_discount_pct = $2,
             manual_discount_reason = $3,
             manual_discount_rule_id = $4
         WHERE id = $1`,
        [row.id, percent, label, Number(ruleId)],
      )
      await recordBillingActivityBestEffort(client, {
        eventKey: `legacy-enrollment-promo:${row.id}:${rule.id}`,
        accountId: Number(accountId),
        memberId: Number(row.member_id),
        signupId: Number(row.id),
        eventType: 'legacy_enrollment_discount_backfilled',
        summary: 'Original enrollment promotional discount restored',
        beforeValue: {
          manualDiscountCents: row.manual_discount_cents,
          manualDiscountPct: row.manual_discount_pct,
          manualDiscountRuleId: row.manual_discount_rule_id,
          manualDiscountReason: row.manual_discount_reason,
        },
        afterValue: {
          manualDiscountPct: percent,
          manualDiscountRuleId: Number(rule.id),
          manualDiscountReason: label,
          promoCode,
        },
        details: { source: 'customer_billing_repair', promoCode },
        actorUserId,
        actorType: actorUserId == null ? 'system' : 'admin',
      })
    }
    await client.query('COMMIT')
    return {
      accountId: Number(accountId),
      signupIds: ids,
      ruleId: Number(ruleId),
      promoCode,
      percent,
      reason: label,
    }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}

export async function ensureLegacyEnrollmentAdjustmentRecords(pool, {
  accountId,
  signupIds,
  ruleId,
  reason,
  actorUserId = null,
} = {}) {
  const ids = [...new Set((signupIds ?? []).map(Number).filter(Number.isFinite))]
  if (ids.length === 0) return { inserted: 0 }
  const label = String(reason ?? '').trim()
  if (!label) throw new Error('A legacy promo reason is required.')
  const client = await pool.connect()
  try {
    await client.query('BEGIN')
    const rule = (
      await client.query(`SELECT * FROM discount_rule WHERE id = $1`, [Number(ruleId)])
    ).rows[0]
    if (!rule) throw new Error('Legacy discount rule no longer exists.')
    const promoCode = promoCodeFromLegacyRule(rule)
    if (!promoCode) throw new Error('The legacy promotional rule does not have a promo code.')
    const rows = (
      await client.query(
        `SELECT signup.id, signup.member_id, signup.enrollment_start_date,
                subscription.id AS subscription_id,
                subscription.monthly_amount_cents
         FROM scheduling_signup signup
         JOIN member ON member.id = signup.member_id
         JOIN family_billing_account account ON account.family_id = member.family_id
         JOIN billing_subscription subscription
           ON subscription.source_type = 'scheduling_signup'
          AND subscription.source_id = signup.id::text
          AND subscription.status <> 'cancelled'
         WHERE account.id = $1 AND signup.id = ANY($2::bigint[])
         ORDER BY signup.id`,
        [Number(accountId), ids],
      )
    ).rows
    let inserted = 0
    let superseded = 0
    let firstAdjustmentId = null
    for (const row of rows) {
      const existing = (
        await client.query(
          `SELECT *
           FROM enrollment_price_adjustment
           WHERE signup_id = $1
             AND kind = 'legacy_discount'
             AND discount_rule_id = $2
             AND status <> 'revoked'
           ORDER BY created_at DESC, id DESC
           LIMIT 1
           FOR UPDATE`,
          [Number(row.id), Number(rule.id)],
        )
      ).rows[0] ?? null
      const attributionMatches =
        existing &&
        String(existing.promo_code ?? '').trim().toUpperCase() === promoCode &&
        String(existing.reason ?? '').trim() === label
      if (attributionMatches) continue

      if (existing) {
        await client.query(
          `UPDATE enrollment_price_adjustment
           SET status = 'revoked',
               revoked_by_user_id = $2,
               revoked_at = now(),
               revoke_reason = $3
           WHERE id = $1`,
          [
            Number(existing.id),
            actorUserId,
            `Promo attribution corrected to ${promoCode}`,
          ],
        )
        superseded += 1
      }

      const result = await client.query(
        `INSERT INTO enrollment_price_adjustment (
           family_billing_account_id, member_id, signup_id, billing_subscription_id,
           kind, promo_code, discount_rule_id, discount_rule_snapshot,
           effective_from_month, standard_price_cents,
           preview_snapshot, reason, status, created_by_user_id,
           supersedes_adjustment_id
         )
         VALUES (
           $1, $2, $3, $4, 'legacy_discount', $5, $6, $7::jsonb,
           date_trunc('month', $8::date)::date, $9,
           $10::jsonb, $11, 'active', $12, $13
         )
         RETURNING id`,
        [
          Number(accountId),
          Number(row.member_id),
          Number(row.id),
          Number(row.subscription_id),
          promoCode,
          Number(rule.id),
          JSON.stringify({
            id: Number(rule.id),
            name: rule.name,
            type: rule.type,
            amountType: rule.amount_type,
            amountValue: Number(rule.amount_value),
            applyTo: rule.apply_to,
            calcBase: rule.calc_base,
            config: rule.config ?? {},
          }),
          asDateOnly(row.enrollment_start_date) ?? toDateString(new Date()),
          Number(row.monthly_amount_cents),
          JSON.stringify({ source: 'legacy_enrollment_promo_backfill', promoCode }),
          label,
          actorUserId,
          existing == null ? null : Number(existing.id),
        ],
      )
      if (result.rows[0]) {
        inserted += 1
        firstAdjustmentId = firstAdjustmentId ?? Number(result.rows[0].id)
        if (existing) {
          await recordBillingActivityBestEffort(client, {
            eventKey: `legacy-promo-attribution-corrected:${existing.id}:${result.rows[0].id}`,
            accountId: Number(accountId),
            memberId: Number(row.member_id),
            signupId: Number(row.id),
            eventType: 'legacy_enrollment_promo_attribution_corrected',
            summary: `Legacy enrollment promo attributed to ${promoCode}`,
            beforeValue: {
              adjustmentId: Number(existing.id),
              promoCode: existing.promo_code ?? null,
              reason: existing.reason,
            },
            afterValue: {
              adjustmentId: Number(result.rows[0].id),
              promoCode,
              reason: label,
            },
            details: {
              source: 'customer_billing_repair',
              supersedesAdjustmentId: Number(existing.id),
            },
            actorUserId,
            actorType: actorUserId == null ? 'system' : 'admin',
          })
        }
      }
    }

    if (firstAdjustmentId != null) {
      const grossTotal = rows.reduce((total, row) => total + Number(row.monthly_amount_cents || 0), 0)
      const amountCents = Math.round(grossTotal * (Number(rule.amount_value) / 10000))
      const redemption = await client.query(
        `INSERT INTO discount_redemption (
           rule_id, member_id, signup_id, kind, units, amount_cents, price_adjustment_id
         )
         SELECT $1, $2, $3, 'discount', 0, $4, $5
         WHERE NOT EXISTS (
           SELECT 1 FROM discount_redemption
           WHERE rule_id = $1 AND signup_id = ANY($6::bigint[])
         )
         RETURNING id`,
        [
          Number(rule.id),
          Number(rows[0]?.member_id),
          Number(rows[0]?.id),
          amountCents,
          firstAdjustmentId,
          ids,
        ],
      )
      if (redemption.rows[0]) {
        await client.query(
          `UPDATE discount_rule SET redeemed_count = redeemed_count + 1, updated_at = now() WHERE id = $1`,
          [Number(rule.id)],
        )
      }
    }
    await client.query('COMMIT')
    return { inserted, superseded, promoCode }
  } catch (error) {
    await client.query('ROLLBACK')
    throw error
  } finally {
    client.release()
  }
}
