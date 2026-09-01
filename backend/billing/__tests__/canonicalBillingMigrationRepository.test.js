import test from 'node:test'
import assert from 'node:assert/strict'
import {
  acceptBillingAccountMigrationBaseline,
  adoptBillingAccountMigrationHouseholdActive,
  claimBillingAccountMigration,
  createBillingMigrationRun,
  hasOpenBlockingMigrationExceptions,
  recordBillingMigrationException,
  resolveClearedBillingMigrationExceptions,
  transitionBillingAccountMigration,
  updateBillingAccountMigrationEvidence,
  upsertBillingAccountMigration,
  upsertBillingAccountMigrationItem,
  withBillingAccountMigrationLock,
} from '../canonicalBillingMigrationRepository.js'
import { billingMigrationSnapshotHash } from '../canonicalBillingMigrationState.js'

const checksum = 'a'.repeat(64)

test('recurring blocking exceptions reopen waived rows while warning waivers remain durable', async () => {
  let captured
  const db = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return { rows: [{ id: 7, status: 'open' }] }
    },
  }
  await recordBillingMigrationException(db, {
    runId: 1,
    accountMigrationId: 2,
    dedupeKey: 'account:2:audit:parity_mismatch',
    exceptionType: 'parity_mismatch',
    severity: 'blocking',
    message: 'Parity still differs.',
  })
  assert.match(captured.sql, /billing_migration_exception\.severity NOT IN \('blocking', 'critical'\)/)
  assert.match(captured.sql, /EXCLUDED\.severity NOT IN \('blocking', 'critical'\)/)
  assert.match(captured.sql, /ELSE 'open'/)
  assert.equal(captured.params[4], 'blocking')
})

test('blocking waivers stay blocking until a subsequent audit proves the issue cleared', async () => {
  const queries = []
  const db = {
    async query(sql) {
      queries.push(String(sql))
      return queries.length === 1 ? { rows: [] } : { rows: [{ blocked: true }] }
    },
  }
  await resolveClearedBillingMigrationExceptions(db, {
    runId: 1,
    accountMigrationId: 2,
    activeDedupeKeys: [],
    dedupePrefix: 'account:2:audit:',
  })
  assert.match(queries[0], /status = 'waived' AND severity IN \('blocking', 'critical'\)/)
  assert.match(queries[0], /NOT \(dedupe_key = ANY\(\$3::text\[\]\)\)/)

  assert.equal(await hasOpenBlockingMigrationExceptions(db, 2), true)
  assert.match(queries[1], /status IN \('open', 'acknowledged', 'waived'\)/)
})

test('account state transition is guarded by state version and live lease', async () => {
  let captured
  const db = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return { rows: [{ id: 4, state: 'armed', lock_version: 8 }] }
    },
  }
  await transitionBillingAccountMigration(db, {
    id: 4,
    state: 'shadow_verified',
    lock_version: 7,
  }, 'armed', { leaseOwner: 'worker-1' })
  assert.match(captured.sql, /lock_version = \$2/)
  assert.match(captured.sql, /state = \$3/)
  assert.match(captured.sql, /lease_owner = \$7/)
  assert.match(captured.sql, /lease_expires_at > now\(\)/)
  assert.deepEqual(captured.params, [4, 7, 'shadow_verified', 'armed', null, null, 'worker-1'])
})

