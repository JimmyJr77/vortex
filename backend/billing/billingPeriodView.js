/**
 * Calendar-month billing period views for the member portal.
 * Charges use service_period_start when set, otherwise created_at.
 * Payments use paid_at.
 */

export function periodKeyFromDate(date) {
  const d = date instanceof Date ? date : new Date(date)
  if (Number.isNaN(d.getTime())) return null
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  return `${y}-${m}`
}

export function periodLabelFromKey(key) {
  const [y, m] = String(key).split('-').map(Number)
  return new Date(y, m - 1, 1).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

export function periodBoundsFromKey(key) {
  const [y, m] = String(key).split('-').map(Number)
  const startDate = `${y}-${String(m).padStart(2, '0')}-01`
  const endDay = new Date(y, m, 0).getDate()
  const endDate = `${y}-${String(m).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`
  return { startDate, endDate }
}

export function chargeOccurredAt(charge) {
  const category = chargeDisplayCategory(charge)
  // Enrollment checkout posts in the month paid at signup, not the covered service month.
  if (category === 'enrollment_first_month' || category === 'membership_fee') {
    return charge.created_at
  }
  return charge.service_period_start ?? charge.created_at
}

export function chargeInPeriod(charge, periodKey) {
  return periodKeyFromDate(chargeOccurredAt(charge)) === periodKey
}

export function paymentInPeriod(payment, periodKey) {
  return periodKeyFromDate(payment.paid_at) === periodKey
}

export function chargeDisplayCategory(charge) {
  if (charge.source_type === 'additional_fee') return 'membership_fee'
  if (charge.charge_type === 'credit' || Number(charge.amount_cents ?? 0) < 0) return 'credit'
  if (charge.charge_type === 'adjustment' && Number(charge.amount_cents ?? 0) > 0) return 'debit'
  if (charge.source_type === 'billing_subscription') return 'recurring_cycle'
  if (charge.source_type === 'scheduling_signup' && charge.charge_type === 'recurring') {
    return 'enrollment_first_month'
  }
  if (charge.charge_type === 'recurring') return 'recurring_cycle'
  return 'one_time'
}

function mapSubscriptionSummary(row) {
  return {
    id: Number(row.id),
    memberId: row.member_id != null ? Number(row.member_id) : null,
    memberName: row.member_name ?? null,
    description: row.description,
    monthlyAmountCents: Number(row.monthly_amount_cents ?? 0),
    discountAmountCents: Number(row.discount_amount_cents ?? 0),
    netMonthlyCents: Number(row.net_monthly_cents ?? 0),
    status: row.status,
    nextBillDate: row.next_bill_date ?? null,
  }
}

function mapChargeRow(charge) {
  const amountCents = Number(charge.amount_cents ?? 0)
  return {
    id: Number(charge.id),
    description: charge.description,
    amountCents,
    grossCents: Number(charge.gross_amount_cents ?? amountCents),
    discountCents: Number(charge.discount_amount_cents ?? 0),
    displayCategory: chargeDisplayCategory(charge),
    occurredAt: chargeOccurredAt(charge),
    memberName: charge.member_name ?? null,
    stripeCheckoutSessionId: charge.stripe_checkout_session_id ?? null,
  }
}

function mapPaymentRow(payment) {
  return {
    id: Number(payment.id),
    amountCents: Number(payment.amount_cents ?? 0),
    paidAt: payment.paid_at,
    method: payment.method ?? null,
    stripePaymentIntentId: payment.stripe_payment_intent_id ?? null,
    stripeCheckoutSessionId: payment.stripe_checkout_session_id ?? null,
    stripeInvoiceId: payment.stripe_invoice_id ?? null,
  }
}

function paymentForCheckoutSession(payments, checkoutSessionId) {
  if (!checkoutSessionId) return null
  return payments.find((p) => p.stripe_checkout_session_id === checkoutSessionId) ?? null
}

function membershipFeePaidAt(charge, payments) {
  const linked = paymentForCheckoutSession(payments, charge.stripe_checkout_session_id)
  if (linked?.paid_at) return linked.paid_at
  const sameMonth = payments.filter((p) => paymentInPeriod(p, periodKeyFromDate(chargeOccurredAt(charge))))
  if (sameMonth.length === 1) return sameMonth[0].paid_at
  return chargeOccurredAt(charge)
}

/**
 * @param {{ charges: object[], payments: object[], subscriptions: object[], asOf?: Date }} input
 */
export function buildCurrentPeriod({ charges = [], payments = [], subscriptions = [], asOf = new Date() }) {
  const key = periodKeyFromDate(asOf)
  const { startDate, endDate } = periodBoundsFromKey(key)
  const label = periodLabelFromKey(key)

  const periodCharges = charges.filter((c) => chargeInPeriod(c, key))
  const periodPayments = payments.filter((p) => paymentInPeriod(p, key))

  let chargesCents = 0
  let debitsCents = 0
  let creditsCents = 0

  const recurringCharges = []
  const oneTimePurchases = []
  const debits = []
  const credits = []
  const membershipFees = []

  for (const charge of periodCharges) {
    const cat = chargeDisplayCategory(charge)
    const amt = Number(charge.amount_cents ?? 0)
    const row = mapChargeRow(charge)

    if (cat === 'credit') {
      creditsCents += Math.abs(amt)
      credits.push(row)
    } else if (cat === 'debit') {
      debitsCents += amt
      debits.push(row)
    } else if (cat === 'membership_fee') {
      chargesCents += amt
      membershipFees.push({
        description: charge.description,
        amountCents: amt,
        paidAt: membershipFeePaidAt(charge, payments),
        stripeCheckoutSessionId: charge.stripe_checkout_session_id ?? null,
        memberName: charge.member_name ?? null,
      })
    } else if (cat === 'enrollment_first_month' || cat === 'recurring_cycle') {
      chargesCents += amt
      recurringCharges.push(row)
    } else {
      chargesCents += amt
      oneTimePurchases.push(row)
    }
  }

  const paymentsCents = periodPayments.reduce((sum, p) => sum + Number(p.amount_cents ?? 0), 0)
  const balanceDueCents = chargesCents + debitsCents - creditsCents - paymentsCents

  const activeSubs = subscriptions.filter((s) => s.status === 'active')
  const recurringEnrollments = activeSubs.map((s) =>
    typeof s.netMonthlyCents === 'number' ? s : mapSubscriptionSummary(s),
  )

  return {
    key,
    label,
    startDate,
    endDate,
    totals: {
      chargesCents,
      debitsCents,
      creditsCents,
      paymentsCents,
      balanceDueCents,
    },
    membershipFees,
    recurringEnrollments,
    recurringCharges,
    oneTimePurchases,
    debits,
    credits,
    payments: periodPayments.map(mapPaymentRow),
  }
}

function historyLineFromCharge(charge) {
  const cat = chargeDisplayCategory(charge)
  const netCents = Number(charge.amount_cents ?? 0)
  return {
    kind: cat,
    description: charge.description,
    grossCents: Number(charge.gross_amount_cents ?? netCents),
    discountCents: Number(charge.discount_amount_cents ?? 0),
    netCents,
    occurredAt: chargeOccurredAt(charge),
    memberName: charge.member_name ?? null,
    stripeRef:
      charge.stripe_checkout_session_id ??
      (charge.source_type === 'scheduling_signup' ? charge.source_id : null),
  }
}

function historyLineFromPayment(payment) {
  return {
    kind: 'payment',
    description: payment.method?.trim() ? payment.method : 'Payment',
    netCents: -Number(payment.amount_cents ?? 0),
    occurredAt: payment.paid_at,
    memberName: null,
    stripeRef:
      payment.stripe_payment_intent_id ??
      payment.stripe_checkout_session_id ??
      payment.stripe_invoice_id ??
      null,
  }
}

/**
 * @param {{ charges: object[], payments: object[], months?: number, asOf?: Date }} input
 */
export function buildBillingHistory({ charges = [], payments = [], months = 12, asOf = new Date() }) {
  const history = []
  const cursor = new Date(asOf.getFullYear(), asOf.getMonth(), 1)

  for (let i = 0; i < months; i += 1) {
    const key = periodKeyFromDate(cursor)
    const { startDate, endDate } = periodBoundsFromKey(key)
    const label = periodLabelFromKey(key)

    const monthCharges = charges.filter((c) => chargeInPeriod(c, key))
    const monthPayments = payments.filter((p) => paymentInPeriod(p, key))

    const lines = [
      ...monthCharges.map(historyLineFromCharge),
      ...monthPayments.map(historyLineFromPayment),
    ].sort((a, b) => {
      const ta = new Date(a.occurredAt).getTime()
      const tb = new Date(b.occurredAt).getTime()
      if (ta !== tb) return ta - tb
      return String(a.kind).localeCompare(String(b.kind))
    })

    const chargeSum = monthCharges.reduce((sum, c) => {
      const cat = chargeDisplayCategory(c)
      const amt = Number(c.amount_cents ?? 0)
      if (cat === 'credit') return sum - Math.abs(amt)
      return sum + amt
    }, 0)
    const paymentSum = monthPayments.reduce((sum, p) => sum + Number(p.amount_cents ?? 0), 0)
    const closingBalanceCents = chargeSum - paymentSum

    history.push({
      periodKey: key,
      label,
      startDate,
      endDate,
      closingBalanceCents,
      lines,
    })

    cursor.setMonth(cursor.getMonth() - 1)
  }

  return history
}

/**
 * Attach displayCategory to raw charge rows for API consumers.
 */
export function enrichChargesWithDisplayCategory(charges = []) {
  return charges.map((c) => ({
    ...c,
    displayCategory: chargeDisplayCategory(c),
  }))
}
