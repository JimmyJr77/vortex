import { getStripeClient } from './stripeBilling.js'
import { createHouseholdMonthlyInvoice } from './householdMonthlyInvoice.js'
import { planEnrollmentStripeDeletion, executeEnrollmentStripeDeletion } from './enrollmentDeletionStripe.js'
import { withBillingAccountCollectionLock } from './billingAccountCollectionLock.js'
import { canonicalActiveHouseholdMemberPredicate } from './householdMembership.js'
import { recordBillingActivity } from './billingActivity.js'
import { reconcileUpcomingProvisionalChargesForAccount } from './canonicalRecurringChargePosting.js'

async function enrollmentContext(db, signupId, facilityId, lock = false) {
  const { rows } = await db.query(`SELECT signup.id, signup.member_id, account.id AS account_id
    FROM scheduling_signup signup
    JOIN member ON member.id = signup.member_id
    JOIN family ON ${canonicalActiveHouseholdMemberPredicate({ memberAlias: 'member', familyIdReference: 'family.id' })}
    JOIN family_billing_account account ON account.family_id = family.id AND account.is_active = TRUE
    WHERE signup.id = $1 AND family.facility_id = $2
    ${lock ? 'FOR UPDATE OF signup, account' : ''}`, [signupId, facilityId])
  if (!rows[0]) throw new Error('Enrollment not found.')
  return rows[0]
}

// Include every historical subscription and linked correction, not just the
// current month's line: a refunded or partially paid class is never deletable.
export async function enrollmentDeletionState(db, signupId, accountId) {
  const subscriptions = (await db.query(`SELECT * FROM billing_subscription
    WHERE source_type = 'scheduling_signup' AND source_id = $1`, [String(signupId)])).rows
  const charges = (await db.query(`WITH RECURSIVE enrollment_charges AS (
    SELECT c.id FROM billing_charge c WHERE
      (c.source_type = 'scheduling_signup' AND c.source_id = $1)
      OR c.subscription_id = ANY($2::bigint[])
    UNION
    SELECT c.id FROM billing_charge c JOIN enrollment_charges parent ON c.related_charge_id = parent.id
  ) SELECT c.* FROM billing_charge c JOIN enrollment_charges e ON e.id = c.id`,
  [String(signupId), subscriptions.map((row) => row.id)])).rows
  const chargeIds = charges.map((row) => row.id)
  const evidence = (await db.query(`SELECT
    EXISTS (SELECT 1 FROM billing_payment_application WHERE billing_charge_id = ANY($1::bigint[])) AS has_payment,
    EXISTS (SELECT 1 FROM billing_monthly_invoice_line line JOIN billing_monthly_invoice invoice ON invoice.id = line.billing_monthly_invoice_id
      WHERE line.billing_charge_id = ANY($1::bigint[]) AND (invoice.paid_at IS NOT NULL OR invoice.status = 'paid'
        OR EXISTS (SELECT 1 FROM billing_charge_credit_application credit
          WHERE credit.target_invoice_line_id = line.id OR credit.credit_invoice_line_id = line.id))) AS has_paid_invoice,
    EXISTS (SELECT 1 FROM billing_refund WHERE related_charge_id = ANY($1::bigint[]) OR offset_credit_charge_id = ANY($1::bigint[])) AS has_refund,
    EXISTS (SELECT 1 FROM billing_statement_line line JOIN billing_statement statement ON statement.id = line.statement_id
      WHERE line.charge_id = ANY($1::bigint[]) AND statement.status = 'paid') AS has_paid_statement,
    EXISTS (SELECT 1 FROM billing_payment WHERE family_billing_account_id = $2
      AND external_status IN ('pending', 'processing', 'reconciliation_required')) AS unresolved_payment`, [chargeIds, accountId])).rows[0]
  let reason = null
  if (subscriptions.some((row) => Number(row.family_billing_account_id) !== Number(accountId))
    || charges.some((row) => Number(row.family_billing_account_id) !== Number(accountId))) {
    reason = 'Enrollment billing ownership must be reconciled before deletion.'
  } else if (evidence.has_payment || evidence.has_refund || evidence.has_paid_statement
    || charges.some((row) => ['paid', 'partially_paid', 'settled', 'succeeded'].includes(row.collection_status))) {
    reason = 'This enrollment has payment history and cannot be deleted.'
  } else if (evidence.has_paid_invoice) {
    reason = 'This enrollment has invoice payment history and cannot be deleted.'
  } else if (evidence.unresolved_payment) {
    reason = 'A payment is pending reconciliation on this account. Finish reconciling it before deletion.'

  }
  return { canDelete: reason === null, reason, charges, subscriptions, chargeIds, subscriptionIds: subscriptions.map((row) => row.id),
    removedAmountCents: charges.reduce((sum, row) => sum + Number(row.amount_cents), 0) }
}

