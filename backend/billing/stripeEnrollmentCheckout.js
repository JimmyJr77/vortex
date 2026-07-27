/**
 * Stripe Checkout for member enrollment — pay-then-commit flow.
 * See docs/STRIPE_CATALOG_INTEGRATION.md Phase 2.
 */

import crypto from 'crypto'
import { getStripeClient, stripeEnabled, ensureStripeBillingSchema, ensureStripeCustomer, recordEnrollmentStripePayment } from './stripeBilling.js'
import {
  feeLookupKey,
  passLookupKey,
  resolveStripePriceId,
  ensureStripeCatalogSchema,
  ensureBillingRecurringSchema,
  getCatalogSyncStatus,
} from './stripeCatalogSync.js'
import {
  formatPerClassStripeProductName,
  pluralizeWeekdayLabel,
} from './stripeProductNaming.js'
import { buildSignupOrderPreview } from '../scheduling/orderPricing.js'
import { executeSignupBatch } from '../scheduling/handlers.js'
import { firstOfNextMonth, todayDateOnly } from '../scheduling/firstMonthProration.js'
import { issueSignupAuthToken } from '../scheduling/signupAuth.js'
import { findMemberById } from '../members/createMemberStub.js'
import { emitStripePurchaseEvent } from '../analytics/ga4Measurement.js'
import { buildSlotDisplayLabel } from '../scheduling/slotDisplayLabel.js'

export { formatPerClassStripeProductName } from './stripeProductNaming.js'

async function loadFormProgramsId(pool, formId) {
  const res = await pool.query(`SELECT programs_id FROM scheduling_form WHERE id = $1`, [formId])
  return res.rows[0]?.programs_id != null ? Number(res.rows[0].programs_id) : null
}

/** Fresh signup JWT for webhook/confirm commit (avoids expired tokens from checkout redirect delay). */
export function resolveEnrolledMemberIdFromPayload(payload, payerOrFallbackMemberId) {
  const body = typeof payload === 'string' ? JSON.parse(payload) : payload
  let enrolledMemberId = Number(payerOrFallbackMemberId)
  if (body?.signupAuthToken) {
    try {
      // Decode only — token may already be expired after Stripe redirect delay.
      const decoded = jwtDecode(body.signupAuthToken)
      if (decoded?.memberId != null) enrolledMemberId = Number(decoded.memberId)
    } catch {
      // fall back to payer/pending member id
    }
  }
  return enrolledMemberId
}

