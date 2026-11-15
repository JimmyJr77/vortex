import { assertNoRetainedAccountHistory } from './retainedAccountHistory.js'

// Unpaid account-owned records to remove with an archived family.
const billingHistoryTables = [
  'annual_membership_checkout_request', 'annual_membership_renewal_pricing',
  'billing_access_action', 'billing_account_activity', 'billing_account_migration',
  'billing_admin_action', 'billing_charge', 'billing_cycle_verification_evidence',
  'billing_enrollment_deletion', 'billing_household_default_remediation_audit',
  'billing_migration_subscription_claim', 'billing_monthly_invoice', 'billing_pause_credit',
  'billing_payment', 'billing_payment_attempt', 'billing_payment_fact_audit_job',
  'billing_recurring_account_progress', 'billing_refund', 'billing_statement',
  'billing_subscription', 'enrollment_cancellation_request', 'enrollment_price_adjustment',
  'store_order', 'stripe_billing_alert', 'stripe_dispute_case', 'stripe_pending_enrollment',
]

// Capture every target before deleting parents: SET NULL foreign keys must not
// cause owned records to disappear from the cleanup scope halfway through.
export async function removeUnpaidHistory(db, { familyId, accountIds, memberIds }) {
  await assertNoRetainedAccountHistory(db, { familyId, memberIds })
  const scopes = new Map(billingHistoryTables.map(table => [table, 'family_billing_account_id=ANY($2::bigint[])']))
  const add = (table, predicate) => scopes.set(table, scopes.has(table) ? `(${scopes.get(table)}) OR (${predicate})` : predicate)
  for (const table of ['scheduling_signup','drop_in_registration','member_missed_class','member_waiver_acceptance',
    'additional_fee_redemption','discount_redemption','drop_in_credit_adjustment','free_pass_redemption',
    'member_multi_class_pass','multi_class_pass_redemption','billing_account_migration_item',
    'billing_charge','billing_subscription','billing_account_activity','billing_statement_line',
    'billing_monthly_invoice_line','billing_pause_credit','enrollment_price_adjustment',
    'annual_membership_renewal_pricing','stripe_pending_enrollment','store_order']) {
    add(table, 'member_id=ANY($3::bigint[])')
  }
  for (const table of ['jackrabbit_history_record','annual_membership_checkout_promo_reservation']) {
    add(table, 'family_id=$1 OR member_id=ANY($3::bigint[])')
  }
  add('annual_membership_checkout_request', 'payer_member_id=ANY($3::bigint[])')
  add('registrations', 'member_id=ANY($3::bigint[]) OR converted_member_id=ANY($3::bigint[])')
  add('account_invite', 'pending_family_id=$1 OR registration_id IN (SELECT id FROM registrations WHERE member_id=ANY($3::bigint[]) OR converted_member_id=ANY($3::bigint[]))')
  add('scheduling_signup', `(member_id IS NULL OR member_id=ANY($3::bigint[])) AND account_invite_id IN (SELECT id FROM account_invite WHERE ${scopes.get('account_invite')})`)
  const descendants = [
    ['enrollment_action','signup_id','scheduling_signup'],
    ['enrollment_cancellation_request','signup_id','scheduling_signup'],
    ['member_missed_class','scheduling_signup_id','scheduling_signup'],
    ['new_admin_lead_ownership_audit','registration_id','registrations'],
    ['billing_account_migration_item','billing_account_migration_id','billing_account_migration'],
    ['billing_account_migration_baseline','billing_account_migration_id','billing_account_migration'],
    ['billing_migration_exception','billing_account_migration_id','billing_account_migration'],
    ['billing_statement_line','statement_id','billing_statement'],
    ['billing_payment_application','billing_payment_id','billing_payment'],
    ['billing_payment_application','billing_charge_id','billing_charge'],
    ['billing_payment_attempt','target_charge_id','billing_charge'],
    ['billing_payment_attempt_charge','billing_payment_attempt_id','billing_payment_attempt'],
    ['billing_payment_attempt_charge','billing_charge_id','billing_charge'],
    ['billing_monthly_invoice_line','billing_charge_id','billing_charge'],
    ['billing_monthly_invoice_line','billing_monthly_invoice_id','billing_monthly_invoice'],
    ['billing_charge_credit_application','billing_monthly_invoice_id','billing_monthly_invoice'],
  ]
  for (const [table, column, parent] of descendants) add(table, `${column} IN (SELECT id FROM ${parent} WHERE ${scopes.get(parent)})`)
  const targets = []
  for (const [table, predicate] of scopes) {
    const keyColumns = {
      billing_enrollment_deletion: ['signup_id'],
      billing_migration_subscription_claim: ['claim_kind', 'claim_value'],
      billing_recurring_account_progress: ['run_id', 'family_billing_account_id'],
    }[table] || ['id']
    const { rows } = await db.query(`SELECT ${keyColumns.join(',')} FROM ${table} WHERE (${predicate}) AND $1::bigint IS NOT NULL AND $2::bigint[] IS NOT NULL AND $3::bigint[] IS NOT NULL`, [familyId, accountIds, memberIds])
    if (rows.length) targets.push({ table, keys: rows })
  }
  const inviteTargets = targets.find(target => target.table === 'account_invite')
  if (inviteTargets) {
    await db.query('UPDATE scheduling_signup SET account_invite_id=NULL WHERE account_invite_id=ANY($1::bigint[])', [inviteTargets.keys.map(key => key.id)])
  }
  // A fixed whitelist, with savepoints to resolve FK ordering. Unknown or shared
  // dependencies abort the entire transaction rather than cascading elsewhere.
  while (targets.length) {
    let progress = false
    let dependencyError
    for (let i = targets.length - 1; i >= 0; i--) {
      await db.query('SAVEPOINT unpaid_cleanup')
      try {
        await db.query(`DELETE FROM ${targets[i].table} AS owned WHERE EXISTS (SELECT 1 FROM jsonb_array_elements($1::jsonb) AS key WHERE NOT EXISTS (SELECT 1 FROM jsonb_each_text(key) field WHERE (to_jsonb(owned)->>field.key) IS DISTINCT FROM field.value))`, [JSON.stringify(targets[i].keys)])
        await db.query('RELEASE SAVEPOINT unpaid_cleanup')
        targets.splice(i, 1)
        progress = true
      } catch (error) {
        await db.query('ROLLBACK TO SAVEPOINT unpaid_cleanup')
        await db.query('RELEASE SAVEPOINT unpaid_cleanup')
        if (error.code !== '23503') throw error
        dependencyError = error
      }
    }
    if (!progress) throw dependencyError
  }
  await db.query('DELETE FROM stripe_customer_projection WHERE family_billing_account_id=ANY($1::bigint[])', [accountIds])
  // Source triggers retain tombstones; remove those copies for this unpaid family.
  for (const table of ['account_enrollment','account_charge','account_payment','account_refund']) {
    await db.query(`DELETE FROM ${table} WHERE record_family_id=$1 OR record_member_id=ANY($2::bigint[])`, [familyId, memberIds])
  }
  await db.query('DELETE FROM account_record_source WHERE family_id=$1 OR member_id=ANY($2::bigint[])', [familyId, memberIds])
}

