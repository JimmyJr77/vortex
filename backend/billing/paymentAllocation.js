import { recordBillingActivityBestEffort } from './billingActivity.js'

let householdInvoiceSchemaEnsured = false

async function ensureHouseholdInvoiceSchema(pool) {
  if (householdInvoiceSchemaEnsured) return
  const fs = await import('fs')
  const migration = new URL('../migrations/774_household_monthly_invoicing.sql', import.meta.url)
  await pool.query(fs.readFileSync(migration, 'utf8'))
  householdInvoiceSchemaEnsured = true
}

const SETTLED_PAYMENT_STATUSES = new Set(['', 'recorded', 'settled', 'succeeded', 'paid', 'complete', 'completed'])

function cents(value) {
  return Math.max(0, Math.round(Number(value) || 0))
}

function dateValue(value) {
  const date = value instanceof Date ? value : new Date(value)
  return Number.isNaN(date.getTime()) ? new Date() : date
}

function timestamp(value) {
  return dateValue(value).getTime()
}

function renewalDate(value) {
  const date = dateValue(value)
  const renewal = new Date(Date.UTC(
    date.getUTCFullYear() + 1,
    date.getUTCMonth(),
    date.getUTCDate(),
  ))
  return renewal.toISOString().slice(0, 10)
}

function chargeOrder(left, right) {
  if (Boolean(left.isAnnualMembership) !== Boolean(right.isAnnualMembership)) {
    return left.isAnnualMembership ? -1 : 1
  }
  const leftDue = timestamp(left.servicePeriodStart || left.createdAt)
  const rightDue = timestamp(right.servicePeriodStart || right.createdAt)
  return leftDue - rightDue || Number(left.id) - Number(right.id)
}

/** Pure allocation planner used by both the service and exact fixture tests. */
export function buildMembershipFirstAllocationPlan({ payments = [], charges = [], applications = [], refunds = [] }) {
  const paymentApplied = new Map()
  const chargeApplied = new Map()
  for (const application of applications) {
    const sign = application.applicationKind === 'reversal' ? -1 : 1
    const amount = sign * cents(application.amountCents)
    paymentApplied.set(Number(application.paymentId), (paymentApplied.get(Number(application.paymentId)) || 0) + amount)
    chargeApplied.set(Number(application.chargeId), (chargeApplied.get(Number(application.chargeId)) || 0) + amount)
  }
  const refundedByPayment = new Map()
  for (const refund of refunds) {
    if (!['succeeded', 'pending'].includes(String(refund.status || 'succeeded').toLowerCase())) continue
    refundedByPayment.set(Number(refund.paymentId), (refundedByPayment.get(Number(refund.paymentId)) || 0) + cents(refund.amountCents))
  }

  const orderedCharges = charges
    .filter((charge) => cents(charge.amountCents) > 0)
    .map((charge) => ({ ...charge }))
    .sort(chargeOrder)
  const plan = []
  const orderedPayments = payments
    .filter((payment) => SETTLED_PAYMENT_STATUSES.has(String(payment.status || '').toLowerCase()))
    .slice()
    .sort((left, right) => timestamp(left.paidAt) - timestamp(right.paidAt) || Number(left.id) - Number(right.id))

  for (const payment of orderedPayments) {
    let available = Math.max(
      0,
      cents(payment.amountCents) - (paymentApplied.get(Number(payment.id)) || 0) - (refundedByPayment.get(Number(payment.id)) || 0),
    )
    for (const charge of orderedCharges) {
      if (available <= 0) break
      const alreadyApplied = chargeApplied.get(Number(charge.id)) || 0
      const remaining = Math.max(0, cents(charge.amountCents) - alreadyApplied)
      if (remaining <= 0) continue
      const amountCents = Math.min(available, remaining)
      plan.push({
        paymentId: Number(payment.id),
        chargeId: Number(charge.id),
        amountCents,
        allocationReason: charge.isAnnualMembership ? 'annual_membership_first' : 'oldest_charge',
      })
      available -= amountCents
      paymentApplied.set(Number(payment.id), (paymentApplied.get(Number(payment.id)) || 0) + amountCents)
      chargeApplied.set(Number(charge.id), alreadyApplied + amountCents)
    }
  }
  return plan
}

