function objectId(value) {
  if (!value) return null
  return typeof value === 'string' ? value : value.id ?? null
}

function monthKey(value) {
  if (value instanceof Date) {
    return Number.isNaN(value.getTime()) ? null : value.toISOString().slice(0, 7)
  }
  const match = String(value ?? '').match(/^(\d{4})-(0[1-9]|1[0-2])(?:-(\d{2}))?$/)
  if (!match) return null
  if (match[3]) {
    const date = new Date(`${match[1]}-${match[2]}-${match[3]}T12:00:00.000Z`)
    if (
      Number.isNaN(date.getTime())
      || date.getUTCFullYear() !== Number(match[1])
      || date.getUTCMonth() + 1 !== Number(match[2])
      || date.getUTCDate() !== Number(match[3])
    ) return null
  }
  return `${match[1]}-${match[2]}`
}

function result(ready, reason, {
  paymentMethodId = null,
  paymentMethodType = null,
  customerId = null,
  billingMonth = null,
} = {}) {
  return {
    ready,
    reason,
    paymentMethodId,
    paymentMethodType,
    customerId,
    billingMonth,
  }
}

/**
 * Pure, fail-closed classification for payment methods that Vortex can pass to
 * Stripe for an off-session household invoice payment.
 */
export function classifyStripePaymentMethodReadiness(paymentMethod, {
  expectedCustomerId,
  billingMonth,
} = {}) {
  const paymentMethodId = objectId(paymentMethod)
  const paymentMethodType = typeof paymentMethod?.type === 'string'
    ? paymentMethod.type
    : null
  const expected = objectId(expectedCustomerId)
  const customerId = objectId(paymentMethod?.customer) ?? objectId(paymentMethod?.customerId)
  const target = monthKey(billingMonth)
  const details = { paymentMethodId, paymentMethodType, customerId, billingMonth: target }

  if (!paymentMethodId) return result(false, 'payment_method_required', details)
  if (!expected) return result(false, 'payment_method_expected_customer_required', details)
  if (!customerId || customerId !== expected) {
    return result(false, 'payment_method_customer_mismatch', details)
  }
  if (!target) return result(false, 'payment_method_billing_month_invalid', details)

  if (paymentMethodType === 'link') {
    if (paymentMethod.metadata?.vortexPaymentMethodBlockedReason === 'link_account_closed') {
      return result(false, 'link_account_closed', details)
    }
    return result(true, null, details)
  }
  if (paymentMethodType !== 'card') {
    return result(false, 'payment_method_type_unsupported', details)
  }

  const expMonth = Number(paymentMethod?.card?.exp_month ?? paymentMethod?.expMonth)
  const expYear = Number(paymentMethod?.card?.exp_year ?? paymentMethod?.expYear)
  if (
    !Number.isSafeInteger(expMonth)
    || expMonth < 1
    || expMonth > 12
    || !Number.isSafeInteger(expYear)
    || expYear < 1
  ) {
    return result(false, 'payment_method_card_expiration_invalid', details)
  }
  const [targetYear, targetMonth] = target.split('-').map(Number)
  if (expYear < targetYear || (expYear === targetYear && expMonth < targetMonth)) {
    return result(false, 'payment_method_card_expired_for_billing_month', details)
  }
  return result(true, null, details)
}

function selected(paymentMethod, readiness, source) {
  return { paymentMethod, readiness, source }
}

function missing(reason = 'payment_method_required', { billingMonth } = {}) {
  return selected(null, result(false, reason, { billingMonth: monthKey(billingMonth) }), null)
}

/**
 * Load only the customer's configured invoice default and apply the same
 * pure readiness rules used by every household collection surface. An
 * attached PaymentMethod is not necessarily the method the customer chose
 * for household invoices, so automatic collection must not select one merely
 * because it appears in the customer's PaymentMethod inventory.
 */
export async function selectStripeCustomerPaymentMethod(stripe, customer, {
  expectedCustomerId,
  billingMonth,
} = {}) {
  const expected = objectId(expectedCustomerId)
  const noMethod = (reason) => missing(reason, { billingMonth })
  if (!customer || customer.deleted === true) return noMethod('stripe_customer_missing')
  if (!expected || objectId(customer) !== expected) {
    return noMethod('stripe_customer_mismatch')
  }

  const defaultReference = customer.invoice_settings?.default_payment_method ?? null
  if (defaultReference) {
    let paymentMethod = defaultReference
    if (typeof defaultReference === 'string') {
      if (!stripe?.paymentMethods?.retrieve) return noMethod('payment_method_details_unavailable')
      try {
        paymentMethod = await stripe.paymentMethods.retrieve(defaultReference)
      } catch (error) {
        if (error?.code === 'resource_missing') return noMethod('payment_method_missing')
        throw error
      }
    }
    return selected(
      paymentMethod,
      classifyStripePaymentMethodReadiness(paymentMethod, {
        expectedCustomerId: expected,
        billingMonth,
      }),
      'default',
    )
  }

  return noMethod('payment_method_required')
}

/** Remember a definitive Link revocation on the exact method, never another default. */
export async function markClosedStripeLinkConnection(stripe, paymentIntent) {
  const failure = paymentIntent?.last_payment_error
  const closed = ['link_account_closed', 'link_connection_closed'].includes(failure?.code)
    || failure?.doc_url === 'https://stripe.com/docs/error-codes/link-account-closed'
  if (!closed) return false
  const customerId = objectId(paymentIntent.customer)
  const paymentMethodId = objectId(failure.payment_method) || objectId(paymentIntent.payment_method)
  if (!customerId || !paymentMethodId) return false
  const method = await stripe.paymentMethods.retrieve(paymentMethodId)
  if (method.type !== 'link' || objectId(method.customer) !== customerId) return false
  await stripe.paymentMethods.update(paymentMethodId, {
    metadata: { vortexPaymentMethodBlockedReason: 'link_account_closed' },
  })
  return true
}
