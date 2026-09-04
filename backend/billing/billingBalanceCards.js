import {
  ANNUAL_MEMBERSHIP_PRICING_KEY,
  ANNUAL_MEMBERSHIP_SOURCE_TYPE,
} from '../scheduling/membershipAnniversary.js'

function annualMembershipSubscription(subscription) {
  return (
    subscription.sourceType === ANNUAL_MEMBERSHIP_SOURCE_TYPE ||
    subscription.source_type === ANNUAL_MEMBERSHIP_SOURCE_TYPE ||
    subscription.pricingOptionKey === ANNUAL_MEMBERSHIP_PRICING_KEY ||
    subscription.pricing_option_key === ANNUAL_MEMBERSHIP_PRICING_KEY
  )
}

function billingMonthKey(value) {
  if (!value) return null
  if (value instanceof Date) return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 7)
  const match = String(value).match(/^(\d{4}-\d{2})/)
  if (match) return match[1]
  const parsed = new Date(value)
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString().slice(0, 7)
}

function chargeServiceMonth(charge) {
  return billingMonthKey(charge.service_period_start ?? charge.created_at)
}

/**
 * Split canonical ledger state into the cards that explain a household's
 * balance. This is a pure shared primitive: it performs no reads or writes.
 */
export function summarizeCustomerBalanceCards({
  charges = [],
  payments = [],
  subscriptions = [],
  refundsCents: _refundsCents = 0,
  recurringBillingMonth = null,
} = {}) {
  // A refund is money returned, not a new household debt. A charge-specific
  // refund is represented by its application reversal and/or linked offset
  // row below; an overpayment refund has neither. Adding raw refunds here
  // incorrectly turns a returned overpayment into "Outstanding balance".
  let outstandingChargesCents = 0
  let ledgerCreditCents = 0
  let currentRecurringSatisfiedCents = 0

  const activeRecurringSubscriptions = subscriptions.filter((subscription) => (
    subscription.status === 'active' && !annualMembershipSubscription(subscription)
  ))
  let monthlyRecurringCents = activeRecurringSubscriptions.reduce(
    (sum, subscription) => sum + Math.max(0, Number(
      subscription.netMonthlyCents ?? subscription.net_monthly_cents ?? 0,
    )),
    0,
  )
  let monthlyRecurringDiscountCents = activeRecurringSubscriptions.reduce(
    (sum, subscription) => sum + Math.max(0, Number(
      subscription.discountAmountCents ?? subscription.discount_amount_cents ?? 0,
    )),
    0,
  )

  const visibleCharges = charges.filter((charge) => (
    charge.metadata?.customerAuditVisibility !== 'suppressed'
  ))
  const chargesById = new Map(visibleCharges.map((charge) => [Number(charge.id), charge]))
  const linkedCreditOffsets = new Map()
  const linkedCreditRemainders = new Map()
  for (const credit of visibleCharges) {
    const creditAmount = Number(credit.amount_cents ?? 0)
    const explicitlyAllocated = credit.credit_allocated_amount_cents
      ?? credit.creditAllocatedAmountCents
    const relatedChargeId = Number(credit.related_charge_id ?? credit.relatedChargeId ?? 0)
    const relatedCharge = chargesById.get(relatedChargeId)
    if (creditAmount >= 0) continue
    if (explicitlyAllocated != null && Number(explicitlyAllocated) > 0) {
      linkedCreditRemainders.set(
        Number(credit.id),
        Math.max(0, Math.abs(creditAmount) - Number(explicitlyAllocated)),
      )
      continue
    }
    if (!relatedCharge || Number(relatedCharge.amount_cents ?? 0) <= 0) continue
    const targetRemaining = Math.max(0, Number(
      relatedCharge.remaining_amount_cents ?? relatedCharge.amount_cents ?? 0,
    ) - (linkedCreditOffsets.get(relatedChargeId) ?? 0))
    const offset = Math.min(Math.abs(creditAmount), targetRemaining)
    linkedCreditOffsets.set(relatedChargeId, (linkedCreditOffsets.get(relatedChargeId) ?? 0) + offset)
    linkedCreditRemainders.set(Number(credit.id), Math.abs(creditAmount) - offset)
  }

  for (const charge of visibleCharges) {
    const amount = Number(charge.amount_cents ?? 0)
    if (amount < 0) {
      ledgerCreditCents += linkedCreditRemainders.get(Number(charge.id)) ?? Math.abs(amount)
      continue
    }
    if (amount <= 0) continue
    const remaining = Math.max(0, Number(charge.remaining_amount_cents ?? amount)
      - (linkedCreditOffsets.get(Number(charge.id)) ?? 0))
    const isCurrentRecurring = charge.charge_type === 'recurring'
      && recurringBillingMonth != null
      && chargeServiceMonth(charge) === recurringBillingMonth
    if (isCurrentRecurring) {
      // A payment or credit applied to this month's tuition belongs to this
      // month's fee, not to Future credits. Counting it in both places makes
      // a settled bill appear due again on the account card.
      currentRecurringSatisfiedCents += Math.min(
        amount,
        Math.max(0, amount - remaining),
      )
      if (activeRecurringSubscriptions.length === 0) {
        monthlyRecurringCents += amount
        monthlyRecurringDiscountCents += Math.max(0, Number(charge.discount_amount_cents ?? 0))
      }
      continue
    }
    if (remaining) outstandingChargesCents += remaining
  }

  const unappliedPaymentCents = payments.reduce(
    (sum, payment) => sum + Math.max(0, Number(payment.remaining_amount_cents ?? 0)),
    0,
  )
  return {
    outstandingBalanceCents: outstandingChargesCents,
    monthlyRecurringCents: Math.max(0, monthlyRecurringCents - currentRecurringSatisfiedCents),
    monthlyRecurringDiscountCents: currentRecurringSatisfiedCents >= monthlyRecurringCents
      ? 0
      : monthlyRecurringDiscountCents,
    currentRecurringSatisfiedCents,
    futureCreditsCents: ledgerCreditCents + unappliedPaymentCents,
  }
}