async function activatePaidMemberships(db, accountId) {
  const satisfied = await db.query(
    `WITH effective_applications AS (
       SELECT application.billing_charge_id, payment.paid_at,
              GREATEST(0, application.amount_cents - COALESCE(SUM(reversal.amount_cents), 0))::int AS effective_cents
       FROM billing_payment_application application
       JOIN billing_payment payment ON payment.id = application.billing_payment_id
       LEFT JOIN billing_payment_application reversal
         ON reversal.reverses_application_id = application.id
        AND reversal.application_kind = 'reversal'
       WHERE application.application_kind = 'application'
       GROUP BY application.id, application.billing_charge_id, payment.paid_at
     ), application_totals AS (
       SELECT billing_charge_id,
              COALESCE(SUM(effective_cents), 0)::int AS applied_cents,
              MAX(paid_at) FILTER (WHERE effective_cents > 0) AS satisfied_at
       FROM effective_applications
       GROUP BY billing_charge_id
     )
     SELECT c.*, fee.id AS fee_id, totals.satisfied_at,
            existing.satisfied_at AS prior_satisfied_at
     FROM billing_charge c
     JOIN additional_fee fee
       ON c.source_type = 'additional_fee'
      AND split_part(c.source_id, ':', 1) ~ '^[0-9]+$'
      AND fee.id = split_part(c.source_id, ':', 1)::bigint
      AND (fee.trigger_type = 'once_per_year' OR fee.apply_basis = 'per_year')
     JOIN application_totals totals ON totals.billing_charge_id = c.id
     LEFT JOIN additional_fee_redemption existing ON existing.billing_charge_id = c.id
     WHERE c.family_billing_account_id = $1
       AND c.member_id IS NOT NULL
       AND c.amount_cents > 0
       AND totals.applied_cents >= c.amount_cents`,
    [accountId],
  )
  const activated = []
  for (const charge of satisfied.rows) {
    const paidAt = dateValue(charge.satisfied_at)
    const periodKey = renewalDate(paidAt)
    let result = await db.query(
      `UPDATE additional_fee_redemption
       SET member_id = $1, period_key = $2, amount_cents = $3,
           satisfied_at = $5, created_at = $5, ended_at = NULL, end_reason = NULL
       WHERE billing_charge_id = $4
       RETURNING *`,
      [charge.member_id, periodKey, Number(charge.amount_cents), charge.id, paidAt],
    )
    if (!result.rows[0]) {
      result = await db.query(
        `INSERT INTO additional_fee_redemption (
           fee_id, member_id, signup_id, period_key, amount_cents,
           billing_charge_id, satisfied_at, created_at
         ) VALUES ($1, $2, NULL, $3, $4, $5, $6, $6)
         ON CONFLICT (fee_id, member_id, period_key) DO UPDATE
         SET billing_charge_id = COALESCE(additional_fee_redemption.billing_charge_id, EXCLUDED.billing_charge_id),
             satisfied_at = COALESCE(additional_fee_redemption.satisfied_at, EXCLUDED.satisfied_at),
             created_at = LEAST(additional_fee_redemption.created_at, EXCLUDED.created_at)
         RETURNING *`,
        [charge.fee_id, charge.member_id, periodKey, Number(charge.amount_cents), charge.id, paidAt],
      )
    }
    const subscription = await db.query(
      `INSERT INTO billing_subscription (
         family_billing_account_id, member_id, source_type, source_id, description,
         monthly_amount_cents, discount_amount_cents, net_monthly_cents,
         status, start_date, anchor_day, next_bill_date, pricing_option_key, auto_renewal
       ) VALUES ($1, $2, 'annual_membership', $3, $4, 0, 0, 0,
                 'active', $5::date, $6, $7::date, 'annual_membership', FALSE)
       ON CONFLICT (source_type, source_id) WHERE source_id IS NOT NULL AND status <> 'cancelled'
       DO UPDATE SET next_bill_date = EXCLUDED.next_bill_date, updated_at = now()
       RETURNING *`,
      [accountId, charge.member_id, `${charge.fee_id}:${charge.member_id}`, charge.description, paidAt, paidAt.getUTCDate(), periodKey],
    ).then((subscriptionResult) => subscriptionResult.rows[0] ?? null)
    if (subscription && !subscription.stripe_subscription_id) {
      await db.query(
        `INSERT INTO stripe_billing_alert (
           stripe_event_id, family_billing_account_id, alert_type, severity, message, details
         ) VALUES ($1, $2, 'membership_autorenewal_setup_required', 'warning', $3, $4::jsonb)
         ON CONFLICT (stripe_event_id) DO UPDATE
         SET message = EXCLUDED.message, details = EXCLUDED.details,
             resolved_at = NULL, updated_at = now()`,
        [
          `membership-autorenewal:${charge.id}`,
          accountId,
          `${charge.description} is paid, but automatic yearly renewal is not connected to Stripe.`,
          JSON.stringify({ chargeId: Number(charge.id), memberId: Number(charge.member_id), billingSubscriptionId: Number(subscription.id) }),
        ],
      )
    }
    const satisfactionChanged = !charge.prior_satisfied_at ||
      dateValue(charge.prior_satisfied_at).getTime() !== paidAt.getTime()
    if (satisfactionChanged) {
      activated.push({ charge, redemption: result.rows[0], satisfiedAt: paidAt, renewsOn: periodKey })
    }
    await recordBillingActivityBestEffort(db, {
      eventKey: `annual-membership-satisfied:${charge.id}:${paidAt.toISOString()}`,
      accountId,
      memberId: charge.member_id,
      chargeId: charge.id,
      eventType: 'annual_membership_activated',
      summary: `${charge.description} was fully paid and activated for its athlete.`,
      afterValue: { membershipDate: paidAt.toISOString(), renewalDate: periodKey },
      actorType: 'system',
      occurredAt: paidAt,
    })
  }
  return activated
}

