import test from 'node:test'
import assert from 'node:assert/strict'
import {
  accountScope,
  assertMigrationTargetMonthPolicy,
  billingMigrationReleaseVersion,
  computeBillingDeployManifestChecksum,
  migrationHasFailure,
  requireTargetMonth,
} from '../../scripts/lib/canonical-billing-migration-cli.mjs'

function withArgv(args, callback) {
  const previous = process.argv
  process.argv = ['node', 'script', ...args]
  try {
    return callback()
  } finally {
    process.argv = previous
  }
}

test('CLI accepts account-ids alias and normalizes documented target month', () => {
  withArgv(['--account-ids=9,4,9'], () => {
    assert.deepEqual(accountScope('audit', false), { all: false, accountIds: [4, 9], familyIds: [] })
    assert.deepEqual(accountScope('adopt', true), { all: false, accountIds: [4, 9], familyIds: [] })
    assert.deepEqual(accountScope('repair-waived-memberships', true), {
      all: false,
      accountIds: [4, 9],
      familyIds: [],
    })
  })
  assert.equal(requireTargetMonth('2026-09'), '2026-09-01')
  assert.equal(requireTargetMonth('2026-09-01'), '2026-09-01')
})

test('CLI permits all only for dry audit/verify and never with apply', () => {
  withArgv(['--all'], () => {
    assert.deepEqual(accountScope('audit', false), { all: true, accountIds: [], familyIds: [] })
    assert.deepEqual(accountScope('verify', false), { all: true, accountIds: [], familyIds: [] })
    assert.throws(() => accountScope('repair', false), /only for a read-only audit or verify/)
    assert.throws(() => accountScope('repair-waived-memberships', false), /only for a read-only audit or verify/)
    assert.throws(() => accountScope('adopt', false), /only for a read-only audit or verify/)
    assert.throws(() => accountScope('audit', true), /--all --apply is forbidden/)
  })
})

test('waived-membership apply derives target month only from its immutable run', () => {
  assert.doesNotThrow(() => assertMigrationTargetMonthPolicy('repair-waived-memberships', {
    apply: false,
    explicitTargetMonth: '2026-09',
  }))
  assert.doesNotThrow(() => assertMigrationTargetMonthPolicy('repair-waived-memberships', {
    apply: true,
    explicitTargetMonth: null,
  }))
  assert.throws(
    () => assertMigrationTargetMonthPolicy('repair-waived-memberships', {
      apply: true,
      explicitTargetMonth: '2026-09',
    }),
    /derived from the immutable migration run/,
  )
})

test('CLI reserves explicit family scope for local account-provisioning repair', () => {
  withArgv(['--family-ids=12,7,12'], () => {
    assert.deepEqual(accountScope('repair', false), { all: false, accountIds: [], familyIds: [7, 12] })
    assert.deepEqual(accountScope('repair', true), { all: false, accountIds: [], familyIds: [7, 12] })
    assert.throws(() => accountScope('audit', false), /supported only by the local billing-account provisioning repair/)
    assert.throws(
      () => accountScope('repair-waived-memberships', true),
      /supported only by the local billing-account provisioning repair/,
    )
  })
  withArgv(['--account-ids=4', '--family-id=7'], () => {
    assert.throws(() => accountScope('repair', true), /cannot be mixed/)
  })
  withArgv(['--family-ids=7,nope'], () => {
    assert.throws(() => accountScope('repair', true), /positive integer IDs/)
  })
  withArgv(['--all', '--family-id=7'], () => {
    assert.throws(() => accountScope('audit', false), /cannot be combined/)
  })
  withArgv(['--family-id=7', '--run=9'], () => {
    assert.throws(() => accountScope('repair', true), /creates and returns its own immutable run/)
  })
})

test('CLI derives deterministic deploy provenance and requires a release identity', async () => {
  const directory = new URL('../../migrations/', import.meta.url).pathname
  const first = await computeBillingDeployManifestChecksum({
    directory,
    filenames: ['785_billing_migration_durable_safety.sql'],
  })
  const second = await computeBillingDeployManifestChecksum({
    directory,
    filenames: ['785_billing_migration_durable_safety.sql'],
  })
  assert.match(first, /^[0-9a-f]{64}$/)
  assert.equal(first, second)
  assert.equal(billingMigrationReleaseVersion({ BILLING_MIGRATION_RELEASE_VERSION: 'release-7' }), 'release-7')
  assert.throws(() => billingMigrationReleaseVersion({}, null), /require BILLING_MIGRATION_RELEASE_VERSION/)
})

test('CLI treats a stopped cohort as a failed apply report', () => {
  assert.equal(migrationHasFailure({
    cohortStopped: true,
    accounts: [{ accountId: 4, state: 'armed' }],
  }), true)
  assert.equal(migrationHasFailure({
    cohortStopped: false,
    accounts: [{ accountId: 4, state: 'household_active' }],
  }), false)
})
