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

/** Normalize promoCodesByMemberId from request body into Map<number, string>. */
function normalizePromoCodesByMemberId(promoCodesByMemberId, fallbackPromoCode = null) {
  const map = new Map()
  if (promoCodesByMemberId && typeof promoCodesByMemberId === 'object' && !Array.isArray(promoCodesByMemberId)) {
    for (const [key, value] of Object.entries(promoCodesByMemberId)) {
      const memberId = Number(key)
      const code = typeof value === 'string' ? value.trim() : ''
      if (Number.isFinite(memberId) && memberId > 0 && code) map.set(memberId, code)
    }
  }
  return { map, fallbackPromoCode: typeof fallbackPromoCode === 'string' && fallbackPromoCode.trim() ? fallbackPromoCode.trim() : null }
}

function serializePromoByMember(promoByMemberId) {
  const compact = {}
  for (const [memberId, promo] of promoByMemberId.entries()) {
    if (!promo) continue
    compact[String(memberId)] = {
      r: promo.rule.id,
      d: promo.discountCents,
      c: promo.code,
    }
  }
  const json = JSON.stringify(compact)
  // Stripe metadata values max out at 500 chars; keep a flat fallback when needed.
  if (json.length <= 500) return { promoByMember: json }
  const first = [...promoByMemberId.entries()].find(([, p]) => p)
  if (!first) return {}
  const [, promo] = first
  return {
    promoRuleId: String(promo.rule.id),
    promoCode: promo.code,
    promoDiscountCents: String(promo.discountCents),
  }
}

function parsePromoByMemberMetadata(metadata) {
  const byMember = new Map()
  if (metadata?.promoByMember) {
    try {
      const parsed = JSON.parse(metadata.promoByMember)
      for (const [key, value] of Object.entries(parsed || {})) {
        const memberId = Number(key)
        if (!Number.isFinite(memberId) || memberId <= 0 || !value) continue
        byMember.set(memberId, {
          ruleId: Number(value.r) || null,
          discountCents: Math.max(0, Number(value.d) || 0),
          code: String(value.c || ''),
        })
      }
    } catch {
      // fall through to legacy flat fields
    }
  }
  if (byMember.size === 0 && metadata?.promoRuleId) {
    const ruleId = Number(metadata.promoRuleId) || null
    const discountCents = Math.max(0, Number(metadata.promoDiscountCents) || 0)
    const code = String(metadata.promoCode || '')
    for (const memberId of parseMemberIdsFromMetadata(metadata)) {
      byMember.set(memberId, { ruleId, discountCents, code })
    }
  }
  return byMember
}

/**
 * Resolve per-athlete membership pricing (promos applied). Throws on invalid promo.
 * @returns {Promise<{
 *   fee: object,
 *   pricedMembers: Array<{
 *     member: object,
 *     memberId: number,
 *     promo: { rule: object, code: string, discountCents: number }|null,
 *     discountCents: number,
 *     netCents: number,
 *     grossCents: number,
 *   }>,
 * }>}
 */
export async function priceAnnualMembershipSelections(
  pool,
  {
    account,
    athleteMemberId,
    memberIds,
    payerMemberId,
    promoCode = null,
    promoCodesByMemberId = null,
  },
) {
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

  const { map: perMemberCodes, fallbackPromoCode } = normalizePromoCodesByMemberId(
    promoCodesByMemberId,
    promoCode,
  )
  const { resolveMembershipFeePromo, membershipPromoDiscountCents } = await import(
    '../scheduling/discountEngine.js'
  )
  const facilityRes = await pool.query('SELECT id FROM facility LIMIT 1')
  const facilityId = facilityRes.rows[0]?.id ?? null

  const pricedMembers = []
  for (const member of eligibleMembers) {
    const memberId = Number(member.id)
    const code = perMemberCodes.get(memberId) || fallbackPromoCode || null
    let promo = null
    if (code) {
      const resolved = await resolveMembershipFeePromo(pool, {
        facilityId,
        promoCodes: [code],
        memberId,
        familyId: account.family_id,
      })
      if (!resolved) {
        const err = new Error(
          `Promo code "${code}" is not valid for annual membership` +
            (eligibleMembers.length > 1
              ? ` (${[member.first_name, member.last_name].filter(Boolean).join(' ') || 'athlete'}).`
              : '.'),
        )
        err.status = 400
        err.memberId = memberId
        err.promoCode = code
        throw err
      }
      const discountCents = membershipPromoDiscountCents(resolved.rule, fee.amountCents)
      promo = {
        rule: resolved.rule,
        code: resolved.code,
        discountCents,
      }
    }
    const discountCents = promo?.discountCents ?? 0
    const grossCents = fee.amountCents
    const netCents = Math.max(0, grossCents - discountCents)
    pricedMembers.push({
      member,
      memberId,
      promo,
      discountCents,
      netCents,
      grossCents,
    })
  }

  return { fee, pricedMembers }
}

