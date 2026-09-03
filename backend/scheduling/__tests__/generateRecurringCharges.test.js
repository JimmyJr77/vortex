import test from 'node:test'
import assert from 'node:assert/strict'
import {
  billingMonthEnd,
  generateRecurringCharges,
  processRecurringBillingAccount,
  recurringCollectionMode,
  recurringBillingClock,
} from '../generateRecurringCharges.js'

test('billingMonthEnd handles ordinary and leap-year months', () => {
  assert.equal(billingMonthEnd('2026-09-01'), '2026-09-30')
  assert.equal(billingMonthEnd('2028-02-01'), '2028-02-29')
  assert.throws(() => billingMonthEnd('2026-09-02'), /YYYY-MM-01/)
})

test('recurring billing month boundaries follow each facility civil date', () => {
  const instant = new Date('2026-09-01T00:30:00.000Z')

  assert.deepEqual(
    recurringBillingClock(instant, 'America/New_York'),
    {
      asOfDate: '2026-08-31',
      asOfMidnight: new Date('2026-08-31T00:00:00.000Z'),
      billingMonth: '2026-08-01',
      isMonthBoundary: false,
    },
  )
  assert.deepEqual(
    recurringBillingClock(instant, 'Pacific/Kiritimati'),
    {
      asOfDate: '2026-09-01',
      asOfMidnight: new Date('2026-09-01T00:00:00.000Z'),
      billingMonth: '2026-09-01',
      isMonthBoundary: true,
    },
  )
})

test('recurring billing rejects a missing or invalid facility timezone', () => {
  assert.throws(() => recurringBillingClock(new Date(), null), /Invalid facility timezone/)
  assert.throws(() => recurringBillingClock(new Date(), 'Mars/Olympus_Mons'), /Invalid facility timezone/)
})

const ACCOUNT = {
  id: 9,
  family_id: 3,
  is_active: true,
  facility_id: 2,
  facility_timezone: 'America/New_York',
  household_monthly_billing_enabled: true,
  migration_state: 'verified',
  verified_collection_month: '2026-09-01',
}

