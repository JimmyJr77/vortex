/**
 * Standalone annual membership purchase (access-only — no class signup).
 * Year 1 collected at Checkout; yearly Stripe subscription renews on anniversary.
 * Supports one or many athletes in a single Checkout session.
 */

import {
  getStripeClient,
  stripeEnabled,
  ensureStripeBillingSchema,
  ensureStripeCustomer,
  recordEnrollmentStripePayment,
} from './stripeBilling.js'
import { resolveStripePriceId, feeLookupKey, ensureStripeCatalogSchema } from './stripeCatalogSync.js'
import { ensureBillingChargeSchema } from './billingChargeSchema.js'
import {
  loadActiveAnnualMembership,
  memberHasActiveAnnualMembership,
} from '../scheduling/annualMembership.js'
import {
  membershipRenewsOnFromPurchase,
  toUtcDateString,
} from '../scheduling/membershipAnniversary.js'
import { mapFeeRow, loadActiveAdditionalFees } from '../scheduling/additionalFeesEngine.js'
import { createEnrollmentAnnualMembershipSubscriptions } from './stripeEnrollmentCheckout.js'

export const ANNUAL_MEMBERSHIP_SPORT_NAME = 'Membership'
export const ANNUAL_MEMBERSHIP_PROGRAM_NAME = 'Annual Membership'

function publicAppUrl() {
  return String(process.env.PUBLIC_APP_URL || process.env.APP_URL || 'http://localhost:5173').replace(
    /\/$/,
    '',
  )
}

function parseMemberIds({ athleteMemberId, memberIds }) {
  if (Array.isArray(memberIds) && memberIds.length > 0) {
    return [...new Set(memberIds.map(Number).filter((id) => Number.isFinite(id) && id > 0))]
  }
  const single = Number(athleteMemberId)
  return Number.isFinite(single) && single > 0 ? [single] : []
}

function parseMemberIdsFromMetadata(metadata) {
  if (!metadata) return []
  if (metadata.memberIds) {
    return String(metadata.memberIds)
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((id) => Number.isFinite(id) && id > 0)
  }
  const single = Number(metadata.memberId)
  return Number.isFinite(single) && single > 0 ? [single] : []
}

/** Pick the facility annual fee used for access membership. */
export async function loadAnnualMembershipFee(pool) {
  const facilityRes = await pool.query('SELECT id FROM facility LIMIT 1')
  const facilityId = facilityRes.rows[0]?.id ?? null
  const fees = await loadActiveAdditionalFees(pool, facilityId)
  const annual = fees.find(
    (fee) =>
      (fee.triggerType === 'once_per_year' || fee.applyBasis === 'per_year') &&
      fee.amountCents > 0,
  )
  return annual ?? null
}

/**
 * Offer + status for the Classes tab Membership card.
 * @returns {Promise<{
 *   available: boolean,
 *   fee: object|null,
 *   active: boolean,
 *   renewsOn: string|null,
 *   cycleStart: string|null,
 *   amountCents: number,
 *   sportName: string,
 *   programName: string,
 * }>}
 */
export async function getAnnualMembershipOffer(pool, memberId) {
  const fee = await loadAnnualMembershipFee(pool)
  const membership = memberId ? await loadActiveAnnualMembership(pool, memberId) : null
  return {
    available: Boolean(fee),
    fee: fee
      ? {
          feeId: fee.id,
          name: fee.name || ANNUAL_MEMBERSHIP_PROGRAM_NAME,
          amountCents: fee.amountCents,
          description: fee.description,
        }
      : null,
    active: Boolean(membership?.active),
    renewsOn: membership?.renewsOn ? toUtcDateString(membership.renewsOn) : null,
    cycleStart: membership?.cycleStart ? toUtcDateString(membership.cycleStart) : null,
    amountCents: fee?.amountCents ?? 0,
    sportName: ANNUAL_MEMBERSHIP_SPORT_NAME,
    programName: ANNUAL_MEMBERSHIP_PROGRAM_NAME,
  }
}

