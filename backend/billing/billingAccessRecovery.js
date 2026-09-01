import { publicAppUrl } from '../email/publicAppUrl.js'
import { sendBillingAccessEmail } from '../email/billingAccessEmail.js'
import { requireAdminFacilityScope } from './adminFacilityScope.js'
import { setStripeSubscriptionOperationalStatus } from './stripeSubscriptionSync.js'
import { recordStripeBillingAlert } from './stripeOperations.js'
import { guardLegacyRemoteSubscriptionMutation } from './remoteSubscriptionMutationGuard.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'

export async function ensureBillingAccessRecoverySchema() {
  // Compatibility hook. Startup billing readiness owns this schema contract.
}

export function isPaymentRecoveryExhausted(invoice) {
  return Boolean(
    invoice &&
    Number(invoice.attempt_count ?? 0) > 0 &&
    invoice.next_payment_attempt == null,
  )
}

export async function recordPaymentRecoveryExhaustedAlert(pool, { event, invoice, accountId, failureReason = null }) {
  if (!accountId || !isPaymentRecoveryExhausted(invoice)) return null
  return recordStripeBillingAlert(pool, {
    event,
    object: {
      ...invoice,
      reason: failureReason,
      metadata: { ...(invoice.metadata ?? {}), familyBillingAccountId: String(accountId) },
    },
    alertType: 'payment_recovery_exhausted',
    severity: 'critical',
    message: `Payment recovery exhausted after ${Number(invoice.attempt_count)} attempt${Number(invoice.attempt_count) === 1 ? '' : 's'}`,
  })
}

async function loadCustomerEmail(pool, accountId) {
  const result = await pool.query(
    `SELECT COALESCE(fba.billing_email, payer.email, au.email) AS email
     FROM family_billing_account fba
     LEFT JOIN member payer ON payer.id = fba.payer_member_id
     LEFT JOIN app_user au ON au.member_id = payer.id
     WHERE fba.id = $1
     LIMIT 1`,
    [accountId],
  )
  return result.rows[0]?.email ?? null
}

async function compensateStripe(changed, targetStatus, {
  pool,
  accountId,
  statusSetter = setStripeSubscriptionOperationalStatus,
} = {}) {
  for (const subscription of [...changed].reverse()) {
    try {
      const mutation = await guardLegacyRemoteSubscriptionMutation(pool, {
        accountId,
        stripeSubscriptionId: subscription.stripe_subscription_id,
        operation: `billing-access-compensation-${targetStatus}`,
      })
      if (!mutation.allowed) continue
      await statusSetter(subscription.stripe_subscription_id, targetStatus)
    } catch {
      // Compensation is best-effort, but a failed policy read still fails closed:
      // the remote subscription is not touched.
    }
  }
}

export async function applyStripeStatus(subscriptions, targetStatus, compensationStatus, {
  pool,
  accountId,
  statusSetter = setStripeSubscriptionOperationalStatus,
  collectionLockHeld = false,
} = {}) {
  if (!collectionLockHeld) {
    return withBillingAccountCollectionLock(pool, accountId, (db) => applyStripeStatus(
      subscriptions,
      targetStatus,
      compensationStatus,
      {
        pool: db,
        accountId,
        statusSetter,
        collectionLockHeld: true,
      },
    ))
  }
  const outcomes = []
  const changed = []
  for (const subscription of subscriptions) {
    if (!subscription.stripe_subscription_id) {
      outcomes.push({ subscriptionId: Number(subscription.id), status: 'skipped', reason: 'missing_stripe_id' })
      continue
    }
    const mutation = await guardLegacyRemoteSubscriptionMutation(pool, {
      accountId,
      stripeSubscriptionId: subscription.stripe_subscription_id,
      operation: `billing-access-${targetStatus}`,
    })
    if (!mutation.allowed) {
      outcomes.push({
        subscriptionId: Number(subscription.id),
        stripeSubscriptionId: subscription.stripe_subscription_id,
        status: 'quarantined',
        reason: mutation.reason,
        remoteMutated: false,
      })
      continue
    }
    const result = await statusSetter(subscription.stripe_subscription_id, targetStatus)
    outcomes.push({
      subscriptionId: Number(subscription.id),
      stripeSubscriptionId: subscription.stripe_subscription_id,
      ...result,
      remoteMutated: !['error', 'skipped'].includes(result.status),
    })
    if (result.status === 'error' || result.status === 'skipped') {
      await compensateStripe(changed, compensationStatus, {
        pool,
        accountId,
        statusSetter,
      })
      throw new Error(`Stripe subscription ${subscription.stripe_subscription_id}: ${result.reason ?? 'update failed'}`)
    }
    changed.push(subscription)
  }
  return outcomes
}

