import fs from 'node:fs/promises'
import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertWaivedMembershipRepairState,
  repairWaivedAnnualMembershipsCanonicalMigration,
  waivedMembershipRepairAuditGate,
  waivedMembershipRepairNeedsCohortStop,
} from '../canonicalBillingMigration.js'

function matchedAudit(exceptions = []) {
  return {
    eligible: exceptions.length === 0,
    parityStatus: 'matched',
    paritySnapshot: {
      matched: true,
      dimensions: {
        membershipsAndPaidThroughOwnership: { matched: true },
      },
    },
    exceptions,
  }
}

function blocking(code) {
  return { code, type: code, severity: 'blocking', dedupeKey: code }
}

test('waived-membership repair accepts only discovered, blocked, or repairing migration states', () => {
  for (const state of ['discovered', 'blocked', 'repairing']) {
    assert.equal(assertWaivedMembershipRepairState(461, state), state)
  }
  for (const state of ['shadow_verified', 'armed', 'household_active', 'verified', 'rolled_back']) {
    assert.throws(
      () => assertWaivedMembershipRepairState(461, state),
      (error) => error.code === 'waived_membership_repair_state_invalid',
    )
  }
})

test('waived-membership repair defaults to dry-run and gates apply before database access', async () => {
  const db = {
    query() {
      throw new Error('database must not be reached')
    },
  }
  await assert.rejects(
    repairWaivedAnnualMembershipsCanonicalMigration(db, {
      apply: true,
      accountIds: [461],
      environment: { BILLING_ENROLLMENT_AUTO_REPAIR_ENABLED: 'true' },
    }),
    /requires an existing migration run ID/,
  )
  await assert.rejects(
    repairWaivedAnnualMembershipsCanonicalMigration(db, {
      apply: true,
      runId: 7,
      accountIds: [461],
      environment: { BILLING_ENROLLMENT_AUTO_REPAIR_ENABLED: 'false' },
    }),
    (error) => error.code === 'feature_disabled',
  )
  await assert.rejects(
    repairWaivedAnnualMembershipsCanonicalMigration(db, {
      accountIds: [461],
      targetMonth: '2026-09-02',
    }),
    /requires a target month on the first day/,
  )
})

test('known unrelated rollout blockers do not stop later explicit waived repairs', () => {
  const audits = new Map([
    [10906, matchedAudit([blocking('target_household_invoice_already_paid')])],
    [10909, matchedAudit([blocking('manual_collection_requires_review')])],
    [10913, matchedAudit()],
  ])
  const repaired = []
  for (const accountId of [10906, 10909, 10913]) {
    const audit = audits.get(accountId)
    if (waivedMembershipRepairNeedsCohortStop({ fullyWaived: { blocked: [] }, audit })) break
    repaired.push(accountId)
  }
  assert.deepEqual(repaired, [10906, 10909, 10913])
  assert.deepEqual(
    waivedMembershipRepairAuditGate(audits.get(10906)).reviewedUnrelatedBlockers.map((issue) => issue.code),
    ['target_household_invoice_already_paid'],
  )
})

test('waived-membership repair stops on membership, structural parity, or unexplained blockers', () => {
  const membershipMismatch = matchedAudit()
  membershipMismatch.parityStatus = 'mismatched'
  membershipMismatch.paritySnapshot.matched = false
  membershipMismatch.paritySnapshot.dimensions.membershipsAndPaidThroughOwnership.matched = false
  assert.equal(waivedMembershipRepairNeedsCohortStop({
    fullyWaived: { blocked: [] },
    audit: membershipMismatch,
  }), true)
  assert.deepEqual(waivedMembershipRepairAuditGate(membershipMismatch).failures, [
    'membership_ownership_parity_not_matched',
    'canonical_structural_parity_not_matched',
  ])

  const unknown = matchedAudit([blocking('stripe_customer_subscription_inventory_failed')])
  assert.equal(waivedMembershipRepairNeedsCohortStop({
    fullyWaived: { blocked: [] },
    audit: unknown,
  }), true)
  assert.deepEqual(
    waivedMembershipRepairAuditGate(unknown).unexplainedBlockers.map((issue) => issue.code),
    ['stripe_customer_subscription_inventory_failed'],
  )
  assert.equal(waivedMembershipRepairNeedsCohortStop({
    fullyWaived: { blocked: [{ code: 'ambiguous' }] },
    audit: matchedAudit(),
  }), true)
})

test('waived-membership command is statically isolated from broad repair primitives', async () => {
  const source = await fs.readFile(new URL('../canonicalBillingMigration.js', import.meta.url), 'utf8')
  const start = source.indexOf('export async function repairWaivedAnnualMembershipsCanonicalMigration')
  const end = source.indexOf('export async function repairProvableFamilyMemberLinks', start)
  assert.ok(start >= 0 && end > start)
  const commandSource = source.slice(start, end)
  assert.match(commandSource, /requireExactAccountScope: true/)
  assert.match(commandSource, /repairFullyWaivedAnnualMembershipEntitlements/)
  assert.match(commandSource, /auditCanonicalBillingAccount/)
  assert.match(commandSource, /persistAudit/)
  assert.match(commandSource, /acceptBillingAccountMigrationBaseline/)
  assert.match(commandSource, /claimBillingAccountMigration/)
  assert.match(commandSource, /releaseBillingAccountMigrationLease/)
  for (const forbidden of [
    'repairProvableFamilyMemberLinks(',
    'repairCanonicalLocalEnrollmentSubscriptions(',
    'repairProvableLegacyEnrollmentAdjustments(',
    'repairEnrollmentBillingCoverage(',
    'repairMembershipOwnershipAndAllocations(',
    'repairBundleEntitlementBalances(',
    'reconcileEnrollmentLedger(',
    'normalizeHistoricalPaymentAllocations(',
    'allocateHouseholdPayments(',
  ]) {
    assert.equal(commandSource.includes(forbidden), false, `${forbidden} must stay outside the narrow command`)
  }
})

test('waived-membership package command routes through exact run provenance checks', async () => {
  const cli = await fs.readFile(
    new URL('../../scripts/lib/canonical-billing-migration-cli.mjs', import.meta.url),
    'utf8',
  )
  const wrapper = await fs.readFile(
    new URL('../../scripts/repair-waived-memberships-canonical-billing.mjs', import.meta.url),
    'utf8',
  )
  const pkg = JSON.parse(await fs.readFile(new URL('../../package.json', import.meta.url), 'utf8'))
  assert.match(cli, /requireExactAccountScope: command === 'repair-waived-memberships'/)
  assert.match(cli, /codeVersion: provenance\.codeVersion/)
  assert.match(cli, /manifestChecksum: provenance\.manifestChecksum/)
  assert.match(wrapper, /runAndReportCanonicalBillingMigration\('repair-waived-memberships'\)/)
  assert.equal(
    pkg.scripts['billing:migration:repair-waived-memberships'],
    'node scripts/repair-waived-memberships-canonical-billing.mjs',
  )
})