async function ensureFamilyMemberAccess(pool, { familyId, memberId, payerMemberId }) {
  const memberRes = await pool.query(
    `SELECT id, family_id, first_name, last_name FROM member WHERE id = $1 AND is_active = TRUE`,
    [memberId],
  )
  const member = memberRes.rows[0]
  if (!member) return { ok: false, status: 404, message: 'Athlete not found.' }
  if (Number(member.family_id) !== Number(familyId)) {
    return { ok: false, status: 403, message: 'Athlete is not in your family.' }
  }
  const isSelf = Number(memberId) === Number(payerMemberId)
  const isPayer = Number(payerMemberId) > 0 // caller is authenticated family member; family match is enough
  if (!isSelf && !isPayer) {
    return { ok: false, status: 403, message: 'Not allowed to purchase membership for this athlete.' }
  }
  return { ok: true, member }
}

/** Record a promo redemption against the discount ledger + rule counter. */
async function recordMembershipPromoRedemption(pool, { ruleId, memberId, discountCents }) {
  try {
    await pool.query(
      `INSERT INTO discount_redemption
        (rule_id, member_id, signup_id, program_id, form_id, kind, units, amount_cents)
       VALUES ($1, $2, NULL, NULL, NULL, 'discount', 0, $3)`,
      [ruleId, memberId, discountCents],
    )
    await pool.query(
      `UPDATE discount_rule SET redeemed_count = redeemed_count + 1, updated_at = now() WHERE id = $1`,
      [ruleId],
    )
  } catch (err) {
    console.warn('[billing] membership promo redemption:', err.message)
  }
}

/**
 * Create Stripe Checkout for annual membership only (no class enrollment).
 * Accepts a single athleteMemberId or memberIds[] — one Checkout, one line item per athlete.
 * An optional promoCode targeting the membership fee discounts each athlete's line;
 * when the promo waives 100%, memberships activate immediately with no Stripe session
 * and the result is `{ free: true, memberIds }`.
 */