function jwtDecode(token) {
  const parts = String(token).split('.')
  if (parts.length < 2) return null
  const json = Buffer.from(parts[1].replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8')
  return JSON.parse(json)
}

/** Drop Stripe-only fields before Joi signup-batch validation. */
export function stripSignupBatchPayload(payload) {
  const body = typeof payload === 'string' ? JSON.parse(payload) : { ...payload }
  const { analytics: _analytics, ...signupBatchPayload } = body
  return signupBatchPayload
}

async function refreshSignupAuthForCommit(pool, payload, payerOrFallbackMemberId) {
  const body = typeof payload === 'string' ? JSON.parse(payload) : { ...payload }
  const firstFormId = body.signups?.find((s) => s.formId != null)?.formId
  if (!firstFormId) throw new Error('Invalid enrollment payload')

  const enrolledMemberId = resolveEnrolledMemberIdFromPayload(body, payerOrFallbackMemberId)
  const member = await findMemberById(pool, enrolledMemberId)
  if (!member) throw new Error('Member account not found')
  const programsId = await loadFormProgramsId(pool, firstFormId)
  body.signupAuthToken = issueSignupAuthToken({
    formId: firstFormId,
    memberId: enrolledMemberId,
    email: member.email,
    programsId,
  })
  return body
}

function parsePendingPayload(payload) {
  return typeof payload === 'string' ? JSON.parse(payload) : payload
}

let pendingSchemaEnsured = false

async function ensurePendingEnrollmentSchema(pool) {
  if (pendingSchemaEnsured) return
  const fs = await import('fs')
  const migrationPath = new URL('../migrations/057_stripe_pending_enrollment.sql', import.meta.url)
  await pool.query(fs.readFileSync(migrationPath, 'utf8'))
  const clientConfirmedPath = new URL(
    '../migrations/100_stripe_pending_enrollment_client_confirmed.sql',
    import.meta.url,
  )
  await pool.query(fs.readFileSync(clientConfirmedPath, 'utf8'))
  const setupModePath = new URL(
    '../migrations/399_stripe_pending_enrollment_setup_mode.sql',
    import.meta.url,
  )
  await pool.query(fs.readFileSync(setupModePath, 'utf8'))
  const processingStatusPath = new URL(
    '../migrations/400_stripe_pending_enrollment_processing_status.sql',
    import.meta.url,
  )
  await pool.query(fs.readFileSync(processingStatusPath, 'utf8'))
  pendingSchemaEnsured = true
}

export function computeEnrollmentDueNowCents(preview) {
  const fees = Math.round((preview.additionalFeesOneTime ?? 0) * 100)
  const firstMonth = preview.firstMonth?.totalCents ?? 0
  const passes = preview.passPurchaseTotalCents ?? 0
  const carriedForward = preview.carriedForward?.totalCents ?? 0
  return Math.max(0, fees + firstMonth + passes + (carriedForward > 0 ? carriedForward : 0))
}

export function enrollmentHasRecurringMembership(preview) {
  return (preview.newSignups ?? []).some(
    (line) =>
      line.billingType === 'recurring' &&
      !line.multiClassPassApplied &&
      (line.monthlyPrice ?? line.incrementalMonthly ?? 0) > 0,
  )
}

/** Stripe trial_end disclaimer — only for recurring membership checkout, not one-time purchases. */
export function shouldShowEnrollmentCheckoutSubmitMessage(preview) {
  return enrollmentHasRecurringMembership(preview)
}

export function enrollmentNeedsStripeCheckout(preview) {
  const dueNow = computeEnrollmentDueNowCents(preview)
  const hasRecurring = enrollmentHasRecurringMembership(preview)
  const hasPassPurchase = (preview.passPurchases?.length ?? 0) > 0
  return dueNow > 0 || hasRecurring || hasPassPurchase
}

function dateStringToUnixBillingAnchor(dateStr) {
  const [y, m, d] = String(dateStr).split('-').map(Number)
  return Math.floor(Date.UTC(y, m - 1, d, 12, 0, 0) / 1000)
}

/** trial_end must be in the future; clamp so Stripe accepts deferred renewals. */
export function resolveSubscriptionTrialEndUnix(anchorDate, nowSec = Math.floor(Date.now() / 1000)) {
  const anchorUnix = dateStringToUnixBillingAnchor(anchorDate)
  const minTrialEnd = nowSec + 60
  return Math.max(anchorUnix, minTrialEnd)
}

/** @deprecated use dateStringToUnixBillingAnchor */
function dateStringToUnixTrialEnd(dateStr) {
  return dateStringToUnixBillingAnchor(dateStr)
}

/**
 * Checkout line label for first-month tuition due at enrollment.
 * Full remaining months use neutral "tuition" wording; partial months say "prorated".
 */
export function formatFirstMonthTuitionLineName(fm) {
  const label = fm.displayLine ?? fm.formTitle ?? 'Class enrollment'
  const prepaid = Math.round(Number(fm.prepaidFirstMonthCents) || 0)
  const prorated = Math.round(Number(fm.proratedCents) || 0)
  if (prepaid > 0) {
    return `${label} — first month (prepaid)`
  }
  const classesPerMonth = fm.classesPerMonth ?? 4
  const remaining = fm.remainingClasses ?? classesPerMonth
  const ratio = Number(fm.ratio ?? 1)
  const isFullMonth = ratio >= 1 || remaining >= classesPerMonth
  if (prorated > 0 && !isFullMonth) {
    return `${label} — first month (prorated)`
  }
  return `${label} — first month tuition`
}

/**
 * One-time tuition line items matching preview.firstMonth (prorated now + prepaid now).
 * Does not include fees, passes, or recurring subscription amounts.
 */
export function computeFirstMonthTuitionLineItems(preview) {
  const lines = []
  if (!preview.firstMonth?.enabled) return lines
  for (const fm of preview.firstMonth.items ?? []) {
    const prorated = Math.round(Number(fm.proratedCents) || 0)
    const prepaid = Math.round(Number(fm.prepaidFirstMonthCents) || 0)
    if (prorated > 0) {
      lines.push({
        amountCents: prorated,
        name: formatFirstMonthTuitionLineName({ ...fm, prepaidFirstMonthCents: 0 }),
      })
    }
    if (prepaid > 0) {
      lines.push({
        amountCents: prepaid,
        name: formatFirstMonthTuitionLineName(fm),
      })
    }
  }
  return lines
}

/**
 * When recurring billing should start in Stripe for one first-month line item.
 * - In-session classes: next 1st after prorated/prepaid tuition collected at checkout.
 * - Future-start prepaid classes: 1st of the month after the prepaid service month.
 */
export function computeFirstMonthBillingAnchorDate(fmItem, fromDate) {
  if (fmItem?.classStartsFutureMonth) {
    const serviceMonthStart = fmItem.firstBillDate ?? fmItem.firstServicePeriodStart ?? fromDate
    return firstOfNextMonth(serviceMonthStart)
  }
  if ((fmItem?.proratedCents ?? 0) > 0 || (fmItem?.prepaidFirstMonthCents ?? 0) > 0) {
    return fmItem.firstBillDate ?? firstOfNextMonth(fromDate)
  }
  return firstOfNextMonth(fromDate)
}

/** Latest billing anchor when multiple classes enroll in one checkout. */
export function computeSubscriptionBillingAnchorDate(preview, asOfDate = null) {
  const fromDate = asOfDate ?? todayDateOnly()
  const fmItems = preview.firstMonth?.enabled ? preview.firstMonth.items ?? [] : []
  let maxAnchorDate = null
  for (const fm of fmItems) {
    const anchorDate = computeFirstMonthBillingAnchorDate(fm, fromDate)
    if (!maxAnchorDate || anchorDate > maxAnchorDate) maxAnchorDate = anchorDate
  }
  return maxAnchorDate ?? firstOfNextMonth(fromDate)
}

/** Unix timestamp for deferred recurring billing in Checkout (required with one-time line items). */
export function computeSubscriptionTrialEndUnix(preview, asOfDate = null) {
  return dateStringToUnixBillingAnchor(computeSubscriptionBillingAnchorDate(preview, asOfDate))
}

/**
 * Checkout submit note — Stripe trial_end can show misleading "X days free" copy in the bill overview.
 */
export function formatEnrollmentCheckoutSubmitMessage() {
  return (
    "Today's payment covers first-month tuition and any additional fees. " +
    'Membership starts on assigned class start date. ' +
    'Each class renews as its own monthly subscription and can be cancelled separately.'
  ).slice(0, 500)
}

/**
 * Net monthly cents for one class after enrollment discounts (matches Vortex ledger).
 * Prefers billing_subscription.net when available; else first-month monthlyNetCents;
 * else discount-line finalCents; else preview incremental monthly.
 */
export function resolvePerClassMonthlyAmountCents(preview, slotKey, { netMonthlyCents = null } = {}) {
  if (netMonthlyCents != null && Number.isFinite(Number(netMonthlyCents))) {
    return Math.max(0, Math.round(Number(netMonthlyCents)))
  }
  const fm = (preview?.firstMonth?.items ?? []).find((item) => item.slotKey === slotKey)
  if (fm?.monthlyNetCents != null) {
    return Math.max(0, Math.round(Number(fm.monthlyNetCents)))
  }
  if (preview?.discounts?.enabled && Array.isArray(preview.discounts.lines)) {
    const line = preview.discounts.lines.find((l) => l.key === slotKey)
    if (line?.finalCents != null) {
      return Math.max(0, Math.round(Number(line.finalCents)))
    }
  }
  const previewLine = (preview?.newSignups ?? []).find((line) => line.slotKey === slotKey)
  return Math.max(0, Math.round(Number(previewLine?.monthlyPrice ?? previewLine?.incrementalMonthly ?? 0) * 100))
}

/** Checkout mode for enrollment: never use subscription Checkout (one sub for many classes). */
export function resolveEnrollmentCheckoutMode(preview) {
  const dueNowCents = computeEnrollmentDueNowCents(preview)
  const hasRecurring = enrollmentHasRecurringMembership(preview)
  if (hasRecurring && dueNowCents <= 0) return 'setup'
  return 'payment'
}

async function buildPerClassStripeSubscriptionItem(
  pool,
  stripe,
  { programsId, amountCents, productName, selectedPricingOptionKey },
) {
  // Always use a dedicated Product so Stripe Customer Portal can show class +
  // day/time + athlete. Reusing catalog products collapses different slots into
  // the same generic "Program — Monthly @ 1×" label.
  void pool
  void selectedPricingOptionKey

  const product = await stripe.products.create({
    name: String(productName || 'Monthly class membership').slice(0, 200),
    metadata: {
      vortex_per_class_subscription: 'true',
      ...(programsId != null ? { vortex_programs_id: String(programsId) } : {}),
    },
  })

  const price = await stripe.prices.create({
    product: product.id,
    currency: 'usd',
    unit_amount: amountCents,
    recurring: { interval: 'month' },
    metadata: {
      vortex_net_monthly: 'true',
      ...(programsId != null ? { vortex_programs_id: String(programsId) } : {}),
    },
  })
  return { price: price.id, quantity: 1 }
}

async function buildCheckoutLineItems(pool, preview) {
  const lineItems = []

  for (const pass of preview.passPurchases ?? []) {
    const lookupKey = passLookupKey(Number(pass.programsId), pass.packageId)
    const priceId = await resolveStripePriceId(pool, lookupKey)
    if (!priceId) {
      throw new Error(`Stripe price not synced for pass ${lookupKey}.`)
    }
    lineItems.push({ price: priceId, quantity: 1 })
  }

  for (const fee of preview.additionalFees?.items ?? []) {
    if ((fee.amountCents ?? 0) <= 0) continue
    const lookupKey = feeLookupKey(Number(fee.feeId ?? fee.id))
    const priceId = await resolveStripePriceId(pool, lookupKey)
    if (priceId) {
      lineItems.push({ price: priceId, quantity: 1 })
    } else {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: Math.round(fee.amountCents),
          product_data: { name: fee.name || 'Additional fee' },
        },
      })
    }
  }

  for (const tuition of computeFirstMonthTuitionLineItems(preview)) {
    lineItems.push({
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: tuition.amountCents,
        product_data: { name: tuition.name.slice(0, 200) },
      },
    })
  }

  if (lineItems.length === 0) {
    const dueNow = computeEnrollmentDueNowCents(preview)
    if (dueNow > 0) {
      lineItems.push({
        quantity: 1,
        price_data: {
          currency: 'usd',
          unit_amount: dueNow,
          product_data: { name: 'Vortex Athletics enrollment' },
        },
      })
    }
  }

  return lineItems
}

