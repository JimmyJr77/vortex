import { recordBillingActivity } from '../billing/billingActivity.js'
/**
 * Billing side effects when an enrollment is paused or reactivated.
 *
 * 1. Paused enrollments do not count toward household discount tiers (handled by
 *    excluding paused signups from pricing/discount queries; this module resyncs
 *    subscription discount amounts for remaining active classes).
 * 2. Mid-month pauses earn a prorated credit on the following month's bill for
 *    unused class sessions while paused (same 4-class-month ratio as signup proration).
 */

import {
  todayDateOnly,
  monthBounds,
  firstOfNextMonth,
  remainingOccurrencesInMonth,
  CLASSES_PER_MONTH,
} from './firstMonthProration.js'
import { loadCalendarRowsForSlotGroups } from './freePassEngine.js'
import {
  safeSetSubscriptionPausedForSource,
  setSubscriptionPausedForSource,
} from './billingSubscriptions.js'
import { ensureBillingAccount } from './persistSignupCharges.js'
import { resolveFamilyEnrollmentPricing } from '../billing/familyEnrollmentPricing.js'
import { billingMonthKey } from '../billing/customerBillingPricing.js'
import { setStripeSubscriptionOperationalStatus } from '../billing/stripeSubscriptionSync.js'
import { guardLegacyRemoteSubscriptionMutation } from '../billing/remoteSubscriptionMutationGuard.js'

export async function ensurePauseCreditTable() {
  // Compatibility hook only. Migration 787 and process readiness own this
  // schema so an enrollment request or recurring worker cannot execute DDL.
}

async function signupBilledForMonth(pool, signup, monthStart, monthEnd) {
  const result = await pool.query(
    `SELECT COALESCE(SUM(amount_cents), 0)::int AS billed_cents
     FROM billing_charge
     WHERE family_billing_account_id = $1 AND member_id = $2
       AND (subscription_id = $3 OR (source_type = 'scheduling_signup' AND source_id = $4)
         OR (source_type = 'billing_subscription' AND split_part(source_id, ':', 1) = $3::text))
       AND COALESCE(service_period_start, created_at::date) BETWEEN $5::date AND $6::date
       AND source_type NOT IN ('pause_credit','pause_credit_reversal')`,
    [signup.family_billing_account_id, signup.member_id, signup.subscription_id, String(signup.id), monthStart, monthEnd],
  )
  return Math.max(0, Number(result.rows[0]?.billed_cents) || 0)
}

/**
 * Prorated credit for sessions not used after a mid-month pause.
 * @returns {{ creditCents:number, ratio:number, remainingClasses:number }}
 */
export function pauseCreditForLine(calendarRows, { slotGroupId, timeSlotId = null, pauseDate, netMonthlyCents }) {
  const remaining = remainingOccurrencesInMonth(calendarRows, {
    slotGroupId,
    timeSlotId,
    fromDate: pauseDate,
  })
  if (remaining <= 0) {
    return { creditCents: 0, ratio: 0, remainingClasses: 0 }
  }
  const ratio = Math.min(remaining, CLASSES_PER_MONTH) / CLASSES_PER_MONTH
  const net = Math.max(0, Math.round(Number(netMonthlyCents) || 0))
  return {
    creditCents: Math.round(net * ratio),
    ratio,
    remainingClasses: remaining,
  }
}

/** First day of the month after `asOf` (YYYY-MM-DD). */
export function nextMonthPauseEffectiveDate(asOf = new Date()) {
  return firstOfNextMonth(todayDateOnly(asOf))
}

/** Schedule pause at start of next month; enrollment stays active until then. */
export async function schedulePauseNextMonth(client, signupId, asOf = new Date()) {
  const effectiveDate = nextMonthPauseEffectiveDate(asOf)
  const res = await client.query(
    `
    UPDATE scheduling_signup
    SET pause_effective_date = $2, pause_mode = 'next_month'
    WHERE id = $1
    RETURNING *
    `,
    [signupId, effectiveDate],
  )
  return res.rows[0]
}

/** Pause immediately with prorated billing credit. */
export async function applyImmediatePause(client, signupId, asOfDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date())) {
  const { updateSignupLifecycleStatus } = await import('./enrollmentLifecycle.js')
  await updateSignupLifecycleStatus(client, signupId, 'paused')
  const res = await client.query(
    `
    UPDATE scheduling_signup
    SET pause_mode = 'prorated', pause_effective_date = $2::date, paused_at = $2::date
    WHERE id = $1
    RETURNING *
    `,
    [signupId, asOfDate],
  )
  return res.rows[0]
}

/** Clear a scheduled pause without changing enrollment status. */
export async function clearScheduledPause(client, signupId) {
  const res = await client.query(
    `
    UPDATE scheduling_signup
    SET pause_effective_date = NULL, pause_mode = NULL
    WHERE id = $1
    RETURNING *
    `,
    [signupId],
  )
  return res.rows[0]
}