/**
 * Soft preview of membership checkout totals with per-child promo codes.
 * Invalid codes are reported per athlete instead of failing the whole preview.
 */
export async function previewAnnualMembershipCheckout(
  pool,
  {
    account,
    athleteMemberId,
    memberIds,
    payerMemberId,
    promoCode = null,
    promoCodesByMemberId = null,
  },
) {
  const requestedIds = parseMemberIds({ athleteMemberId, memberIds })
  if (requestedIds.length === 0) {
    return {
      feeAmountCents: 0,
      athletes: [],
      totalGrossCents: 0,
      totalDiscountCents: 0,
      totalNetCents: 0,
      allWaived: false,
    }
  }

  const fee = await loadAnnualMembershipFee(pool)
  if (!fee) {
    const err = new Error('Annual membership is not available right now.')
    err.status = 404
    throw err
  }

  const { map: perMemberCodes, fallbackPromoCode } = normalizePromoCodesByMemberId(
    promoCodesByMemberId,
    promoCode,
  )
  const { resolveMembershipFeePromo, membershipPromoDiscountCents } = await import(
    '../scheduling/discountEngine.js'
  )
  const facilityRes = await pool.query('SELECT id FROM facility LIMIT 1')
  const facilityId = facilityRes.rows[0]?.id ?? null

  const athletes = []
  for (const memberId of requestedIds) {
    const access = await ensureFamilyMemberAccess(pool, {
      familyId: account.family_id,
      memberId,
      payerMemberId,
    })
    if (!access.ok) {
      athletes.push({
        memberId,
        name: '',
        active: false,
        available: false,
        grossCents: fee.amountCents,
        discountCents: 0,
        netCents: fee.amountCents,
        promoCode: null,
        promoValid: false,
        promoError: access.message,
        waived: false,
      })
      continue
    }
    const name = [access.member.first_name, access.member.last_name].filter(Boolean).join(' ').trim()
    const active = await memberHasActiveAnnualMembership(pool, memberId)
    if (active) {
      athletes.push({
        memberId,
        name,
        active: true,
        available: true,
        grossCents: 0,
        discountCents: 0,
        netCents: 0,
        promoCode: null,
        promoValid: true,
        promoError: null,
        waived: false,
      })
      continue
    }

    const code = perMemberCodes.get(memberId) || fallbackPromoCode || null
    let discountCents = 0
    let promoValid = true
    let promoError = null
    if (code) {
      const resolved = await resolveMembershipFeePromo(pool, {
        facilityId,
        promoCodes: [code],
        memberId,
        familyId: account.family_id,
      })
      if (!resolved) {
        promoValid = false
        promoError = `Promo code "${code}" is not valid for annual membership.`
      } else {
        discountCents = membershipPromoDiscountCents(resolved.rule, fee.amountCents)
      }
    }
    const grossCents = fee.amountCents
    const netCents = promoValid ? Math.max(0, grossCents - discountCents) : grossCents
    athletes.push({
      memberId,
      name,
      active: false,
      available: true,
      grossCents,
      discountCents: promoValid ? discountCents : 0,
      netCents,
      promoCode: code,
      promoValid,
      promoError,
      waived: promoValid && discountCents > 0 && netCents === 0,
    })
  }

  const billable = athletes.filter((a) => !a.active && a.available)
  const totalGrossCents = billable.reduce((sum, a) => sum + a.grossCents, 0)
  const totalDiscountCents = billable.reduce((sum, a) => sum + a.discountCents, 0)
  const totalNetCents = billable.reduce((sum, a) => sum + a.netCents, 0)

  return {
    feeAmountCents: fee.amountCents,
    athletes,
    totalGrossCents,
    totalDiscountCents,
    totalNetCents,
    allWaived: billable.length > 0 && billable.every((a) => a.waived),
  }
}

/**
 * Create Stripe Checkout for annual membership only (no class enrollment).
 * Accepts a single athleteMemberId or memberIds[] — one Checkout, one line item per athlete.
 * Optional promoCode (legacy, applies to every athlete) or promoCodesByMemberId
 * (per-child codes). When every selected athlete is 100% waived, memberships activate
 * immediately with `{ free: true, memberIds }`. Mixed carts activate waived athletes
 * immediately and open Stripe Checkout for the rest.
 */
