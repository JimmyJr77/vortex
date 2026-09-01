import { billingMigrationCollectionLocked } from './canonicalBillingMigrationState.js'
import { recordStripeBillingAlert } from './stripeOperations.js'

export const REMOTE_SUBSCRIPTION_MUTATION_BLOCKED_CODE =
  'LEGACY_REMOTE_SUBSCRIPTION_MUTATION_BLOCKED'

function positiveAccountId(value) {
  const accountId = Number(value)
  if (!Number.isSafeInteger(accountId) || accountId <= 0) {
    throw new Error('Billing account ID is required before mutating a Stripe subscription.')
  }
  return accountId
}

function normalizedOperation(value) {
  const operation = String(value ?? '').trim()
  if (!operation) throw new Error('A remote subscription mutation operation is required.')
  return operation.slice(0, 120)
}

export function legacyRemoteSubscriptionMutationBlocked(policy) {
  return policy?.householdMonthlyBillingEnabled === true
    || billingMigrationCollectionLocked(policy?.migrationState)
}

/**
 * Read the durable collector owner for one account. The latest migration row is
 * authoritative even when an older verified/shadow run also exists.
 */
export async function loadLegacyRemoteSubscriptionMutationPolicy(db, accountId) {
  const normalizedAccountId = positiveAccountId(accountId)
  const result = await db.query(
    `SELECT account.id,
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
      WHERE account.id = $1
      LIMIT 1`,
    [normalizedAccountId],
  )
  const row = result.rows[0]
  if (!row) {
    const error = new Error(`Billing account ${normalizedAccountId} was not found.`)
    error.code = REMOTE_SUBSCRIPTION_MUTATION_BLOCKED_CODE
    error.statusCode = 409
    throw error
  }
  return {
    accountId: normalizedAccountId,
    householdMonthlyBillingEnabled: row.household_monthly_billing_enabled === true,
    migrationState: row.migration_state ?? null,
  }
}

function quarantineMessage({ policy, stripeSubscriptionId, operation }) {
  const owner = policy.householdMonthlyBillingEnabled
    ? 'household ledger collection is enabled'
    : `billing migration state ${policy.migrationState} owns collection`
  return [
    `Blocked legacy Stripe subscription mutation ${operation} because ${owner}.`,
    stripeSubscriptionId
      ? `Remote subscription ${stripeSubscriptionId} requires reviewed retirement.`
      : null,
  ].filter(Boolean).join(' ')
}

/**
 * Decide whether an old Stripe Subscription may still be changed. A blocked
 * identifier is retained as evidence, recorded as a critical billing alert,
 * and never sent to Stripe. Callers may continue the corresponding local
 * ledger operation when `allowed` is false.
 */
export async function guardLegacyRemoteSubscriptionMutation(db, {
  accountId,
  stripeSubscriptionId = null,
  operation,
} = {}) {
  const policy = await loadLegacyRemoteSubscriptionMutationPolicy(db, accountId)
  if (!legacyRemoteSubscriptionMutationBlocked(policy)) {
    return { allowed: true, quarantined: false, policy, reason: null }
  }

  const normalized = normalizedOperation(operation)
  const subscriptionId = String(stripeSubscriptionId ?? '').trim() || null
  const reason = quarantineMessage({
    policy,
    stripeSubscriptionId: subscriptionId,
    operation: normalized,
  })
  const eventSuffix = subscriptionId ?? 'missing-id'
  await recordStripeBillingAlert(db, {
    event: {
      id: `legacy-remote-mutation-blocked:${policy.accountId}:${eventSuffix}:${normalized}`,
    },
    object: {
      id: subscriptionId,
      reason,
      metadata: { familyBillingAccountId: String(policy.accountId) },
    },
    alertType: 'legacy_remote_subscription_mutation_blocked',
    severity: 'critical',
    message: reason,
  })

  return {
    allowed: false,
    quarantined: true,
    policy,
    reason,
    code: REMOTE_SUBSCRIPTION_MUTATION_BLOCKED_CODE,
  }
}