async function loadSignupBillingContext(pool, signupId) {
  const res = await pool.query(
    `
    SELECT s.id, s.member_id, s.slot_group_id, s.time_slot_id, s.paused_at, s.pause_effective_date, s.enrollment_start_date,
           GREATEST(s.enrollment_start_date, (SELECT MAX(effective_date) FROM enrollment_action WHERE signup_id=s.id AND requested_status='confirmed' AND status='applied')) AS billing_start_date,
           m.family_id,
           bs.id AS subscription_id, bs.family_billing_account_id, bs.stripe_subscription_id,
           bs.net_monthly_cents,
           bs.monthly_amount_cents,
           bs.discount_amount_cents,
           bs.status AS subscription_status
    FROM scheduling_signup s
    JOIN member m ON m.id = s.member_id
    LEFT JOIN billing_subscription bs
      ON bs.source_type = 'scheduling_signup'
     AND bs.source_id = s.id::text
     AND bs.status <> 'cancelled'
    WHERE s.id = $1
    ORDER BY bs.id DESC NULLS LAST
    LIMIT 1
    `,
    [signupId],
  )
  return res.rows[0] ?? null
}

export async function recordPauseCredit(pool, signup) {
  if (!signup?.slot_group_id || !signup.family_id) return null

  const pauseDate = signup.pause_effective_date
    ? (signup.pause_effective_date instanceof Date ? todayDateOnly(signup.pause_effective_date) : String(signup.pause_effective_date).slice(0, 10))
    : signup.paused_at
    ? todayDateOnly(signup.paused_at instanceof Date ? signup.paused_at : new Date(signup.paused_at))
    : todayDateOnly()

  const { monthStart, monthEnd } = monthBounds(pauseDate)
  const rowsByGroup = await loadCalendarRowsForSlotGroups(pool, [Number(signup.slot_group_id)])
  const calendarRows = [...rowsByGroup.values()].flat()
  const { remainingClasses } = pauseCreditForLine(calendarRows, {
    slotGroupId: Number(signup.slot_group_id),
    timeSlotId: signup.time_slot_id != null ? Number(signup.time_slot_id) : null,
    pauseDate,
    netMonthlyCents: 0,
  })

  // Credit only this enrollment's billed tuition, never another family's charge or an unbilled month.
  const billedCents = await signupBilledForMonth(pool, signup, monthStart, monthEnd)
  const start = signup.billing_start_date ?? signup.enrollment_start_date
  const startDate = start instanceof Date ? todayDateOnly(start) : String(start ?? monthStart).slice(0, 10)
  const paidClasses = Math.min(CLASSES_PER_MONTH, remainingOccurrencesInMonth(calendarRows, {
    slotGroupId: Number(signup.slot_group_id), timeSlotId: signup.time_slot_id == null ? null : Number(signup.time_slot_id),
    fromDate: startDate > monthStart && startDate <= monthEnd ? startDate : monthStart,
  }))
  const remainingCreditCents = paidClasses > 0 ? Math.round(billedCents * Math.min(1, remainingClasses / paidClasses)) : 0
  const priorCredits = await pool.query(
    `SELECT COALESCE(SUM(credit_cents - revoked_cents), 0)::int AS cents FROM billing_pause_credit
     WHERE scheduling_signup_id = $1 AND service_month = $2 AND pause_date <> $3::date
       AND credit_kind IN ('pause', 'prorated_pause')`,
    [signup.id, pauseDate.slice(0, 7), pauseDate],
  )
  const creditCents = Math.min(remainingCreditCents, Math.max(0, billedCents - Number(priorCredits.rows[0]?.cents ?? 0)))
  if (creditCents <= 0) return null
  const account = signup.family_billing_account_id ? { id: signup.family_billing_account_id } : await ensureBillingAccount(pool, Number(signup.family_id))
  if (!account) throw new Error('A billing account is required to record the pause credit.')

  const serviceMonth = pauseDate.slice(0, 7)
  const applyOnMonth = firstOfNextMonth(pauseDate).slice(0, 7)

  const ins = await pool.query(
    `
    INSERT INTO billing_pause_credit (
      scheduling_signup_id, family_billing_account_id, member_id,
      credit_cents, pause_date, service_month, apply_on_month, remaining_classes
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    ON CONFLICT (scheduling_signup_id, pause_date) DO UPDATE
      SET credit_cents = EXCLUDED.credit_cents,
          remaining_classes = EXCLUDED.remaining_classes,
          apply_on_month = EXCLUDED.apply_on_month, revoked_cents = 0
    WHERE billing_pause_credit.applied_at IS NULL
    RETURNING id, credit_cents
    `,
    [
      signup.id,
      account.id,
      signup.member_id,
      creditCents,
      pauseDate,
      serviceMonth,
      applyOnMonth,
      remainingClasses,
    ],
  )
  return ins.rows[0] ?? null
}

/**
 * Recompute household discount tiers and push updated discount/net onto active subscriptions.
 */