/**
 * After enrollment payment/setup, create one Stripe Subscription per class signup.
 * Amounts use Vortex net monthly (discounts already applied across total class count).
 */
export async function createEnrollmentStripeSubscriptions(
  pool,
  stripe,
  { preview, stripeSession, signupIds, familyBillingAccountId },
) {
  if (!stripe || !signupIds?.length) return

  const sessionId = typeof stripeSession === 'string' ? stripeSession : stripeSession?.id
  if (!sessionId) return

  const session = await stripe.checkout.sessions.retrieve(sessionId, {
    expand: ['payment_intent.payment_method', 'setup_intent.payment_method'],
  })
  const customerId = session.customer
  if (!customerId) return

  let defaultPaymentMethod =
    session.payment_intent?.payment_method ?? session.setup_intent?.payment_method ?? null
  if (defaultPaymentMethod && typeof defaultPaymentMethod === 'object') {
    defaultPaymentMethod = defaultPaymentMethod.id
  }

  if (defaultPaymentMethod) {
    try {
      await stripe.customers.update(customerId, {
        invoice_settings: { default_payment_method: defaultPaymentMethod },
      })
    } catch (err) {
      console.warn('[stripe] set default payment method:', err.message)
    }
  }

  const previewObj = preview
  const fromDate = previewObj.firstMonth?.periodStart ?? todayDateOnly()

  const subsRes = await pool.query(
    `SELECT bs.id, bs.source_id, bs.net_monthly_cents, bs.description
     FROM billing_subscription bs
     WHERE bs.source_type = 'scheduling_signup'
       AND bs.source_id = ANY($1::text[])
       AND bs.status = 'active'
       AND bs.stripe_subscription_id IS NULL`,
    [signupIds.map(String)],
  )

  for (const subRow of subsRes.rows) {
    const signupId = Number(subRow.source_id)
    const signupRes = await pool.query(
      `
        SELECT ss.form_id, ss.slot_group_id, ss.time_slot_id, ss.member_id,
               sf.title AS form_title,
               m.first_name, m.last_name,
               ts.week_letter, ts.schedule_mode, ts.specific_date, ts.day_of_week,
               ts.start_time, ts.end_time
        FROM scheduling_signup ss
        JOIN scheduling_form sf ON sf.id = ss.form_id
        JOIN member m ON m.id = ss.member_id
        LEFT JOIN scheduling_time_slot ts ON ts.id = ss.time_slot_id
        WHERE ss.id = $1
      `,
      [signupId],
    )
    const signup = signupRes.rows[0]
    if (!signup) continue

    const slotKey = `${signup.form_id}:${signup.slot_group_id}:${signup.time_slot_id ?? 'none'}`
    const previewLine = (previewObj.newSignups ?? []).find((line) => line.slotKey === slotKey)
    if (!previewLine || previewLine.billingType !== 'recurring' || previewLine.multiClassPassApplied) {
      continue
    }

    const amountCents = resolvePerClassMonthlyAmountCents(previewObj, slotKey, {
      netMonthlyCents: subRow.net_monthly_cents,
    })
    if (amountCents <= 0) continue

    const fmItem = (previewObj.firstMonth?.items ?? []).find((item) => item.slotKey === slotKey)
    const anchorDate = fmItem
      ? computeFirstMonthBillingAnchorDate(fmItem, fromDate)
      : firstOfNextMonth(fromDate)

    const scheduleLabel = pluralizeWeekdayLabel(buildSlotDisplayLabel(signup))
    const athleteName = [signup.first_name, signup.last_name].filter(Boolean).join(' ').trim()
    const productName = formatPerClassStripeProductName({
      classTitle: signup.form_title || previewLine.formTitle || subRow.description,
      scheduleLabel,
      athleteName,
    })
    const item = await buildPerClassStripeSubscriptionItem(pool, stripe, {
      programsId: previewLine.programsId ?? null,
      amountCents,
      productName,
      selectedPricingOptionKey: previewLine.selectedPricingOptionKey || 'monthly_1x',
    })

    const stripeSub = await stripe.subscriptions.create({
      customer: customerId,
      items: [item],
      // First-month tuition was collected at Checkout. Defer the first recurring
      // invoice with trial_end (billing_cycle_anchor cannot be >1 interval ahead).
      trial_end: resolveSubscriptionTrialEndUnix(anchorDate),
      proration_behavior: 'none',
      ...(defaultPaymentMethod ? { default_payment_method: defaultPaymentMethod } : {}),
      description: productName.slice(0, 500),
      metadata: {
        billingSubscriptionId: String(subRow.id),
        familyBillingAccountId: String(familyBillingAccountId),
        schedulingSignupId: String(signupId),
        checkoutType: 'enrollment',
        perClassSubscription: 'true',
      },
    })

    await pool.query(
      `UPDATE billing_subscription SET stripe_subscription_id = $2, updated_at = now() WHERE id = $1`,
      [subRow.id, stripeSub.id],
    )
  }

  // Recompute household spend discounts across all active enrollments and push
  // nets to Stripe (new class can unlock a higher tier for every sibling).
  if (familyBillingAccountId != null) {
    try {
      const fam = await pool.query(
        `SELECT family_id FROM family_billing_account WHERE id = $1`,
        [familyBillingAccountId],
      )
      const familyId = fam.rows[0]?.family_id
      if (familyId != null) {
        const { syncFamilyEnrollmentDiscounts } = await import(
          '../scheduling/pauseEnrollmentBilling.js'
        )
        await syncFamilyEnrollmentDiscounts(pool, Number(familyId))
      }
    } catch (err) {
      console.warn('[stripe] family discount sync after enrollment:', err?.message ?? err)
    }
  }
}

