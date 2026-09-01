export const BILLING_CANONICAL_READ_MODES = Object.freeze(['off', 'shadow', 'active'])
export const BILLING_CLASS_SUBSCRIPTION_CREATION_MODES = Object.freeze([
  'legacy',
  'household_only',
])
export const BILLING_STRIPE_SUBSCRIPTION_CREATION_MODES = Object.freeze([
  'disabled',
])

export function billingCanonicalReadMode(environment = process.env) {
  const mode = String(environment?.BILLING_CANONICAL_READ_MODE ?? 'off').trim().toLowerCase()
  if (!BILLING_CANONICAL_READ_MODES.includes(mode)) {
    throw new Error(
      `BILLING_CANONICAL_READ_MODE must be one of ${BILLING_CANONICAL_READ_MODES.join(', ')}.`,
    )
  }
  return mode
}

export function billingFlagEnabled(name, environment = process.env) {
  return String(environment?.[name] ?? '').trim().toLowerCase() === 'true'
}

export function billingCollectionCutoverEnabled(environment = process.env) {
  return billingFlagEnabled('BILLING_COLLECTION_CUTOVER_ENABLED', environment)
}

export function billingEnrollmentAutoRepairEnabled(environment = process.env) {
  return billingFlagEnabled('BILLING_ENROLLMENT_AUTO_REPAIR_ENABLED', environment)
}

export function billingHouseholdAutoActivateEnabled(environment = process.env) {
  return billingFlagEnabled('BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED', environment)
}

export function billingHouseholdInvoiceEnabled(environment = process.env) {
  return billingFlagEnabled('BILLING_HOUSEHOLD_INVOICE_ENABLED', environment)
}

/**
 * New Stripe Subscription objects are permanently disabled on the canonical
 * billing read/write path. Existing remote subscriptions may still be read,
 * repriced, paused, or retired until their account completes migration, but a
 * checkout or repair must never add another class or annual collector.
 *
 * Keeping this as an explicit, single-value mode makes stale deployment
 * configuration fail closed instead of silently restoring a legacy creator.
 */
export function billingStripeSubscriptionCreationMode(environment = process.env) {
  const mode = String(
    environment?.BILLING_STRIPE_SUBSCRIPTION_CREATION_MODE ?? 'disabled',
  ).trim().toLowerCase()
  if (!BILLING_STRIPE_SUBSCRIPTION_CREATION_MODES.includes(mode)) {
    throw new Error(
      'BILLING_STRIPE_SUBSCRIPTION_CREATION_MODE must be disabled.',
    )
  }
  return mode
}

export function billingStripeSubscriptionCreationAllowed(environment = process.env) {
  billingStripeSubscriptionCreationMode(environment)
  return false
}

/**
 * Global collection-creation phase for non-annual class enrollments.
 *
 * `legacy` remains accepted only so old deployment configuration and migration
 * evidence can be read safely. The global future-creation invariant still
 * blocks it. `household_only` records the canonical production phase.
 */
export function billingClassSubscriptionCreationMode(environment = process.env) {
  const mode = String(
    environment?.BILLING_CLASS_SUBSCRIPTION_CREATION_MODE ?? 'household_only',
  ).trim().toLowerCase()
  if (!BILLING_CLASS_SUBSCRIPTION_CREATION_MODES.includes(mode)) {
    throw new Error(
      'BILLING_CLASS_SUBSCRIPTION_CREATION_MODE must be one of '
      + `${BILLING_CLASS_SUBSCRIPTION_CREATION_MODES.join(', ')}.`,
    )
  }
  return mode
}

/**
 * No new per-class Stripe collector is available. Existing account and
 * migration state checks remain in callers as defense in depth while legacy
 * configuration is retired.
 *
 * @deprecated Select the collector from durable account state instead.
 */
export function legacyPerClassStripeCollectionAllowed(environment = process.env) {
  // Preserve strict validation of configured modes. Read/cutover permissions
  // still never select an account's collector by themselves.
  billingCanonicalReadMode(environment)
  billingClassSubscriptionCreationMode(environment)
  return billingStripeSubscriptionCreationAllowed(environment)
}
