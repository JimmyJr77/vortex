import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import {
  classifyStripePaymentMethodReadiness,
  selectStripeCustomerPaymentMethod,
} from './stripePaymentMethodReadiness.js'

const MAX_DISPLAY_AGE_MS = 36 * 60 * 60 * 1000
export const CUSTOMER_PROJECTION_EVENT_TYPES = Object.freeze([
  'customer.created', 'customer.updated', 'customer.deleted',
  'payment_method.attached', 'payment_method.detached', 'payment_method.updated',
  'payment_method.automatically_updated',
])

function objectId(value) {
  return typeof value === 'string' ? value : value?.id ?? null
}

function identityError(message) {
  const error = new Error(message)
  error.code = 'stripe_projection_owner_conflict'
  return error
}

function paymentMethodFromRow(row) {
  if (!row?.stripe_payment_method_id) return null
  return {
    id: row.stripe_payment_method_id,
    type: row.payment_method_type,
    customerId: row.stripe_customer_id,
    brand: row.payment_method_brand,
    last4: row.payment_method_last4,
    expMonth: row.payment_method_exp_month,
    expYear: row.payment_method_exp_year,
    ...(row.payment_method_blocked_reason ? {
      metadata: { vortexPaymentMethodBlockedReason: row.payment_method_blocked_reason },
    } : {}),
  }
}

/** Pure display mapping. Never evidence authorizing a collection. */
export function stripeCustomerProjectionSummary(account, row, {
  stripeEnabled = false,
  billingMonth,
  now = new Date(),
} = {}) {
  const base = { available: false, stripeEnabled, paymentMethod: null, syncedAt: null, syncError: null }
  if (!account?.stripe_customer_id) return { ...base, syncStatus: 'not_linked' }
  if (Number(account.stripe_customer_owner_count) !== 1) {
    return {
      ...base, syncStatus: 'failed', reconciliationRequired: true,
      error: 'The Stripe customer does not have one unique local billing-account owner.',
      syncError: 'stripe_projection_owner_conflict',
    }
  }
  const accountId = Number(account.id ?? account.billing_account_id)
  if (!row || Number(row.family_billing_account_id) !== accountId
    || row.stripe_customer_id !== account.stripe_customer_id) {
    return { ...base, syncStatus: 'pending', error: 'Saved payment method details are awaiting Stripe synchronization.' }
  }
  const syncedAt = row.synced_at ? new Date(row.synced_at) : null
  const hasSnapshot = syncedAt && Number.isFinite(syncedAt.getTime())
  const syncStatus = row.sync_status === 'failed' ? 'failed'
    : !hasSnapshot ? 'pending'
      : now.getTime() - syncedAt.getTime() > MAX_DISPLAY_AGE_MS ? 'stale' : 'current'
  const paymentMethod = hasSnapshot ? paymentMethodFromRow(row) : null
  const readiness = classifyStripePaymentMethodReadiness(paymentMethod, {
    expectedCustomerId: account.stripe_customer_id, billingMonth,
  })
  return {
    ...base,
    available: Boolean(hasSnapshot && !row.customer_deleted && readiness.ready),
    customerId: account.stripe_customer_id,
    readiness,
    paymentMethod,
    syncStatus,
    syncedAt: hasSnapshot ? syncedAt.toISOString() : null,
    syncError: row.last_error ?? null,
    ...(syncStatus === 'failed' ? { error: 'Stripe synchronization failed. Previously saved details may be out of date.' }
      : syncStatus === 'stale' ? { error: 'Saved payment method details are awaiting a fresh Stripe synchronization.' }
        : syncStatus === 'pending' ? { error: 'Saved payment method details are awaiting Stripe synchronization.' } : {}),
  }
}

export async function loadStripeCustomerProjection(pool, account) {
  const result = await pool.query(
    `SELECT * FROM stripe_customer_projection
      WHERE family_billing_account_id = $1 AND stripe_customer_id = $2`,
    [Number(account.id ?? account.billing_account_id), account.stripe_customer_id],
  )
  return result.rows[0] ?? null
}