function previewFingerprint(preview) {
  return crypto
    .createHash('sha256')
    .update(
      JSON.stringify({
        dueNow: computeEnrollmentDueNowCents(preview),
        monthly: preview.estimatedMonthlyTotal,
        newCount: preview.newSignups?.length ?? 0,
        passTotal: preview.passPurchaseTotalCents ?? 0,
      }),
    )
    .digest('hex')
    .slice(0, 16)
}

export async function createEnrollmentCheckoutSession(
  pool,
  { account, memberId, batchPayload, successUrl, cancelUrl },
) {
  if (!stripeEnabled()) return null
  await ensureStripeBillingSchema(pool)
  await ensureStripeCatalogSchema(pool)
  await ensurePendingEnrollmentSchema(pool)

  const stripe = await getStripeClient()
  if (!stripe) return null

  const slotSignups = (batchPayload.signups ?? []).filter((s) => s.lineType !== 'multi_class_pass')
  const passSignups = (batchPayload.signups ?? []).filter((s) => s.lineType === 'multi_class_pass')

  // Fees, existing enrollments, and once-per-year redemptions are athlete-scoped.
  // The authenticated caller is usually the family payer — do not use payer id here
  // or annual fees already redeemed by the payer wrongly suppress the child's fee.
  const enrolledMemberId = resolveEnrolledMemberIdFromPayload(batchPayload, memberId)

  const preview = await buildSignupOrderPreview(pool, {
    memberId: enrolledMemberId,
    newSignups: [
      ...slotSignups.map((s) => ({
        formId: s.formId,
        slotGroupId: s.slotGroupId,
        timeSlotId: s.timeSlotId,
        formTitle: s.formTitle,
        selectedPricingOptionKey: s.selectedPricingOptionKey,
        useMultiClassPass: s.useMultiClassPass,
        lineType: 'slot',
      })),
      ...passSignups.map((p) => ({
        lineType: 'multi_class_pass',
        programsId: p.programsId,
        packageId: p.packageId,
      })),
    ],
    promoCodes: batchPayload.promoCodes ?? [],
  })

  if (!enrollmentNeedsStripeCheckout(preview)) {
    return { skipCheckout: true, preview }
  }

  const dueNowCents = computeEnrollmentDueNowCents(preview)
  const hasRecurring = enrollmentHasRecurringMembership(preview)
  const mode = resolveEnrollmentCheckoutMode(preview)
  const lineItems = mode === 'setup' ? [] : await buildCheckoutLineItems(pool, preview)

  if (mode === 'payment' && lineItems.length === 0) {
    return { skipCheckout: true, preview }
  }

  const pending = await pool.query(
    `INSERT INTO stripe_pending_enrollment (
       family_billing_account_id, member_id, payload, preview_snapshot,
       due_now_cents, checkout_mode, status
     ) VALUES ($1,$2,$3,$4,$5,$6,'pending')
     RETURNING id`,
    [
      account.id,
      enrolledMemberId,
      JSON.stringify(batchPayload),
      JSON.stringify(preview),
      dueNowCents,
      mode,
    ],
  )
  const pendingId = pending.rows[0].id

  const customerId = await ensureStripeCustomer(pool, stripe, account)

  const sessionParams = {
    mode,
    customer: customerId,
    success_url: successUrl,
    cancel_url: cancelUrl,
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: String(pendingId),
      familyBillingAccountId: String(account.id),
      memberId: String(enrolledMemberId),
      payerMemberId: String(memberId),
      previewHash: previewFingerprint(preview),
      hasRecurring: hasRecurring ? 'true' : 'false',
      perClassSubscriptions: hasRecurring ? 'true' : 'false',
    },
  }

  if (mode === 'setup') {
    // Recurring enrollments with $0 due now: collect a payment method, then create
    // one Stripe Subscription per class after commit.
    sessionParams.currency = 'usd'
  } else {
    sessionParams.line_items = lineItems
    sessionParams.payment_intent_data = {
      setup_future_usage: 'off_session',
    }
  }

  if (hasRecurring && shouldShowEnrollmentCheckoutSubmitMessage(preview)) {
    sessionParams.custom_text = {
      submit: {
        message: formatEnrollmentCheckoutSubmitMessage(),
      },
    }
  }

  const session = await stripe.checkout.sessions.create(sessionParams)

  await pool.query(
    `UPDATE stripe_pending_enrollment
     SET stripe_checkout_session_id = $2, updated_at = now()
     WHERE id = $1`,
    [pendingId, session.id],
  )

  return { url: session.url, pendingEnrollmentId: pendingId, preview }
}

