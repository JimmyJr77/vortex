const STRIPE_PAGE_SIZE = 100

function stripePaymentsUnavailable() {
  const error = new Error('Stripe payments are unavailable because Stripe is not configured.')
  error.code = 'STRIPE_PAYMENTS_UNAVAILABLE'
  error.statusCode = 503
  return error
}

function objectValue(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : null
}

function stringValue(value) {
  return typeof value === 'string' && value.trim() ? value : null
}

function objectId(value) {
  return stringValue(value) ?? stringValue(objectValue(value)?.id)
}

function stripeDate(value) {
  const seconds = Number(value)
  return Number.isFinite(seconds) && seconds > 0
    ? new Date(seconds * 1000).toISOString()
    : null
}

/**
 * Convert a Stripe PaymentIntent into the deliberately small DTO used by the
 * admin's Stripe-only payment viewer. No local billing or accounting records
 * are read or joined here.
 */
export function stripePaymentDto(paymentIntent) {
  const customer = objectValue(paymentIntent?.customer)
  const charge = objectValue(paymentIntent?.latest_charge)
  const paymentMethodDetails = objectValue(charge?.payment_method_details)

  return {
    id: stringValue(paymentIntent?.id) ?? 'unknown',
    createdAt: stripeDate(paymentIntent?.created),
    amountMinor: Number(paymentIntent?.amount ?? 0),
    amountReceivedMinor: Number(paymentIntent?.amount_received ?? 0),
    amountRefundedMinor: Number(charge?.amount_refunded ?? 0),
    currency: stringValue(paymentIntent?.currency) ?? 'usd',
    status: stringValue(paymentIntent?.status) ?? 'unknown',
    description: stringValue(paymentIntent?.description),
    customerId: objectId(paymentIntent?.customer),
    customerName: stringValue(customer?.name),
    customerEmail: stringValue(customer?.email) ?? stringValue(paymentIntent?.receipt_email),
    paymentMethod: stringValue(paymentMethodDetails?.type)
      ?? (Array.isArray(paymentIntent?.payment_method_types)
        ? stringValue(paymentIntent.payment_method_types[0])
        : null),
    latestChargeId: objectId(paymentIntent?.latest_charge),
    liveMode: paymentIntent?.livemode === true,
  }
}

/**
 * Fetch every PaymentIntent from the configured Stripe account, requesting
 * customer and charge details from Stripe itself. The caller supplies the
 * Stripe client so this remains independently testable and never depends on
 * the application's accounting database.
 */
export async function listStripePayments(stripe) {
  if (!stripe?.paymentIntents?.list) throw stripePaymentsUnavailable()

  const payments = []
  let startingAfter = null

  do {
    const page = await stripe.paymentIntents.list({
      limit: STRIPE_PAGE_SIZE,
      expand: ['data.customer', 'data.latest_charge'],
      ...(startingAfter ? { starting_after: startingAfter } : {}),
    })
    const intents = Array.isArray(page?.data) ? page.data : []

    payments.push(...intents.map(stripePaymentDto))

    if (!page?.has_more) break
    startingAfter = stringValue(intents.at(-1)?.id)
    if (!startingAfter) {
      throw new Error('Stripe returned another payments page without a cursor.')
    }
  } while (startingAfter)

  return {
    retrievedAt: new Date().toISOString(),
    payments,
  }
}
