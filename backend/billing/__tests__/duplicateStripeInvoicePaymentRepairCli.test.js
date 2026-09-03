import test from 'node:test'
import assert from 'node:assert/strict'

import {
  APPLY_CONFIRMATION,
  buildRepairPlanHash,
  databaseTargetFingerprint,
  parseRepairCliArgs,
  resolveUnambiguousDatabaseUrl,
  sanitizeRepairReport,
} from '../../scripts/lib/duplicate-stripe-invoice-payment-repair-cli.mjs'
import {
  computeRepairSourceChecksum,
  databaseSsl,
  main as runRepairCli,
} from '../../scripts/repair-duplicate-stripe-invoice-payments.mjs'

test('repair CLI is dry-run by default and normalizes only explicit decimal pairs', () => {
  const parsed = parseRepairCliArgs([
    '--target=production',
    '--pairs=51:65,44:69',
  ])
  assert.equal(parsed.apply, false)
  assert.deepEqual(parsed.pairs, [
    { invoicePaymentId: 44, duplicatePaymentId: 69 },
    { invoicePaymentId: 51, duplicatePaymentId: 65 },
  ])
  for (const invalid of [
    '1e2:3',
    '1:1',
    '1:2,2:3',
    '0:2',
    '9007199254740992:2',
    '1:2:3',
  ]) {
    assert.throws(
      () => parseRepairCliArgs([`--pairs=${invalid}`, '--target=production']),
      /Invalid|reuses|appears|safe integer/,
    )
  }
})

test('repair CLI apply requires confirmation, plan hash, operator, and change ticket', () => {
  const base = ['--target=production', '--pairs=44:69', '--apply']
  assert.throws(() => parseRepairCliArgs(base), /--confirm/)
  assert.throws(
    () => parseRepairCliArgs([...base, `--confirm=${APPLY_CONFIRMATION}`]),
    /--plan-hash/,
  )
  const parsed = parseRepairCliArgs([
    ...base,
    `--confirm=${APPLY_CONFIRMATION}`,
    `--plan-hash=${'a'.repeat(64)}`,
    '--operator=Jimmy',
    '--change-ticket=INC-42',
  ])
  assert.equal(parsed.apply, true)
  assert.throws(
    () => parseRepairCliArgs([...base, '--dry-run']),
    /mutually exclusive/,
  )
})

test('database target resolution fails closed when aliases disagree', () => {
  assert.equal(
    resolveUnambiguousDatabaseUrl({ DATABASE_URL: 'postgres://u:p@db.example/vortex' }),
    'postgres://u:p@db.example/vortex',
  )
  assert.throws(
    () => resolveUnambiguousDatabaseUrl({
      DATABASE_URL: 'postgres://u:p@db-one/vortex',
      EXTERNAL_DB_URL: 'postgres://u:p@db-two/vortex',
    }),
    /disagree/,
  )
  assert.equal(
    databaseTargetFingerprint('postgres://first:secret@db.example:5432/vortex'),
    databaseTargetFingerprint('postgres://other:different@db.example:5432/vortex'),
  )
})

test('repair plan hash is deterministic, environment-bound, and omits family names', () => {
  const result = {
    ready: [{
      pair: '44:69',
      familyName: 'Private Family Name',
      accountId: 10893,
      accountStripeCustomerId: 'cus_1',
      amountCents: 25500,
      invoicePayment: {
        id: 44, status: 'settled', stripeCustomerId: 'cus_1', stripeInvoiceId: 'in_1',
        stripePaymentIntentId: null, externalReference: 'in_1',
      },
      duplicatePayment: {
        id: 69, status: 'settled', stripeCustomerId: 'cus_1', stripeInvoiceId: null,
        stripePaymentIntentId: 'pi_1', externalReference: 'pi_1',
      },
      reversals: [],
      remote: { stripeInvoiceId: 'in_1', stripePaymentIntentId: 'pi_1', unreviewedField: 'Private Family Name' },
      state: 'ready',
    }],
    repaired: [],
    failed: [],
    mode: 'dry_run',
    cohortStopped: false,
  }
  const identity = {
    target: 'production',
    databaseFingerprint: 'db-one',
    stripeAccountId: 'acct_one',
    stripeMode: 'live',
    codeVersion: 'release-one',
    sourceChecksum: 'b'.repeat(64),
  }
  const first = buildRepairPlanHash(result, identity)
  assert.equal(first, buildRepairPlanHash(result, identity))
  assert.notEqual(first, buildRepairPlanHash(result, { ...identity, stripeAccountId: 'acct_two' }))
  assert.notEqual(first, buildRepairPlanHash(result, { ...identity, sourceChecksum: 'c'.repeat(64) }))
  assert.equal(JSON.stringify(sanitizeRepairReport(result)).includes('Private Family Name'), false)
})

test('repair CLI TLS detection uses only the parsed database hostname', () => {
  assert.deepEqual(
    databaseSsl('postgres://user:localhost@db.example/vortex'),
    { rejectUnauthorized: false },
  )
  assert.deepEqual(
    databaseSsl('postgres://user:localhost@db.example/vortex?application_name=127.0.0.1'),
    { rejectUnauthorized: false },
  )
  assert.equal(databaseSsl('postgres://user:secret@localhost/vortex'), false)
  assert.equal(databaseSsl('postgres://user:secret@127.0.0.1/vortex'), false)
})