export async function previewCustomerBillingEnrollmentDeletion(pool, { signupId, facilityId, stripeClient }) {
  const source = await enrollmentContext(pool, signupId, facilityId)
  const state = await enrollmentDeletionState(pool, signupId, source.account_id)
  if (state.canDelete) {
    try {
      const { attempts, invoices } = await loadDeletionCollectors(pool, state)
      const account = (await pool.query('SELECT * FROM family_billing_account WHERE id=$1', [source.account_id])).rows[0]
      const operation = (await pool.query('SELECT plan FROM billing_enrollment_deletion WHERE signup_id=$1 AND facility_id=$2', [signupId, facilityId])).rows[0]
      await planEnrollmentStripeDeletion(stripeClient === undefined ? await getStripeClient() : stripeClient, {
        customerId: account.stripe_customer_id, charges: state.charges, subscriptions: state.subscriptions, attempts, invoices, previousPlan: operation?.plan ?? [],
      })
    } catch (error) {
      return { signupId, canDelete: false, reason: error.message, removedAmountCents: state.removedAmountCents }
    }
  }
  return { signupId, canDelete: state.canDelete, reason: state.reason, removedAmountCents: state.removedAmountCents }
}

async function loadDeletionCollectors(db, state) {
  const attempts = (await db.query(`SELECT * FROM billing_payment_attempt attempt WHERE target_charge_id=ANY($1::bigint[])
    OR EXISTS (SELECT 1 FROM billing_payment_attempt_charge line WHERE line.billing_payment_attempt_id=attempt.id
      AND line.billing_charge_id=ANY($1::bigint[]))`, [state.chargeIds])).rows
  if (attempts.some((row) => row.status === 'succeeded' || row.billing_payment_id)) throw new Error('Enrollment has payment history or a payment awaiting reconciliation.')
  if (attempts.some((row) => !row.stripe_checkout_session_id && !row.stripe_payment_intent_id
    && !['failed','expired','canceled'].includes(row.status))) throw new Error('A payment request has an unknown Stripe outcome. Reconcile it before deletion.')
  const invoices = (await db.query(`SELECT * FROM billing_monthly_invoice invoice WHERE EXISTS (
    SELECT 1 FROM billing_monthly_invoice_line line WHERE line.billing_monthly_invoice_id=invoice.id
      AND line.billing_charge_id=ANY($1::bigint[]))`, [state.chargeIds])).rows
  for (const invoice of invoices) {
    invoice.lines = (await db.query('SELECT * FROM billing_monthly_invoice_line WHERE billing_monthly_invoice_id=$1 ORDER BY id', [invoice.id])).rows
  }
  return { attempts, invoices }
}

async function recordDeletionFailure(db, operation, error) {
  await db.query('UPDATE billing_enrollment_deletion SET error_message=$2, updated_at=now() WHERE signup_id=$1', [operation.signup_id, error.message])
  await db.query(`INSERT INTO stripe_billing_alert
    (stripe_event_id,family_billing_account_id,alert_type,severity,message,details)
    VALUES ($1,$2,'reconciliation_mismatch','critical',$3,$4::jsonb)
    ON CONFLICT (stripe_event_id) DO UPDATE SET message=EXCLUDED.message, details=EXCLUDED.details,
      resolved_at=NULL, action_status='open', updated_at=now()`,
  [`enrollment-deletion:${operation.signup_id}`,operation.family_billing_account_id,
    'Enrollment deletion needs reconciliation: ' + error.message,
    JSON.stringify({signupId:Number(operation.signup_id), retryDeletion:operation.status==='reconciling'})])
}

