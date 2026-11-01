import { enrollmentNeedsStripeCheckout } from '../billing/stripeEnrollmentCheckout.js'

/** billingCheckout is server-only context from verified Stripe fulfillment. */
export function requireSignupCheckout(preview, billingCheckout = null) {
  if (!preview || preview.hasPricing === false) throw new Error('Enrollment pricing is unavailable. Please try again.')
  if (!billingCheckout?.stripeCheckoutSessionId && enrollmentNeedsStripeCheckout(preview)) {
    const error = new Error('Payment checkout is required. Please complete enrollment through the member portal.')
    error.code = 'ENROLLMENT_CHECKOUT_REQUIRED'
    error.statusCode = 402
    throw error
  }
}