async function refreshChargeStatuses(db, accountId) {
  await db.query(
    `UPDATE billing_charge charge
     SET collection_status = CASE
       WHEN COALESCE((
         SELECT SUM(CASE WHEN application_kind = 'reversal' THEN -amount_cents ELSE amount_cents END)
         FROM billing_payment_application WHERE billing_charge_id = charge.id
       ), 0) >= charge.amount_cents THEN 'paid'
       WHEN COALESCE((
         SELECT SUM(CASE WHEN application_kind = 'reversal' THEN -amount_cents ELSE amount_cents END)
         FROM billing_payment_application WHERE billing_charge_id = charge.id
       ), 0) > 0 THEN 'partially_paid'
       WHEN charge.collection_status IN ('checkout_pending', 'processing', 'failed') THEN charge.collection_status
       ELSE 'unpaid'
     END
     WHERE charge.family_billing_account_id = $1
       AND charge.amount_cents > 0`,
    [accountId],
  )
  await db.query(
    `UPDATE billing_statement statement
     SET status = 'paid', updated_at = now()
     WHERE statement.family_billing_account_id = $1
       AND statement.status = 'issued'
       AND NOT EXISTS (
         SELECT 1
         FROM billing_statement_line line
         JOIN billing_charge charge ON charge.id = line.charge_id
         WHERE line.statement_id = statement.id
           AND charge.amount_cents > COALESCE((
             SELECT SUM(CASE WHEN application_kind = 'reversal' THEN -amount_cents ELSE amount_cents END)
             FROM billing_payment_application WHERE billing_charge_id = charge.id
           ), 0)
       )`,
    [accountId],
  )
}