export async function syncFamilyEnrollmentDiscounts(pool, familyId, {
  strict = false,
  periodKey = null,
  syncStripe = true,
} = {}) {
  if (!familyId) return { updated: 0 }

  let accountLines = []
  try {
    const pricing = await resolveFamilyEnrollmentPricing(pool, {
      familyId: Number(familyId),
      periodKey: periodKey ?? billingMonthKey(new Date()),
      strictPricing: strict,
      ensureSchema: false,
    })
    accountLines = pricing.lines ?? []
  } catch (err) {
    if (strict) throw err
    console.warn('[pauseBilling] discount recompute failed:', err?.message ?? err)
    return { updated: 0 }
  }

  // Open-ended free promo grants ("free for program duration") live on the signup's
  // pricing_breakdown snapshot, not in this promo-less recompute — preserve their $0
  // subscription instead of resetting it to the recomputed family net.
  const openEndedFreeSignupIds = new Set()
  try {
    const signupIds = accountLines
      .map((l) => Number(l.signupId))
      .filter((n) => Number.isFinite(n))
    if (signupIds.length > 0) {
      const bdRes = await pool.query(
        `SELECT id, pricing_breakdown FROM scheduling_signup WHERE id = ANY($1::bigint[])`,
        [signupIds],
      )
      for (const row of bdRes.rows) {
        const applied = row.pricing_breakdown?.line?.applied
        if (
          Array.isArray(applied) &&
          applied.some(
            (a) => a?.kind === 'free' && a?.freeDurationMonths == null && a?.freeDurationWeeks == null,
          )
        ) {
          openEndedFreeSignupIds.add(Number(row.id))
        }
      }
    }
  } catch (err) {
    if (strict) throw err
    console.warn('[pauseBilling] free-promo snapshot check:', err?.message ?? err)
  }

  let updated = 0
  for (const line of accountLines) {
    if (line.signupId == null) continue
    const gross = Math.max(
      0,
      Math.round(line.grossCents ?? line.baseCents ?? line.listCents ?? 0),
    )
    const isOpenEndedFree = openEndedFreeSignupIds.has(Number(line.signupId))
    const net = isOpenEndedFree
      ? 0
      : Math.max(0, Math.round(line.netCents ?? line.finalCents ?? gross))
    const discount = Math.max(0, gross - net)
    try {
      const res = await pool.query(
        `
        UPDATE billing_subscription
        SET monthly_amount_cents = $2,
            discount_amount_cents = $3,
            net_monthly_cents = $4,
            updated_at = now()
        WHERE source_type = 'scheduling_signup'
          AND source_id = $1
          AND status = 'active'
          AND family_billing_account_id IN (
            SELECT id FROM family_billing_account WHERE family_id = $5
          )
        RETURNING id
        `,
        [String(line.signupId), gross, discount, net, Number(familyId)],
      )
      if (res.rows.length > 0) updated += 1
      else if (strict) {
        const error = new Error(`Enrollment ${line.signupId} changed during strict discount synchronization.`)
        error.code = 'recurring_discount_sync_cas_failed'
        throw error
      }
    } catch (err) {
      if (strict) throw err
      console.warn('[pauseBilling] subscription update', line.signupId, err?.message ?? err)
    }
  }

  // Live household changes also affect already-posted, uncollected tuition.
  // Scheduled recurring runs supply their own period and retain their posting workflow.
  if (periodKey == null) {
    const { reconcileCurrentEnrollmentCharges } = await import('../billing/currentEnrollmentChargePricing.js')
    await reconcileCurrentEnrollmentCharges(pool, { familyId: Number(familyId) })
    const { reconcileUpcomingProvisionalChargesForAccount } = await import('../billing/canonicalRecurringChargePosting.js')
    const accounts = (await pool.query('SELECT id FROM family_billing_account WHERE family_id=$1 AND is_active=TRUE', [familyId])).rows
    for (const account of accounts) await reconcileUpcomingProvisionalChargesForAccount(pool, { accountId: Number(account.id) })
  }

  // Keep Stripe Prices aligned with household net amounts (e.g. 3-class / $450 → 20%).
  let stripeSync = { updated: 0 }
  try {
    if (!syncStripe) return { updated, stripeUpdated: 0 }
    const { syncFamilyStripeSubscriptionAmounts } = await import('../billing/stripeSubscriptionSync.js')
    stripeSync = await syncFamilyStripeSubscriptionAmounts(pool, Number(familyId))
    if (
      strict &&
      (stripeSync.reason || (stripeSync.results ?? []).some((result) => !['updated', 'unchanged'].includes(result.status)))
    ) {
      const error = new Error('Legacy Stripe subscription pricing did not synchronize exactly.')
      error.code = 'legacy_stripe_discount_sync_failed'
      error.details = stripeSync
      throw error
    }
  } catch (err) {
    if (strict) throw err
    console.warn('[pauseBilling] stripe amount sync:', err?.message ?? err)
  }

  return { updated, stripeUpdated: stripeSync.updated ?? 0 }
}

/**
 * Post pending pause credits whose apply_on_month matches the billing period starting `periodStart`.
 * @returns {Promise<number>} credits posted
 */
