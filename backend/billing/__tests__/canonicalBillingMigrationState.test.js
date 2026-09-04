import test from 'node:test'
import assert from 'node:assert/strict'
import {
  BILLING_MIGRATION_STATES as S,
  FORWARD_ONLY_STATES,
  PRE_CANCEL_ROLLBACK_STATES,
  assertBillingMigrationTransition,
  billingCutoverTiming,
  billingMigrationSnapshotHash,
  normalizeBillingAccountIds,
  sanitizeBillingMigrationSnapshot,
  validateBillingTargetMonth,
  zonedDateStartUnix,
} from '../canonicalBillingMigrationState.js'

test('migration state machine rejects skipping irreversible collection stages and keeps detachment reversible', () => {
  assert.doesNotThrow(() => assertBillingMigrationTransition(S.ARMED, S.CANCELLATION_SCHEDULED))
  assert.throws(
    () => assertBillingMigrationTransition(S.ARMED, S.REMOTE_RETIRED),
    /cannot transition/,
  )
  assert.doesNotThrow(() => assertBillingMigrationTransition(S.DETACHED, S.ROLLBACK_PENDING))
  assert.doesNotThrow(() => assertBillingMigrationTransition(S.SHADOW_VERIFIED, S.ROLLED_BACK))
  assert.throws(() => assertBillingMigrationTransition(S.ARMED, S.BLOCKED), /cannot transition/)
  assert.throws(() => assertBillingMigrationTransition(S.CANCELLATION_SCHEDULED, S.BLOCKED), /cannot transition/)
  assert.equal(FORWARD_ONLY_STATES.has(S.DETACHED), false)
  assert.equal(PRE_CANCEL_ROLLBACK_STATES.has(S.DETACHED), true)
  assert.doesNotThrow(() => assertBillingMigrationTransition(S.CANCELLATION_SCHEDULED, S.FAILED_FORWARD_ONLY))
})

test('account scope is explicit, positive, unique, and stable', () => {
  assert.deepEqual(normalizeBillingAccountIds(['9', 4, 9]), [4, 9])
  assert.throws(() => normalizeBillingAccountIds([]), /explicit billing account ID/)
  assert.throws(() => normalizeBillingAccountIds(['all']), /explicit billing account ID/)
})

test('target-month validation uses facility-local date rather than UTC month', () => {
  const result = validateBillingTargetMonth('2026-09-01', {
    timeZone: 'America/New_York',
    now: new Date('2026-09-01T02:00:00.000Z'), // Aug 31 at the facility.
    requireFuture: true,
  })
  assert.equal(result.currentMonth, '2026-08-01')
  assert.equal(result.boundaryReached, false)
  assert.equal(new Date(result.boundaryUnix * 1000).toISOString(), '2026-09-01T04:00:00.000Z')
})

test('facility-local boundary handles standard time', () => {
  const unix = zonedDateStartUnix('2027-01-01', 'America/New_York')
  assert.equal(new Date(unix * 1000).toISOString(), '2027-01-01T05:00:00.000Z')
})

test('cutover timing enforces seven-day preparation and final-day revalidation', () => {
  const boundaryUnix = Date.parse('2026-09-08T12:00:00.000Z') / 1000
  assert.deepEqual(billingCutoverTiming(boundaryUnix, new Date('2026-09-01T12:00:00.000Z')), {
    secondsUntilBoundary: 7 * 24 * 60 * 60,
    boundaryReached: false,
    canPrepare: true,
    inRevalidationWindow: false,
  })
  const finalDay = billingCutoverTiming(boundaryUnix, new Date('2026-09-08T00:00:00.000Z'))
  assert.equal(finalDay.canPrepare, false)
  assert.equal(finalDay.inRevalidationWindow, true)
  assert.equal(billingCutoverTiming(boundaryUnix, new Date('2026-09-08T12:00:00.000Z')).boundaryReached, true)
})

test('snapshot sanitation redacts secrets and stable hashes ignore object key order', () => {
  const safe = sanitizeBillingMigrationSnapshot({
    id: 'sub_1',
    nested: { client_secret: 'do-not-store', status: 'active' },
    authorization: 'Bearer nope',
  })
  assert.deepEqual(safe, {
    id: 'sub_1',
    nested: { client_secret: '[REDACTED]', status: 'active' },
    authorization: '[REDACTED]',
  })
  assert.equal(
    billingMigrationSnapshotHash({ b: 2, a: { d: 4, c: 3 } }),
    billingMigrationSnapshotHash({ a: { c: 3, d: 4 }, b: 2 }),
  )
})