async function finishDeletion(db, operation, { stripe, environment, replaceInvoice, recoverSiblings = true }) {
  const result = operation.result
  const account = (await db.query(`SELECT account.*, facility.timezone AS facility_timezone
    FROM family_billing_account account JOIN family ON family.id=account.family_id
    JOIN facility ON facility.id=family.facility_id WHERE account.id=$1`, [operation.family_billing_account_id])).rows[0]
  try {
    const { reconcileCurrentEnrollmentCharges } = await import('./currentEnrollmentChargePricing.js')
    await reconcileCurrentEnrollmentCharges(db, { familyId: Number(account.family_id) })
    await reconcileUpcomingProvisionalChargesForAccount(db, { accountId: Number(account.id) })
    const months = [...(result.replacementMonths ?? [])].sort()
    if (months.length) {
      const replacement = await replaceInvoice(db, { account, billingMonth: months.at(-1),
        actorUserId: operation.actor_user_id, stripeClient: stripe, environment, publishOnly: true })
      if (replacement.skipped && replacement.skipped !== 'no_open_charges' && replacement.skipped !== 'already_created') {
        throw new Error(`Replacement invoice pending: ${replacement.skipped}`)
      }
    }
    await db.query("UPDATE billing_enrollment_deletion SET status='complete', error_message=NULL, updated_at=now() WHERE signup_id=$1", [operation.signup_id])
    await db.query("UPDATE stripe_billing_alert SET resolved_at=now(), updated_at=now() WHERE stripe_event_id=$1", [`enrollment-deletion:${operation.signup_id}`])
    // A sequence of deletions can clear a mismatch that blocked an earlier
    // deletion. Complete those account-local follow-ups while holding the same
    // collection lock, rather than leaving stale errors until the next job.
    if (recoverSiblings) {
      const siblings = (await db.query(`SELECT * FROM billing_enrollment_deletion
        WHERE family_billing_account_id=$1 AND status='deleted' AND signup_id<>$2
        ORDER BY updated_at`, [operation.family_billing_account_id, operation.signup_id])).rows
      for (const sibling of siblings) {
        await finishDeletion(db, sibling, { stripe, environment, replaceInvoice, recoverSiblings: false })
      }
    }
    return result
  } catch (error) {
    await recordDeletionFailure(db, operation, error)
    return { ...result, reconciliationPending: true }
  }
}

