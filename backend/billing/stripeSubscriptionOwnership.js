import { billingMigrationCollectionLocked } from './canonicalBillingMigrationState.js'

function objectId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

function invoiceSubscriptionId(invoice) {
  return objectId(invoice?.subscription)
    || objectId(invoice?.parent?.subscription_details?.subscription)
    || null
}

function parseJsonObject(value) {
  if (!value) return {}
  if (typeof value === 'object' && !Array.isArray(value)) return value
  if (typeof value !== 'string') return {}
  try {
    const parsed = JSON.parse(value)
    return parsed && typeof parsed === 'object' && !Array.isArray(parsed) ? parsed : {}
  } catch {
    return {}
  }
}

function positiveInteger(value) {
  const parsed = Number(value)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
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

function paidSettlementConflict(code, reason, details = {}) {
  return {
    expectedLegacy: false,
    paidSettlementVerified: false,
    code,
    reason,
    accountId: null,
    ...details,
  }
}

function metadataAccountClaim(metadata) {
  const raw = metadata?.familyBillingAccountId
  if (raw == null || String(raw).trim() === '') return { present: false, accountId: null }
  return { present: true, accountId: positiveInteger(raw), raw }
}

/**
 * Resolve ownership only for cash that Stripe already collected on a paid
 * subscription invoice. Unlike the strict collector/lifecycle classifier
 * above, current household, migration, account, and customer-owner drift are
 * alert conditions here rather than reasons to erase a real receipt.
 *
 * Ownership still never falls back to customer or invoice metadata. It must
 * come from one exact current subscription link, one exact immutable migration
 * claim, or both agreeing. Stripe is then re-read so the invoice,
 * subscription, customer, metadata, and durable local evidence all agree.
 */
export async function resolvePaidLegacyStripeSubscriptionOwnership(pool, {
  stripe,
  invoice,
} = {}) {
  const invoiceId = objectId(invoice)
  if (!invoiceId) {
    return paidSettlementConflict(
      'paid_stripe_invoice_id_missing',
      'The paid Stripe invoice ID is missing.',
    )
  }
  if (
    typeof stripe?.invoices?.retrieve !== 'function'
    || typeof stripe?.subscriptions?.retrieve !== 'function'
  ) {
    throw new Error('Fresh Stripe invoice and subscription retrieval are required for paid legacy settlement.')
  }

  const remoteInvoice = await stripe.invoices.retrieve(String(invoiceId))
  if (objectId(remoteInvoice) !== String(invoiceId)) {
    return paidSettlementConflict(
      'paid_stripe_invoice_identity_conflict',
      `Stripe returned a different invoice while verifying ${invoiceId}.`,
      { stripeInvoiceId: invoiceId, retrievedInvoiceId: objectId(remoteInvoice) },
    )
  }
  if (remoteInvoice?.status !== 'paid' && remoteInvoice?.paid !== true) {
    return paidSettlementConflict(
      'paid_stripe_invoice_not_paid',
      `Stripe invoice ${invoiceId} is not conclusively paid.`,
      { stripeInvoiceId: invoiceId, status: remoteInvoice?.status ?? null },
    )
  }

  const eventSubscriptionId = invoiceSubscriptionId(invoice)
  const subscriptionId = invoiceSubscriptionId(remoteInvoice)
  if (!subscriptionId) {
    return paidSettlementConflict(
      'paid_stripe_subscription_id_missing',
      `Paid Stripe invoice ${invoiceId} has no subscription binding.`,
      { stripeInvoiceId: invoiceId },
    )
  }
  if (eventSubscriptionId && String(eventSubscriptionId) !== String(subscriptionId)) {
    return paidSettlementConflict(
      'paid_stripe_invoice_subscription_conflict',
      `Paid Stripe invoice ${invoiceId} changed subscription identity before settlement.`,
      { stripeInvoiceId: invoiceId, eventSubscriptionId, subscriptionId },
    )
  }
  if (
    String(remoteInvoice?.metadata?.householdMonthlyInvoice ?? '') === 'true'
    || String(remoteInvoice?.metadata?.monthlyInvoiceId ?? '').trim() !== ''
  ) {
    return paidSettlementConflict(
      'invoice_collection_classification_conflict',
      `Paid Stripe invoice ${invoiceId} identifies both household and subscription collection.`,
      { stripeInvoiceId: invoiceId, subscriptionId },
    )
  }

  const remoteSubscription = await stripe.subscriptions.retrieve(String(subscriptionId))
  if (objectId(remoteSubscription) !== String(subscriptionId)) {
    return paidSettlementConflict(
      'paid_stripe_subscription_identity_conflict',
      `Stripe returned a different subscription while verifying ${subscriptionId}.`,
      { subscriptionId, retrievedSubscriptionId: objectId(remoteSubscription) },
    )
  }
  const invoiceCustomerId = objectId(remoteInvoice?.customer)
  const subscriptionCustomerId = objectId(remoteSubscription?.customer)
  if (
    !invoiceCustomerId
    || !subscriptionCustomerId
    || String(invoiceCustomerId) !== String(subscriptionCustomerId)
  ) {
    return paidSettlementConflict(
      'paid_stripe_subscription_customer_conflict',
      `Paid Stripe invoice ${invoiceId} and subscription ${subscriptionId} do not have the same customer.`,
      { stripeInvoiceId: invoiceId, subscriptionId, invoiceCustomerId, subscriptionCustomerId },
    )
  }

  const currentRows = await pool.query(
    `/* stripe-subscription:paid-settlement-current */
     SELECT subscription.id AS billing_subscription_id,
            subscription.family_billing_account_id,
            subscription.member_id,
            subscription.source_type,
            subscription.source_id,
            subscription.pricing_option_key,
            subscription.status AS local_status,
            account.stripe_customer_id AS current_account_customer_id,
            account.is_active AS account_is_active,
            account.household_monthly_billing_enabled,
            (
              SELECT COUNT(*)::integer
                FROM family_billing_account customer_owner
               WHERE customer_owner.stripe_customer_id = account.stripe_customer_id
            ) AS current_customer_owner_count,
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
      LIMIT 3`,
    [String(subscriptionId)],
  ).then((result) => result.rows ?? [])
  if (currentRows.length > 1) {
    return paidSettlementConflict(
      'paid_stripe_subscription_owner_ambiguous',
      `Paid Stripe subscription ${subscriptionId} is linked to multiple local subscriptions.`,
      { subscriptionId, localSubscriptionIds: currentRows.map((row) => Number(row.billing_subscription_id)) },
    )
  }

  const claimRows = await pool.query(
    `/* stripe-subscription:paid-settlement-claim */
     SELECT claim.family_billing_account_id AS claimed_account_id,
            claim.first_migration_item_id,
            item.id AS migration_item_id,
            item.item_type,
            item.billing_subscription_id AS claimed_billing_subscription_id,
            item.former_stripe_subscription_id,
            item.source_snapshot,
            migration.family_billing_account_id AS migration_account_id,
            migration.state AS migration_state,
            migration.accepted_account_snapshot,
            claimed_subscription.family_billing_account_id AS claimed_subscription_account_id,
            claimed_subscription.member_id AS claimed_member_id,
            claimed_subscription.source_type AS claimed_source_type,
            claimed_subscription.source_id AS claimed_source_id,
            claimed_subscription.pricing_option_key AS claimed_pricing_option_key,
            claimed_subscription.status AS claimed_local_status,
            claimed_subscription.stripe_subscription_id AS claimed_current_stripe_subscription_id,
            account.stripe_customer_id AS current_account_customer_id,
            account.is_active AS account_is_active,
            account.household_monthly_billing_enabled,
            (
              SELECT COUNT(*)::integer
                FROM family_billing_account customer_owner
               WHERE customer_owner.stripe_customer_id = account.stripe_customer_id
            ) AS current_customer_owner_count
       FROM billing_migration_subscription_claim claim
       JOIN billing_account_migration_item item
         ON item.id = claim.first_migration_item_id
       JOIN billing_account_migration migration
         ON migration.id = item.billing_account_migration_id
       JOIN family_billing_account account
         ON account.id = claim.family_billing_account_id
       LEFT JOIN billing_subscription claimed_subscription
         ON claimed_subscription.id = item.billing_subscription_id
      WHERE claim.claim_kind = 'stripe_subscription'
        AND claim.claim_value = $1
      LIMIT 2`,
    [String(subscriptionId)],
  ).then((result) => result.rows ?? [])
  if (claimRows.length > 1) {
    return paidSettlementConflict(
      'paid_stripe_subscription_claim_ambiguous',
      `Paid Stripe subscription ${subscriptionId} has multiple immutable ownership claims.`,
      { subscriptionId },
    )
  }

  const current = currentRows[0] ?? null
  const claim = claimRows[0] ?? null
  if (!current && !claim) {
    return paidSettlementConflict(
      'stripe_subscription_owner_missing',
      `Stripe subscription ${subscriptionId} has no exact current link or immutable migration claim.`,
      { subscriptionId },
    )
  }

  let claimAccountId = null
  if (claim) {
    claimAccountId = positiveInteger(claim.claimed_account_id)
    const migrationAccountId = positiveInteger(claim.migration_account_id)
    const firstItemId = positiveInteger(claim.first_migration_item_id)
    const migrationItemId = positiveInteger(claim.migration_item_id)
    const source = parseJsonObject(claim.source_snapshot)
    const sourceRemote = parseJsonObject(source.remote)
    const sourceLocal = parseJsonObject(source.local)
    const acceptedAccount = parseJsonObject(claim.accepted_account_snapshot)
    const sourceRemoteCustomerId = objectId(sourceRemote.customerId)
      || (typeof sourceRemote.customerId === 'string' ? sourceRemote.customerId : null)
    const sourceRemoteSubscriptionId = objectId(sourceRemote.id)
    const sourceLocalSubscriptionId = objectId(sourceLocal.stripeSubscriptionId)
    const sourceLocalIdPresent = sourceLocal.id != null && String(sourceLocal.id).trim() !== ''
    const sourceLocalId = sourceLocalIdPresent ? positiveInteger(sourceLocal.id) : null
    const claimedBillingSubscriptionId = claim.claimed_billing_subscription_id == null
      ? null
      : positiveInteger(claim.claimed_billing_subscription_id)
    const acceptedAccountId = acceptedAccount.id == null ? null : positiveInteger(acceptedAccount.id)
    const acceptedCustomerPresent = acceptedAccount.stripeCustomerId != null
      && String(acceptedAccount.stripeCustomerId).trim() !== ''
    const acceptedCustomerId = acceptedCustomerPresent
      ? String(acceptedAccount.stripeCustomerId).trim()
      : null
    const claimedSubscriptionAccountId = claim.claimed_subscription_account_id == null
      ? null
      : positiveInteger(claim.claimed_subscription_account_id)
    if (
      !claimAccountId
      || migrationAccountId !== claimAccountId
      || !firstItemId
      || migrationItemId !== firstItemId
      || String(claim.item_type ?? '') !== 'billing_subscription'
      || String(claim.former_stripe_subscription_id ?? '') !== String(subscriptionId)
      || String(sourceRemoteSubscriptionId ?? '') !== String(subscriptionId)
      || String(sourceRemoteCustomerId ?? '') !== String(invoiceCustomerId)
      || (sourceLocalSubscriptionId && String(sourceLocalSubscriptionId) !== String(subscriptionId))
      || (sourceLocalIdPresent && !sourceLocalId)
      || (
        sourceLocalId != null
        && claimedBillingSubscriptionId != null
        && sourceLocalId !== claimedBillingSubscriptionId
      )
      || (acceptedAccountId != null && acceptedAccountId !== claimAccountId)
      || (acceptedCustomerPresent && acceptedCustomerId !== String(invoiceCustomerId))
      || (claimedSubscriptionAccountId != null && claimedSubscriptionAccountId !== claimAccountId)
      || (
        claim.claimed_current_stripe_subscription_id
        && String(claim.claimed_current_stripe_subscription_id) !== String(subscriptionId)
      )
    ) {
      return paidSettlementConflict(
        'paid_stripe_subscription_claim_conflict',
        `Paid Stripe subscription ${subscriptionId} does not match its immutable migration claim.`,
        {
          subscriptionId,
          claimAccountId,
          migrationAccountId,
          firstMigrationItemId: firstItemId,
          migrationItemId,
          sourceRemoteSubscriptionId: sourceRemoteSubscriptionId ?? null,
          sourceRemoteCustomerId: sourceRemoteCustomerId ?? null,
          sourceLocalId,
          claimedBillingSubscriptionId,
          acceptedCustomerId,
          claimedSubscriptionAccountId,
        },
      )
    }
  }

  const currentAccountId = current ? positiveInteger(current.family_billing_account_id) : null
  if (current && !currentAccountId) {
    return paidSettlementConflict(
      'paid_stripe_subscription_current_owner_invalid',
      `Paid Stripe subscription ${subscriptionId} has an invalid current local owner.`,
      { subscriptionId },
    )
  }
  if (currentAccountId && claimAccountId && currentAccountId !== claimAccountId) {
    return paidSettlementConflict(
      'paid_stripe_subscription_owner_claim_conflict',
      `Paid Stripe subscription ${subscriptionId} has conflicting current and immutable account owners.`,
      { subscriptionId, currentAccountId, claimAccountId },
    )
  }
  if (
    current
    && claim?.claimed_billing_subscription_id != null
    && Number(current.billing_subscription_id) !== Number(claim.claimed_billing_subscription_id)
  ) {
    return paidSettlementConflict(
      'paid_stripe_subscription_owner_claim_conflict',
      `Paid Stripe subscription ${subscriptionId} has conflicting current and immutable local subscription bindings.`,
      {
        subscriptionId,
        currentBillingSubscriptionId: Number(current.billing_subscription_id),
        claimedBillingSubscriptionId: Number(claim.claimed_billing_subscription_id),
      },
    )
  }
  const accountId = currentAccountId ?? claimAccountId

  const metadataLayers = [
    ['invoice', remoteInvoice?.metadata],
    ['invoice subscription details', remoteInvoice?.subscription_details?.metadata],
    ['invoice parent subscription details', remoteInvoice?.parent?.subscription_details?.metadata],
    ['subscription', remoteSubscription?.metadata],
  ]
  for (const [source, metadata] of metadataLayers) {
    const metadataClaim = metadataAccountClaim(metadata)
    if (metadataClaim.present && metadataClaim.accountId !== accountId) {
      return paidSettlementConflict(
        'paid_stripe_subscription_metadata_account_conflict',
        `Paid Stripe ${source} metadata does not match its durable local owner.`,
        { subscriptionId, accountId, source, metadataAccountId: metadataClaim.raw },
      )
    }
  }

  const authority = current ?? claim
  const driftReasons = []
  if (!current && claim) {
    driftReasons.push('legacy_subscription_link_detached')
    driftReasons.push('immutable_migration_claim_only')
  }
  if (authority.account_is_active !== true) driftReasons.push('billing_account_inactive')
  if (authority.household_monthly_billing_enabled === true) {
    driftReasons.push('household_monthly_billing_enabled')
  }
  if (billingMigrationCollectionLocked(authority.migration_state)) {
    driftReasons.push(`migration_collection_locked:${authority.migration_state}`)
  }
  if (String(authority.current_account_customer_id ?? '') !== String(invoiceCustomerId)) {
    driftReasons.push('stripe_customer_remapped')
  }
  if (Number(authority.current_customer_owner_count) !== 1) {
    driftReasons.push(`stripe_customer_owner_count:${Number(authority.current_customer_owner_count) || 0}`)
  }

  const localEvidence = current ?? claim
  return {
    expectedLegacy: true,
    paidSettlementVerified: true,
    code: null,
    reason: null,
    accountId,
    billingSubscriptionId: Number(
      current?.billing_subscription_id
      ?? claim?.claimed_billing_subscription_id
      ?? 0,
    ) || null,
    memberId: (current?.member_id ?? claim?.claimed_member_id) == null
      ? null
      : Number(current?.member_id ?? claim?.claimed_member_id),
    sourceType: current?.source_type ?? claim?.claimed_source_type ?? null,
    sourceId: current?.source_id ?? claim?.claimed_source_id ?? null,
    pricingOptionKey: current?.pricing_option_key ?? claim?.claimed_pricing_option_key ?? null,
    localStatus: current?.local_status ?? claim?.claimed_local_status ?? null,
    stripeCustomerId: String(invoiceCustomerId),
    currentStripeCustomerId: authority.current_account_customer_id ?? null,
    migrationState: authority.migration_state ?? null,
    ownershipSource: current && claim ? 'current_and_claim' : current ? 'current_link' : 'immutable_claim',
    claimedAccountId: claimAccountId,
    driftReasons: [...new Set(driftReasons)],
    invoice: remoteInvoice,
    subscription: remoteSubscription,
    evidence: {
      currentBillingSubscriptionId: current?.billing_subscription_id == null
        ? null
        : Number(current.billing_subscription_id),
      firstMigrationItemId: claim?.first_migration_item_id == null
        ? null
        : Number(claim.first_migration_item_id),
      localEvidencePresent: Boolean(localEvidence),
    },
  }
}