test('repair source checksum binds the reviewed source contents', async () => {
  const first = await computeRepairSourceChecksum({
    directory: '/reviewed',
    readFile: async (filename) => Buffer.from(`first:${filename}`),
  })
  const second = await computeRepairSourceChecksum({
    directory: '/reviewed',
    readFile: async (filename) => Buffer.from(`second:${filename}`),
  })
  assert.match(first, /^[0-9a-f]{64}$/)
  assert.notEqual(first, second)
})

function cliInspection(state = 'ready') {
  return {
    mode: 'dry_run',
    cohortStopped: false,
    repaired: [],
    failed: [],
    ready: [{
      pair: '1:2',
      accountId: 8,
      accountStripeCustomerId: 'cus_1',
      amountCents: 7125,
      invoicePayment: {
        id: 1,
        accountId: 8,
        amountCents: 7125,
        status: state === 'already_repaired' ? 'settled' : 'settled',
        stripeCustomerId: 'cus_1',
        stripeInvoiceId: 'in_1',
        stripePaymentIntentId: state === 'already_repaired' ? 'pi_1' : null,
        externalReference: 'in_1',
      },
      duplicatePayment: {
        id: 2,
        accountId: 8,
        amountCents: 7125,
        status: state === 'already_repaired' ? 'canceled' : 'settled',
        stripeCustomerId: 'cus_1',
        stripeInvoiceId: null,
        stripePaymentIntentId: state === 'already_repaired' ? null : 'pi_1',
        externalReference: 'pi_1',
      },
      reversals: [],
      remote: {
        stripeInvoiceId: 'in_1',
        stripePaymentIntentId: 'pi_1',
        stripeCustomerId: 'cus_1',
        amountCents: 7125,
        currency: 'usd',
      },
      state,
    }],
  }
}

test('repair CLI main performs its dry run inside a read-only transaction and closes the pool', async () => {
  const events = []
  const client = {
    async query(sql) { events.push(String(sql)); return { rows: [] } },
    release() { events.push('release') },
  }
  const pool = {
    async connect() { events.push('connect'); return client },
    async end() { events.push('end') },
  }
  const stripe = { accounts: { async retrieve() { return { id: 'acct_test' } } } }
  const report = await runRepairCli([
    '--target=staging',
    '--pairs=1:2',
    '--dry-run',
  ], {
    STRIPE_ENABLED: 'true',
    STRIPE_SECRET_KEY: 'sk_test_example',
    DATABASE_URL: 'postgres://user:secret@db.example/vortex',
  }, {
    pool,
    stripe,
    sourceChecksum: 'c'.repeat(64),
    assertSchema: async () => { events.push('schema') },
    repair: async (_pool, _stripe, options) => {
      assert.equal(options.apply, false)
      events.push('repair-dry')
      return cliInspection()
    },
  })

  assert.match(report.planHash, /^[0-9a-f]{64}$/)
  assert.deepEqual(events, [
    'connect',
    'BEGIN TRANSACTION READ ONLY',
    "SET LOCAL statement_timeout = '30s'",
    'schema',
    'repair-dry',
    'COMMIT',
    'release',
    'end',
  ])
})

test('repair CLI main always emits fresh postflight evidence after an ambiguous apply error', async () => {
  const sourceChecksum = 'd'.repeat(64)
  const databaseUrl = 'postgres://user:secret@db.example/vortex'
  const identity = {
    target: 'staging',
    databaseFingerprint: databaseTargetFingerprint(databaseUrl),
    stripeAccountId: 'acct_test',
    stripeMode: 'test',
    codeVersion: 'release-1',
    sourceChecksum,
  }
  const preflight = cliInspection('ready')
  const planHash = buildRepairPlanHash(preflight, identity)
  let inspections = 0
  let ended = 0
  const pool = { async end() { ended += 1 } }
  const stripe = { accounts: { async retrieve() { return { id: 'acct_test' } } } }

  await assert.rejects(
    runRepairCli([
      '--target=staging',
      '--pairs=1:2',
      '--apply',
      `--confirm=${APPLY_CONFIRMATION}`,
      `--plan-hash=${planHash}`,
      '--operator=Jimmy',
      '--change-ticket=INC-42',
    ], {
      STRIPE_ENABLED: 'true',
      STRIPE_SECRET_KEY: 'sk_test_example',
      DATABASE_URL: databaseUrl,
      BILLING_REPAIR_CODE_VERSION: 'release-1',
      BILLING_DUPLICATE_PAYMENT_REPAIR_ENABLED: 'true',
      BILLING_DUPLICATE_PAYMENT_REPAIR_DB_FINGERPRINT: identity.databaseFingerprint,
      BILLING_DUPLICATE_PAYMENT_REPAIR_STRIPE_ACCOUNT_ID: 'acct_test',
    }, {
      pool,
      stripe,
      sourceChecksum,
      assertSchema: async () => {},
      readOnlyInspection: async () => {
        inspections += 1
        return inspections === 1 ? preflight : cliInspection('already_repaired')
      },
      repair: async () => { throw new Error('connection lost after COMMIT') },
    }),
    (error) => {
      assert.equal(inspections, 2)
      assert.equal(error.report.postVerification.ready[0].state, 'already_repaired')
      assert.match(error.report.nextPlanHash, /^[0-9a-f]{64}$/)
      return /fresh post-verification/.test(error.message)
    },
  )
  assert.equal(ended, 1)
})