export async function deleteCustomerBillingEnrollment(pool, { signupId, facilityId, actorUserId,
  stripeClient, environment = process.env, replaceInvoice = createHouseholdMonthlyInvoice }) {
  if (![signupId, facilityId, actorUserId].every((id) => Number.isSafeInteger(id) && id > 0)) {
    throw new Error('A valid enrollment, facility, and administrator are required.')
  }
  const previous = (await pool.query('SELECT * FROM billing_enrollment_deletion WHERE signup_id=$1 AND facility_id=$2', [signupId, facilityId])).rows[0]
  const source = previous ? { account_id: previous.family_billing_account_id } : await enrollmentContext(pool, signupId, facilityId)
  return withBillingAccountCollectionLock(pool, source.account_id, async (db) => {
    let operation = (await db.query('SELECT * FROM billing_enrollment_deletion WHERE signup_id=$1 AND facility_id=$2', [signupId, facilityId])).rows[0]
    const stripe = stripeClient === undefined ? await getStripeClient() : stripeClient
    if (operation?.status === 'complete') return { ...operation.result, replayed: true }
    if (operation?.status === 'deleted') return finishDeletion(db, operation, { stripe, environment, replaceInvoice })
    const state = await enrollmentDeletionState(db, signupId, source.account_id)
    if (!state.canDelete) throw new Error(state.reason)
    const { attempts, invoices } = await loadDeletionCollectors(db, state)
    const account = (await db.query('SELECT * FROM family_billing_account WHERE id=$1', [source.account_id])).rows[0]
    if ([...attempts, ...invoices].some((row) => Number(row.family_billing_account_id) !== Number(account.id))) {
      throw new Error('Stripe collection records belong to a different billing account.')
    }
    const conflicting = (await db.query(`SELECT 1 FROM billing_subscription WHERE family_billing_account_id <> $1
      AND stripe_subscription_id=ANY($2::text[]) UNION ALL SELECT 1 FROM billing_subscription
      WHERE family_billing_account_id=$1 AND NOT (id=ANY($3::bigint[])) AND stripe_subscription_id=ANY($2::text[])`,
    [source.account_id, state.subscriptions.map((row) => row.stripe_subscription_id).filter(Boolean), state.subscriptionIds])).rows
    if (conflicting.length) throw new Error('Stripe subscription is shared with another enrollment; deletion was blocked.')
    // The plan is durably saved before dispatch, so missing drafts after a
    // timeout can be recognized and safely resumed without guessing.
    const plan = await planEnrollmentStripeDeletion(stripe, { customerId: account.stripe_customer_id,
      charges: state.charges, subscriptions: state.subscriptions, attempts, invoices, previousPlan: operation?.plan ?? [] })
    operation = (await db.query(`INSERT INTO billing_enrollment_deletion
      (signup_id,family_billing_account_id,facility_id,actor_user_id,status,plan)
      VALUES ($1,$2,$3,$4,'reconciling',$5::jsonb) ON CONFLICT (signup_id) DO UPDATE SET
      plan=EXCLUDED.plan, error_message=NULL, updated_at=now()
      WHERE billing_enrollment_deletion.facility_id=EXCLUDED.facility_id
        AND billing_enrollment_deletion.family_billing_account_id=EXCLUDED.family_billing_account_id RETURNING *`,
    [signupId, source.account_id, facilityId, actorUserId, JSON.stringify([...new Map([...(operation?.plan ?? []), ...plan].map((step) => [`${step.kind}:${step.id}`, step])).values()])])).rows[0]
    if (!operation) throw new Error('Enrollment deletion ownership changed. Refresh and retry.')
    try {
      await executeEnrollmentStripeDeletion(stripe, plan, { customerId: account.stripe_customer_id,
        operationKey: `enrollment-delete:${facilityId}:${signupId}`,
        checkpoint: async (step) => db.query(`UPDATE billing_enrollment_deletion
          SET completed_steps=completed_steps || $2::jsonb, updated_at=now() WHERE signup_id=$1`, [signupId, JSON.stringify([step])]) })
      const verified = await planEnrollmentStripeDeletion(stripe, { customerId: account.stripe_customer_id,
        charges: state.charges, subscriptions: state.subscriptions, attempts, invoices, previousPlan: operation.plan })
      if (verified.some((step) => !step.terminal)) throw new Error('A new Stripe collector appeared during deletion. Retry to reconcile it.')
      await db.query('BEGIN')
      await db.query('SELECT pg_advisory_xact_lock($1::bigint)', [signupId])
      const locked = await enrollmentContext(db, signupId, facilityId, true)
      if (Number(locked.account_id) !== Number(source.account_id)) throw new Error('Enrollment account changed. Refresh and retry.')
      source.member_id = locked.member_id
      await db.query('SELECT id FROM billing_subscription WHERE family_billing_account_id=$1 FOR UPDATE', [source.account_id])
      await db.query('SELECT id FROM billing_charge WHERE family_billing_account_id=$1 FOR UPDATE', [source.account_id])
      const current = await enrollmentDeletionState(db, signupId, source.account_id)
      if (!current.canDelete) throw new Error(current.reason)
      if (JSON.stringify(current.chargeIds.map(String).sort()) !== JSON.stringify(state.chargeIds.map(String).sort())
        || current.removedAmountCents !== state.removedAmountCents
        || JSON.stringify(current.subscriptionIds.map(String).sort()) !== JSON.stringify(state.subscriptionIds.map(String).sort())) throw new Error('Enrollment billing changed during reconciliation. Retry deletion.')
      await db.query("SELECT set_config('vortex.enrollment_deletion_charge_ids', $1, true)", [JSON.stringify(state.chargeIds.map(Number))])
      await db.query(`UPDATE billing_monthly_invoice SET status='void', hosted_invoice_url=NULL,
        enrollment_deletion_id=$2, updated_at=now() WHERE id=ANY($1::bigint[]) AND (stripe_invoice_id IS NOT NULL OR stripe_payment_intent_id IS NOT NULL)`, [invoices.map((row) => row.id), signupId])
      await db.query(`UPDATE billing_monthly_invoice_line line SET deleted_charge_id=billing_charge_id, billing_charge_id=NULL
        WHERE billing_charge_id=ANY($1::bigint[]) AND EXISTS (SELECT 1 FROM billing_monthly_invoice invoice
          WHERE invoice.id=line.billing_monthly_invoice_id AND invoice.enrollment_deletion_id=$2)`, [state.chargeIds, signupId])
      await db.query(`UPDATE billing_payment_attempt SET status='canceled', released_at=now(), updated_at=now(),
        metadata=metadata || '{"enrollmentDeletionRetired":true}'::jsonb,
        target_charge_id=CASE WHEN target_charge_id=ANY($2::bigint[]) THEN NULL ELSE target_charge_id END
        WHERE id=ANY($1::bigint[])`, [attempts.map((row) => row.id), state.chargeIds])
      await db.query(`UPDATE billing_payment_attempt_charge SET deleted_charge_id=billing_charge_id, billing_charge_id=NULL
        WHERE billing_charge_id=ANY($1::bigint[])`, [state.chargeIds])
      const invoiceLines = await db.query('DELETE FROM billing_monthly_invoice_line WHERE billing_charge_id = ANY($1::bigint[]) RETURNING billing_monthly_invoice_id', [state.chargeIds])
      await db.query(`UPDATE billing_monthly_invoice invoice SET
        subtotal_cents = totals.subtotal, credit_cents = totals.credit,
        total_cents = GREATEST(0, totals.subtotal - totals.credit), updated_at = now()
        FROM (SELECT invoice.id, COALESCE(SUM(GREATEST(line.amount_cents, 0)), 0)::int AS subtotal,
          COALESCE(SUM(GREATEST(-line.amount_cents, 0)), 0)::int AS credit
          FROM billing_monthly_invoice invoice LEFT JOIN billing_monthly_invoice_line line ON line.billing_monthly_invoice_id = invoice.id
          WHERE invoice.id = ANY($1::bigint[]) GROUP BY invoice.id) totals
        WHERE invoice.id = totals.id`, [invoiceLines.rows.map((row) => row.billing_monthly_invoice_id)])
      const statements = await db.query('DELETE FROM billing_statement_line WHERE charge_id = ANY($1::bigint[]) RETURNING statement_id', [state.chargeIds])
      await db.query(`UPDATE billing_statement SET total_cents = COALESCE((SELECT SUM(amount_cents)
        FROM billing_statement_line WHERE statement_id = billing_statement.id), 0), updated_at = now()
        WHERE id = ANY($1::bigint[])`, [statements.rows.map((row) => row.statement_id)])
      await db.query('DELETE FROM billing_charge WHERE id = ANY($1::bigint[])', [state.chargeIds])
      await db.query('DELETE FROM billing_subscription WHERE id = ANY($1::bigint[])', [state.subscriptionIds])
      await db.query('DELETE FROM enrollment_cancellation_request WHERE signup_id = $1', [signupId])
      await db.query('DELETE FROM member_missed_class WHERE scheduling_signup_id = $1', [signupId])
      await db.query('DELETE FROM scheduling_signup WHERE id = $1', [signupId])
      const data = { signupId, replacementMonths: [...new Set(invoices.filter((row) => row.stripe_invoice_id && row.status !== 'void').map((row) => String(row.billing_month instanceof Date ? row.billing_month.toISOString() : row.billing_month).slice(0, 10)))], removedChargeCount: state.chargeIds.length, removedAmountCents: state.removedAmountCents }
      await recordBillingActivity(db, { accountId: source.account_id, memberId: source.member_id,
        eventKey: `enrollment-deleted:${facilityId}:${signupId}`, eventType: 'unpaid_enrollment_deleted',
        summary: 'Unpaid enrollment and its unpaid charges were deleted.', afterValue: data, actorUserId })

      await db.query("UPDATE billing_enrollment_deletion SET status='deleted', result=$2::jsonb, updated_at=now() WHERE signup_id=$1", [signupId, JSON.stringify(data)])
      await db.query('COMMIT')
      return finishDeletion(db, { ...operation, status: 'deleted', result: data }, { stripe, environment, replaceInvoice })
    } catch (error) {
      await db.query('ROLLBACK')
      await recordDeletionFailure(db, operation, error)
      throw error
    }
  })
}