async function advancePaidThroughEnrollmentSubscriptions(db, accountId, actorType) {
  const candidates = await db.query(
    `SELECT subscription.id, subscription.member_id, subscription.source_type,
            subscription.source_id, subscription.next_bill_date,
            MAX(charge.service_period_end) AS paid_through_date
     FROM billing_subscription subscription
     JOIN billing_charge charge ON charge.subscription_id = subscription.id
     WHERE subscription.family_billing_account_id = $1
       AND subscription.status = 'active'
       AND subscription.source_type = 'scheduling_signup'
       AND subscription.next_bill_date IS NOT NULL
       AND charge.charge_type = 'recurring'
       AND charge.service_period_end IS NOT NULL
       AND COALESCE((
         SELECT SUM(CASE
           WHEN application.application_kind = 'reversal' THEN -application.amount_cents
           ELSE application.amount_cents
         END)
         FROM billing_payment_application application
         WHERE application.billing_charge_id = charge.id
       ), 0) >= charge.amount_cents
     GROUP BY subscription.id
     HAVING MAX(charge.service_period_end) + 1 > subscription.next_bill_date`,
    [accountId],
  )
  const advanced = []
  for (const row of candidates.rows) {
    const nextBillDate = new Date(dateValue(row.paid_through_date).getTime() + 24 * 60 * 60 * 1000)
      .toISOString()
      .slice(0, 10)
    const result = await db.query(
      `UPDATE billing_subscription
       SET next_bill_date = $2::date, updated_at = now()
       WHERE id = $1 AND next_bill_date < $2::date
       RETURNING *`,
      [row.id, nextBillDate],
    )
    if (!result.rows[0]) continue
    advanced.push(result.rows[0])
    await recordBillingActivityBestEffort(db, {
      eventKey: `enrollment-paid-through-next-bill:${row.id}:${nextBillDate}`,
      accountId,
      memberId: row.member_id,
      signupId: /^\d+$/.test(String(row.source_id ?? '')) ? Number(row.source_id) : null,
      eventType: 'enrollment_next_bill_advanced',
      summary: 'Next enrollment bill advanced through the fully paid service month.',
      beforeValue: { nextBillDate: row.next_bill_date },
      afterValue: { nextBillDate },
      details: { paidThroughDate: row.paid_through_date },
      actorType,
    })
  }
  return advanced
}

export async function repairEnrollmentBillingCoverage(pool, {
  accountId,
  apply = false,
  actorType = 'system',
} = {}) {
  if (!Number.isFinite(Number(accountId))) throw new Error('A billing account ID is required.')
  const candidates = await pool.query(
    `SELECT charge.id AS charge_id, charge.member_id, charge.family_billing_account_id,
            subscription.id AS subscription_id, subscription.source_id AS signup_id,
            signup.enrollment_start_date AS service_period_start,
            (date_trunc('month', signup.enrollment_start_date) + INTERVAL '1 month - 1 day')::date AS service_period_end
     FROM billing_charge charge
     JOIN billing_subscription subscription ON subscription.id = charge.subscription_id
     JOIN scheduling_signup signup
       ON subscription.source_type = 'scheduling_signup'
      AND subscription.source_id ~ '^[0-9]+$'
      AND signup.id = subscription.source_id::bigint
     WHERE charge.family_billing_account_id = $1
       AND charge.charge_type = 'recurring'
       AND charge.source_type = 'scheduling_signup'
       AND charge.service_period_start IS NULL
       AND charge.service_period_end IS NULL
       -- A signup-sourced recurring charge is the initial enrollment bill.
       -- Its service window always begins on the athlete's chosen start date,
       -- even when the row was created before that month or the subscription
       -- has since advanced after a payment.
       AND signup.enrollment_start_date IS NOT NULL
     ORDER BY charge.id`,
    [Number(accountId)],
  )
  if (!apply) return { candidates: candidates.rows, updatedCharges: [], advancedSubscriptions: [] }

  const client = typeof pool.connect === 'function' ? await pool.connect() : pool
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(accountId)])
    const updatedCharges = []
    for (const row of candidates.rows) {
      const updated = await client.query(
        `UPDATE billing_charge
         SET service_period_start = $2::date, service_period_end = $3::date
         WHERE id = $1 AND service_period_start IS NULL AND service_period_end IS NULL
         RETURNING *`,
        [row.charge_id, row.service_period_start, row.service_period_end],
      )
      if (!updated.rows[0]) continue
      updatedCharges.push(updated.rows[0])
      await recordBillingActivityBestEffort(client, {
        eventKey: `enrollment-charge-service-period-backfill:${row.charge_id}`,
        accountId: Number(accountId),
        memberId: row.member_id,
        signupId: Number(row.signup_id),
        chargeId: Number(row.charge_id),
        eventType: 'enrollment_charge_service_period_repaired',
        summary: 'Prepaid enrollment charge assigned to its unambiguous service month.',
        beforeValue: { servicePeriodStart: null, servicePeriodEnd: null },
        afterValue: {
          servicePeriodStart: row.service_period_start,
          servicePeriodEnd: row.service_period_end,
        },
        details: { reason: 'future_or_month_boundary_enrollment' },
        actorType,
      })
    }
    const advancedSubscriptions = await advancePaidThroughEnrollmentSubscriptions(
      client,
      Number(accountId),
      actorType,
    )
    await client.query('COMMIT')
    return { candidates: candidates.rows, updatedCharges, advancedSubscriptions }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    if (client !== pool && typeof client.release === 'function') client.release()
  }
}