/** Only explicitly allowlisted display data is persisted; never a Stripe payload. */
export async function saveStripeCustomerProjection(db, { accountId, customerId, customerDeleted = false, paymentMethod = null }) {
  if (paymentMethod && objectId(paymentMethod.customer) !== customerId) {
    throw identityError('The Stripe payment method does not belong to the projected customer.')
  }
  const card = paymentMethod?.card
  const last4 = /^\d{4}$/.test(String(card?.last4 ?? '')) ? String(card.last4) : null
  const expMonth = Number(card?.exp_month)
  const expYear = Number(card?.exp_year)
  const result = await db.query(
    `INSERT INTO stripe_customer_projection (
       family_billing_account_id, stripe_customer_id, customer_deleted,
       stripe_payment_method_id, payment_method_type, payment_method_brand,
       payment_method_last4, payment_method_exp_month, payment_method_exp_year,
       payment_method_blocked_reason, sync_status, synced_at, attempted_at, last_error
     ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'synced',now(),now(),NULL)
     ON CONFLICT (family_billing_account_id) DO UPDATE SET
       stripe_customer_id=EXCLUDED.stripe_customer_id, customer_deleted=EXCLUDED.customer_deleted,
       stripe_payment_method_id=EXCLUDED.stripe_payment_method_id,
       payment_method_type=EXCLUDED.payment_method_type, payment_method_brand=EXCLUDED.payment_method_brand,
       payment_method_last4=EXCLUDED.payment_method_last4, payment_method_exp_month=EXCLUDED.payment_method_exp_month,
       payment_method_exp_year=EXCLUDED.payment_method_exp_year,
       payment_method_blocked_reason=EXCLUDED.payment_method_blocked_reason,
       sync_status='synced', synced_at=now(), attempted_at=now(), last_error=NULL
     RETURNING *`,
    [Number(accountId), customerId, customerDeleted, objectId(paymentMethod),
      paymentMethod?.type ?? null, card?.brand ?? paymentMethod?.type ?? null, last4,
      Number.isSafeInteger(expMonth) && expMonth >= 1 && expMonth <= 12 ? expMonth : null,
      Number.isSafeInteger(expYear) && expYear > 0 ? expYear : null,
      paymentMethod?.metadata?.vortexPaymentMethodBlockedReason === 'link_account_closed' ? 'link_account_closed' : null],
  )
  await db.query(
    `UPDATE stripe_billing_alert SET action_status='resolved', resolved_at=now(), updated_at=now(),
       resolution_note='Saved payment method display synchronized with current Stripe state.'
     WHERE stripe_event_id=$1 AND alert_type='customer_projection_sync_failed' AND resolved_at IS NULL
       AND action_status <> 'suspended'`,
    [`customer-projection:${Number(accountId)}:${customerId}`],
  )
  return result.rows[0] ?? null
}

async function recordProjectionFailure(db, accountId, customerId, error) {
  // Preserve the last successful snapshot. A changed link cannot read it because
  // the read path checks both account and customer IDs.
  await db.query(
    `INSERT INTO stripe_customer_projection
       (family_billing_account_id, stripe_customer_id, sync_status, last_error)
     VALUES ($1,$2,'failed',$3)
     ON CONFLICT (family_billing_account_id) DO UPDATE SET
       sync_status='failed', attempted_at=now(), last_error=EXCLUDED.last_error`,
    [Number(accountId), customerId, String(error?.code ?? 'stripe_projection_refresh_failed').slice(0, 100)],
  )
  await db.query(
    `INSERT INTO stripe_billing_alert
       (stripe_event_id, family_billing_account_id, alert_type, severity, stripe_object_id, message, details)
     VALUES ($1,$2,'customer_projection_sync_failed','warning',$3,
       'Saved payment method display could not synchronize with Stripe. Reconciliation will retry.', '{}'::jsonb)
     ON CONFLICT (stripe_event_id) DO UPDATE SET action_status='open', resolved_at=NULL,
       resolution_note=NULL, updated_at=now() WHERE stripe_billing_alert.action_status <> 'suspended'`,
    [`customer-projection:${Number(accountId)}:${customerId}`, Number(accountId), customerId],
  )
}

