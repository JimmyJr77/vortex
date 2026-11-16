import { assertNoUnexpectedDeleteReferences, captureDeletionTarget } from './deletionReferences.js'

function protectedDuplicate(message) {
  return Object.assign(new Error(message), {
    statusCode: 409,
    code: 'MERGED_MEMBER_DELETE_BLOCKED',
    blockers: [{ type: 'merged_member_history', message }],
  })
}

function requireSafe(condition, message) {
  if (!condition) throw protectedDuplicate(message)
}

const unavailable = 'This archived duplicate cannot be removed until its reviewed merge and retained history are verified.'

/**
 * Delete only an already-reviewed historical duplicate. This never matches
 * names/emails, moves history, or calls the ordinary unpaid-history cleanup.
 * The caller owns the transaction, including rollback after any failure.
 */
export async function tryDeleteMergedMember(db, { memberId, facilityId }) {
  const { rows: [source] } = await db.query(
    'SELECT * FROM member WHERE id=$1 AND facility_id=$2 FOR UPDATE', [memberId, facilityId],
  )
  if (!source || source.signup_source !== 'jackrabbit_history_merged') return false
  requireSafe(source.is_active === false && source.app_user_id == null && source.family_id == null,
    'This merged duplicate is still active or linked to a login or household. Keep it archived until those links are reviewed.')

  const { rows: [migration] } = await db.query(
    "SELECT to_regprocedure('can_detach_merged_member_activity(bigint,bigint)') IS NOT NULL AS ready",
  )
  requireSafe(migration?.ready === true, 'The safe merged-member deletion migration must be applied before removing this duplicate.')
  const { rows: merges } = await db.query(
    `SELECT activity.* FROM billing_account_activity activity
     JOIN family_billing_account account ON account.id=activity.family_billing_account_id
     JOIN family household ON household.id=account.family_id
     WHERE activity.event_type='historical_identity_merged'
       AND activity.details->>'retiredDuplicateId'=$1::text AND household.facility_id=$2
     FOR UPDATE OF activity`, [memberId, facilityId],
  )
  requireSafe(merges.length === 1, unavailable)
  const merge = merges[0]
  const targetId = merge.member_id
  requireSafe(targetId != null && String(targetId) !== String(memberId)
    && String(merge.before_value?.importCreatedMemberId) === String(memberId)
    && String(merge.after_value?.memberId) === String(targetId)
    && merge.after_value?.sourceSystem === 'Jackrabbit' && merge.actor_type === 'system'
    && merge.details?.historicalOnly === true && merge.details?.canonicalProfilePreserved === true,
  unavailable)

  const { rows: [target] } = await db.query(
    'SELECT id,facility_id,family_id,is_active FROM member WHERE id=$1 AND facility_id=$2 FOR UPDATE', [targetId, facilityId],
  )
  const { rows: [account] } = await db.query(
    `SELECT account.id,account.family_id FROM family_billing_account account
     JOIN family household ON household.id=account.family_id AND household.facility_id=$2
     WHERE account.id=$1 FOR UPDATE OF account`, [merge.family_billing_account_id, facilityId],
  )
  requireSafe(target?.is_active === true && account != null && String(target.family_id) === String(account.family_id), unavailable)
  const { rows: people } = await db.query(
    `SELECT person.* FROM account_record_source person
     JOIN jackrabbit_history_record original ON original.id=person.imported_record_id
       AND original.facility_id=person.facility_id AND original.family_id=person.family_id
       AND original.member_id=person.member_id AND original.organization_id=person.organization_id
       AND original.record_kind='person' AND original.source_id=person.source_id
     WHERE person.facility_id=$1 AND person.family_id=$2 AND person.member_id=$3
       AND person.source='jackrabbit' AND person.record_kind='person' AND NOT person.deleted
       AND person.source_id=$4
       AND $5=concat(person.source,':',person.organization_id,':identity-merge:',$6::text)
     FOR UPDATE OF person,original`,
    [facilityId, account.family_id, targetId, merge.after_value.sourceProfileId, merge.event_key, memberId],
  )
  requireSafe(people.length === 1, unavailable)

  const { rows: activity } = await db.query(
    'SELECT id FROM billing_account_activity WHERE member_id=$1 ORDER BY id FOR UPDATE', [memberId],
  )
  requireSafe(activity.length > 0, unavailable)
  // Lock the source mappings used by the exact retained events so concurrent
  // import updates cannot replace their surviving-member attribution.
  await db.query(
    `SELECT history.source_id FROM account_record_source history
     JOIN billing_account_activity activity ON activity.event_key=
       concat(history.source,':',history.organization_id,':',history.record_kind,':',history.source_id)
     WHERE activity.member_id=$1 AND history.facility_id=$2 FOR UPDATE OF history`, [memberId, facilityId],
  )
  const { rowCount: invalidActivity } = await db.query(
    `SELECT id FROM billing_account_activity WHERE member_id=$1
       AND NOT can_detach_merged_member_activity(id,$1::bigint) LIMIT 1`, [memberId],
  )
  requireSafe(invalidActivity === 0, unavailable)

  for (const [table, predicate] of [
    ['jackrabbit_history_record', 'member_id=$1'], ['account_record_source', 'member_id=$1'],
    ['account_enrollment', 'member_id=$1 OR record_member_id=$1'],
    ['account_charge', 'member_id=$1 OR record_member_id=$1'],
    ['account_payment', 'record_member_id=$1'], ['account_refund', 'record_member_id=$1'],
  ]) {
    requireSafe((await db.query(`SELECT 1 FROM ${table} WHERE ${predicate} LIMIT 1`, [memberId])).rowCount === 0,
      'This archived duplicate still owns history or accounting records. Preserve it until those records are reviewed.')
  }
  const { rows: links } = await db.query('SELECT * FROM family_member WHERE member_id=$1 FOR UPDATE', [memberId])
  requireSafe(links.every(link => link.is_active === false && String(link.family_id) === String(account.family_id)), unavailable)
  const { rows: entitlements } = await db.query('SELECT * FROM member_drop_in_entitlement WHERE member_id=$1 FOR UPDATE', [memberId])
  requireSafe(entitlements.every(entitlement => entitlement.lifetime_trial_granted === 0
    && entitlement.annual_credits_granted === 0 && entitlement.admin_credits_granted === 0
    && entitlement.annual_cycle_started_at == null && entitlement.annual_cycle_expires_at == null),
  'This archived duplicate still has usable credits. Keep it archived until those credits are reviewed.')

  const targets = await Promise.all([
    captureDeletionTarget(db, 'member', 'id=$1 AND facility_id=$2', [memberId, facilityId]),
    captureDeletionTarget(db, 'family_member', 'member_id=$1', [memberId]),
    captureDeletionTarget(db, 'member_drop_in_entitlement', 'member_id=$1', [memberId]),
  ])
  await assertNoUnexpectedDeleteReferences(db, targets, {
    allowedNullReferences: [{ table: 'billing_account_activity', column: 'member_id', keys: activity.map(row => ({ id: row.id })) }],
  })
  const result = await db.query('DELETE FROM member WHERE id=$1 AND facility_id=$2', [memberId, facilityId])
  requireSafe(result.rowCount === 1, unavailable)
  return true
}
