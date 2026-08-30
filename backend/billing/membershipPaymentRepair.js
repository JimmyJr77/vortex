import { normalizeHistoricalPaymentAllocations } from './paymentAllocation.js'
import { recordBillingActivityBestEffort } from './billingActivity.js'

function uniqueIds(rows) {
  return [...new Set(rows.map((row) => Number(row.member_id)).filter((id) => Number.isFinite(id) && id > 0))]
}

function periodFromCharge(charge) {
  const sourcePeriod = String(charge.source_id || '').split(':')[2]
  if (/^\d{4}-\d{2}-\d{2}$/.test(sourcePeriod || '')) return sourcePeriod
  const created = new Date(charge.created_at)
  created.setUTCFullYear(created.getUTCFullYear() + 1)
  return created.toISOString().slice(0, 10)
}

async function candidatesAtPriority(pool, charge) {
  const feeId = Number(String(charge.source_id || '').split(':')[0])
  const periodKey = periodFromCharge(charge)
  const linkedSignup = await pool.query(
    `SELECT DISTINCT signup.member_id
     FROM additional_fee_redemption redemption
     JOIN scheduling_signup signup ON signup.id = redemption.signup_id
     WHERE redemption.fee_id = $1
       AND (redemption.billing_charge_id = $2 OR redemption.period_key = $3)
       AND signup.member_id IS NOT NULL`,
    [feeId, charge.id, periodKey],
  )
  let candidates = uniqueIds(linkedSignup.rows)
  if (candidates.length) return { candidates, evidence: 'linked_signup_redemption' }

  if (charge.stripe_checkout_session_id) {
    const pending = await pool.query(
      `SELECT DISTINCT member_id
       FROM stripe_pending_enrollment
       WHERE family_billing_account_id = $1
         AND stripe_checkout_session_id = $2
         AND member_id IS NOT NULL`,
      [charge.family_billing_account_id, charge.stripe_checkout_session_id],
    )
    candidates = uniqueIds(pending.rows)
    if (candidates.length) return { candidates, evidence: 'pending_enrollment' }

    const sameCheckout = await pool.query(
      `SELECT DISTINCT member_id
       FROM billing_charge
       WHERE family_billing_account_id = $1
         AND stripe_checkout_session_id = $2
         AND source_type = 'scheduling_signup'
         AND member_id IS NOT NULL`,
      [charge.family_billing_account_id, charge.stripe_checkout_session_id],
    )
    candidates = uniqueIds(sameCheckout.rows)
    if (candidates.length) return { candidates, evidence: 'same_checkout_class_charge' }
  }

  const recurring = await pool.query(
    `SELECT DISTINCT member_id FROM (
       SELECT subscription.member_id
       FROM billing_subscription subscription
       WHERE subscription.family_billing_account_id = $1
         AND subscription.source_type = 'scheduling_signup'
         AND subscription.status IN ('active', 'paused')
       UNION ALL
       SELECT signup.member_id
       FROM scheduling_signup signup
       JOIN member ON member.id = signup.member_id
       WHERE member.family_id = $2
         AND signup.status = 'confirmed'
         AND EXISTS (
           SELECT 1 FROM billing_charge class_charge
           WHERE class_charge.source_type = 'scheduling_signup'
             AND class_charge.source_id = signup.id::text
         )
     ) candidates WHERE member_id IS NOT NULL`,
    [charge.family_billing_account_id, charge.family_id],
  )
  return { candidates: uniqueIds(recurring.rows), evidence: 'unique_qualifying_recurring_athlete' }
}

async function createAmbiguityAlert(pool, charge, candidates, evidence) {
  await pool.query(
    `INSERT INTO stripe_billing_alert (
       stripe_event_id, family_billing_account_id, alert_type, severity,
       stripe_object_id, message, details
     ) VALUES ($1, $2, 'membership_owner_review', 'warning', $3, $4, $5::jsonb)
     ON CONFLICT (stripe_event_id) DO UPDATE
     SET message = EXCLUDED.message, details = EXCLUDED.details,
         resolved_at = NULL, updated_at = now()`,
    [
      `membership-owner-review:${charge.id}`,
      charge.family_billing_account_id,
      charge.stripe_checkout_session_id,
      `Annual membership charge #${charge.id} needs athlete ownership review.`,
      JSON.stringify({ chargeId: Number(charge.id), currentMemberId: Number(charge.member_id), candidates, evidence }),
    ],
  )
}