export async function hasFamilyPayments(db, { familyId, accountIds, memberIds }) {
  const { rows: [history] } = await db.query(
    `SELECT EXISTS (
       SELECT 1 FROM account_payment
       WHERE (record_family_id=$1 OR record_member_id=ANY($3::bigint[]) OR family_billing_account_id=ANY($2::bigint[]))
         AND amount_cents > 0
         AND COALESCE(NULLIF(lower(external_status), ''), 'settled') IN ('settled','succeeded','paid','complete','completed','recorded')
     ) OR EXISTS (
       SELECT 1 FROM account_refund
       WHERE (record_family_id=$1 OR record_member_id=ANY($3::bigint[]) OR family_billing_account_id=ANY($2::bigint[]))
         AND amount_cents > 0 AND COALESCE(external_status, 'succeeded') IN ('succeeded','settled','paid','completed')
     ) OR EXISTS (
       SELECT 1 FROM billing_payment_attempt WHERE family_billing_account_id=ANY($2::bigint[]) AND status='succeeded'
     ) OR EXISTS (
       SELECT 1 FROM store_order WHERE (family_billing_account_id=ANY($2::bigint[]) OR member_id=ANY($3::bigint[])) AND payment_status IN ('paid','external')
     ) OR EXISTS (
       SELECT 1 FROM billing_charge WHERE family_billing_account_id=ANY($2::bigint[]) AND amount_cents > 0 AND collection_status IN ('paid','partially_paid')
     ) OR EXISTS (
       SELECT 1 FROM billing_monthly_invoice WHERE family_billing_account_id=ANY($2::bigint[]) AND total_cents > 0 AND paid_at IS NOT NULL
     ) AS retained`, [familyId, accountIds, memberIds],
  )
  return history.retained
}