function recurringAccountFixture({
  account = ACCOUNT,
  due = [{ id: 41, next_bill_date: '2026-09-01' }],
} = {}) {
  const state = { account: account ? { ...account } : null, due: due.map((row) => ({ ...row })) }
  const calls = []
  const db = {
    release() {},
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (/FROM family_billing_account account/.test(text) && /billing_account_migration/.test(text)) {
        return { rows: state.account ? [{ ...state.account }] : [] }
      }
      if (/SELECT subscription\.id, subscription\.next_bill_date/.test(text)) {
        return { rows: state.due.map((row) => ({ ...row })) }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  return { db, state, calls }
}

function safeProcessors(overrides = {}) {
  return {
    completionProcessor: async () => [],
    cancellationProcessor: async () => [],
    scheduledPauseProcessor: async () => 0,
    pauseCreditProcessor: async () => 0,
    discountSynchronizer: async () => ({ updated: 0 }),
    annualRenewalPoster: async () => ({
      subscriptionsProcessed: 0,
      chargesPosted: 0,
      periodsAdvanced: 0,
    }),
    paymentAllocator: async () => {},
    invoiceFactory: async () => ({ created: false }),
    ...overrides,
  }
}

test('any strict lifecycle or due-credit failure blocks canonical charges and household invoice', async (t) => {
  for (const failedStage of ['completionProcessor', 'cancellationProcessor', 'scheduledPauseProcessor', 'pauseCreditProcessor']) {
    await t.test(failedStage, async () => {
      const fixture = recurringAccountFixture()
      let reconciles = 0
      let invoices = 0
      await assert.rejects(
        processRecurringBillingAccount(fixture.db, ACCOUNT, {
          asOfTimestamp: new Date('2026-09-01T05:00:00.000Z'),
          clock: recurringBillingClock('2026-09-01T05:00:00.000Z', ACCOUNT.facility_timezone),
          ...safeProcessors({
            [failedStage]: async () => {
              const error = new Error(`injected ${failedStage} failure`)
              error.code = `${failedStage}_failed`
              throw error
            },
            recurringChargeReconciler: async () => { reconciles += 1 },
            invoiceFactory: async () => { invoices += 1 },
          }),
        }),
        new RegExp(`injected ${failedStage} failure`),
      )
      assert.equal(reconciles, 0)
      assert.equal(invoices, 0)
    })
  }
})

test('canonical pricing failure blocks household invoice creation', async () => {
  const fixture = recurringAccountFixture()
  let invoices = 0
  await assert.rejects(
    processRecurringBillingAccount(fixture.db, ACCOUNT, {
      asOfTimestamp: new Date('2026-09-01T05:00:00.000Z'),
      clock: recurringBillingClock('2026-09-01T05:00:00.000Z', ACCOUNT.facility_timezone),
      ...safeProcessors({
        recurringChargeReconciler: async () => {
          throw new Error('injected canonical pricing failure')
        },
        invoiceFactory: async () => {
          invoices += 1
          return { created: true }
        },
      }),
    }),
    /injected canonical pricing failure/,
  )
  assert.equal(invoices, 0)
})

test('strict post-lifecycle discount synchronization blocks collection on failure', async () => {
  const fixture = recurringAccountFixture()
  let reconciles = 0
  let invoices = 0
  await assert.rejects(
    processRecurringBillingAccount(fixture.db, ACCOUNT, {
      asOfTimestamp: new Date('2026-09-01T05:00:00.000Z'),
      clock: recurringBillingClock('2026-09-01T05:00:00.000Z', ACCOUNT.facility_timezone),
      ...safeProcessors({
        completionProcessor: async () => [101],
        discountSynchronizer: async (_db, familyId, options) => {
          assert.equal(familyId, 3)
          assert.equal(options.strict, true)
          assert.equal(options.periodKey, '2026-09-01')
          assert.equal(options.syncStripe, false)
          throw new Error('injected strict discount sync failure')
        },
        recurringChargeReconciler: async () => { reconciles += 1 },
        invoiceFactory: async () => { invoices += 1 },
      }),
    }),
    /injected strict discount sync failure/,
  )
  assert.equal(reconciles, 0)
  assert.equal(invoices, 0)
})

test('collector mode is fail-closed for staged rollout state combinations', () => {
  assert.equal(recurringCollectionMode({ ...ACCOUNT }), 'canonical_household')
  assert.equal(recurringCollectionMode({
    ...ACCOUNT,
    migration_state: 'discovered',
    has_verified_migration: true,
  }), 'canonical_household')
  assert.equal(recurringCollectionMode({ ...ACCOUNT, migration_state: null, household_monthly_billing_enabled: false }), 'legacy')
  assert.equal(recurringCollectionMode({ ...ACCOUNT, migration_state: 'rolled_back', household_monthly_billing_enabled: false }), 'legacy')
  assert.equal(recurringCollectionMode({ ...ACCOUNT, migration_state: 'armed', household_monthly_billing_enabled: false }), 'migration_managed')
  assert.equal(recurringCollectionMode({ ...ACCOUNT, migration_state: 'household_active' }), 'migration_managed')
  for (const account of [
    { ...ACCOUNT, migration_state: 'verified', household_monthly_billing_enabled: false },
    { ...ACCOUNT, migration_state: null, household_monthly_billing_enabled: true },
    { ...ACCOUNT, migration_state: 'rolled_back', household_monthly_billing_enabled: true },
    { ...ACCOUNT, migration_state: 'armed', household_monthly_billing_enabled: true },
    { ...ACCOUNT, migration_state: 'household_active', household_monthly_billing_enabled: false },
  ]) {
    assert.throws(() => recurringCollectionMode(account), (error) => (
      error.code === 'recurring_collection_state_inconsistent'
    ))
  }
})

test('verified household collection stays dormant until its effective billing month', async () => {
  const future = { ...ACCOUNT, verified_collection_month: '2026-10-01' }
  assert.equal(
    recurringCollectionMode(future, { billingMonth: '2026-09-01' }),
    'canonical_household_deferred',
  )
  assert.equal(
    recurringCollectionMode(future, { billingMonth: '2026-10-01' }),
    'canonical_household',
  )
  assert.throws(
    () => recurringCollectionMode(
      { ...ACCOUNT, verified_collection_month: null },
      { billingMonth: '2026-09-01' },
    ),
    (error) => error.code === 'recurring_collection_boundary_invalid',
  )

  const fixture = recurringAccountFixture({ account: future })
  let processorCalls = 0
  let canonicalCalls = 0
  let invoiceCalls = 0
  const result = await processRecurringBillingAccount(fixture.db, future, {
    asOfTimestamp: new Date('2026-09-03T06:10:00.000Z'),
    clock: recurringBillingClock('2026-09-03T06:10:00.000Z', future.facility_timezone),
    ...safeProcessors({
      completionProcessor: async () => { processorCalls += 1; return [] },
      recurringChargeReconciler: async () => {
        canonicalCalls += 1
        fixture.state.due = []
        return { verified: true, postedChargeIds: [] }
      },
      invoiceFactory: async () => { invoiceCalls += 1; return { created: true } },
    }),
  })
  assert.equal(result.collectionMode, 'canonical_household_deferred')
  assert.equal(processorCalls, 1)
  assert.equal(canonicalCalls, 1)
  assert.equal(invoiceCalls, 0)
})

test('pre-pilot and rolled-back accounts stay on the hardened legacy poster', async (t) => {
  for (const migrationState of [null, 'rolled_back']) {
    await t.test(String(migrationState), async () => {
      const account = {
        ...ACCOUNT,
        migration_state: migrationState,
        household_monthly_billing_enabled: false,
      }
      const fixture = recurringAccountFixture({ account })
      let legacyCalls = 0
      let canonicalCalls = 0
      let invoiceCalls = 0
      const result = await processRecurringBillingAccount(fixture.db, account, {
        asOfTimestamp: new Date('2026-09-01T05:00:00.000Z'),
        clock: recurringBillingClock('2026-09-01T05:00:00.000Z', account.facility_timezone),
        ...safeProcessors({
          recurringChargeReconciler: async () => {
            canonicalCalls += 1
            throw new Error('canonical path must remain off before cutover')
          },
          legacyChargePoster: async (_db, options) => {
            legacyCalls += 1
            assert.equal(options.billingMonth, '2026-09-01')
            fixture.state.due = []
            return { verified: true, postedChargeIds: [801] }
          },
          invoiceFactory: async () => {
            invoiceCalls += 1
            return { created: true }
          },
        }),
      })
      assert.equal(result.collectionMode, 'legacy')
      assert.equal(legacyCalls, 1)
      assert.equal(canonicalCalls, 0)
      assert.equal(invoiceCalls, 0)
    })
  }
})

test('an active migration owns collection until verified or rolled back', async () => {
  const fixture = recurringAccountFixture({ account: { ...ACCOUNT, migration_state: 'household_active' } })
  let workerCalls = 0
  const result = await processRecurringBillingAccount(fixture.db, fixture.state.account, {
    asOfTimestamp: new Date('2026-09-01T05:00:00.000Z'),
    clock: recurringBillingClock('2026-09-01T05:00:00.000Z', ACCOUNT.facility_timezone),
    ...safeProcessors({
      cancellationProcessor: async () => { workerCalls += 1 },
      recurringChargeReconciler: async () => { workerCalls += 1 },
      invoiceFactory: async () => { workerCalls += 1 },
    }),
  })
  assert.equal(result.skipped, 'migration_managed')
  assert.equal(result.migrationState, 'household_active')
  assert.equal(workerCalls, 0)
})

test('verified household recurring charges reconcile canonically under the invoice lock', async () => {
  const fixture = recurringAccountFixture()
  const events = []
  const result = await processRecurringBillingAccount(fixture.db, ACCOUNT, {
    asOfTimestamp: new Date('2026-09-01T05:00:00.000Z'),
    clock: recurringBillingClock('2026-09-01T05:00:00.000Z', ACCOUNT.facility_timezone),
    ...safeProcessors({
      recurringChargeReconciler: async (receivedDb, options) => {
        assert.equal(receivedDb, fixture.db)
        assert.equal(options.billingMonth, '2026-09-01')
        assert.equal(options.apply, true)
        events.push('canonical-charges')
        fixture.state.due = []
        return { verified: true, postedChargeIds: [701] }
      },
      invoiceFactory: async (receivedDb, options) => {
        assert.equal(receivedDb, fixture.db)
        assert.equal(options.billingMonth, '2026-09-01')
        assert.equal(options.migrationAuthorization, undefined)
        events.push('household-invoice')
        return { created: true }
      },
    }),
  })
  assert.deepEqual(events, ['canonical-charges', 'household-invoice'])
  assert.equal(result.chargesPosted, 1)
  assert.equal(result.householdInvoicesCreated, 1)
})

test('due annual membership charges are posted before the household invoice and included in totals', async () => {
  const fixture = recurringAccountFixture({ due: [] })
  const events = []
  const result = await processRecurringBillingAccount(fixture.db, ACCOUNT, {
    asOfTimestamp: new Date('2027-09-01T05:00:00.000Z'),
    clock: recurringBillingClock('2027-09-01T05:00:00.000Z', ACCOUNT.facility_timezone),
    ...safeProcessors({
      annualRenewalPoster: async (receivedDb, options) => {
        assert.equal(receivedDb, fixture.db)
        assert.equal(options.accountId, 9)
        assert.equal(options.asOfDate, '2027-09-01')
        assert.equal(options.billingThroughDate, '2027-09-30')
        assert.equal(options.maxCatchUpPerSubscription, 12)
        events.push('annual-renewal')
        return { subscriptionsProcessed: 1, chargesPosted: 1, periodsAdvanced: 1 }
      },
      recurringChargeReconciler: async () => {
        events.push('canonical-charges')
        return { verified: true, postedChargeIds: [] }
      },
      invoiceFactory: async () => {
        events.push('household-invoice')
        return { created: true }
      },
    }),
  })

  assert.deepEqual(events, ['annual-renewal', 'canonical-charges', 'household-invoice'])
  assert.equal(result.subscriptionsProcessed, 1)
  assert.equal(result.chargesPosted, 1)
  assert.equal(result.periodsAdvanced, 1)
  assert.equal(result.annualRenewalChargesPosted, 1)
  assert.equal(result.annualRenewalPeriodsAdvanced, 1)
  assert.equal(result.householdInvoicesCreated, 1)
})

test('a ledger annual renewal alone triggers legacy payment allocation', async () => {
  const account = {
    ...ACCOUNT,
    migration_state: null,
    household_monthly_billing_enabled: false,
  }
  const fixture = recurringAccountFixture({ account, due: [] })
  let allocations = 0
  const result = await processRecurringBillingAccount(fixture.db, account, {
    asOfTimestamp: new Date('2027-09-01T05:00:00.000Z'),
    clock: recurringBillingClock('2027-09-01T05:00:00.000Z', account.facility_timezone),
    ...safeProcessors({
      annualRenewalPoster: async (_db, options) => {
        assert.equal(options.billingThroughDate, '2027-09-01')
        return {
          subscriptionsProcessed: 1,
          chargesPosted: 1,
          periodsAdvanced: 1,
        }
      },
      paymentAllocator: async () => { allocations += 1 },
    }),
  })

  assert.equal(result.collectionMode, 'legacy')
  assert.equal(result.annualRenewalChargesPosted, 1)
  assert.equal(allocations, 1)
})

test('verified household accounts re-verify the current month before every invoice retry', async () => {
  const fixture = recurringAccountFixture({ due: [] })
  const events = []
  const result = await processRecurringBillingAccount(fixture.db, ACCOUNT, {
    asOfTimestamp: new Date('2026-09-02T05:00:00.000Z'),
    clock: recurringBillingClock('2026-09-02T05:00:00.000Z', ACCOUNT.facility_timezone),
    ...safeProcessors({
      recurringChargeReconciler: async (_db, options) => {
        events.push(`verify:${options.billingMonth}`)
        return { verified: true, postedChargeIds: [] }
      },
      invoiceFactory: async () => {
        events.push('invoice')
        return { created: false }
      },
    }),
  })
  assert.deepEqual(events, ['verify:2026-09-01', 'invoice'])
  assert.equal(result.periodsAdvanced, 0)
})

test('verified household collection fails closed when invoice creation is disabled or unavailable', async (t) => {
  for (const skipped of ['feature_disabled', 'not_enabled', 'stripe_unavailable']) {
    await t.test(skipped, async () => {
      const fixture = recurringAccountFixture({ due: [] })
      await assert.rejects(
        processRecurringBillingAccount(fixture.db, ACCOUNT, {
          asOfTimestamp: new Date('2026-09-02T05:00:00.000Z'),
          clock: recurringBillingClock('2026-09-02T05:00:00.000Z', ACCOUNT.facility_timezone),
          ...safeProcessors({
            recurringChargeReconciler: async () => ({ verified: true, postedChargeIds: [] }),
            invoiceFactory: async () => ({ created: false, skipped }),
          }),
        }),
        (error) => (
          error.code === 'household_invoice_collection_unavailable'
          && error.details?.accountId === ACCOUNT.id
          && error.details?.skipped === skipped
        ),
      )
    })
  }
})

test('inactive accounts are excluded before lifecycle, charge, or invoice work', async () => {
  const fixture = recurringAccountFixture({ account: null })
  let work = 0
  const result = await processRecurringBillingAccount(fixture.db, ACCOUNT, {
    asOfTimestamp: new Date('2026-09-01T05:00:00.000Z'),
    clock: recurringBillingClock('2026-09-01T05:00:00.000Z', ACCOUNT.facility_timezone),
    ...safeProcessors({
      cancellationProcessor: async () => { work += 1 },
      recurringChargeReconciler: async () => { work += 1 },
      invoiceFactory: async () => { work += 1 },
    }),
  })
  assert.equal(result.skipped, 'inactive')
  assert.equal(work, 0)
  assert.match(fixture.calls[0].text, /account\.is_active = TRUE/)
})

test('facility civil dates are passed to each account-scoped worker independently', async () => {
  const accounts = [
    { ...ACCOUNT, id: 9, facility_timezone: 'America/New_York' },
    { ...ACCOUNT, id: 10, facility_id: 3, facility_timezone: 'Pacific/Kiritimati' },
  ]
  const clocks = new Map()
  const pool = {
    async query(sql) {
      if (/FROM family_billing_account account/.test(String(sql)) && /billing_account_migration/.test(String(sql))) {
        return { rows: accounts }
      }
      return { rows: [] }
    },
  }
  await generateRecurringCharges(pool, {
    asOf: new Date('2026-09-01T00:30:00.000Z'),
    accountLock: async (_pool, _accountId, callback) => callback(pool),
    accountProcessor: async (_db, account, options) => {
      clocks.set(account.id, options.clock.asOfDate)
      return {}
    },
  })
  assert.equal(clocks.get(9), '2026-08-31')
  assert.equal(clocks.get(10), '2026-09-01')
})

test('recurring account inventory preserves terminal verified collection evidence across later audits', async () => {
  const accounts = [{
    ...ACCOUNT,
    migration_state: 'discovered',
    has_verified_migration: true,
  }]
  let accountSql = ''
  const pool = {
    async query(sql) {
      accountSql = String(sql)
      return { rows: accounts }
    },
  }
  let observedMode = null
  await generateRecurringCharges(pool, {
    accountLock: async (_pool, _accountId, callback) => callback(pool),
    accountProcessor: async (_db, account) => {
      observedMode = recurringCollectionMode(account)
      return {}
    },
  })
  assert.match(accountSql, /verified_migration\.id IS NOT NULL AS has_verified_migration/)
  assert.match(accountSql, /candidate\.state = 'verified'[\s\S]+candidate\.verified_at IS NOT NULL/)
  assert.match(accountSql, /verified_migration\.effective_month AS verified_collection_month/)
  assert.equal(observedMode, 'canonical_household')
})

test('a quarantined account does not stop the sweep and is reported with its failure code', async () => {
  const accounts = [
    { ...ACCOUNT, id: 9 },
    { ...ACCOUNT, id: 10 },
  ]
  const pool = {
    async query(sql) {
      if (/FROM family_billing_account account/.test(String(sql)) && /billing_account_migration/.test(String(sql))) {
        return { rows: accounts }
      }
      return { rows: [] }
    },
  }
  const originalError = console.error
  console.error = () => {}
  let result
  try {
    result = await generateRecurringCharges(pool, {
      accountLock: async (_pool, _accountId, callback) => callback(pool),
      accountProcessor: async (_db, account) => {
        if (account.id === 9) {
          const error = new Error('injected account quarantine')
          error.code = 'pause_credit_postcondition_failed'
          throw error
        }
        return { subscriptionsProcessed: 1, chargesPosted: 1, periodsAdvanced: 1 }
      },
    })
  } finally {
    console.error = originalError
  }
  assert.equal(result.accountsBlocked, 1)
  assert.deepEqual(result.blockedAccounts, [{ accountId: 9, code: 'pause_credit_postcondition_failed' }])
  assert.equal(result.subscriptionsProcessed, 1)
  assert.equal(result.chargesPosted, 1)
})

test('strict lifecycle processors receive each facility civil date at the UTC boundary', async () => {
  const instant = new Date('2026-09-01T00:30:00.000Z')
  for (const [timeZone, expectedDate] of [
    ['America/New_York', '2026-08-31'],
    ['Pacific/Kiritimati', '2026-09-01'],
  ]) {
    const account = {
      ...ACCOUNT,
      migration_state: null,
      household_monthly_billing_enabled: false,
      facility_timezone: timeZone,
    }
    const fixture = recurringAccountFixture({ account, due: [] })
    let completionDate = null
    let cancellationDate = null
    let pauseDate = null
    await processRecurringBillingAccount(fixture.db, account, {
      asOfTimestamp: instant,
      clock: recurringBillingClock(instant, timeZone),
      ...safeProcessors({
        completionProcessor: async (_db, options) => { completionDate = options.asOfDate },
        cancellationProcessor: async (_db, options) => { cancellationDate = options.asOfDate },
        scheduledPauseProcessor: async (_db, options) => { pauseDate = options.asOfDate },
      }),
    })
    assert.equal(completionDate, expectedDate)
    assert.equal(cancellationDate, expectedDate)
    assert.equal(pauseDate, expectedDate)
  }
})