async function repairChargeOwner(pool, stripe, charge, targetMemberId, evidence) {
  const feeId = Number(String(charge.source_id || '').split(':')[0])
  const periodKey = periodFromCharge(charge)
  const client = typeof pool.connect === 'function' ? await pool.connect() : pool
  let subscriptions = []
  try {
    await client.query('BEGIN')
    await client.query(
      `UPDATE billing_charge
       SET member_id = $2,
           source_id = $3,
           metadata = COALESCE(metadata, '{}'::jsonb) || $4::jsonb
       WHERE id = $1`,
      [
        charge.id,
        targetMemberId,
        `${feeId}:${targetMemberId}:${periodKey}`,
        JSON.stringify({ membershipOwnerRepair: { fromMemberId: Number(charge.member_id), toMemberId: targetMemberId, evidence } }),
      ],
    )
    await client.query(
      `UPDATE additional_fee_redemption
       SET member_id = $2, billing_charge_id = $3
       WHERE fee_id = $1
         AND (billing_charge_id = $3 OR (member_id = $4 AND period_key = $5))`,
      [feeId, targetMemberId, charge.id, charge.member_id, periodKey],
    )
    subscriptions = await client.query(
      `UPDATE billing_subscription
       SET member_id = $2,
           source_id = $3,
           description = regexp_replace(description, '\\s+·\\s+.*$', '') || ' · ' ||
             (SELECT trim(concat_ws(' ', first_name, last_name)) FROM member WHERE id = $2),
           updated_at = now()
       WHERE family_billing_account_id = $1
         AND source_type = 'annual_membership'
         AND member_id = $4
         AND source_id = $5
         AND ABS(start_date - $6::timestamptz::date) <= 2
       RETURNING id, stripe_subscription_id`,
      [
        charge.family_billing_account_id,
        targetMemberId,
        `${feeId}:${targetMemberId}`,
        charge.member_id,
        `${feeId}:${charge.member_id}`,
        charge.created_at,
      ],
    ).then((result) => result.rows)
    const promoCode = String(charge.metadata?.discountCode || '').trim()
    if (promoCode && Number(charge.discount_amount_cents) > 0) {
      await client.query(
        `UPDATE discount_redemption redemption
         SET member_id = $2
         FROM discount_rule rule
         WHERE redemption.rule_id = rule.id
           AND redemption.member_id = $1
           AND redemption.amount_cents = $3
           AND upper(COALESCE(rule.config->>'code', rule.config->>'promo_code', '')) = upper($4)
           AND redemption.created_at BETWEEN $5::timestamptz - interval '15 minutes'
                                         AND $5::timestamptz + interval '15 minutes'`,
        [charge.member_id, targetMemberId, charge.discount_amount_cents, promoCode, charge.created_at],
      )
    }
    await recordBillingActivityBestEffort(client, {
      eventKey: `membership-owner-repaired:${charge.id}:${targetMemberId}`,
      accountId: charge.family_billing_account_id,
      memberId: targetMemberId,
      chargeId: charge.id,
      eventType: 'annual_membership_owner_repaired',
      summary: `Annual membership ownership moved to the qualifying athlete.`,
      beforeValue: { memberId: Number(charge.member_id), sourceId: charge.source_id },
      afterValue: { memberId: targetMemberId, sourceId: `${feeId}:${targetMemberId}:${periodKey}` },
      actorType: 'system',
      details: { evidence, repair: true },
    })
    await client.query(
      `UPDATE stripe_billing_alert
       SET resolved_at = now(), updated_at = now()
       WHERE stripe_event_id = $1`,
      [`membership-owner-review:${charge.id}`],
    )
    await client.query('COMMIT')
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {})
    throw error
  } finally {
    if (client !== pool && typeof client.release === 'function') client.release()
  }

  if (stripe) {
    for (const subscription of subscriptions) {
      if (!subscription.stripe_subscription_id) continue
      await stripe.subscriptions.update(subscription.stripe_subscription_id, {
        metadata: { memberId: String(targetMemberId), feeId: String(feeId) },
      })
    }
  }
}

