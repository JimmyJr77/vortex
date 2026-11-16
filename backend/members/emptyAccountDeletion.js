import { hasFamilyPayments } from './unpaidHistoryDeletion.js'
import { assertNoRetainedAccountHistory } from './retainedAccountHistory.js'
import { captureDeletionTarget, assertNoUnexpectedDeleteReferences, deleteCapturedTarget, deletionBlocked } from './deletionReferences.js'

/**
 * Remove empty archived identities and their unfinished setup only. No charge,
 * payment, subscription, financial projection or audit event is a delete target.
 * All callers own a transaction; every target is captured before mutation.
 */
export async function deleteEmptyArchivedAccounts(db, { facilityId, familyId = null, memberIds }) {
  const targets = []
  const capture = async (table, predicate, values = []) => {
    const target = await captureDeletionTarget(db, table, predicate, values)
    targets.push(target)
    return target
  }
  const members = await capture('member', 'id=ANY($1::bigint[]) AND facility_id=$2', [memberIds, facilityId])
  if (members.rows.length !== memberIds.length) throw deletionBlocked('The selected member records changed. Refresh the archive and try again.')
  if (members.rows.some(member => member.is_active !== false)) throw deletionBlocked('Archive every member before deleting the account.')
  const { rows: owners } = await db.query('SELECT id FROM facility WHERE owner_user_id=ANY($1::bigint[])', [members.rows.map(member => member.app_user_id).filter(Boolean)])
  if (owners.length) throw deletionBlocked('The facility Owner account cannot be deleted.')

  const family = familyId == null ? null : await capture('family', 'id=$1 AND facility_id=$2 AND archived=TRUE', [familyId, facilityId])
  if (family && family.rows.length !== 1) throw deletionBlocked('Archive this family before deleting the account.')
  const links = await capture('family_member', 'member_id=ANY($1::bigint[])', [memberIds])
  if (familyId != null && (links.rows.some(link => String(link.family_id) !== String(familyId))
    || members.rows.some(member => member.family_id != null && String(member.family_id) !== String(familyId)))) {
    throw deletionBlocked('A person is linked to another family. Resolve their family memberships before deleting this family.')
  }

  // Try the same lock keys as all local/Stripe collectors. A busy account must
  // fail immediately rather than race a pending payment or deadlock a collector.
  const { rows: relatedAccounts } = await db.query(`SELECT id FROM family_billing_account WHERE family_id=$1
    OR payer_member_id=ANY($2::bigint[]) OR family_id IN (
      SELECT family_id FROM member WHERE id=ANY($2::bigint[])
      UNION SELECT family_id FROM family_member WHERE member_id=ANY($2::bigint[])) ORDER BY id`, [familyId, memberIds])
  for (const account of relatedAccounts) {
    const { rows: [lock] } = await db.query('SELECT pg_try_advisory_xact_lock(hashtextextended($1::text,0)) AS locked', [`household-monthly-invoice:${account.id}`])
    if (!lock.locked) throw deletionBlocked('Billing is currently processing this account. Try deleting it after billing finishes.')
  }
  await db.query('SELECT id FROM family_billing_account WHERE id=ANY($1::bigint[]) ORDER BY id FOR UPDATE', [relatedAccounts.map(account => account.id)])
  if (await hasFamilyPayments(db, { familyId: familyId ?? -1, accountIds: relatedAccounts.map(account => account.id), memberIds })) {
    throw deletionBlocked('Payments have been made for this member or family. Keep the account archived to preserve payment history.')
  }
  await assertNoRetainedAccountHistory(db, { familyId: familyId ?? -1, memberIds })
  const accounts = await capture('family_billing_account', 'family_id=$1', [familyId])
  if (accounts.rows.some(account => account.stripe_customer_id || account.household_monthly_billing_enabled)) {
    throw deletionBlocked('This account is connected to payment collection. Keep it archived until its billing setup is resolved.')
  }

  // A registration linked to both this account and another person is retained:
  // the dependency guard below rejects it instead of deleting the other lead.
  const leads = await capture('registrations', `facility_id=$2
    AND (member_id=ANY($1::bigint[]) OR converted_member_id=ANY($1::bigint[]))
    AND (member_id IS NULL OR member_id=ANY($1::bigint[]))
    AND (converted_member_id IS NULL OR converted_member_id=ANY($1::bigint[]))`, [memberIds, facilityId])
  const invites = await capture('account_invite', `facility_id=$3 AND (pending_family_id=$1 OR registration_id=ANY($2::bigint[]))`, [familyId, leads.rows.map(lead => lead.id), facilityId])
  for (const invite of invites.rows) {
    if (invite.inviter_member_id != null && !memberIds.some(id => String(id) === String(invite.inviter_member_id))) throw deletionBlocked('An invitation belongs to another member and must be retained.')
    const result = invite.pending_payload?.result
    const ownedMember = id => memberIds.some(memberId => String(memberId) === String(id))
    if (result && (!Array.isArray(result.memberIds) || result.memberIds.some(id => !ownedMember(id))
      || (result.payerMemberId != null && !ownedMember(result.payerMemberId))
      || (result.loginMemberId != null && !ownedMember(result.loginMemberId))
      || (result.pendingEnrollments != null && !Array.isArray(result.pendingEnrollments))
      || (result.pendingEnrollments || []).some(enrollment => !ownedMember(enrollment?.memberId))
      || (result.enrollmentReceipts != null && !Array.isArray(result.enrollmentReceipts))
      || (result.enrollmentReceipts || []).length || result.completedDropIn || result.familyHadMembersBefore
      || (result.familyId != null && (familyId == null || String(result.familyId) !== String(familyId))))) {
      throw deletionBlocked('An invitation created records for another member and must be retained.')
    }
    if (invite.pending_family_id != null && String(invite.pending_family_id) !== String(familyId)) throw deletionBlocked('An invitation belongs to another family and must be retained.')
  }
  const inviteIds = invites.rows.map(invite => invite.id)
  const signups = await capture('scheduling_signup', `status='pending_setup' AND
    (member_id=ANY($1::bigint[]) OR (member_id IS NULL AND account_invite_id=ANY($2::bigint[])))`, [memberIds, inviteIds])
  if (signups.rows.some(signup => signup.account_invite_id != null
    && !inviteIds.some(id => String(id) === String(signup.account_invite_id)))) {
    throw deletionBlocked('This enrollment belongs to an invitation outside this account. Keep it archived until the invitation is resolved.')
  }
  const projections = await capture('account_enrollment', `record_source='vortex' AND record_source_id=ANY($1::text[])
    AND status='pending_setup' AND NOT historical_only`, [signups.rows.map(signup => String(signup.id))])
  for (const projection of projections.rows) {
    const signup = signups.rows.find(row => String(row.id) === String(projection.record_source_id))
    const sameId = (a, b) => a == null ? b == null : b != null && String(a) === String(b)
    if (!signup || !sameId(projection.id, signup.id) || !sameId(projection.member_id, signup.member_id)
      || !sameId(projection.record_member_id, signup.member_id)
      || !sameId(projection.record_facility_id, signup.member_id == null ? null : facilityId)) throw deletionBlocked()
    if (projection.record_family_id != null && familyId != null && String(projection.record_family_id) !== String(familyId)) throw deletionBlocked()
  }
  // Source IDs can point at an enrollment even when its billing member FK is
  // missing or wrong. Never erase a pending setup that is already being billed.
  for (const table of ['billing_charge', 'billing_subscription', 'account_charge']) {
    const { rowCount } = await db.query(`SELECT 1 FROM ${table} WHERE source_type='scheduling_signup'
      AND split_part(source_id,':',1)=ANY($1::text[]) LIMIT 1`, [signups.rows.map(signup => String(signup.id))])
    if (rowCount) throw deletionBlocked('This enrollment has billing records. Keep the account archived to preserve them.')
  }
  const leadIds = leads.rows.map(lead => lead.id)
  const leadAudit = await capture('new_admin_lead_ownership_audit', 'registration_id=ANY($1::bigint[])', [leadIds])
  const notes = await capture('note', `(subject_type='member' AND subject_id=ANY($1::bigint[]))
    OR (subject_type='family' AND subject_id=$2) OR (subject_type='registration' AND subject_id=ANY($3::bigint[]))`, [memberIds, familyId, leadIds])
  const waivers = await capture('member_waiver_acceptance', 'member_id=ANY($1::bigint[])', [memberIds])
  const guardians = await capture('parent_guardian_authority', 'parent_member_id=ANY($1::bigint[]) AND child_member_id=ANY($1::bigint[])', [memberIds])
  const contacts = await capture('emergency_contact', 'member_id=ANY($1::bigint[])', [memberIds])
  const schools = await capture('member_school', 'member_id=ANY($1::bigint[])', [memberIds])
  const entitlements = await capture('member_drop_in_entitlement', `member_id=ANY($1::bigint[])
    AND annual_credits_granted=0 AND admin_credits_granted=0 AND lifetime_trial_granted IN(0,1)
    AND annual_cycle_started_at IS NULL AND annual_cycle_expires_at IS NULL`, [memberIds])
  const progress = await capture('billing_recurring_account_progress', 'family_billing_account_id=ANY($1::bigint[])', [accounts.rows.map(account => account.id)])
  if (progress.rows.some(row => !emptyBillingProgress(row))) throw deletionBlocked('This account has billing work or billing review history that must be retained.')

  // A login also used by staff or another member is not part of this deletion.
  const loginIds = members.rows.map(member => member.app_user_id).filter(id => id != null)
  const logins = await capture('app_user', `id=ANY($1::bigint[]) AND facility_id=$2 AND role::text='MEMBER_ATHLETE'
    AND NOT EXISTS(SELECT 1 FROM app_user_role r WHERE r.user_id=app_user.id AND r.role::text<>'MEMBER_ATHLETE')
    AND NOT EXISTS(SELECT 1 FROM member m WHERE m.app_user_id=app_user.id AND m.id<>ALL($3::bigint[]))
    AND NOT EXISTS(SELECT 1 FROM facility f WHERE f.owner_user_id=app_user.id)`, [loginIds, facilityId, memberIds])
  const deletedLoginIds = logins.rows.map(login => login.id)
  const loginDependencies = []
  for (const table of ['app_user_role','app_user_permission_override','email_verification_token']) {
    loginDependencies.push(await capture(table, 'user_id=ANY($1::bigint[])', [deletedLoginIds]))
  }

  // Unknown dependencies, financial records (even unpaid/pending), imported
  // history and another person's evidence all reject the entire transaction.
  await assertNoUnexpectedDeleteReferences(db, targets)
  for (const target of [notes,signups,projections,invites,leadAudit,leads,waivers,guardians,contacts,schools,entitlements,progress,accounts,links,members,...loginDependencies,logins,...(family ? [family] : [])]) {
    await deleteCapturedTarget(db, target)
  }
}

function emptyBillingProgress(row) {
  if (!['pending','completed','skipped'].includes(row.status)) return false
  const data = row.result || {}, result = data.result || {}
  const counters = ['chargesPosted','periodsAdvanced','pauseCreditsPosted','subscriptionsProcessed','householdInvoicesCreated','annualRenewalChargesPosted','annualRenewalPeriodsAdvanced']
  const resultCounters = ['expectedNetCents','actualChargeCount','expectedGrossCents','expectedChargeCount','expectedDiscountCents']
  const resultArrays = ['issues','chargeIds','postedChargeIds','expectedLines','excludedSubscriptions']
  const allowed = ['accountId','reason','status','skipped','result','invoiceOutcome',...counters]
  const resultAllowed = ['accountId','verified','billingMonth',...resultCounters,...resultArrays]
  return !Object.keys(data).some(key => !allowed.includes(key)) && !data.invoiceOutcome
    && !counters.some(key => data[key] != null && Number(data[key]) !== 0)
    && !Object.keys(result).some(key => !resultAllowed.includes(key))
    && !resultCounters.some(key => result[key] != null && Number(result[key]) !== 0)
    && !resultArrays.some(key => result[key] != null && (!Array.isArray(result[key]) || result[key].length > 0))
}