export async function createAnnualMembershipCheckoutSession(
  pool,
  { account, athleteMemberId, memberIds, payerMemberId, promoCode = null, successUrl, cancelUrl },
) {
  if (!stripeEnabled()) return null
  await ensureStripeBillingSchema(pool)
  await ensureStripeCatalogSchema(pool)

  const requestedIds = parseMemberIds({ athleteMemberId, memberIds })
  if (requestedIds.length === 0) {
    const err = new Error('Select at least one athlete for membership.')
    err.status = 400
    throw err
  }

  const eligibleMembers = []
  for (const memberId of requestedIds) {
    const access = await ensureFamilyMemberAccess(pool, {
      familyId: account.family_id,
      memberId,
      payerMemberId,
    })
    if (!access.ok) {
      const err = new Error(access.message)
      err.status = access.status
      throw err
    }
    if (await memberHasActiveAnnualMembership(pool, memberId)) continue
    eligibleMembers.push(access.member)
  }

  if (eligibleMembers.length === 0) {
    const err = new Error('All selected athletes already have an active annual membership.')
    err.status = 409
    throw err
  }

  const fee = await loadAnnualMembershipFee(pool)
  if (!fee) {
    const err = new Error('Annual membership is not available right now.')
    err.status = 404
    throw err
  }

  // Resolve an optional membership-fee promo (enforces total/per-member/per-family limits).
  let promo = null
  if (promoCode) {
    const { resolveMembershipFeePromo } = await import('../scheduling/discountEngine.js')
    const facilityRes = await pool.query('SELECT id FROM facility LIMIT 1')
    promo = await resolveMembershipFeePromo(pool, {
      facilityId: facilityRes.rows[0]?.id ?? null,
      promoCodes: [promoCode],
      memberId: payerMemberId,
      familyId: account.family_id,
    })
    if (!promo) {
      const err = new Error('That promo code is not valid for annual membership.')
      err.status = 400
      throw err
    }
  }

  const { membershipPromoDiscountCents } = await import('../scheduling/discountEngine.js')
  const perAthleteDiscount = promo ? membershipPromoDiscountCents(promo.rule, fee.amountCents) : 0
  const perAthleteNet = Math.max(0, fee.amountCents - perAthleteDiscount)
  const eligibleIds = eligibleMembers.map((m) => Number(m.id))

  // 100% waived: no Stripe payment needed — activate memberships directly.
  if (promo && perAthleteNet === 0) {
    const purchasedAt = new Date()
    for (const member of eligibleMembers) {
      await persistAnnualMembershipLedger(pool, {
        accountId: account.id,
        memberId: Number(member.id),
        fee,
        checkoutSessionId: null,
        purchasedAt,
        grossCents: fee.amountCents,
        discountCents: perAthleteDiscount,
      })
      await recordMembershipPromoRedemption(pool, {
        ruleId: promo.rule.id,
        memberId: Number(member.id),
        discountCents: perAthleteDiscount,
      })
    }
    // No payment method is captured on a free redemption, so no Stripe renewal
    // subscription is created; the membership simply expires on its anniversary
    // unless renewed.
    return {
      free: true,
      memberIds: eligibleIds,
      renewsOn: toUtcDateString(membershipRenewsOnFromPurchase(purchasedAt)),
    }
  }

  const stripe = await getStripeClient()
  if (!stripe) return null

  const customerId = await ensureStripeCustomer(pool, stripe, account)
  const lookupKey = feeLookupKey(fee.id)
  // Catalog prices are full price; discounted checkouts must use ad-hoc price_data.
  const priceId = promo ? null : await resolveStripePriceId(pool, lookupKey)

  const lineItems = eligibleMembers.map((member) => {
    const athleteName = [member.first_name, member.last_name].filter(Boolean).join(' ').trim()
    const promoSuffix = promo ? ` (promo ${promo.code.toUpperCase()})` : ''
    const productName = `${fee.name || ANNUAL_MEMBERSHIP_PROGRAM_NAME}${
      athleteName ? ` · ${athleteName}` : ''
    }${promoSuffix}`.slice(0, 200)

    // Single athlete with catalog price keeps price ID (Classes tab path).
    // Multi-athlete uses named price_data so Checkout lists each athlete.
    if (priceId && eligibleMembers.length === 1) {
      return { price: priceId, quantity: 1 }
    }

    return {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: perAthleteNet,
        product_data: {
          name: productName,
          description: 'Valid for 1 year from purchase. Renews annually.',
        },
      },
    }
  })

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: lineItems,
    success_url: successUrl || `${publicAppUrl()}/?billing=membership-paid&session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: cancelUrl || `${publicAppUrl()}/?billing=membership-cancelled`,
    payment_intent_data: { setup_future_usage: 'off_session' },
    metadata: {
      checkoutType: 'annual_membership',
      familyBillingAccountId: String(account.id),
      memberId: String(eligibleIds[0]),
      memberIds: eligibleIds.join(','),
      payerMemberId: String(payerMemberId),
      feeId: String(fee.id),
      amountCents: String(perAthleteNet),
      feeName: String(fee.name || ANNUAL_MEMBERSHIP_PROGRAM_NAME).slice(0, 100),
      ...(promo
        ? {
            promoRuleId: String(promo.rule.id),
            promoCode: promo.code,
            promoDiscountCents: String(perAthleteDiscount),
          }
        : {}),
    },
  })

  return { url: session.url, checkoutSessionId: session.id }
}

async function persistAnnualMembershipLedger(pool, {
  accountId,
  memberId,
  fee,
  checkoutSessionId,
  purchasedAt,
  grossCents = null,
  discountCents = 0,
}) {
  await ensureBillingChargeSchema(pool)
  const renewsOnKey =
    toUtcDateString(membershipRenewsOnFromPurchase(purchasedAt)) || toUtcDateString(purchasedAt)
  const sourceId = `${fee.id}:${memberId}:${renewsOnKey}`
  const gross = Math.max(0, Math.round(Number(grossCents ?? fee.amountCents) || 0))
  const discount = Math.max(0, Math.round(Number(discountCents) || 0))
  const net = Math.max(0, gross - discount)

  await pool.query(
    `
      INSERT INTO billing_charge
        (family_billing_account_id, member_id, source_type, source_id, description,
         amount_cents, gross_amount_cents, discount_amount_cents,
         charge_type, billing_interval, stripe_checkout_session_id, created_at)
      VALUES ($1, $2, 'additional_fee', $3, $4, $5, $6, $7, 'one_time', 'one_time', $8, $9)
      ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
      DO NOTHING
    `,
    [
      accountId,
      memberId,
      sourceId,
      fee.name || ANNUAL_MEMBERSHIP_PROGRAM_NAME,
      net,
      gross,
      discount,
      checkoutSessionId,
      purchasedAt,
    ],
  )

  await pool.query(
    `
      INSERT INTO additional_fee_redemption
        (fee_id, member_id, signup_id, period_key, amount_cents)
      VALUES ($1, $2, NULL, $3, $4)
      ON CONFLICT (fee_id, member_id, period_key) DO NOTHING
    `,
    [fee.id, memberId, renewsOnKey, net],
  )
}

/**
 * Finalize standalone annual membership after Stripe Checkout payment.
 * Loops memberIds from metadata (falls back to single memberId).
 */
export async function commitAnnualMembershipCheckout(pool, { stripeSession, accountId }) {
  const session =
    typeof stripeSession === 'string'
      ? await (await getStripeClient()).checkout.sessions.retrieve(stripeSession)
      : stripeSession
  if (!session?.id) return { status: 'none' }
  if (session.metadata?.checkoutType !== 'annual_membership') return { status: 'none' }

  const memberIds = parseMemberIdsFromMetadata(session.metadata)
  const feeId = Number(session.metadata.feeId)
  const resolvedAccountId = accountId ?? Number(session.metadata.familyBillingAccountId)
  if (memberIds.length === 0 || !feeId || !resolvedAccountId) {
    return { status: 'error', reason: 'missing_metadata' }
  }

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return { status: 'unpaid' }
  }

  const feeRes = await pool.query(`SELECT * FROM additional_fee WHERE id = $1`, [feeId])
  const feeRow = feeRes.rows[0]
  if (!feeRow) return { status: 'error', reason: 'fee_not_found' }
  const fee = mapFeeRow(feeRow)

  const purchasedAt = session.created ? new Date(session.created * 1000) : new Date()
  const stripe = await getStripeClient()
  const activatedMemberIds = []

  const promoRuleId = Number(session.metadata?.promoRuleId) || null
  const promoDiscountCents = Math.max(0, Number(session.metadata?.promoDiscountCents) || 0)

  for (const memberId of memberIds) {
    if (await memberHasActiveAnnualMembership(pool, memberId)) continue

    await persistAnnualMembershipLedger(pool, {
      accountId: resolvedAccountId,
      memberId,
      fee,
      checkoutSessionId: session.id,
      purchasedAt,
      grossCents: fee.amountCents,
      discountCents: promoRuleId ? promoDiscountCents : 0,
    })

    if (promoRuleId && promoDiscountCents > 0) {
      await recordMembershipPromoRedemption(pool, {
        ruleId: promoRuleId,
        memberId,
        discountCents: promoDiscountCents,
      })
    }

    if (stripe) {
      await createEnrollmentAnnualMembershipSubscriptions(pool, stripe, {
        preview: {
          additionalFees: {
            items: [
              {
                feeId: fee.id,
                name: fee.name,
                // Renewal bills the full fee on the anniversary; promos only
                // discount year 1.
                amountCents: fee.amountCents,
                grossAmountCents: fee.amountCents,
                triggerType: fee.triggerType,
                applyBasis: fee.applyBasis,
              },
            ],
          },
        },
        stripeSession: session,
        familyBillingAccountId: resolvedAccountId,
        memberId,
        purchasedAt,
      })
    }
    activatedMemberIds.push(memberId)
  }

  const payment = await recordEnrollmentStripePayment(pool, stripe, {
    session,
    accountId: resolvedAccountId,
    paidAt: purchasedAt,
  })

  if (activatedMemberIds.length === 0) {
    return { status: 'already_active', memberIds, payment }
  }

  return {
    status: 'completed',
    payment,
    memberId: activatedMemberIds[0],
    memberIds: activatedMemberIds,
    renewsOn: toUtcDateString(membershipRenewsOnFromPurchase(purchasedAt)),
  }
}