test('forward adoption uses a dedicated immutable-evidence CAS without widening generic transitions', async () => {
  let captured
  const db = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return {
        rows: [{
          id: 4,
          billing_migration_run_id: 7,
          state: 'household_active',
          lock_version: 9,
        }],
      }
    },
  }
  const result = await adoptBillingAccountMigrationHouseholdActive(db, {
    id: 4,
    billing_migration_run_id: 7,
    state: 'shadow_verified',
    lock_version: 8,
  }, {
    leaseOwner: 'adopt-worker',
    evidence: {
      payerAccessVerified: true,
      canonicalParityMatched: true,
      canonicalBalanceVerified: true,
      zeroActiveLocalRecurringCollectors: true,
      zeroActiveRemoteRecurringCollectors: true,
      householdActivationEvidenceVerified: true,
      stripeCustomerId: null,
      localCollectors: [],
      remoteSubscriptionInventory: null,
      remoteScheduleInventory: { liveScheduleCount: 0, schedules: [] },
      verificationHash: 'b'.repeat(64),
      activationEvidence: { evidenceHash: 'c'.repeat(64) },
      paymentMethod: { status: 'payment_method_required' },
    },
  })
  assert.equal(result.state, 'household_active')
  assert.match(captured.sql, /state = 'household_active'/)
  assert.match(captured.sql, /migration\.state = 'shadow_verified'/)
  assert.match(captured.sql, /accepted_snapshot_hash ~ '\^\[0-9a-f\]\{64\}\$'/)
  assert.match(captured.sql, /accepted_baseline_version > 0/)
  assert.match(captured.sql, /payer_access\.is_active = TRUE/)
  assert.match(captured.sql, /household_monthly_billing_enabled = TRUE/)
  assert.match(captured.sql, /billing_subscription subscription/)
  assert.match(captured.sql, /billing_migration_exception exception/)
  const durableEvidence = JSON.parse(captured.params[4])
  assert.match(durableEvidence.evidenceHash, /^[0-9a-f]{64}$/)
  assert.equal(durableEvidence.zeroActiveRemoteRecurringCollectors, true)

  await assert.rejects(
    adoptBillingAccountMigrationHouseholdActive(db, {
      id: 4,
      billing_migration_run_id: 7,
      state: 'shadow_verified',
      lock_version: 8,
    }, {
      leaseOwner: 'adopt-worker',
      evidence: {
        payerAccessVerified: true,
        canonicalParityMatched: true,
        canonicalBalanceVerified: true,
        zeroActiveLocalRecurringCollectors: true,
        zeroActiveRemoteRecurringCollectors: false,
        householdActivationEvidenceVerified: true,
        localCollectors: [],
        remoteScheduleInventory: { liveScheduleCount: 0, schedules: [] },
        verificationHash: 'b'.repeat(64),
        activationEvidence: { evidenceHash: 'c'.repeat(64) },
      },
    }),
    /zeroActiveRemoteRecurringCollectors/,
  )
})

test('accepted repair baseline is CAS-, lease-, parity-, and exception-gated', async () => {
  const accountSnapshot = { id: 10 }
  const pricingSnapshot = { targetMonth: '2026-09-01' }
  const ledgerSnapshot = { balanceCents: 7000 }
  const stripeSnapshot = { customerId: 'cus_1' }
  const rollbackSnapshot = { subscriptions: [] }
  const snapshotHash = billingMigrationSnapshotHash({
    accountSnapshot,
    pricingSnapshot,
    ledgerSnapshot,
    initialStripeSnapshot: stripeSnapshot,
    rollbackSnapshot,
  })
  let captured
  const db = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return { rows: [{
        id: 4,
        state: 'shadow_verified',
        lock_version: 9,
        accepted_baseline_version: 2,
        accepted_snapshot_hash: snapshotHash,
        baseline_changed: true,
      }] }
    },
  }
  const result = await acceptBillingAccountMigrationBaseline(db, {
    id: 4,
    state: 'shadow_verified',
    lock_version: 8,
    accepted_snapshot_hash: 'a'.repeat(64),
  }, {
    snapshotHash,
    accountSnapshot,
    pricingSnapshot,
    ledgerSnapshot,
    stripeSnapshot,
    rollbackSnapshot,
    leaseOwner: 'repair-worker',
  })
  assert.equal(result.baseline_changed, true)
  assert.match(captured.sql, /accepted_baseline_version = migration\.accepted_baseline_version \+ 1/)
  assert.match(captured.sql, /migration\.parity_status = 'matched'/)
  assert.match(captured.sql, /migration\.lease_owner = \$9/)
  assert.match(captured.sql, /migration\.lease_expires_at > now\(\)/)
  assert.match(captured.sql, /NOT EXISTS \([\s\S]*billing_migration_exception/)
  assert.deepEqual(captured.params.slice(0, 3), [4, 8, snapshotHash])
})

