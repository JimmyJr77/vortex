/**
 * Standalone annual membership purchase (access-only — no class signup).
 * Year 1 collected at Checkout; yearly Stripe subscription renews on anniversary.
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

/**
 * Create Stripe Checkout for annual membership only (no class enrollment).
 */
export async function createAnnualMembershipCheckoutSession(
  pool,
  { account, athleteMemberId, payerMemberId, successUrl, cancelUrl },
) {
  if (!stripeEnabled()) return null
  await ensureStripeBillingSchema(pool)
  await ensureStripeCatalogSchema(pool)

  const access = await ensureFamilyMemberAccess(pool, {
    familyId: account.family_id,
    memberId: athleteMemberId,
    payerMemberId,
  })
  if (!access.ok) {
    const err = new Error(access.message)
    err.status = access.status
    throw err
  }

  if (await memberHasActiveAnnualMembership(pool, athleteMemberId)) {
    const err = new Error('This athlete already has an active annual membership.')
    err.status = 409
    throw err
  }

  const fee = await loadAnnualMembershipFee(pool)
  if (!fee) {
    const err = new Error('Annual membership is not available right now.')
    err.status = 404
    throw err
  }

  const stripe = await getStripeClient()
  if (!stripe) return null

  const customerId = await ensureStripeCustomer(pool, stripe, account)
  const lookupKey = feeLookupKey(fee.id)
  const priceId = await resolveStripePriceId(pool, lookupKey)

  const athleteName = [access.member.first_name, access.member.last_name].filter(Boolean).join(' ').trim()
  const productName = `${fee.name || ANNUAL_MEMBERSHIP_PROGRAM_NAME}${
    athleteName ? ` · ${athleteName}` : ''
  }`.slice(0, 200)

  const lineItems = priceId
    ? [{ price: priceId, quantity: 1 }]
    : [
        {
          quantity: 1,
          price_data: {
            currency: 'usd',
            unit_amount: fee.amountCents,
            product_data: {
              name: productName,
              description: 'Valid for 1 year from purchase. Renews annually.',
            },
          },
        },
      ]

  const session = await stripe.checkout.sessions.create({
    mode: 'payment',
    customer: customerId,
    line_items: lineItems,
    success_url: successUrl || `${publicAppUrl()}/?billing=membership-paid`,
    cancel_url: cancelUrl || `${publicAppUrl()}/?billing=membership-cancelled`,
    payment_intent_data: { setup_future_usage: 'off_session' },
    metadata: {
      checkoutType: 'annual_membership',
      familyBillingAccountId: String(account.id),
      memberId: String(athleteMemberId),
      payerMemberId: String(payerMemberId),
      feeId: String(fee.id),
      amountCents: String(fee.amountCents),
      feeName: String(fee.name || ANNUAL_MEMBERSHIP_PROGRAM_NAME).slice(0, 100),
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
}) {
  await ensureBillingChargeSchema(pool)
  const renewsOnKey =
    toUtcDateString(membershipRenewsOnFromPurchase(purchasedAt)) || toUtcDateString(purchasedAt)
  const sourceId = `${fee.id}:${memberId}:${renewsOnKey}`

  await pool.query(
    `
      INSERT INTO billing_charge
        (family_billing_account_id, member_id, source_type, source_id, description,
         amount_cents, gross_amount_cents, discount_amount_cents,
         charge_type, billing_interval, stripe_checkout_session_id, created_at)
      VALUES ($1, $2, 'additional_fee', $3, $4, $5, $5, 0, 'one_time', 'one_time', $6, $7)
      ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL
      DO NOTHING
    `,
    [
      accountId,
      memberId,
      sourceId,
      fee.name || ANNUAL_MEMBERSHIP_PROGRAM_NAME,
      fee.amountCents,
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
    [fee.id, memberId, renewsOnKey, fee.amountCents],
  )
}

/**
 * Finalize standalone annual membership after Stripe Checkout payment.
 */
export async function commitAnnualMembershipCheckout(pool, { stripeSession, accountId }) {
  const session =
    typeof stripeSession === 'string'
      ? await (await getStripeClient()).checkout.sessions.retrieve(stripeSession)
      : stripeSession
  if (!session?.id) return { status: 'none' }
  if (session.metadata?.checkoutType !== 'annual_membership') return { status: 'none' }

  const memberId = Number(session.metadata.memberId)
  const feeId = Number(session.metadata.feeId)
  const resolvedAccountId = accountId ?? Number(session.metadata.familyBillingAccountId)
  if (!memberId || !feeId || !resolvedAccountId) {
    return { status: 'error', reason: 'missing_metadata' }
  }

  if (session.payment_status !== 'paid' && session.status !== 'complete') {
    return { status: 'unpaid' }
  }

  if (await memberHasActiveAnnualMembership(pool, memberId)) {
    return { status: 'already_active' }
  }

  const feeRes = await pool.query(`SELECT * FROM additional_fee WHERE id = $1`, [feeId])
  const feeRow = feeRes.rows[0]
  if (!feeRow) return { status: 'error', reason: 'fee_not_found' }
  const fee = mapFeeRow(feeRow)

  const purchasedAt = session.created ? new Date(session.created * 1000) : new Date()
  await persistAnnualMembershipLedger(pool, {
    accountId: resolvedAccountId,
    memberId,
    fee,
    checkoutSessionId: session.id,
    purchasedAt,
  })

  const stripe = await getStripeClient()
  const payment = await recordEnrollmentStripePayment(pool, stripe, {
    session,
    accountId: resolvedAccountId,
    paidAt: purchasedAt,
  })

  if (stripe) {
    await createEnrollmentAnnualMembershipSubscriptions(pool, stripe, {
      preview: {
        additionalFees: {
          items: [
            {
              feeId: fee.id,
              name: fee.name,
              amountCents: fee.amountCents,
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

  return {
    status: 'completed',
    payment,
    memberId,
    renewsOn: toUtcDateString(membershipRenewsOnFromPurchase(purchasedAt)),
  }
}