/**
 * Replays all available settled household payments. Existing applications make
 * this idempotent, while the account advisory lock prevents webhook races.
 */
export async function allocateHouseholdPayments(pool, {
  accountId,
  actorType = 'system',
  idempotencyNamespace = 'allocation',
}) {
  await ensureHouseholdInvoiceSchema(pool)
  const activityActorType = ['admin', 'member', 'system', 'stripe'].includes(actorType)
    ? actorType
    : 'system'
  const client = typeof pool.connect === 'function' ? await pool.connect() : pool
  try {
    await client.query('BEGIN')
    await client.query('SELECT pg_advisory_xact_lock($1)', [Number(accountId)])
    const [paymentsResult, chargesResult, applicationsResult, refundsResult] = await Promise.all([
      client.query(
        `SELECT id, amount_cents, paid_at, COALESCE(external_status, '') AS status
         FROM billing_payment WHERE family_billing_account_id = $1 ORDER BY paid_at, id`,
        [accountId],
      ),
      client.query(
        `SELECT c.id, c.amount_cents, c.service_period_start, c.created_at,
                EXISTS (
                  SELECT 1 FROM additional_fee fee
                  WHERE c.source_type = 'additional_fee'
                    AND split_part(c.source_id, ':', 1) ~ '^[0-9]+$'
                    AND fee.id = split_part(c.source_id, ':', 1)::bigint
                    AND (fee.trigger_type = 'once_per_year' OR fee.apply_basis = 'per_year')
                ) AS is_annual_membership
         FROM billing_charge c
         WHERE c.family_billing_account_id = $1
           AND c.amount_cents > 0
           AND c.charge_type <> 'credit'
           -- A charge reserved on an open household monthly invoice is paid
           -- only by that invoice's webhook mapping. General household
           -- allocation must not consume it and make Stripe collect it again.
           AND NOT EXISTS (
             SELECT 1
             FROM billing_monthly_invoice_line line
             JOIN billing_monthly_invoice invoice ON invoice.id = line.billing_monthly_invoice_id
             WHERE line.billing_charge_id = c.id
               AND invoice.status IN ('draft', 'open', 'failed', 'payment_method_required')
           )
         ORDER BY c.created_at, c.id`,
        [accountId],
      ),
      client.query(
        `SELECT application.billing_payment_id, application.billing_charge_id,
                application.amount_cents, application.application_kind
         FROM billing_payment_application application
         JOIN billing_payment payment ON payment.id = application.billing_payment_id
         WHERE payment.family_billing_account_id = $1`,
        [accountId],
      ),
      client.query(
        `SELECT payment_id, amount_cents, COALESCE(external_status, 'succeeded') AS status
         FROM billing_refund WHERE family_billing_account_id = $1`,
        [accountId],
      ),
    ])
    const plan = buildMembershipFirstAllocationPlan({
      payments: paymentsResult.rows.map((row) => ({ id: row.id, amountCents: row.amount_cents, paidAt: row.paid_at, status: row.status })),
      charges: chargesResult.rows.map((row) => ({
        id: row.id,
        amountCents: row.amount_cents,
        servicePeriodStart: row.service_period_start,
        createdAt: row.created_at,
        isAnnualMembership: row.is_annual_membership,
      })),
      applications: applicationsResult.rows.map((row) => ({
        paymentId: row.billing_payment_id,
        chargeId: row.billing_charge_id,
        amountCents: row.amount_cents,
        applicationKind: row.application_kind,
      })),
      refunds: refundsResult.rows.map((row) => ({ paymentId: row.payment_id, amountCents: row.amount_cents, status: row.status })),
    })
    const inserted = []
    for (const item of plan) {
      const result = await client.query(
        `INSERT INTO billing_payment_application (
           billing_payment_id, billing_charge_id, amount_cents,
           application_kind, idempotency_key, allocation_reason
         ) VALUES ($1, $2, $3, 'application', $4, $5)
         ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
         RETURNING *`,
        [item.paymentId, item.chargeId, item.amountCents, `${idempotencyNamespace}:${item.paymentId}:${item.chargeId}`, item.allocationReason],
      )
      if (!result.rows[0]) continue
      inserted.push(result.rows[0])
      await recordBillingActivityBestEffort(client, {
        eventKey: `payment-allocation:${result.rows[0].id}`,
        accountId,
        chargeId: item.chargeId,
        paymentId: item.paymentId,
        eventType: 'payment_allocated',
        summary: `$${(item.amountCents / 100).toFixed(2)} was applied to charge #${item.chargeId}.`,
        details: { amountCents: item.amountCents, allocationReason: item.allocationReason },
        actorType: activityActorType,
      })
    }
    await refreshChargeStatuses(client, accountId)
    const advancedSubscriptions = await advancePaidThroughEnrollmentSubscriptions(
      client,
      accountId,
      activityActorType,
    )
    const activatedMemberships = await activatePaidMemberships(client, accountId)
    await client.query('COMMIT')
    return { applications: inserted, activatedMemberships, advancedSubscriptions }
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    if (client !== pool && typeof client.release === 'function') client.release()
  }
}