export async function applyPendingPauseCredits(pool, {
  periodStart,
  facilityId = null,
  accountId = null,
  strict = false,
}) {
  if (
    strict &&
    (accountId == null || facilityId == null || !/^\d{4}-\d{2}-\d{2}$/.test(String(periodStart ?? '')))
  ) {
    const error = new Error('Strict pause-credit posting requires an account, facility, and civil period date.')
    error.code = 'strict_pause_credit_scope_required'
    throw error
  }
  const applyOnMonth = String(periodStart).slice(0, 7)
  let pending
  try {
    await ensurePauseCreditTable(pool)
    pending = await pool.query(
      `
      SELECT pc.*, (pc.credit_cents - COALESCE((to_jsonb(pc)->>'revoked_cents')::int,0)) AS credit_cents, sf.title AS form_title
      FROM billing_pause_credit pc
      JOIN scheduling_signup s ON s.id = pc.scheduling_signup_id
      JOIN scheduling_form sf ON sf.id = s.form_id
      JOIN family_billing_account account ON account.id = pc.family_billing_account_id
      JOIN family ON family.id = account.family_id
      WHERE pc.applied_at IS NULL AND pc.credit_cents > COALESCE((to_jsonb(pc)->>'revoked_cents')::int,0)
        AND pc.apply_on_month <= $1
        AND ($2::bigint IS NULL OR family.facility_id = $2)
        AND ($3::bigint IS NULL OR pc.family_billing_account_id = $3)
      ORDER BY pc.id
      `,
      [applyOnMonth, facilityId, accountId],
    )
  } catch (err) {
    if (strict) throw err
    console.warn('[pauseBilling] load pending credits:', err?.message ?? err)
    return 0
  }

  let posted = 0
  for (const row of pending.rows) {
    const pauseDate = row.pause_date instanceof Date ? todayDateOnly(row.pause_date) : String(row.pause_date).slice(0, 10)
    const sourceId = `pause:${row.scheduling_signup_id}:${pauseDate}`
    // Earlier releases embedded the driver's Date string in this key. Reuse
    // either spelling after an interrupted posting instead of issuing a second credit.
    const compatibleSourceIds = [...new Set([sourceId, `pause:${row.scheduling_signup_id}:${row.pause_date}`])]
    const description =
      row.credit_kind === 'prepaid_first_month'
        ? `First month prepayment credit — ${row.form_title || 'Class'}`
        : `Pause credit — ${row.form_title || 'Class'} (${row.service_month}, ${row.remaining_classes ?? '?'} unused sessions)`
    try {
      const ins = await pool.query(
        `
        INSERT INTO billing_charge
          (family_billing_account_id, member_id, source_type, source_id, description,
           amount_cents, gross_amount_cents, discount_amount_cents,
           charge_type, billing_interval)
        SELECT $1, $2, 'pause_credit', $3, $4, $5, $5, 0, 'credit', 'one_time'
        WHERE NOT EXISTS (SELECT 1 FROM billing_charge WHERE source_type='pause_credit' AND source_id=ANY($6::text[]))
        ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
        DO NOTHING
        RETURNING id
        `,
        [
          row.family_billing_account_id,
          row.member_id,
          sourceId,
          description,
          -Math.abs(Number(row.credit_cents)),
          compatibleSourceIds,
        ],
      )
      let chargeExists = ins.rows.length > 0
      if (!chargeExists) {
        const existing = await pool.query(
          `SELECT id, family_billing_account_id, member_id, amount_cents,
                  charge_type, billing_interval
             FROM billing_charge
            WHERE source_type = 'pause_credit' AND source_id = ANY($1::text[])
            LIMIT 1`,
          [compatibleSourceIds],
        )
        const prior = existing.rows[0] ?? null
        chargeExists = Boolean(prior) &&
          Number(prior.family_billing_account_id) === Number(row.family_billing_account_id) &&
          (prior.member_id == null ? null : Number(prior.member_id)) ===
            (row.member_id == null ? null : Number(row.member_id)) &&
          Number(prior.amount_cents) === -Math.abs(Number(row.credit_cents)) &&
          prior.charge_type === 'credit' &&
          prior.billing_interval === 'one_time'
        if (prior && !chargeExists) {
          const error = new Error(`Pause credit ${row.id} conflicts with billing charge ${prior.id}.`)
          error.code = 'pause_credit_idempotency_mismatch'
          throw error
        }
      }
      if (!chargeExists) {
        throw new Error(`Pause credit ${row.id} was not posted idempotently.`)
      }
      await pool.query(`UPDATE billing_pause_credit SET applied_at = now() WHERE id = $1`, [row.id])
      if (ins.rows.length > 0) posted += 1
    } catch (err) {
      if (strict) throw err
      console.warn('[pauseBilling] post credit', row.id, err?.message ?? err)
    }
  }
  if (strict) {
    const remaining = await pool.query(
      `SELECT pc.id
         FROM billing_pause_credit pc
         JOIN family_billing_account account ON account.id = pc.family_billing_account_id
         JOIN family ON family.id = account.family_id
        WHERE pc.applied_at IS NULL AND pc.credit_cents > COALESCE((to_jsonb(pc)->>'revoked_cents')::int,0)
          AND pc.apply_on_month <= $1
          AND ($2::bigint IS NULL OR family.facility_id = $2)
          AND ($3::bigint IS NULL OR pc.family_billing_account_id = $3)
        ORDER BY pc.id
        LIMIT 1`,
      [applyOnMonth, facilityId, accountId],
    )
    if (remaining.rows[0]) {
      const error = new Error(`Pause credit ${remaining.rows[0].id} remains unapplied for ${applyOnMonth}.`)
      error.code = 'pause_credit_postcondition_failed'
      throw error
    }
  }
  return posted
}

/**
 * Pending debits/credits that carry forward to a future billing period (e.g. mid-month
 * pause proration credits). Shown at checkout so families see what will hit next month.
 */
function carriedForwardTotals(items) {
  let creditsCents = 0
  let debitsCents = 0
  for (const item of items) {
    const cents = Math.round(Number(item.amountCents) || 0)
    if (cents < 0) creditsCents += Math.abs(cents)
    else if (cents > 0) debitsCents += cents
  }
  return {
    creditsCents,
    debitsCents,
    totalCents: debitsCents - creditsCents,
  }
}