async function findLatestFamilyEnrollmentReturn(pool, familyId) {
  const res = await pool.query(
    `SELECT pe.id, pe.stripe_checkout_session_id, pe.status
     FROM stripe_pending_enrollment pe
     JOIN family_billing_account fba ON fba.id = pe.family_billing_account_id
     WHERE fba.family_id = $1
       AND pe.created_at > now() - interval '7 days'
     ORDER BY pe.updated_at DESC
     LIMIT 1`,
    [familyId],
  )
  return res.rows[0] ?? null
}

/**
 * Commit enrollment after Stripe Checkout when the member returns to the portal.
 * Backup for webhook delivery — verifies payment with Stripe before creating signups.
 */
export async function confirmEnrollmentCheckoutSession(
  pool,
  { checkoutSessionId, pendingEnrollmentId, memberId, familyId, roles },
) {
  const stripe = await getStripeClient()
  if (!stripe) throw new Error('Online payments are not available right now.')

  let sessionId = checkoutSessionId ? String(checkoutSessionId).trim() : null
  let pendingId = pendingEnrollmentId ? Number(pendingEnrollmentId) : null

  if (!sessionId && !pendingId && familyId) {
    const latest = await findLatestFamilyEnrollmentReturn(pool, familyId)
    if (!latest) return { status: 'none' }
    if (latest.status === 'completed') return { status: 'already_completed' }
    pendingId = Number(latest.id)
    sessionId = latest.stripe_checkout_session_id ?? null
  }

  if (!sessionId && pendingId) {
    const pendingRes = await pool.query(
      `SELECT stripe_checkout_session_id FROM stripe_pending_enrollment WHERE id = $1`,
      [pendingId],
    )
    sessionId = pendingRes.rows[0]?.stripe_checkout_session_id ?? null
  }

  if (!sessionId) {
    return { status: 'none' }
  }

  const session = await stripe.checkout.sessions.retrieve(sessionId)
  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    throw new Error('Payment is not complete yet. If you were charged, please wait a moment and refresh.')
  }
  if (session.metadata?.checkoutType !== 'enrollment') {
    throw new Error('This checkout session is not an enrollment payment.')
  }

  pendingId = pendingId || Number(session.metadata?.pendingEnrollmentId)
  if (!pendingId) throw new Error('Enrollment reference missing from checkout session.')

  const pendingRes = await pool.query(
    `SELECT pe.*, fba.family_id, fba.payer_member_id
     FROM stripe_pending_enrollment pe
     JOIN family_billing_account fba ON fba.id = pe.family_billing_account_id
     WHERE pe.id = $1`,
    [pendingId],
  )
  const pending = pendingRes.rows[0]
  if (!pending) throw new Error('Enrollment checkout not found.')
  if (Number(pending.family_id) !== Number(familyId)) {
    throw new Error('This enrollment belongs to a different family account.')
  }

  const canPay =
    Number(pending.payer_member_id) === Number(memberId)
  if (!canPay) {
    throw new Error('Only the family payer or a guardian can confirm enrollment checkout.')
  }

  if (pending.stripe_checkout_session_id && pending.stripe_checkout_session_id !== session.id) {
    throw new Error('Checkout session does not match this enrollment.')
  }

  const commitResult = await commitPendingEnrollment(pool, {
    pendingEnrollmentId: pendingId,
    stripeSession: session,
  })

  if (commitResult.status === 'not_found') {
    throw new Error('Enrollment checkout not found.')
  }

  if (commitResult.status === 'in_progress') {
    throw new Error(
      'Enrollment is still being finalized. Please wait a moment and refresh this page.',
    )
  }

  if (commitResult.status !== 'completed' && commitResult.status !== 'already_completed') {
    return commitResult
  }

  const payment = await recordEnrollmentStripePayment(pool, stripe, {
    session,
    accountId: Number(pending.family_billing_account_id),
  })
  void emitStripePurchaseEvent(pool, {
    payment,
    session,
    paymentType: 'initial_enrollment',
  })

  // Fire-once flag for the browser-side vortex_purchase dataLayer push (GTM
  // Google Ads conversion): only the first confirm after payment returns
  // firstConfirmation=true, so refresh/revisit never re-fires the conversion.
  const confirmStamp = await pool.query(
    `UPDATE stripe_pending_enrollment
     SET client_confirmed_at = now(), updated_at = now()
     WHERE id = $1 AND client_confirmed_at IS NULL
     RETURNING id`,
    [pendingId],
  )
  const firstConfirmation = (confirmStamp.rowCount ?? 0) > 0

  const purchase = {
    transactionId:
      payment?.stripe_payment_intent_id || payment?.stripe_checkout_session_id || session.id,
    valueCents: Number(payment?.amount_cents ?? session.amount_total) || 0,
    currency: 'USD',
    enrollmentType:
      pending.checkout_mode === 'setup' ||
      pending.checkout_mode === 'subscription' ||
      session.metadata?.hasRecurring === 'true'
        ? 'recurring'
        : 'one_time',
    paymentType: 'initial_enrollment',
  }

  return { ...commitResult, firstConfirmation, purchase }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