/**
 * Supersede the first allocator version with append-only reversals, then replay
 * chronologically. Exact custom-charge applications are never touched.
 */
export async function normalizeHistoricalPaymentAllocations(pool, {
  accountId,
  replayVersion = 'historical-v2',
}) {
  const prior = await pool.query(
    `SELECT application.*,
            COALESCE((SELECT SUM(reversal.amount_cents)
                      FROM billing_payment_application reversal
                      WHERE reversal.reverses_application_id = application.id), 0)::int AS reversed_cents
     FROM billing_payment_application application
     JOIN billing_payment payment ON payment.id = application.billing_payment_id
     WHERE payment.family_billing_account_id = $1
       AND application.application_kind = 'application'
       AND application.idempotency_key LIKE 'allocation:%'`,
    [accountId],
  )
  for (const application of prior.rows) {
    const amount = Math.max(0, Number(application.amount_cents) - Number(application.reversed_cents))
    if (!amount) continue
    await pool.query(
      `INSERT INTO billing_payment_application (
         billing_payment_id, billing_charge_id, amount_cents, application_kind,
         reverses_application_id, idempotency_key, allocation_reason
       ) VALUES ($1, $2, $3, 'reversal', $4, $5, 'allocator_replay')
       ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING`,
      [
        application.billing_payment_id,
        application.billing_charge_id,
        amount,
        application.id,
        `${replayVersion}:reverse:${application.id}`,
      ],
    )
  }
  return allocateHouseholdPayments(pool, {
    accountId,
    actorType: 'system',
    idempotencyNamespace: replayVersion,
  })
}

/** Pin an exact authorized collection to its charge before general allocation. */
export async function applyExactPayment(pool, { accountId, paymentId, chargeId, amountCents, actorType = 'system' }) {
  const result = await pool.query(
    `INSERT INTO billing_payment_application (
       billing_payment_id, billing_charge_id, amount_cents,
       application_kind, idempotency_key, allocation_reason
     ) VALUES ($1, $2, $3, 'application', $4, 'exact_custom_charge')
     ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
     RETURNING *`,
    [paymentId, chargeId, amountCents, `exact:${paymentId}:${chargeId}`],
  )
  await allocateHouseholdPayments(pool, { accountId, actorType })
  return result.rows[0] ?? pool.query(
    `SELECT * FROM billing_payment_application
     WHERE billing_payment_id = $1 AND billing_charge_id = $2 AND application_kind = 'application'
     ORDER BY id LIMIT 1`,
    [paymentId, chargeId],
  ).then((lookup) => lookup.rows[0] ?? null)
}