function formatApplyMonthLabel(applyOnMonth) {
  if (!applyOnMonth) return 'next billing cycle'
  return new Date(`${applyOnMonth}-01T12:00:00`).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

/** Checkout preview: show prepaid first-month tuition as a credit on the first bill. */
export function mergeFirstMonthPrepaidIntoCarriedForward(carriedForward, firstMonth) {
  const base = carriedForward ?? {
    enabled: true,
    items: [],
    creditsCents: 0,
    debitsCents: 0,
    totalCents: 0,
  }
  if (!firstMonth?.enabled || !firstMonth.items?.length) return base

  const prepaidItems = []
  for (const fm of firstMonth.items) {
    const prepaid = Math.round(Number(fm.prepaidFirstMonthCents) || 0)
    if (prepaid <= 0) continue
    const applyOnMonth = fm.firstBillDate?.slice(0, 7) ?? null
    prepaidItems.push({
      key: `prepaid-preview-${fm.slotKey}`,
      kind: 'prepaid_first_month',
      label: `First month credit — ${fm.displayLine ?? fm.formTitle ?? 'Class'}`,
      detail: `Applies ${formatApplyMonthLabel(applyOnMonth)}`,
      amountCents: -prepaid,
      applyOnMonth,
    })
  }
  if (!prepaidItems.length) return base
  const items = [...base.items, ...prepaidItems]
  return { enabled: true, items, ...carriedForwardTotals(items) }
}

export async function recordPrepaidFirstMonthCredit(
  pool,
  { signupId, memberId, familyBillingAccountId, firstMonthItem, signupDate = null },
) {
  const prepaid = Math.round(Number(firstMonthItem?.prepaidFirstMonthCents) || 0)
  if (!signupId || !familyBillingAccountId || prepaid <= 0) return null

  const bookedDate = signupDate ?? todayDateOnly()
  const serviceMonth =
    firstMonthItem.firstServicePeriodStart?.slice(0, 7) ??
    firstMonthItem.firstBillDate?.slice(0, 7) ??
    bookedDate.slice(0, 7)
  const applyOnMonth = firstMonthItem.firstBillDate?.slice(0, 7) ?? firstOfNextMonth(bookedDate).slice(0, 7)

  try {
    await ensurePauseCreditTable(pool)
  } catch (err) {
    console.warn('[pauseBilling] ensurePauseCreditTable:', err?.message ?? err)
    return null
  }

  const ins = await pool.query(
    `
    INSERT INTO billing_pause_credit (
      scheduling_signup_id, family_billing_account_id, member_id,
      credit_cents, pause_date, service_month, apply_on_month, remaining_classes, credit_kind
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, NULL, 'prepaid_first_month')
    ON CONFLICT (scheduling_signup_id, pause_date) DO UPDATE
      SET credit_cents = EXCLUDED.credit_cents,
          service_month = EXCLUDED.service_month,
          apply_on_month = EXCLUDED.apply_on_month,
          credit_kind = EXCLUDED.credit_kind
    WHERE billing_pause_credit.applied_at IS NULL
    RETURNING id, credit_cents
    `,
    [signupId, familyBillingAccountId, memberId ?? null, prepaid, bookedDate, serviceMonth, applyOnMonth],
  )
  return ins.rows[0] ?? null
}

export async function computeCarriedForwardLayer(pool, { memberId, asOfDate = null }) {
  const empty = { enabled: true, items: [], creditsCents: 0, debitsCents: 0, totalCents: 0 }
  if (memberId == null) return empty

  const famRes = await pool.query(`SELECT family_id FROM member WHERE id = $1`, [memberId])
  const familyId = famRes.rows[0]?.family_id
  if (familyId == null) return empty

  const fromMonth = (asOfDate ?? todayDateOnly()).slice(0, 7)
  const items = []

  try {
    await ensurePauseCreditTable(pool)
    const credits = await pool.query(
      `
      SELECT pc.scheduling_signup_id, (pc.credit_cents - COALESCE((to_jsonb(pc)->>'revoked_cents')::int,0)) AS credit_cents, pc.pause_date, pc.apply_on_month,
             pc.remaining_classes, pc.credit_kind,
             sf.title AS class_name,
             m.first_name, m.last_name
      FROM billing_pause_credit pc
      JOIN scheduling_signup s ON s.id = pc.scheduling_signup_id
      JOIN scheduling_form sf ON sf.id = s.form_id
      LEFT JOIN member m ON m.id = pc.member_id
      WHERE pc.applied_at IS NULL AND pc.credit_cents > COALESCE((to_jsonb(pc)->>'revoked_cents')::int,0)
        AND pc.apply_on_month >= $2
        AND pc.family_billing_account_id IN (
          SELECT id FROM family_billing_account WHERE family_id = $1
        )
      ORDER BY pc.apply_on_month, pc.id
      `,
      [familyId, fromMonth],
    )
    for (const row of credits.rows) {
      const memberName = `${row.first_name || ''} ${row.last_name || ''}`.trim()
      const creditCents = Math.abs(Number(row.credit_cents) || 0)
      if (creditCents <= 0) continue
      const applyLabel = formatApplyMonthLabel(row.apply_on_month)
      const isPrepaid = row.credit_kind === 'prepaid_first_month'
      items.push({
        key: isPrepaid
          ? `prepaid-${row.scheduling_signup_id}-${row.pause_date}`
          : `pause-${row.scheduling_signup_id}-${row.pause_date}`,
        kind: isPrepaid ? 'prepaid_first_month' : 'pause_credit',
        label: isPrepaid
          ? `First month credit — ${row.class_name || 'Class'}`
          : `Pause credit — ${row.class_name || 'Class'}`,
        detail: [
          memberName || null,
          !isPrepaid && row.remaining_classes != null
            ? `${row.remaining_classes} unused session${row.remaining_classes === 1 ? '' : 's'}`
            : null,
          `Applies ${applyLabel}`,
        ]
          .filter(Boolean)
          .join(' · '),
        amountCents: -creditCents,
        applyOnMonth: row.apply_on_month,
      })
    }
  } catch (err) {
    console.warn('[pauseBilling] carried forward preview:', err?.message ?? err)
  }

  return { enabled: true, items, ...carriedForwardTotals(items) }
}

/** Reconcile a resumed student's pending or posted credit without deleting any history. */
export async function reconcilePauseCreditsOnResume(db, signup, resumeDate) {
  const credits = (await db.query(`SELECT * FROM billing_pause_credit WHERE scheduling_signup_id=$1
    AND credit_kind IN ('pause','prorated_pause') AND service_month >= $2 ORDER BY id FOR UPDATE`,
  [signup.id, resumeDate.slice(0, 7)])).rows
  const rowsByGroup = await loadCalendarRowsForSlotGroups(db, [Number(signup.slot_group_id)])
  const calendarRows = [...rowsByGroup.values()].flat()
  for (const credit of credits) {
    const remaining = credit.service_month > resumeDate.slice(0, 7) ? Number(credit.remaining_classes) : remainingOccurrencesInMonth(calendarRows, {
      slotGroupId: Number(signup.slot_group_id), timeSlotId: signup.time_slot_id == null ? null : Number(signup.time_slot_id), fromDate: resumeDate,
    })
    const originalClasses = Math.min(CLASSES_PER_MONTH, Number(credit.remaining_classes))
    const missed = Math.min(originalClasses, Math.max(0, Number(credit.remaining_classes) - remaining))
    const retainedCents = originalClasses > 0 ? Math.round(Number(credit.credit_cents) * missed / originalClasses) : 0
    const revokedCents = Math.max(Number(credit.revoked_cents ?? 0), Number(credit.credit_cents) - retainedCents)
    const difference = revokedCents - Number(credit.revoked_cents ?? 0)
    if (difference <= 0) continue
    if (credit.applied_at) await db.query(`INSERT INTO billing_charge
      (family_billing_account_id,member_id,source_type,source_id,description,amount_cents,gross_amount_cents,discount_amount_cents,charge_type,billing_interval,service_period_start,service_period_end)
      VALUES($1,$2,'pause_credit_reversal',$3,'Pause credit adjusted after reactivation',$4,$4,0,'adjustment','one_time',$5::date,($5::date+interval '1 month - 1 day')::date)
      ON CONFLICT (source_type,source_id) WHERE source_id IS NOT NULL DO NOTHING`,
      [credit.family_billing_account_id,credit.member_id,`${credit.id}:${resumeDate}`,difference,`${credit.apply_on_month}-01`])
    await db.query('UPDATE billing_pause_credit SET revoked_cents=$2 WHERE id=$1', [credit.id,revokedCents])
    await recordBillingActivity(db, { eventKey: `pause-credit-resume:${credit.id}:${resumeDate}`, accountId: Number(credit.family_billing_account_id),
      memberId: Number(signup.member_id), signupId: Number(signup.id), actorType: 'system', eventType: 'pause_credit_adjusted',
      summary: `Pause credit adjusted for reactivation on ${resumeDate}.`, beforeValue: { creditCents: Number(credit.credit_cents) - Number(credit.revoked_cents ?? 0) },
      afterValue: { creditCents: Number(credit.credit_cents) - revokedCents }, details: { effectiveDate: resumeDate, pauseCreditId: Number(credit.id) } })
  }
}

async function prepareResumeBilling(db, signup, resumeDate) {
  await reconcilePauseCreditsOnResume(db, signup, resumeDate)
  const { monthStart,monthEnd } = monthBounds(resumeDate)
  if (!signup.subscription_id) return
  const monthAlreadyBilled = await signupBilledForMonth(db,signup,monthStart,monthEnd) > 0
  // Pausing can void an upcoming bill after its cursor advanced. Rewind to the
  // resumed period (or its next month when already billed); canonical period
  // keys reuse existing bills and prevent duplicate collection.
  await db.query('UPDATE billing_subscription SET next_bill_date=$2::date,updated_at=now() WHERE id=$1',
    [signup.subscription_id,monthAlreadyBilled ? firstOfNextMonth(resumeDate) : monthStart])
  if (monthAlreadyBilled) return
  const pricing = await resolveFamilyEnrollmentPricing(db,{familyId:Number(signup.family_id),periodKey:resumeDate.slice(0,7),strictPricing:true,ensureSchema:false})
  const line = pricing.lines.find(item => Number(item.signupId) === Number(signup.id))
  if (!line) throw new Error('Reactivation tuition could not be priced.')
  const calendars = await loadCalendarRowsForSlotGroups(db,[Number(signup.slot_group_id)])
  const remaining = pauseCreditForLine([...calendars.values()].flat(),{slotGroupId:Number(signup.slot_group_id),timeSlotId:Number(signup.time_slot_id)||null,pauseDate:resumeDate,netMonthlyCents:line.netCents})
  const credit = Math.max(0,Number(line.netCents)-remaining.creditCents)
  if (credit > 0) await db.query(`INSERT INTO billing_charge
    (family_billing_account_id,member_id,subscription_id,source_type,source_id,description,amount_cents,gross_amount_cents,discount_amount_cents,charge_type,billing_interval,service_period_start,service_period_end)
    VALUES($1,$2,$3,'enrollment_resume_credit',$4,'Proration for weeks before reactivation',$5,$5,0,'credit','one_time',$6::date,$7::date)
    ON CONFLICT (source_type,source_id) WHERE source_id IS NOT NULL DO NOTHING`,
    [signup.family_billing_account_id,signup.member_id,signup.subscription_id,`resume:${signup.id}:${resumeDate}`,-credit,monthStart,monthEnd])
}

/** Persist subscription state and the promised carry-forward credit in the caller's transaction. */
export async function persistEnrollmentPauseBilling(db, { signupId, enteringPaused, leavingPaused, effectiveDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()), asOfDate = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/New_York' }).format(new Date()), stripeStatusUpdater = setStripeSubscriptionOperationalStatus }) {
  const signup = await loadSignupBillingContext(db, signupId)
  if (!signup) throw new Error('Enrollment billing context could not be loaded.')
  if (enteringPaused) {
    const today = asOfDate
    let date = signup.pause_effective_date instanceof Date ? todayDateOnly(signup.pause_effective_date) : String(signup.pause_effective_date ?? effectiveDate).slice(0,10)
    while (date <= today) {
      await recordPauseCredit(db, { ...signup, pause_effective_date: date })
      date = firstOfNextMonth(date)
    }
  }
  if (enteringPaused || leavingPaused) {
    await setSubscriptionPausedForSource(db, { sourceType: 'scheduling_signup', sourceId: signupId, paused: enteringPaused })
    if (leavingPaused && signup.subscription_id) await prepareResumeBilling(db, signup, effectiveDate)
    if (signup.stripe_subscription_id) {
      const status = enteringPaused ? 'paused' : 'active'
      const guard = await guardLegacyRemoteSubscriptionMutation(db, {
        accountId: signup.family_billing_account_id,
        stripeSubscriptionId: signup.stripe_subscription_id,
        operation: `enrollment_${status}`,
      })
      if (guard.allowed) {
        const outcome = await stripeStatusUpdater(signup.stripe_subscription_id, status)
        if (outcome?.status !== status) throw new Error('Enrollment billing could not be synchronized. Please retry the action.')
      }
    }
  }
  return signup
}

/**
 * Run after signup status commit when entering or leaving paused.
 * @param {'prorated'|'next_month'} [pauseMode] — prorated pauses now with mid-month credit; next_month skips credit.
 */
export async function handleEnrollmentPauseBilling(pool, { signupId, enteringPaused, leavingPaused, pauseMode = 'prorated', persisted = false }) {
  const signup = await loadSignupBillingContext(pool, signupId)
  if (!signup) return

  if (enteringPaused && !persisted) {
    await safeSetSubscriptionPausedForSource(pool, {
      sourceType: 'scheduling_signup',
      sourceId: signupId,
      paused: true,
    })
    if (pauseMode === 'prorated') {
      await recordPauseCredit(pool, signup)
    }
  } else if (leavingPaused && !persisted) {
    await safeSetSubscriptionPausedForSource(pool, {
      sourceType: 'scheduling_signup',
      sourceId: signupId,
      paused: false,
    })
  }

  if (signup.family_id && (enteringPaused || leavingPaused)) {
    await syncFamilyEnrollmentDiscounts(pool, Number(signup.family_id))
  }
}

/**
 * Activate enrollments whose pause_effective_date has arrived (start-of-month pauses).
 * @returns {Promise<number>} count activated
 */
export async function applyScheduledPauses(pool, {
  asOf = new Date(),
  asOfDate = null,
  strict = false,
  accountId = null,
  facilityId = null,
  stripeStatusUpdater = setStripeSubscriptionOperationalStatus,
} = {}) {
  if (
    strict &&
    (accountId == null || facilityId == null || !/^\d{4}-\d{2}-\d{2}$/.test(String(asOfDate ?? '')))
  ) {
    const error = new Error('Strict scheduled-pause processing requires an account, facility, and civil as-of date.')
    error.code = 'strict_scheduled_pause_scope_required'
    throw error
  }
  const today = asOfDate ?? todayDateOnly(asOf)
  const scoped = accountId != null || facilityId != null
  let due
  try {
    due = await pool.query(
      `
      SELECT DISTINCT signup.id, signup.pause_effective_date, signup.pause_mode,
             family.id AS family_id
      FROM scheduling_signup signup
      ${scoped ? `JOIN billing_subscription subscription
        ON subscription.source_type = 'scheduling_signup'
       AND subscription.source_id = signup.id::text
       AND subscription.status <> 'cancelled'
      JOIN family_billing_account account
        ON account.id = subscription.family_billing_account_id
      JOIN family ON family.id = account.family_id` : 'LEFT JOIN member ON member.id = signup.member_id LEFT JOIN family ON family.id = member.family_id'}
      WHERE signup.pause_effective_date IS NOT NULL
        AND signup.pause_effective_date <= $1
        AND signup.status IN ('confirmed', 'waitlisted')
        AND signup.orphaned_at IS NULL
        ${scoped ? 'AND ($2::bigint IS NULL OR account.id = $2) AND ($3::bigint IS NULL OR family.facility_id = $3)' : ''}
      ORDER BY signup.id
      `,
      scoped ? [today, accountId, facilityId] : [today],
    )
  } catch (err) {
    if (strict) throw err
    console.warn('[pauseBilling] applyScheduledPauses query:', err?.message ?? err)
    return 0
  }

  let applied = 0
  for (const row of due.rows) {
    const signupId = Number(row.id)
    const mode = row.pause_mode === 'prorated' ? 'prorated' : 'next_month'
    const ownsClient = typeof pool.release !== 'function' && typeof pool.connect === 'function'
    const client = ownsClient ? await pool.connect() : pool
    try {
      if (strict) {
        const remoteSubscriptions = await client.query(
          `SELECT stripe_subscription_id
             FROM billing_subscription
            WHERE family_billing_account_id = $1
              AND source_type = 'scheduling_signup'
              AND source_id = $2
              AND status <> 'cancelled'
              AND stripe_subscription_id IS NOT NULL
            ORDER BY id`,
          [Number(accountId), String(signupId)],
        )
        for (const subscription of remoteSubscriptions.rows) {
          const outcome = await stripeStatusUpdater(subscription.stripe_subscription_id, 'paused')
          if (outcome?.status !== 'paused') {
            const error = new Error(`Stripe subscription ${subscription.stripe_subscription_id} could not be paused for enrollment ${signupId}.`)
            error.code = 'enrollment_pause_stripe_sync_failed'
            error.details = outcome
            throw error
          }
        }
      }
      await client.query('BEGIN')
      if (strict) {
        const locked = await client.query(
          `SELECT id
             FROM scheduling_signup
            WHERE id = $1
              AND pause_effective_date IS NOT NULL
              AND pause_effective_date <= $2::date
              AND status IN ('confirmed', 'waitlisted')
              AND orphaned_at IS NULL
            FOR UPDATE`,
          [signupId, today],
        )
        if (!locked.rows[0]) {
          await client.query('COMMIT')
          continue
        }
        const lockedSubscriptions = await client.query(
          `SELECT id
             FROM billing_subscription
            WHERE family_billing_account_id = $1
              AND source_type = 'scheduling_signup'
              AND source_id = $2
              AND status <> 'cancelled'
            ORDER BY id
            FOR UPDATE`,
          [Number(accountId), String(signupId)],
        )
        if (lockedSubscriptions.rows.length === 0) {
          const error = new Error(`Enrollment ${signupId} lost its billing subscription before its pause.`)
          error.code = 'enrollment_pause_subscription_missing'
          throw error
        }
      }
      const { updateSignupLifecycleStatus } = await import('./enrollmentLifecycle.js')
      const signupStatus = await updateSignupLifecycleStatus(client, signupId, 'paused')
      if (strict && !signupStatus.rows[0]) {
        const error = new Error(`Enrollment ${signupId} changed while its pause was being applied.`)
        error.code = 'enrollment_pause_cas_failed'
        throw error
      }
      const cleared = await client.query(
        `
        UPDATE scheduling_signup
        SET pause_effective_date = NULL,
            pause_mode = $2
        WHERE id = $1
          ${strict ? "AND status = 'paused' AND pause_effective_date <= $3::date" : ''}
        RETURNING id
        `,
        strict ? [signupId, mode, today] : [signupId, mode],
      )
      if (strict && !cleared.rows[0]) {
        const error = new Error(`Enrollment ${signupId} pause schedule changed before it was cleared.`)
        error.code = 'enrollment_pause_schedule_cas_failed'
        throw error
      }
      if (strict) {
        const pausedSubscriptions = await setSubscriptionPausedForSource(client, {
          sourceType: 'scheduling_signup',
          sourceId: signupId,
          paused: true,
        })
        if (pausedSubscriptions.length === 0) {
          const error = new Error(`Enrollment ${signupId} has no subscription to pause.`)
          error.code = 'enrollment_pause_subscription_missing'
          throw error
        }
        const remaining = await client.query(
          `SELECT id
             FROM billing_subscription
            WHERE family_billing_account_id = $1
              AND source_type = 'scheduling_signup'
              AND source_id = $2
              AND status NOT IN ('paused', 'cancelled')
            LIMIT 1`,
          [Number(accountId), String(signupId)],
        )
        if (remaining.rows[0]) {
          const error = new Error(`Enrollment ${signupId} retained an active subscription after its pause.`)
          error.code = 'enrollment_pause_postcondition_failed'
          throw error
        }
      }
      await client.query('COMMIT')
      if (!strict) {
        await handleEnrollmentPauseBilling(pool, {
          signupId,
          enteringPaused: true,
          pauseMode: mode,
        })
      }
      applied += 1
    } catch (err) {
      try {
        await client.query('ROLLBACK')
      } catch {
        /* ignore */
      }
      if (strict) throw err
      console.warn('[pauseBilling] applyScheduledPauses signup', signupId, err?.message ?? err)
    } finally {
      if (ownsClient) client.release()
    }
  }
  return applied
}
