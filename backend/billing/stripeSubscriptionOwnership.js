import { billingMigrationCollectionLocked } from './canonicalBillingMigrationState.js'

function objectId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

function conflict(code, reason, details = {}) {
  return {
    expectedLegacy: false,
    code,
    reason,
    accountId: null,
    ...details,
  }
}

/**
 * Resolve the durable local owner of a recurring Stripe Subscription.
 *
 * A remote subscription is an expected legacy collector only when it has one
 * exact current local link, its Stripe customer matches that account, and the
 * account is neither household-collected nor collection-locked by migration.
 * Immutable migration claims keep detached/former IDs attributable so they
 * are quarantined instead of being mistaken for unknown legacy collectors.
 */
export async function classifyLegacyStripeSubscriptionOwnership(pool, {
  stripeSubscriptionId,
  stripeCustomerId = null,
  metadataAccountId = null,
} = {}) {
  const subscriptionId = String(stripeSubscriptionId ?? '').trim()
  if (!subscriptionId) {
    return conflict('stripe_subscription_id_missing', 'The Stripe subscription ID is missing.')
  }

  const result = await pool.query(
    `/* stripe-subscription:ownership */
     WITH current_links AS (
       SELECT subscription.id AS billing_subscription_id,
              subscription.family_billing_account_id,
              subscription.member_id,
              subscription.source_type,
              subscription.pricing_option_key,
              subscription.status AS local_status,
              account.stripe_customer_id,
              (
                SELECT COUNT(*)::integer
                  FROM family_billing_account customer_owner
                 WHERE customer_owner.stripe_customer_id = account.stripe_customer_id
              ) AS stripe_customer_owner_count,
              account.household_monthly_billing_enabled,
              migration.state AS migration_state
         FROM billing_subscription subscription
         JOIN family_billing_account account
           ON account.id = subscription.family_billing_account_id
         LEFT JOIN LATERAL (
           SELECT candidate.state
             FROM billing_account_migration candidate
            WHERE candidate.family_billing_account_id = account.id
            ORDER BY candidate.id DESC
            LIMIT 1
         ) migration ON TRUE
        WHERE subscription.stripe_subscription_id = $1
        ORDER BY subscription.id
        LIMIT 3
     ), immutable_claim AS (
       SELECT claim.family_billing_account_id AS claimed_account_id
         FROM billing_migration_subscription_claim claim
        WHERE claim.claim_kind = 'stripe_subscription'
          AND claim.claim_value = $1
        LIMIT 1
     )
     SELECT current_links.*, immutable_claim.claimed_account_id
       FROM current_links
       FULL OUTER JOIN immutable_claim ON TRUE`,
    [subscriptionId],
  )
  const rows = result.rows ?? []
  const currentRows = rows.filter((row) => row.billing_subscription_id != null)
  const claimedAccountIds = [...new Set(rows
    .map((row) => Number(row.claimed_account_id))
    .filter((value) => Number.isSafeInteger(value) && value > 0))]

  if (currentRows.length === 0) {
    if (claimedAccountIds.length === 1) {
      return conflict(
        'stripe_subscription_former_canonical_collector',
        `Stripe subscription ${subscriptionId} is a former canonical-migration collector and is not eligible for legacy settlement.`,
        { accountId: claimedAccountIds[0], claimedAccountId: claimedAccountIds[0] },
      )
    }
    const observedCustomerId = objectId(stripeCustomerId)
    if (observedCustomerId) {
      const customerOwners = await pool.query(
        `/* stripe-subscription:customer-owner */
         SELECT account.id,
                account.household_monthly_billing_enabled,
                migration.state AS migration_state
           FROM family_billing_account account
           LEFT JOIN LATERAL (
             SELECT candidate.state
               FROM billing_account_migration candidate
              WHERE candidate.family_billing_account_id = account.id
              ORDER BY candidate.id DESC
              LIMIT 1
           ) migration ON TRUE
          WHERE account.stripe_customer_id = $1
          ORDER BY account.id
          LIMIT 3`,
        [String(observedCustomerId)],
      ).then((ownerResult) => ownerResult.rows ?? [])
      if (customerOwners.length > 1) {
        return conflict(
          'stripe_subscription_customer_owner_ambiguous',
          `Stripe subscription ${subscriptionId} customer maps to multiple billing accounts.`,
          { customerId: observedCustomerId },
        )
      }
      if (customerOwners.length === 1) {
        const owner = customerOwners[0]
        const accountId = Number(owner.id)
        if (owner.household_monthly_billing_enabled === true) {
          return conflict(
            'stripe_subscription_household_collector_conflict',
            `Unknown Stripe subscription ${subscriptionId} belongs to a customer already owned by household collection.`,
            { accountId, migrationState: owner.migration_state ?? null },
          )
        }
        if (billingMigrationCollectionLocked(owner.migration_state)) {
          return conflict(
            'stripe_subscription_cutover_collector_conflict',
            `Unknown Stripe subscription ${subscriptionId} belongs to a collection-locked migration account.`,
            { accountId, migrationState: owner.migration_state },
          )
        }
        return conflict(
          'stripe_subscription_owner_missing',
          `Stripe subscription ${subscriptionId} has no exact local owner.`,
          { accountId },
        )
      }
    }
    return conflict(
      'stripe_subscription_owner_missing',
      `Stripe subscription ${subscriptionId} has no exact local owner.`,
    )
  }
  if (currentRows.length !== 1) {
    return conflict(
      'stripe_subscription_owner_ambiguous',
      `Stripe subscription ${subscriptionId} is linked to multiple local subscriptions.`,
      { localSubscriptionIds: currentRows.map((row) => Number(row.billing_subscription_id)) },
    )
  }

  const row = currentRows[0]
  const accountId = Number(row.family_billing_account_id)
  if (claimedAccountIds.length > 1 || (
    claimedAccountIds.length === 1 && claimedAccountIds[0] !== accountId
  )) {
    return conflict(
      'stripe_subscription_owner_claim_conflict',
      `Stripe subscription ${subscriptionId} has conflicting current and immutable account owners.`,
      { accountId, claimedAccountIds },
    )
  }
  if (row.household_monthly_billing_enabled === true) {
    return conflict(
      'stripe_subscription_household_collector_conflict',
      `Stripe subscription ${subscriptionId} belongs to an account already owned by household collection.`,
      { accountId, migrationState: row.migration_state ?? null },
    )
  }
  if (billingMigrationCollectionLocked(row.migration_state)) {
    return conflict(
      'stripe_subscription_cutover_collector_conflict',
      `Stripe subscription ${subscriptionId} belongs to a collection-locked migration account.`,
      { accountId, migrationState: row.migration_state },
    )
  }

  if (Number(row.stripe_customer_owner_count) !== 1) {
    return conflict(
      'stripe_subscription_customer_owner_ambiguous',
      `Stripe subscription ${subscriptionId} customer does not have one unique billing-account owner.`,
      { accountId, customerOwnerCount: Number(row.stripe_customer_owner_count) || 0 },
    )
  }

  const expectedCustomerId = String(row.stripe_customer_id ?? '').trim() || null
  const observedCustomerId = objectId(stripeCustomerId)
  if (!expectedCustomerId || !observedCustomerId || expectedCustomerId !== String(observedCustomerId)) {
    return conflict(
      'stripe_subscription_customer_conflict',
      `Stripe subscription ${subscriptionId} customer does not exactly match its local billing account.`,
      { accountId, expectedCustomerId, observedCustomerId: observedCustomerId ?? null },
    )
  }

  const claimedMetadataAccountId = Number(metadataAccountId)
  if (
    metadataAccountId != null
    && metadataAccountId !== ''
    && (!Number.isSafeInteger(claimedMetadataAccountId) || claimedMetadataAccountId !== accountId)
  ) {
    return conflict(
      'stripe_subscription_metadata_account_conflict',
      `Stripe subscription ${subscriptionId} metadata disagrees with its local billing account.`,
      { accountId, metadataAccountId },
    )
  }

  return {
    expectedLegacy: true,
    code: null,
    reason: null,
    accountId,
    billingSubscriptionId: Number(row.billing_subscription_id),
    memberId: row.member_id == null ? null : Number(row.member_id),
    sourceType: row.source_type ?? null,
    pricingOptionKey: row.pricing_option_key ?? null,
    localStatus: row.local_status ?? null,
    stripeCustomerId: expectedCustomerId,
    migrationState: row.migration_state ?? null,
  }
}