function isAlreadySignedUpError(err) {
  return (
    err?.code === 'ALREADY_SIGNED_UP' ||
    /already signed up/i.test(String(err?.message ?? ''))
  )
}

/** Recover signup ids when a prior commit created rows but never marked completed. */
export async function findExistingSignupIdsForEnrollmentPayload(pool, payload, memberId) {
  const body = typeof payload === 'string' ? JSON.parse(payload) : payload
  const ids = []
  for (const entry of body?.signups ?? []) {
    if (entry?.formId == null || entry?.slotGroupId == null) continue
    const timeSlotId = entry.timeSlotId != null ? Number(entry.timeSlotId) : null
    const res = await pool.query(
      `
        SELECT id FROM scheduling_signup
        WHERE member_id = $1
          AND form_id = $2
          AND slot_group_id = $3
          AND ($4::bigint IS NULL OR time_slot_id = $4)
          AND orphaned_at IS NULL
          AND status IN ('confirmed', 'waitlisted')
        ORDER BY id DESC
        LIMIT 1
      `,
      [Number(memberId), Number(entry.formId), Number(entry.slotGroupId), timeSlotId],
    )
    if (res.rows[0]?.id != null) ids.push(Number(res.rows[0].id))
  }
  return ids
}

/**
 * Claim → signup (no row lock) → ledger repair → completed → Stripe I/O.
 * Concurrent webhook + confirm: one worker claims; the other waits for completed.
 */