test('accepted repair baseline rejects evidence that does not match its hash before SQL', async () => {
  let queried = false
  await assert.rejects(acceptBillingAccountMigrationBaseline({
    async query() { queried = true; return { rows: [] } },
  }, {
    id: 4,
    lock_version: 8,
    accepted_snapshot_hash: 'a'.repeat(64),
  }, {
    snapshotHash: 'b'.repeat(64),
    accountSnapshot: { id: 10 },
    pricingSnapshot: {},
    ledgerSnapshot: {},
    stripeSnapshot: {},
    rollbackSnapshot: {},
    leaseOwner: 'repair-worker',
  }), /do not match/)
  assert.equal(queried, false)
})

test('evidence CAS uses the corrected lease placeholder', async () => {
  let captured
  const db = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return { rows: [{ id: 4, state: 'repairing', lock_version: 9 }] }
    },
  }
  await updateBillingAccountMigrationEvidence(db, {
    id: 4,
    state: 'repairing',
    lock_version: 8,
    payer_validation_status: 'pending',
    parity_status: 'pending',
  }, { leaseOwner: 'worker-1' })
  assert.match(captured.sql, /lease_owner = \$9/)
  assert.equal(captured.params.length, 9)
})

test('run idempotency refuses reuse across a different facility contract', async () => {
  let calls = 0
  const db = {
    async query(sql) {
      calls += 1
      if (calls === 1) return { rows: [] }
      assert.match(String(sql), /idempotency_key/)
      return { rows: [{
        id: 1,
        migration_key: 'canonical-household-billing-v1',
        mode: 'apply',
        status: 'running',
        code_version: 'release-1',
        manifest_checksum: checksum,
        facility_id: 9,
        target_month: '2026-09-01',
        facility_timezone: 'America/New_York',
        cohort: 'pilot',
        configuration: { accountIds: [4], targetMonth: '2026-09-01', cohort: 'pilot' },
      }] }
    },
  }
  await assert.rejects(
    createBillingMigrationRun(db, {
      idempotencyKey: 'same-key',
      codeVersion: 'release-1',
      manifestChecksum: checksum,
      facilityId: 10,
      targetMonth: '2026-09-01',
      facilityTimezone: 'America/New_York',
      cohort: 'pilot',
      configuration: { accountIds: [4], targetMonth: '2026-09-01', cohort: 'pilot' },
    }),
    /differs in: facility/,
  )
})

test('apply run creation rejects missing release provenance before touching the database', async () => {
  let queried = false
  const db = { async query() { queried = true; return { rows: [] } } }
  await assert.rejects(createBillingMigrationRun(db, {
    idempotencyKey: 'run-1',
    facilityId: 9,
    targetMonth: '2026-09-01',
    facilityTimezone: 'America/New_York',
    cohort: 'pilot',
    configuration: { accountIds: [4] },
  }), /non-empty release version/)
  assert.equal(queried, false)
})

test('run idempotency compares the complete frozen account scope and release contract', async () => {
  let calls = 0
  const db = {
    async query() {
      calls += 1
      if (calls === 1) return { rows: [] }
      return { rows: [{
        id: 1,
        migration_key: 'canonical-household-billing-v1',
        mode: 'apply',
        status: 'running',
        code_version: 'release-1',
        manifest_checksum: checksum,
        facility_id: 9,
        target_month: '2026-09-01',
        facility_timezone: 'America/New_York',
        cohort: 'pilot',
        configuration: { accountIds: [4, 5], targetMonth: '2026-09-01', cohort: 'pilot' },
      }] }
    },
  }
  await assert.rejects(createBillingMigrationRun(db, {
    idempotencyKey: 'run-1',
    codeVersion: 'release-2',
    manifestChecksum: checksum,
    facilityId: 9,
    targetMonth: '2026-09-01',
    facilityTimezone: 'America/New_York',
    cohort: 'pilot',
    configuration: { accountIds: [4], targetMonth: '2026-09-01', cohort: 'pilot' },
  }), /release version|account scope/)
})