/** Reverse applications from one refunded payment, prioritizing the selected charge. */
export async function reverseRefundedApplications(pool, { refund, actorType = 'system' }) {
  if (!refund?.payment_id || Number(refund.amount_cents) <= 0) return []
  const applications = await pool.query(
    `SELECT application.*,
            COALESCE((SELECT SUM(reversal.amount_cents)
                      FROM billing_payment_application reversal
                      WHERE reversal.reverses_application_id = application.id), 0)::int AS reversed_cents
     FROM billing_payment_application application
     WHERE application.billing_payment_id = $1
       AND application.application_kind = 'application'
     ORDER BY (application.billing_charge_id = $2) DESC, application.created_at DESC, application.id DESC`,
    [refund.payment_id, refund.related_charge_id],
  )
  let remaining = Number(refund.amount_cents)
  const reversals = []
  for (const application of applications.rows) {
    if (remaining <= 0) break
    const available = Math.max(0, Number(application.amount_cents) - Number(application.reversed_cents))
    const amount = Math.min(remaining, available)
    if (amount <= 0) continue
    const result = await pool.query(
      `INSERT INTO billing_payment_application (
         billing_payment_id, billing_charge_id, amount_cents, application_kind,
         reverses_application_id, idempotency_key, allocation_reason
       ) VALUES ($1, $2, $3, 'reversal', $4, $5, 'refund_reversal')
       ON CONFLICT (idempotency_key) WHERE idempotency_key IS NOT NULL DO NOTHING
       RETURNING *`,
      [application.billing_payment_id, application.billing_charge_id, amount, application.id, `refund:${refund.id}:application:${application.id}`],
    )
    if (result.rows[0]) reversals.push(result.rows[0])
    remaining -= amount
  }
  await allocateHouseholdPayments(pool, { accountId: refund.family_billing_account_id, actorType })
  return reversals
}

/** End only the athlete membership whose fee allocation was refunded. */
export async function endRefundedAnnualMembership(pool, stripe, refund) {
  if (!refund?.related_charge_id) return { ended: false, subscriptions: [] }
  const charge = await pool.query(
    `SELECT charge.*, fee.id AS fee_id
     FROM billing_charge charge
     JOIN additional_fee fee
       ON charge.source_type = 'additional_fee'
      AND split_part(charge.source_id, ':', 1) ~ '^[0-9]+$'
      AND fee.id = split_part(charge.source_id, ':', 1)::bigint
      AND (fee.trigger_type = 'once_per_year' OR fee.apply_basis = 'per_year')
     WHERE charge.id = $1`,
    [refund.related_charge_id],
  ).then((result) => result.rows[0] ?? null)
  if (!charge?.member_id) return { ended: false, subscriptions: [] }
  const endedAt = refund.created_at || new Date()
  await pool.query(
    `UPDATE additional_fee_redemption
     SET ended_at = $2, end_reason = $3
     WHERE billing_charge_id = $1 AND ended_at IS NULL`,
    [charge.id, endedAt, `Refund #${refund.id}`],
  )
  const subscriptions = await pool.query(
    `UPDATE billing_subscription
     SET status = 'cancelled', auto_renewal = FALSE,
         end_date = $3::timestamptz::date, next_bill_date = NULL, updated_at = now()
     WHERE family_billing_account_id = $1
       AND member_id = $2
       AND source_type = 'annual_membership'
       AND status <> 'cancelled'
     RETURNING id, stripe_subscription_id`,
    [refund.family_billing_account_id, charge.member_id, endedAt],
  ).then((result) => result.rows)
  if (stripe) {
    for (const subscription of subscriptions) {
      if (!subscription.stripe_subscription_id) continue
      await stripe.subscriptions.cancel(subscription.stripe_subscription_id, { prorate: false })
    }
  }
  await recordBillingActivityBestEffort(pool, {
    eventKey: `annual-membership-ended-by-refund:${refund.id}:${charge.id}`,
    accountId: refund.family_billing_account_id,
    memberId: charge.member_id,
    chargeId: charge.id,
    paymentId: refund.payment_id,
    refundId: refund.id,
    eventType: 'annual_membership_refunded',
    summary: `The athlete's annual membership ended because its fee was refunded.`,
    afterValue: { endedAt, autoRenewal: false },
    actorType: 'system',
  })
  return { ended: true, subscriptions }
}
