/**
 * Human-readable payment method labels for billing history / ledgers.
 * Last-4 card digits are safe to display (Stripe PaymentMethod.card.last4).
 */

const BRAND_LABELS = {
  amex: 'Amex',
  american_express: 'Amex',
  diners: 'Diners Club',
  discover: 'Discover',
  jcb: 'JCB',
  mastercard: 'Mastercard',
  unionpay: 'UnionPay',
  visa: 'Visa',
}

export function titleCaseCardBrand(brand) {
  const key = String(brand || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, '_')
  if (!key) return null
  if (BRAND_LABELS[key]) return BRAND_LABELS[key]
  return key
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ')
}

/** True when the stored method is a generic placeholder without last4. */
export function isGenericCardMethod(method) {
  const value = String(method || '').trim()
  if (!value) return true
  return /^(card|credit\s*card|debit\s*card)$/i.test(value)
}

/**
 * @param {{ brand?: string|null, last4?: string|null }} card
 * @returns {string} e.g. "Visa •••• 4969"
 */
export function formatCardPaymentMethodLabel(card = {}) {
  const digits = String(card.last4 || '')
    .replace(/\D/g, '')
    .slice(-4)
  const brandLabel = titleCaseCardBrand(card.brand) || 'Card'
  if (digits.length !== 4) return brandLabel
  return `${brandLabel} •••• ${digits}`
}

export function formatPaymentMethodLabelFromStripePaymentMethod(paymentMethod) {
  if (!paymentMethod || typeof paymentMethod !== 'object') return null
  if (paymentMethod.card?.last4) {
    return formatCardPaymentMethodLabel(paymentMethod.card)
  }
  if (paymentMethod.us_bank_account?.last4) {
    const bank = paymentMethod.us_bank_account.bank_name || 'Bank'
    return `${bank} •••• ${paymentMethod.us_bank_account.last4}`
  }
  if (paymentMethod.type === 'link') return 'Link'
  if (paymentMethod.type === 'cashapp') return 'Cash App'
  return null
}

/** Prefer charge.payment_method_details when it exposes card last4 (incl. some wallets). */
export function formatPaymentMethodLabelFromChargeDetails(details) {
  if (!details || typeof details !== 'object') return null
  if (details.card?.last4) {
    return formatCardPaymentMethodLabel(details.card)
  }
  if (details.type === 'link' && details.link) {
    // Link does not expose underlying card last4 to merchants via the API.
    return 'Link'
  }
  if (details.type === 'card_present' && details.card_present?.last4) {
    return formatCardPaymentMethodLabel(details.card_present)
  }
  return null
}

/**
 * Resolve a display label from Stripe objects. Falls back to "Card" when unknown.
 * @param {import('stripe').Stripe|null|undefined} stripe
 */
export async function resolveStripePaymentMethodLabel(
  stripe,
  { paymentIntentId = null, checkoutSessionId = null, invoice = null, paymentMethodId = null } = {},
) {
  if (!stripe) return 'Card'

  try {
    let pm = null

    if (paymentMethodId) {
      pm =
        typeof paymentMethodId === 'object'
          ? paymentMethodId
          : await stripe.paymentMethods.retrieve(paymentMethodId)
    }

    if (!pm && paymentIntentId) {
      const pi = await stripe.paymentIntents.retrieve(paymentIntentId, {
        expand: ['payment_method', 'latest_charge'],
      })
      const fromCharge = formatPaymentMethodLabelFromChargeDetails(
        pi.latest_charge?.payment_method_details,
      )
      if (fromCharge && !isGenericCardMethod(fromCharge) && fromCharge !== 'Link') {
        return fromCharge
      }
      pm =
        typeof pi.payment_method === 'object'
          ? pi.payment_method
          : pi.payment_method
            ? await stripe.paymentMethods.retrieve(pi.payment_method)
            : null
      const fromPm = formatPaymentMethodLabelFromStripePaymentMethod(pm)
      if (fromPm) return fromPm
      if (fromCharge) return fromCharge
    }

    if (!pm && checkoutSessionId) {
      const session = await stripe.checkout.sessions.retrieve(checkoutSessionId, {
        expand: [
          'payment_intent.payment_method',
          'setup_intent.payment_method',
        ],
      })
      const fromPi = session.payment_intent?.payment_method
      const fromSetup = session.setup_intent?.payment_method
      pm =
        (fromPi && typeof fromPi === 'object' ? fromPi : null) ||
        (fromSetup && typeof fromSetup === 'object' ? fromSetup : null) ||
        null
      if (!pm && typeof fromPi === 'string') {
        pm = await stripe.paymentMethods.retrieve(fromPi)
      } else if (!pm && typeof fromSetup === 'string') {
        pm = await stripe.paymentMethods.retrieve(fromSetup)
      }
    }

    if (!pm && invoice) {
      const chargeId =
        typeof invoice.charge === 'string' ? invoice.charge : invoice.charge?.id
      if (chargeId) {
        const charge = await stripe.charges.retrieve(chargeId)
        if (charge.payment_method_details?.card?.last4) {
          return formatCardPaymentMethodLabel(charge.payment_method_details.card)
        }
        if (charge.payment_method) {
          pm =
            typeof charge.payment_method === 'object'
              ? charge.payment_method
              : await stripe.paymentMethods.retrieve(charge.payment_method)
        }
      }
      const invPm =
        invoice.default_payment_method ||
        invoice.payment_intent?.payment_method ||
        null
      if (!pm && invPm) {
        pm =
          typeof invPm === 'object'
            ? invPm
            : await stripe.paymentMethods.retrieve(invPm)
      }
    }

    return formatPaymentMethodLabelFromStripePaymentMethod(pm) || 'Card'
  } catch (err) {
    console.warn('[stripe] resolve payment method label:', err?.message ?? err)
    return 'Card'
  }
}