test('migration items persist explicit former Stripe and local schedule selectors', async () => {
  let captured
  const db = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return { rows: [{ id: 3 }] }
    },
  }
  await upsertBillingAccountMigrationItem(db, {
    accountMigrationId: 2,
    itemType: 'stripe_subscription',
    sourceId: 'sub_1',
    billingSubscriptionId: 22,
    signupId: 33,
    memberId: 44,
    formerStripeSubscriptionId: 'sub_1',
    formerStripeItemId: 'si_1',
    localStatus: 'active',
    localNetMonthlyCents: 12_000,
    remoteStatus: 'active',
    remoteAmountCents: 12_000,
  })
  assert.match(captured.sql, /former_stripe_subscription_id/)
  assert.match(captured.sql, /local_net_monthly_cents/)
  assert.equal(captured.params[8], 22)
  assert.equal(captured.params[11], 'sub_1')
  assert.equal(captured.params[18], 12_000)
  assert.match(captured.sql, /migration\.state IN \('discovered', 'repairing', 'blocked', 'shadow_verified'\)/)
  assert.match(captured.sql, /target_snapshot = CASE/)
  assert.match(captured.sql, /former_stripe_subscription_id = COALESCE\(billing_account_migration_item\.former_stripe_subscription_id, EXCLUDED\.former_stripe_subscription_id\)/)
})

test('account evidence upsert is run-scoped, state-gated, and advances lock version', async () => {
  let captured
  const db = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return { rows: [{ id: 2, state: 'discovered', lock_version: 1 }] }
    },
  }
  await upsertBillingAccountMigration(db, {
    runId: 1,
    accountId: 4,
    cutoverMonth: '2026-09-01',
  })
  assert.match(captured.sql, /run\.status = 'running'/)
  assert.match(captured.sql, /run\.manifest_checksum ~ '\^\[0-9a-f\]\{64\}\$'/)
  assert.match(captured.sql, /billing_account_migration\.lock_version \+ 1/)
  assert.match(captured.sql, /billing_account_migration\.state IN \('discovered', 'repairing', 'blocked', 'shadow_verified'\)/)
})

test('lease claim rejects terminal or out-of-scope runs in SQL', async () => {
  let captured
  const db = {
    async query(sql) {
      captured = String(sql)
      return { rows: [] }
    },
  }
  await assert.rejects(claimBillingAccountMigration(db, {
    runId: 1,
    accountId: 4,
    leaseOwner: 'worker-1',
  }), /could not be leased/)
  assert.match(captured, /run\.status = 'running'/)
  assert.match(captured, /run\.mode = 'apply'/)
  assert.match(captured, /run\.configuration -> 'accountIds'/)
  assert.match(captured, /migration\.state NOT IN \('verified', 'rolled_back'\)/)
})

test('migration lock reuses a passed PoolClient without reconnecting or releasing it', async () => {
  const statements = []
  let releases = 0
  const client = {
    async connect() { assert.fail('a checked-out PoolClient must not reconnect') },
    async query(sql) {
      statements.push(String(sql))
      return { rows: [] }
    },
    release() { releases += 1 },
  }

  const value = await withBillingAccountMigrationLock(client, 41, async (lockedDb) => {
    assert.equal(lockedDb, client)
    await lockedDb.query('SELECT nested_work')
    return 'done'
  })

  assert.equal(value, 'done')
  assert.deepEqual(statements, [
    'BEGIN',
    'SELECT pg_advisory_xact_lock($1)',
    'SELECT nested_work',
    'COMMIT',
  ])
  assert.equal(releases, 0)
})