export async function commitPendingEnrollment(pool, { pendingEnrollmentId, stripeSession = null }) {
  await ensureBillingRecurringSchema(pool)
  await ensurePendingEnrollmentSchema(pool)

  for (let attempt = 0; attempt < 16; attempt++) {
    const outcome = await tryCommitPendingEnrollmentOnce(pool, {
      pendingEnrollmentId,
      stripeSession,
    })
    if (outcome.status !== 'in_progress') return outcome
    await sleep(400 + attempt * 150)
  }

  const final = await pool.query(`SELECT status FROM stripe_pending_enrollment WHERE id = $1`, [
    pendingEnrollmentId,
  ])
  if (final.rows[0]?.status === 'completed') return { status: 'already_completed' }
  return { status: 'in_progress' }
}

async function tryCommitPendingEnrollmentOnce(pool, { pendingEnrollmentId, stripeSession }) {
  // Claim quickly — never hold FOR UPDATE across signup / Stripe network I/O.
  const claim = await pool.query(
    `
      UPDATE stripe_pending_enrollment
      SET status = 'processing', error_message = NULL, updated_at = now()
      WHERE id = $1
        AND (
          status IN ('pending', 'failed')
          OR (status = 'processing' AND updated_at < now() - interval '2 minutes')
        )
      RETURNING *
    `,
    [pendingEnrollmentId],
  )
  const pending = claim.rows[0]
  if (!pending) {
    const existing = await pool.query(`SELECT status FROM stripe_pending_enrollment WHERE id = $1`, [
      pendingEnrollmentId,
    ])
    const status = existing.rows[0]?.status
    if (status === 'completed') return { status: 'already_completed' }
    if (status === 'processing') return { status: 'in_progress' }
    if (!status) return { status: 'not_found' }
    return { status: 'invalid', reason: status }
  }

  let signupIds = []
  let result = null
  const previewSnapshot =
    typeof pending.preview_snapshot === 'string'
      ? JSON.parse(pending.preview_snapshot)
      : pending.preview_snapshot
  const familyBillingAccountId = pending.family_billing_account_id
  const previewHasRecurring = enrollmentHasRecurringMembership(previewSnapshot ?? {})
  const enrolledMemberId = resolveEnrolledMemberIdFromPayload(pending.payload, pending.member_id)

  try {
    const refreshed = await refreshSignupAuthForCommit(pool, pending.payload, pending.member_id)
    const signupBatchPayload = stripSignupBatchPayload(refreshed)

    try {
      result = await executeSignupBatch(pool, signupBatchPayload)
      signupIds = (result?.data?.signups ?? [])
        .map((row) => Number(row.id ?? row.signupId))
        .filter(Boolean)
    } catch (signupErr) {
      if (!isAlreadySignedUpError(signupErr)) throw signupErr
      signupIds = await findExistingSignupIdsForEnrollmentPayload(
        pool,
        signupBatchPayload,
        enrolledMemberId,
      )
      if (signupIds.length === 0) throw signupErr
      result = { success: true, data: { signups: signupIds.map((id) => ({ id })) }, recovered: true }
    }

    if (signupIds.length > 0 && previewSnapshot) {
      await ensureEnrollmentLedgerRows(pool, {
        memberId: enrolledMemberId,
        signupIds,
        preview: previewSnapshot,
      })
    }

    await pool.query(
      `UPDATE stripe_pending_enrollment
       SET status = 'completed', error_message = NULL, updated_at = now()
       WHERE id = $1`,
      [pendingEnrollmentId],
    )

    if (stripeSession?.subscription && !previewHasRecurring) {
      await pool.query(
        `UPDATE billing_subscription
         SET stripe_subscription_id = $2, updated_at = now()
         WHERE family_billing_account_id = $1
           AND status = 'active'
           AND stripe_subscription_id IS NULL
           AND created_at >= now() - interval '5 minutes'`,
        [familyBillingAccountId, stripeSession.subscription],
      )
    }
  } catch (err) {
    await pool.query(
      `UPDATE stripe_pending_enrollment
       SET status = 'failed', error_message = $2, updated_at = now()
       WHERE id = $1 AND status IN ('processing', 'failed', 'pending')`,
      [pendingEnrollmentId, String(err.message ?? err).slice(0, 500)],
    )
    throw err
  }

  // Stripe network I/O after the pending row is completed (no DB locks held).
  if (signupIds.length > 0 && previewSnapshot && previewHasRecurring && stripeSession) {
    try {
      const stripe = await getStripeClient()
      if (stripe) {
        await createEnrollmentStripeSubscriptions(pool, stripe, {
          preview: previewSnapshot,
          stripeSession,
          signupIds,
          familyBillingAccountId,
        })
      }
    } catch (err) {
      console.error('[stripe] per-class subscription create after enrollment commit:', err)
    }
  }

  if (stripeSession?.id && familyBillingAccountId != null) {
    try {
      const stripe = await getStripeClient()
      if (stripe) {
        const payment = await recordEnrollmentStripePayment(pool, stripe, {
          session: stripeSession,
          accountId: Number(familyBillingAccountId),
        })
        void emitStripePurchaseEvent(pool, {
          payment,
          session: stripeSession,
          paymentType: 'initial_enrollment',
        })
      }
    } catch (err) {
      console.error('[stripe] enrollment payment record after commit:', err)
    }
  }

  return { status: 'completed', result }
}