/** Periodic recovery only finishes already committed deletions. Remote
 * cancellation retries still require the administrator to retry deletion. */
export async function reconcileDeletedEnrollmentInvoices(pool, { stripeClient, environment = process.env } = {}) {
  const pending = (await pool.query("SELECT * FROM billing_enrollment_deletion WHERE status='deleted' ORDER BY updated_at LIMIT 20")).rows
  for (const operation of pending) {
    try {
      await deleteCustomerBillingEnrollment(pool, { signupId: Number(operation.signup_id), facilityId: Number(operation.facility_id),
        actorUserId: Number(operation.actor_user_id), stripeClient, environment })
    } catch (error) {
      console.error('[enrollment-deletion] invoice recovery failed:', operation.signup_id, error.message)
    }
  }
}

export async function previewChargeEnrollmentDeletion(pool, { chargeId, facilityId }) {
  const { rows } = await pool.query(`SELECT COALESCE(
      CASE WHEN charge.source_type = 'scheduling_signup' THEN charge.source_id END,
      CASE WHEN subscription.source_type = 'scheduling_signup' THEN subscription.source_id END
    ) AS signup_id
    FROM billing_charge charge
    JOIN family_billing_account account ON account.id = charge.family_billing_account_id
    JOIN family ON family.id = account.family_id AND family.facility_id = $2
    LEFT JOIN billing_subscription subscription ON subscription.id = charge.subscription_id
    WHERE charge.id = $1`, [chargeId, facilityId])
  const signupId = Number(rows[0]?.signup_id)
  if (!Number.isSafeInteger(signupId) || signupId <= 0) return { canDelete: false }
  return previewCustomerBillingEnrollmentDeletion(pool, { signupId, facilityId })
}