async function notifyCustomer(pool, actionRow, action, reason) {
  try {
    const to = await loadCustomerEmail(pool, actionRow.family_billing_account_id)
    if (!to) {
      await pool.query(`UPDATE billing_access_action SET notification_status = 'skipped' WHERE id = $1`, [actionRow.id])
      return
    }
    const result = await sendBillingAccessEmail({
      to,
      action,
      reason,
      billingUrl: `${publicAppUrl()}/?billing=update`,
      idempotencyKey: `billing-access-${actionRow.id}`,
    })
    await pool.query(
      `UPDATE billing_access_action SET notification_status = $2 WHERE id = $1`,
      [actionRow.id, result.sent ? 'sent' : 'skipped'],
    )
  } catch (error) {
    await pool.query(
      `UPDATE billing_access_action SET notification_status = 'failed', notification_error = $2 WHERE id = $1`,
      [actionRow.id, String(error?.message ?? error).slice(0, 1000)],
    ).catch(() => {})
  }
}

export async function applyBillingAccessAction(pool, {
  alertId,
  action,
  reason,
  actedByUserId,
  facilityId = null,
  allowGlobal = false,
}) {
  await ensureBillingAccessRecoverySchema(pool)
  if (!['suspend', 'restore'].includes(action)) throw new Error('Action must be suspend or restore.')
  if (!String(reason ?? '').trim()) throw new Error('A reason is required.')
  const scopedFacilityId = requireAdminFacilityScope({ facilityId, allowGlobal })

  const alertResult = await pool.query(
    `SELECT alert.*
     FROM stripe_billing_alert alert
     LEFT JOIN family_billing_account scoped_account
       ON scoped_account.id = alert.family_billing_account_id
     LEFT JOIN family scoped_family ON scoped_family.id = scoped_account.family_id
     WHERE alert.id = $1
       AND ($2::bigint IS NULL OR scoped_family.facility_id = $2)`,
    [alertId, scopedFacilityId],
  )
  const alert = alertResult.rows[0]
  if (!alert) throw new Error('Billing alert not found.')
  if (alert.alert_type !== 'payment_recovery_exhausted') throw new Error('This alert does not support access actions.')
  if (!alert.family_billing_account_id) throw new Error('The alert is not linked to a family billing account.')
  if (action === 'suspend' && alert.action_status !== 'open') throw new Error('This alert is not awaiting suspension review.')
  if (action === 'restore' && alert.action_status !== 'suspended') throw new Error('This alert does not have suspended access.')

  const expectedAlertStatus = action === 'suspend' ? 'open' : 'suspended'
  const claim = await pool.query(
    `UPDATE stripe_billing_alert SET action_status = 'processing', updated_at = now()
     WHERE id = $1
       AND action_status = $2
       AND ($3::bigint IS NULL OR EXISTS (
         SELECT 1
         FROM family_billing_account scoped_account
         JOIN family scoped_family ON scoped_family.id = scoped_account.family_id
         WHERE scoped_account.id = stripe_billing_alert.family_billing_account_id
           AND scoped_family.facility_id = $3
       ))
     RETURNING id`,
    [alertId, expectedAlertStatus, scopedFacilityId],
  )
  if (!claim.rows[0]) throw new Error('Another staff action is already processing this alert.')

  try {
  let subscriptionIds = []
  let signupIds = []
  let subscriptions = []
  if (action === 'suspend') {
    const result = await pool.query(
      `SELECT id, source_type, source_id, stripe_subscription_id
       FROM billing_subscription
       WHERE family_billing_account_id = $1 AND status = 'active'
       ORDER BY id`,
      [alert.family_billing_account_id],
    )
    subscriptions = result.rows
    if (subscriptions.length === 0) throw new Error('This family has no active billing subscriptions to suspend.')
    subscriptionIds = subscriptions.map((row) => Number(row.id))
    signupIds = subscriptions
      .filter((row) => row.source_type === 'scheduling_signup' && /^\d+$/.test(String(row.source_id ?? '')))
      .map((row) => Number(row.source_id))
  } else {
    const previous = await pool.query(
      `SELECT affected_subscription_ids, affected_signup_ids
       FROM billing_access_action
       WHERE stripe_billing_alert_id = $1
         AND family_billing_account_id = $2
         AND action = 'suspend' AND status = 'succeeded'
       ORDER BY created_at DESC LIMIT 1`,
      [alertId, alert.family_billing_account_id],
    )
    if (!previous.rows[0]) throw new Error('No successful suspension record was found.')
    subscriptionIds = previous.rows[0].affected_subscription_ids ?? []
    signupIds = previous.rows[0].affected_signup_ids ?? []
    if (subscriptionIds.length) {
      subscriptions = (await pool.query(
        `SELECT id, stripe_subscription_id
         FROM billing_subscription
         WHERE id = ANY($1::bigint[])
           AND family_billing_account_id = $2`,
        [subscriptionIds, alert.family_billing_account_id],
      )).rows
    }
  }

  const stripeOutcomes = await applyStripeStatus(
    subscriptions,
    action === 'suspend' ? 'paused' : 'active',
    action === 'suspend' ? 'active' : 'paused',
    { pool, accountId: alert.family_billing_account_id },
  )

  const client = await pool.connect()
  let actionRow
  try {
    await client.query('BEGIN')
    if (subscriptionIds.length) {
      await client.query(
        `UPDATE billing_subscription SET status = $2, updated_at = now()
         WHERE id = ANY($1::bigint[])
           AND status = $3
           AND family_billing_account_id = $4`,
        [subscriptionIds, action === 'suspend' ? 'paused' : 'active', action === 'suspend' ? 'active' : 'paused', alert.family_billing_account_id],
      )
    }
    if (signupIds.length) {
      await client.query(
        `UPDATE scheduling_signup
         SET status = $2,
             paused_at = CASE WHEN $2 = 'paused' THEN now() ELSE NULL END,
             pause_effective_date = CASE WHEN $2 = 'paused' THEN CURRENT_DATE ELSE NULL END,
             pause_mode = CASE WHEN $2 = 'paused' THEN 'billing_recovery' ELSE NULL END
         WHERE id = ANY($1::bigint[]) AND status = $3
           AND ($2 = 'paused' OR pause_mode = 'billing_recovery')
           AND EXISTS (
             SELECT 1
             FROM billing_subscription scoped_subscription
             WHERE scoped_subscription.family_billing_account_id = $4
               AND scoped_subscription.source_type = 'scheduling_signup'
               AND scoped_subscription.source_id = scheduling_signup.id::text
           )`,
        [signupIds, action === 'suspend' ? 'paused' : 'confirmed', action === 'suspend' ? 'confirmed' : 'paused', alert.family_billing_account_id],
      )
    }
    actionRow = (await client.query(
      `INSERT INTO billing_access_action
        (stripe_billing_alert_id, family_billing_account_id, action, status, reason,
         acted_by_user_id, affected_subscription_ids, affected_signup_ids, stripe_outcomes, completed_at)
       VALUES ($1, $2, $3, 'succeeded', $4, $5, $6, $7, $8, now()) RETURNING *`,
      [alertId, alert.family_billing_account_id, action, String(reason).trim(), actedByUserId,
        JSON.stringify(subscriptionIds), JSON.stringify(signupIds), JSON.stringify(stripeOutcomes)],
    )).rows[0]
    await client.query(
      `UPDATE stripe_billing_alert
       SET action_status = $2,
           resolved_at = CASE WHEN $2 = 'resolved' THEN now() ELSE NULL END,
           details = details || $3::jsonb,
           updated_at = now()
       WHERE id = $1
         AND family_billing_account_id = $4
         AND ($5::bigint IS NULL OR EXISTS (
           SELECT 1
           FROM family_billing_account scoped_account
           JOIN family scoped_family ON scoped_family.id = scoped_account.family_id
           WHERE scoped_account.id = stripe_billing_alert.family_billing_account_id
             AND scoped_family.facility_id = $5
         ))`,
      [alertId, action === 'suspend' ? 'suspended' : 'resolved', JSON.stringify({ lastAccessAction: action, lastAccessActionId: actionRow.id }), alert.family_billing_account_id, scopedFacilityId],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK')
    const remotelyChangedIds = new Set(
      stripeOutcomes
        .filter((outcome) => outcome.remoteMutated === true)
        .map((outcome) => Number(outcome.subscriptionId)),
    )
    await withBillingAccountCollectionLock(
      pool,
      alert.family_billing_account_id,
      (db) => compensateStripe(
        subscriptions.filter((row) => remotelyChangedIds.has(Number(row.id))),
        action === 'suspend' ? 'active' : 'paused',
        { pool: db, accountId: alert.family_billing_account_id },
      ),
    )
    throw error
  } finally {
    client.release()
  }

  await notifyCustomer(pool, actionRow, action, String(reason).trim())
  return (await pool.query(`SELECT * FROM billing_access_action WHERE id = $1`, [actionRow.id])).rows[0]
  } catch (error) {
    await pool.query(
      `UPDATE stripe_billing_alert SET action_status = $2, updated_at = now()
       WHERE id = $1
         AND action_status = 'processing'
         AND ($3::bigint IS NULL OR EXISTS (
           SELECT 1
           FROM family_billing_account scoped_account
           JOIN family scoped_family ON scoped_family.id = scoped_account.family_id
           WHERE scoped_account.id = stripe_billing_alert.family_billing_account_id
             AND scoped_family.facility_id = $3
         ))`,
      [alertId, expectedAlertStatus, scopedFacilityId],
    ).catch(() => {})
    throw error
  }
}