/** Re-run ledger bridge when signup batch charge persistence was skipped/failed. */
export async function ensureEnrollmentLedgerRows(pool, { memberId, signupIds, preview }) {
  if (!memberId || !signupIds?.length || !preview) return { repaired: false }

  const missing = await pool.query(
    `
      SELECT ss.id AS signup_id, ss.form_id, ss.slot_group_id, ss.time_slot_id, sf.title
      FROM scheduling_signup ss
      JOIN scheduling_form sf ON sf.id = ss.form_id
      LEFT JOIN billing_subscription bs
        ON bs.source_type = 'scheduling_signup'
       AND bs.source_id = ss.id::text
       AND bs.status = 'active'
      WHERE ss.id = ANY($1::bigint[])
        AND bs.id IS NULL
    `,
    [signupIds],
  )
  if (missing.rows.length === 0) return { repaired: false }

  const { persistSignupCharges } = await import('../scheduling/persistSignupCharges.js')
  await persistSignupCharges(pool, {
    memberId: Number(memberId),
    signups: missing.rows.map((row) => ({
      signupId: Number(row.signup_id),
      formId: Number(row.form_id),
      slotGroupId: Number(row.slot_group_id),
      timeSlotId: row.time_slot_id != null ? Number(row.time_slot_id) : null,
      formTitle: row.title,
      slotLabel: '',
    })),
    preview,
  })
  return { repaired: true, count: missing.rows.length }
}

export { getCatalogSyncStatus } from './stripeCatalogSync.js'