export async function createAnnualMembershipCheckoutSession(
  pool,
  {
    account,
    athleteMemberId,
    memberIds,
    payerMemberId,
    promoCode = null,
    promoCodesByMemberId = null,
    successUrl,
    cancelUrl,
  },
) {
  if (!stripeEnabled()) return null
  await ensureStripeBillingSchema(pool)
  await ensureStripeCatalogSchema(pool)

  const { fee, pricedMembers } = await priceAnnualMembershipSelections(pool, {
    account,
    athleteMemberId,
    memberIds,
    payerMemberId,
    promoCode,
    promoCodesByMemberId,
  })

  const freeMembers = pricedMembers.filter((row) => row.promo && row.netCents === 0)
  const paidMembers = pricedMembers.filter((row) => !(row.promo && row.netCents === 0))
  const eligibleIds = pricedMembers.map((row) => row.memberId)

  // Activate fully waived athletes immediately (whole cart or mixed with paid siblings).
  if (freeMembers.length > 0) {
    const purchasedAt = new Date()
    for (const row of freeMembers) {
      await persistAnnualMembershipLedger(pool, {
        accountId: account.id,
        memberId: row.memberId,
        fee,
        checkoutSessionId: null,
        purchasedAt,
        grossCents: row.grossCents,
        discountCents: row.discountCents,
      })
      await recordMembershipPromoRedemption(pool, {
        ruleId: row.promo.rule.id,
        memberId: row.memberId,
        discountCents: row.discountCents,
      })
    }
    if (paidMembers.length === 0) {
      // No payment method is captured on a free redemption, so no Stripe renewal
      // subscription is created; the membership simply expires on its anniversary
      // unless renewed.
      return {
        free: true,
        memberIds: eligibleIds,
        renewsOn: toUtcDateString(membershipRenewsOnFromPurchase(purchasedAt)),
      }
    }
  }

  const stripe = await getStripeClient()
  if (!stripe) return null

  const customerId = await ensureStripeCustomer(pool, stripe, account)
  const lookupKey = feeLookupKey(fee.id)
  const anyDiscount = paidMembers.some((row) => row.discountCents > 0)
  // Catalog prices are full price; discounted checkouts must use ad-hoc price_data.
  const priceId =
    !anyDiscount && paidMembers.length === 1 ? await resolveStripePriceId(pool, lookupKey) : null

  const lineItems = paidMembers.map((row) => {
    const athleteName = [row.member.first_name, row.member.last_name].filter(Boolean).join(' ').trim()
    const promoSuffix = row.promo ? ` (promo ${row.promo.code.toUpperCase()})` : ''
    const productName = `${fee.name || ANNUAL_MEMBERSHIP_PROGRAM_NAME}${
      athleteName ? ` · ${athleteName}` : ''
    }${promoSuffix}`.slice(0, 200)

    if (priceId && paidMembers.length === 1) {
      return { price: priceId, quantity: 1 }
    }

    return {
      quantity: 1,
      price_data: {
        currency: 'usd',
        unit_amount: row.netCents,
        product_data: {
          name: productName,
          description: 'Valid for 1 year from purchase. Renews annually.',
        },
      },
    }
  })

  const paidIds = paidMembers.map((row) => row.memberId)
  const paidPromoByMember = new Map(
    paidMembers.filter((row) => row.promo).map((row) => [row.memberId, row.promo]),
  )

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
      memberId: String(paidIds[0]),
      memberIds: paidIds.join(','),
      payerMemberId: String(payerMemberId),
      feeId: String(fee.id),
      amountCents: String(paidMembers.reduce((sum, row) => sum + row.netCents, 0)),
      feeName: String(fee.name || ANNUAL_MEMBERSHIP_PROGRAM_NAME).slice(0, 100),
      ...serializePromoByMember(paidPromoByMember),
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

  const promoByMember = parsePromoByMemberMetadata(session.metadata)

  for (const memberId of memberIds) {
    if (await memberHasActiveAnnualMembership(pool, memberId)) continue

    const promo = promoByMember.get(Number(memberId))
    const discountCents = promo?.ruleId ? promo.discountCents : 0

    await persistAnnualMembershipLedger(pool, {
      accountId: resolvedAccountId,
      memberId,
      fee,
      checkoutSessionId: session.id,
      purchasedAt,
      grossCents: fee.amountCents,
      discountCents,
    })

    if (promo?.ruleId && discountCents > 0) {
      await recordMembershipPromoRedemption(pool, {
        ruleId: promo.ruleId,
        memberId,
        discountCents,
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