/** Re-read current Stripe state under the household lock, never apply an old event snapshot. */
export async function refreshStripeCustomerProjection(pool, stripe, { customerId, accountId = null }) {
  const observed = await pool.query(
    `/* stripe-projection:owners */ SELECT id FROM family_billing_account WHERE stripe_customer_id=$1 ORDER BY id`,
    [customerId],
  )
  if (!observed.rows.length) return { skipped: true, reason: 'no_local_owner' }
  if (observed.rows.length !== 1 || (accountId != null && Number(observed.rows[0].id) !== Number(accountId))) {
    throw identityError('The Stripe customer projection requires one exact local account owner.')
  }
  const ownerId = Number(observed.rows[0].id)
  return withBillingAccountCollectionLock(pool, ownerId, async (db) => {
    try {
      const current = await db.query(
        `/* stripe-projection:owners */ SELECT id FROM family_billing_account WHERE stripe_customer_id=$1 ORDER BY id`,
        [customerId],
      )
      if (current.rows.length !== 1 || Number(current.rows[0].id) !== ownerId) {
        throw identityError('The Stripe customer owner changed while waiting for its account lock.')
      }
      const customer = await stripe.customers.retrieve(customerId, { expand: ['invoice_settings.default_payment_method'] })
      if (objectId(customer) !== customerId
        || (customer.metadata?.familyBillingAccountId && String(customer.metadata.familyBillingAccountId) !== String(ownerId))) {
        throw identityError('The current Stripe customer identity disagrees with its local account.')
      }
      const selection = await selectStripeCustomerPaymentMethod(stripe, customer, {
        expectedCustomerId: customerId, billingMonth: new Date().toISOString().slice(0, 7),
      })
      const defaultMethodId = objectId(customer.invoice_settings?.default_payment_method)
      if (defaultMethodId && objectId(selection.paymentMethod) !== defaultMethodId) {
        throw identityError('Stripe did not return the exact configured default payment method.')
      }
      if (selection.paymentMethod && objectId(selection.paymentMethod.customer) !== customerId) {
        throw identityError('The current Stripe default payment method belongs to another customer.')
      }
      const projection = await saveStripeCustomerProjection(db, {
        accountId: ownerId, customerId, customerDeleted: customer.deleted === true,
        paymentMethod: selection.paymentMethod,
      })
      return { accountId: ownerId, projection }
    } catch (error) {
      await recordProjectionFailure(db, ownerId, customerId, error)
      throw error
    }
  })
}

export async function refreshStripeCustomerProjectionForEvent(pool, stripe, event) {
  const object = event?.data?.object ?? {}
  let customerId = event.type.startsWith('customer.') ? objectId(object)
    : objectId(object.customer) ?? objectId(event.data?.previous_attributes?.customer)
  if (!customerId && objectId(object)) {
    const previous = await pool.query(
      `SELECT DISTINCT stripe_customer_id FROM stripe_customer_projection WHERE stripe_payment_method_id=$1`,
      [objectId(object)],
    )
    if (previous.rows.length > 1) throw identityError('Detached Stripe method has ambiguous local ownership.')
    customerId = previous.rows[0]?.stripe_customer_id ?? null
  }
  if (!customerId) return { skipped: true, reason: 'no_local_owner' }
  return refreshStripeCustomerProjection(pool, stripe, { customerId })
}

/** Bounded keyset traversal also backfills existing customers without creating anything remotely. */
export async function reconcileStripeCustomerProjections(pool, stripe, { refresh = refreshStripeCustomerProjection } = {}) {
  const summary = { checked: 0, synced: 0, failed: 0 }
  let afterId = 0
  for (;;) {
    const page = await pool.query(
      `SELECT id, stripe_customer_id FROM family_billing_account
        WHERE id>$1 AND stripe_customer_id IS NOT NULL AND is_active=TRUE ORDER BY id LIMIT 100`,
      [afterId],
    )
    if (!page.rows.length) return summary
    for (const account of page.rows) {
      summary.checked += 1
      try {
        await refresh(pool, stripe, { accountId: Number(account.id), customerId: account.stripe_customer_id })
        summary.synced += 1
      } catch {
        summary.failed += 1
      }
      afterId = Number(account.id)
    }
  }
}