/** Dry-run by default. Applies only evidence-backed, single-athlete repairs. */
export async function repairMembershipOwnershipAndAllocations(pool, stripe = null, {
  apply = false,
  accountIds = [],
  familyIds = [],
  from = null,
  through = null,
} = {}) {
  const charges = await pool.query(
    `SELECT charge.*, account.family_id, account.payer_member_id,
            trim(concat_ws(' ', owner.first_name, owner.last_name)) AS current_member_name
     FROM billing_charge charge
     JOIN family_billing_account account ON account.id = charge.family_billing_account_id
     LEFT JOIN member owner ON owner.id = charge.member_id
     JOIN additional_fee fee
       ON charge.source_type = 'additional_fee'
      AND split_part(charge.source_id, ':', 1) ~ '^[0-9]+$'
      AND fee.id = split_part(charge.source_id, ':', 1)::bigint
      AND (fee.trigger_type = 'once_per_year' OR fee.apply_basis = 'per_year')
     WHERE ($1::bigint[] = '{}'::bigint[] OR charge.family_billing_account_id = ANY($1::bigint[]))
       AND ($2::bigint[] = '{}'::bigint[] OR account.family_id = ANY($2::bigint[]))
       AND ($3::date IS NULL OR charge.created_at::date >= $3::date)
       AND ($4::date IS NULL OR charge.created_at::date <= $4::date)
     ORDER BY charge.family_billing_account_id, charge.created_at, charge.id`,
    [accountIds, familyIds, from, through],
  )
  const report = {
    mode: apply ? 'apply' : 'dry_run',
    scanned: charges.rowCount,
    repaired: [],
    correct: [],
    ambiguous: [],
    allocations: [],
    failed: [],
  }
  const touchedAccounts = new Set()
  for (const charge of charges.rows) {
    try {
      const resolution = await candidatesAtPriority(pool, charge)
      if (resolution.candidates.includes(Number(charge.member_id))) {
        report.correct.push({
          chargeId: Number(charge.id),
          accountId: Number(charge.family_billing_account_id),
          memberId: Number(charge.member_id),
          evidence: `${resolution.evidence}:existing_owner_is_qualifying`,
        })
        touchedAccounts.add(Number(charge.family_billing_account_id))
        continue
      }
      if (resolution.candidates.length !== 1) {
        const item = { chargeId: Number(charge.id), accountId: Number(charge.family_billing_account_id), currentMemberId: Number(charge.member_id), ...resolution }
        report.ambiguous.push(item)
        if (apply) await createAmbiguityAlert(pool, charge, resolution.candidates, resolution.evidence)
        continue
      }
      const targetMemberId = resolution.candidates[0]
      if (targetMemberId === Number(charge.member_id)) {
        report.correct.push({ chargeId: Number(charge.id), accountId: Number(charge.family_billing_account_id), memberId: targetMemberId, evidence: resolution.evidence })
      } else {
        const item = {
          chargeId: Number(charge.id),
          accountId: Number(charge.family_billing_account_id),
          fromMemberId: Number(charge.member_id),
          toMemberId: targetMemberId,
          evidence: resolution.evidence,
        }
        report.repaired.push(item)
        if (apply) await repairChargeOwner(pool, stripe, charge, targetMemberId, resolution.evidence)
      }
      touchedAccounts.add(Number(charge.family_billing_account_id))
    } catch (error) {
      report.failed.push({ chargeId: Number(charge.id), accountId: Number(charge.family_billing_account_id), error: error.message })
    }
  }
  if (apply) {
    const accountScope = accountIds.length
      ? accountIds
      : await pool.query(
          `SELECT id FROM family_billing_account
           WHERE ($1::bigint[] = '{}'::bigint[] OR family_id = ANY($1::bigint[]))`,
          [familyIds],
        ).then((result) => result.rows.map((row) => Number(row.id)))
    for (const accountId of new Set([...accountScope, ...touchedAccounts])) {
      try {
        const allocation = await normalizeHistoricalPaymentAllocations(pool, { accountId })
        report.allocations.push({
          accountId,
          allocationApplications: allocation.applications.length,
          activatedMemberships: allocation.activatedMemberships.length,
        })
      } catch (error) {
        report.failed.push({ accountId, stage: 'allocation', error: error.message })
      }
    }
  }
  return report
}
