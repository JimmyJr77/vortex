import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertEnrollmentCheckoutMemberScope,
  assertEnrollmentCheckoutSessionBinding,
  authorizePendingEnrollmentCheckout,
  computeEnrollmentDueNowCents,
  computeFirstMonthBillingAnchorDate,
  computeFirstMonthTuitionLineItems,
  computeSubscriptionBillingAnchorDate,
  commitPendingEnrollment,
  createEnrollmentAnnualMembershipSubscriptions,
  createEnrollmentStripeSubscriptions,
  enrollmentHasRecurringMembership,
  formatEnrollmentCheckoutSubmitMessage,
  formatFirstMonthTuitionLineName,
  formatPerClassStripeProductName,
  resolveEnrollmentCheckoutMode,
  resolvePerClassMonthlyAmountCents,
  resolveVerifiedEnrollmentMemberId,
  refreshSignupAuthForCommit,
  shouldSkipPerClassStripeCollection,
  shouldShowEnrollmentCheckoutSubmitMessage,
} from '../stripeEnrollmentCheckout.js'
import { pluralizeWeekdayLabel } from '../stripeProductNaming.js'
import { firstOfNextMonth } from '../../scheduling/firstMonthProration.js'
import {
  issueSignupAuthToken,
  verifySignupAuthToken,
} from '../../scheduling/signupAuth.js'
import {
  withLegacyClassSubscriptionCreationExclusiveLock,
  withLegacyClassSubscriptionCreationSharedLock,
} from '../legacyClassSubscriptionCreationLock.js'
import { withBillingAccountMigrationLock } from '../canonicalBillingMigrationRepository.js'

test('formatPerClassStripeProductName includes class, schedule, and athlete', () => {
  assert.equal(
    formatPerClassStripeProductName({
      classTitle: 'Tramp & Tumble',
      scheduleLabel: 'Mondays 19:15–20:45',
      athleteName: 'Maddox OBrien',
    }),
    'Tramp & Tumble · Mondays 19:15–20:45 · Maddox OBrien',
  )
})

test('future per-class Stripe creation stays disabled across every rollout state', () => {
  for (const state of [null, 'shadow_verified', 'armed', 'household_active', 'rollback_pending', 'rolled_back']) {
    assert.equal(
      shouldSkipPerClassStripeCollection(
        { household_monthly_billing_enabled: false, migration_state: state },
        {
          BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'legacy',
          BILLING_STRIPE_SUBSCRIPTION_CREATION_MODE: 'disabled',
        },
      ),
      true,
    )
  }
})

test('the global household-only phase blocks an unmigrated account independently of cohort flags', () => {
  assert.equal(
    shouldSkipPerClassStripeCollection(
      { household_monthly_billing_enabled: false, migration_state: null },
      {
        BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'household_only',
        BILLING_COLLECTION_CUTOVER_ENABLED: 'false',
      },
    ),
    true,
  )
})

test('durable armed history keeps the global cutoff active after an environment rollback', () => {
  assert.equal(
    shouldSkipPerClassStripeCollection(
      {
        global_creation_cutoff_durable: true,
        household_monthly_billing_enabled: false,
        migration_state: null,
      },
      { BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'legacy' },
    ),
    true,
  )
})

test('retired class creator preserves the Checkout payment method without creating a subscription', async () => {
  const updates = []
  let remoteCreationCalls = 0
  const stripe = {
    checkout: {
      sessions: {
        async retrieve() {
          return {
            customer: 'cus_8',
            setup_intent: { payment_method: 'pm_8' },
          }
        },
      },
    },
    customers: {
      async update(customerId, payload) {
        updates.push({ customerId, payload })
      },
    },
    subscriptions: {
      async create() {
        remoteCreationCalls += 1
      },
    },
  }
  const result = await createEnrollmentStripeSubscriptions({}, stripe, {
    stripeSession: 'cs_8',
    signupIds: [1],
    familyBillingAccountId: 8,
    environment: {},
  })
  assert.deepEqual(result, [])
  assert.equal(remoteCreationCalls, 0)
  assert.deepEqual(updates, [{
    customerId: 'cus_8',
    payload: { invoice_settings: { default_payment_method: 'pm_8' } },
  }])
})

test('per-class creation fails closed when the active billing account is missing', async () => {
  let stripeCalls = 0
  const pool = { async query() { return { rows: [] } } }
  const stripe = new Proxy({}, {
    get() {
      stripeCalls += 1
      throw new Error('Stripe must not be called')
    },
  })
  const result = await createEnrollmentStripeSubscriptions(pool, stripe, {
    preview: {},
    signupIds: [1],
    familyBillingAccountId: 8,
    environment: {},
  })
  assert.deepEqual(result, [])
  assert.equal(stripeCalls, 0)
})

test('legacy creation lock and nested migration transaction reuse a passed PoolClient', async () => {
  const statements = []
  let releases = 0
  const client = {
    async connect() { assert.fail('a checked-out PoolClient must not reconnect') },
    async query(sql) {
      statements.push(String(sql))
      return { rows: [{}] }
    },
    release() { releases += 1 },
  }

  const value = await withLegacyClassSubscriptionCreationExclusiveLock(client, async (lockedDb) => {
    assert.equal(lockedDb, client)
    return withBillingAccountMigrationLock(lockedDb, 41, async (transactionDb) => {
      assert.equal(transactionDb, client)
      await transactionDb.query('SELECT nested_work')
      return 'nested'
    })
  })

  assert.equal(value, 'nested')
  assert.deepEqual(statements, [
    'SELECT pg_advisory_lock($1::integer, $2::integer)',
    'BEGIN',
    'SELECT pg_advisory_xact_lock($1)',
    'SELECT nested_work',
    'COMMIT',
    'SELECT pg_advisory_unlock($1::integer, $2::integer)',
  ])
  assert.equal(releases, 0)
})

test('first arm waits for an in-flight creator and stale post-arm creation returns zero', async () => {
  let activeSharedLocks = 0
  let exclusiveWaiter = null
  let armed = false
  let releaseCreator
  let creatorEntered
  const order = []
  const creatorReady = new Promise((resolve) => { creatorEntered = resolve })
  const holdCreator = new Promise((resolve) => { releaseCreator = resolve })

  const client = {
    async query(sql) {
      const text = String(sql)
      if (/pg_advisory_lock_shared/.test(text)) {
        activeSharedLocks += 1
        order.push('creator-lock-acquired')
        return { rows: [{}] }
      }
      if (/pg_advisory_unlock_shared/.test(text)) {
        activeSharedLocks -= 1
        order.push('creator-lock-released')
        if (activeSharedLocks === 0 && exclusiveWaiter) exclusiveWaiter()
        return { rows: [{}] }
      }
      if (/pg_advisory_lock\(/.test(text)) {
        order.push('arm-lock-requested')
        if (activeSharedLocks > 0) {
          await new Promise((resolve) => { exclusiveWaiter = resolve })
          exclusiveWaiter = null
        }
        order.push('arm-lock-acquired')
        return { rows: [{}] }
      }
      if (/pg_advisory_unlock\(/.test(text)) {
        order.push('arm-lock-released')
        return { rows: [{}] }
      }
      if (/migration\.state AS migration_state/.test(text)) {
        return {
          rows: [{
            global_creation_cutoff_durable: armed,
            household_monthly_billing_enabled: false,
            migration_state: null,
          }],
        }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
    release() {},
  }
  const pool = { async connect() { return client } }

  const creator = withLegacyClassSubscriptionCreationSharedLock(pool, async () => {
    creatorEntered()
    await holdCreator
    order.push('creator-local-link-durable')
  })
  await creatorReady

  let armEntered = false
  const arm = withLegacyClassSubscriptionCreationExclusiveLock(pool, async () => {
    armEntered = true
    armed = true
    order.push('armed')
  })
  await new Promise((resolve) => setImmediate(resolve))
  assert.equal(armEntered, false)

  releaseCreator()
  await Promise.all([creator, arm])
  assert.ok(order.indexOf('creator-local-link-durable') < order.indexOf('arm-lock-acquired'))
  assert.ok(order.indexOf('arm-lock-acquired') < order.indexOf('armed'))

  let stripeCalls = 0
  const stripe = new Proxy({}, {
    get() {
      stripeCalls += 1
      throw new Error('A stale creator must not call Stripe after first arm.')
    },
  })
  const created = await createEnrollmentStripeSubscriptions(pool, stripe, {
    preview: {},
    signupIds: [1],
    familyBillingAccountId: 8,
    customerId: 'cus_8',
    environment: { BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'legacy' },
  })
  assert.deepEqual(created, [])
  assert.equal(stripeCalls, 0)
})

test('invalid global cutoff configuration fails before database or Stripe work', async () => {
  let databaseCalls = 0
  await assert.rejects(
    createEnrollmentStripeSubscriptions(
      { async query() { databaseCalls += 1 } },
      {},
      {
        preview: {},
        signupIds: [1],
        familyBillingAccountId: 8,
        environment: { BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'sometimes' },
      },
    ),
    /must be one of legacy, household_only/,
  )
  assert.equal(databaseCalls, 0)
})

test('annual checkout saves the payment method and creates only a local renewal schedule', async () => {
  let subscriptionCreateCalls = 0
  let insertSql = ''
  const customerUpdates = []
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (/SELECT first_name, last_name FROM member/.test(text)) {
        return { rows: [{ first_name: 'Legend', last_name: 'Jackson' }] }
      }
      if (/SELECT id, stripe_subscription_id/.test(text)) return { rows: [] }
      if (/SELECT \* FROM annual_membership_renewal_pricing/.test(text)) return { rows: [] }
      if (/INSERT INTO billing_subscription/.test(text)) {
        insertSql = text
        return { rows: [{ id: 91, stripe_subscription_id: null, auto_renewal: true }] }
      }
      if (/UPDATE billing_subscription/.test(text)) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  const stripe = {
    checkout: {
      sessions: {
        async retrieve() {
          return { customer: 'cus_annual', setup_intent: { payment_method: 'pm_annual' } }
        },
        },
      },
    customers: {
      async update(customerId, payload) {
        customerUpdates.push({ customerId, payload })
      },
    },
    subscriptions: {
      async create() {
        subscriptionCreateCalls += 1
        throw new Error('Future annual Stripe subscriptions must stay disabled.')
      },
    },
  }

  const result = await createEnrollmentAnnualMembershipSubscriptions(pool, stripe, {
    preview: {
      additionalFees: {
        items: [{
          feeId: 7,
          name: 'Annual Membership',
          grossAmountCents: 8500,
          triggerType: 'once_per_year',
        }],
      },
    },
    stripeSession: 'cs_annual',
    familyBillingAccountId: 8,
    memberId: 12,
    purchasedAt: new Date('2026-08-31T12:00:00.000Z'),
    environment: { BILLING_STRIPE_SUBSCRIPTION_CREATION_MODE: 'disabled' },
  })

  assert.deepEqual(result, [{
    billingSubscriptionId: 91,
    stripeSubscriptionId: null,
    renewsOn: '2027-08-31',
    amountCents: 8500,
    autoRenewal: true,
    status: 'local_only',
  }])
  assert.equal(subscriptionCreateCalls, 0)
  assert.match(insertSql, /auto_renewal/)
  assert.match(insertSql, /TRUE/)
  assert.deepEqual(customerUpdates, [{
    customerId: 'cus_annual',
    payload: { invoice_settings: { default_payment_method: 'pm_annual' } },
  }])
})

test('annual ledger activation fails closed while a legacy annual Stripe collector is linked', async () => {
  const writes = []
  const pool = {
    async query(sql) {
      const text = String(sql)
      if (/SELECT first_name, last_name FROM member/.test(text)) {
        return { rows: [{ first_name: 'Legacy', last_name: 'Member' }] }
      }
      if (/SELECT id, stripe_subscription_id/.test(text)) {
        return { rows: [{ id: 44, stripe_subscription_id: 'sub_legacy_annual' }] }
      }
      writes.push(text)
      return { rows: [] }
    },
  }

  await assert.rejects(
    createEnrollmentAnnualMembershipSubscriptions(pool, null, {
      preview: {
        additionalFees: {
          items: [{
            feeId: 7,
            name: 'Annual Membership',
            grossAmountCents: 8500,
            triggerType: 'once_per_year',
          }],
        },
      },
      familyBillingAccountId: 8,
      memberId: 12,
      purchasedAt: new Date('2026-08-31T12:00:00.000Z'),
      environment: { BILLING_STRIPE_SUBSCRIPTION_CREATION_MODE: 'disabled' },
    }),
    (error) => (
      error?.code === 'ANNUAL_STRIPE_COLLECTOR_STILL_LINKED'
      && error.stripeSubscriptionId === 'sub_legacy_annual'
    ),
  )
  assert.equal(writes.length, 0)
})

test('cutover flags cannot revive class subscription creation and still retain the saved method', async () => {
  const queries = []
  let customerUpdates = 0
  let subscriptionCreateCalls = 0
  const pool = {
    async query(sql) {
      const text = String(sql)
      queries.push(text)
      if (/SELECT family_id FROM family_billing_account/.test(text)) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  const stripe = {
    customers: {
      async update() {
        customerUpdates += 1
      },
    },
    subscriptions: {
      async create() {
        subscriptionCreateCalls += 1
      },
    },
  }

  const result = await createEnrollmentStripeSubscriptions(pool, stripe, {
    preview: { firstMonth: { periodStart: '2026-08-01' } },
    signupIds: [1],
    familyBillingAccountId: 8,
    customerId: 'cus_8',
    defaultPaymentMethodId: 'pm_8',
    environment: {
      BILLING_COLLECTION_CUTOVER_ENABLED: 'true',
      BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'legacy',
      BILLING_STRIPE_SUBSCRIPTION_CREATION_MODE: 'disabled',
    },
  })

  assert.deepEqual(result, [])
  assert.equal(customerUpdates, 1)
  assert.equal(subscriptionCreateCalls, 0)
  assert.equal(queries.length, 1)
  assert.match(queries[0], /SELECT family_id FROM family_billing_account/)
})

test('formatPerClassStripeProductName distinguishes same class different times', () => {
  const a = formatPerClassStripeProductName({
    classTitle: 'Tramp & Tumble',
    scheduleLabel: 'Mondays 19:15–20:45',
    athleteName: 'Maddox',
  })
  const b = formatPerClassStripeProductName({
    classTitle: 'Tramp & Tumble',
    scheduleLabel: 'Wednesdays 18:00–19:30',
    athleteName: 'Maddox',
  })
  assert.notEqual(a, b)
  assert.match(a, /Mondays/)
  assert.match(b, /Wednesdays/)
})

test('pluralizeWeekdayLabel converts weekday names for recurring slots', () => {
  assert.equal(pluralizeWeekdayLabel('Tuesday · 14:00–18:00'), 'Tuesdays · 14:00–18:00')
})

test('formatEnrollmentCheckoutSubmitMessage covers first-month pay and family billing', () => {
  const message = formatEnrollmentCheckoutSubmitMessage()
  assert.match(message, /first-month tuition and any additional fees/i)
  assert.match(message, /assigned class start date/i)
  assert.match(message, /family billing account/i)
  assert.doesNotMatch(message, /own monthly subscription/i)
})

test('shouldShowEnrollmentCheckoutSubmitMessage is false for one-time class or event purchases', () => {
  const oneTimeOnly = {
    newSignups: [{ billingType: 'one_time', incrementalMonthly: 75 }],
  }
  assert.equal(enrollmentHasRecurringMembership(oneTimeOnly), false)
  assert.equal(shouldShowEnrollmentCheckoutSubmitMessage(oneTimeOnly), false)

  const passOnly = { newSignups: [], passPurchases: [{ programsId: 1, packageId: 2 }] }
  assert.equal(shouldShowEnrollmentCheckoutSubmitMessage(passOnly), false)
})

test('shouldShowEnrollmentCheckoutSubmitMessage is true for recurring membership enrollments', () => {
  const recurring = {
    newSignups: [{ billingType: 'recurring', incrementalMonthly: 150 }],
  }
  assert.equal(enrollmentHasRecurringMembership(recurring), true)
  assert.equal(shouldShowEnrollmentCheckoutSubmitMessage(recurring), true)
})

test('enrollmentHasRecurringMembership ignores zero-dollar recurring lines', () => {
  const preview = {
    newSignups: [{ billingType: 'recurring', incrementalMonthly: 0, monthlyPrice: 0 }],
  }
  assert.equal(enrollmentHasRecurringMembership(preview), false)
})

test('formatFirstMonthTuitionLineName uses tuition wording for a full remaining month', () => {
  const name = formatFirstMonthTuitionLineName({
    formTitle: 'Typhoons',
    proratedCents: 15000,
    remainingClasses: 4,
    classesPerMonth: 4,
    ratio: 1,
  })
  assert.match(name, /first month tuition/i)
  assert.doesNotMatch(name, /prorated/i)
})

test('formatFirstMonthTuitionLineName uses prorated wording for partial months', () => {
  const name = formatFirstMonthTuitionLineName({
    formTitle: 'Typhoons',
    proratedCents: 7500,
    remainingClasses: 2,
    classesPerMonth: 4,
    ratio: 0.5,
  })
  assert.match(name, /first month \(prorated\)/i)
})

test('computeFirstMonthTuitionLineItems separates prorated and prepaid per class', () => {
  const preview = {
    firstMonth: {
      enabled: true,
      items: [
        {
          slotKey: 'a',
          formTitle: 'Typhoons',
          proratedCents: 11250,
          prepaidFirstMonthCents: 0,
          remainingClasses: 3,
          classesPerMonth: 4,
          ratio: 0.75,
        },
        {
          slotKey: 'b',
          displayLine: 'Future Class',
          proratedCents: 0,
          prepaidFirstMonthCents: 15000,
        },
      ],
    },
  }
  const lines = computeFirstMonthTuitionLineItems(preview)
  assert.equal(lines.length, 2)
  assert.equal(lines[0].amountCents, 11250)
  assert.match(lines[0].name, /prorated/i)
  assert.equal(lines[1].amountCents, 15000)
  assert.match(lines[1].name, /prepaid/i)
})

test('computeFirstMonthBillingAnchorDate uses next 1st after in-session tuition paid now', () => {
  const anchor = computeFirstMonthBillingAnchorDate(
    {
      proratedCents: 15000,
      classStartsFutureMonth: false,
      firstBillDate: '2026-08-01',
    },
    '2026-07-04',
  )
  assert.equal(anchor, '2026-08-01')
})

test('computeFirstMonthBillingAnchorDate defers recurring until month after prepaid service month', () => {
  const anchor = computeFirstMonthBillingAnchorDate(
    {
      proratedCents: 0,
      prepaidFirstMonthCents: 15000,
      classStartsFutureMonth: true,
      firstBillDate: '2026-09-01',
    },
    '2026-07-04',
  )
  assert.equal(anchor, firstOfNextMonth('2026-09-01'))
})

test('computeSubscriptionBillingAnchorDate picks latest anchor across lines', () => {
  const preview = {
    firstMonth: {
      enabled: true,
      items: [
        {
          proratedCents: 15000,
          classStartsFutureMonth: false,
          firstBillDate: '2026-08-01',
        },
        {
          prepaidFirstMonthCents: 15000,
          classStartsFutureMonth: true,
          firstBillDate: '2026-09-01',
        },
      ],
    },
  }
  assert.equal(computeSubscriptionBillingAnchorDate(preview, '2026-07-04'), '2026-10-01')
})

test('computeEnrollmentDueNowCents matches fees plus first-month tuition', () => {
  const preview = {
    additionalFeesOneTime: 85,
    firstMonth: { totalCents: 15000 },
    passPurchaseTotalCents: 0,
    carriedForward: { totalCents: 0 },
  }
  assert.equal(computeEnrollmentDueNowCents(preview), 23500)
})

test('resolveEnrollmentCheckoutMode uses payment for due-now and setup when only recurring', () => {
  const withDueNow = {
    additionalFeesOneTime: 85,
    firstMonth: { totalCents: 15000 },
    newSignups: [{ billingType: 'recurring', incrementalMonthly: 150 }],
  }
  assert.equal(resolveEnrollmentCheckoutMode(withDueNow), 'payment')

  const recurringOnly = {
    additionalFeesOneTime: 0,
    firstMonth: { totalCents: 0 },
    newSignups: [{ billingType: 'recurring', incrementalMonthly: 150 }],
  }
  assert.equal(resolveEnrollmentCheckoutMode(recurringOnly), 'setup')
})

test('resolvePerClassMonthlyAmountCents prefers ledger net then first-month net', () => {
  const preview = {
    firstMonth: {
      items: [{ slotKey: 'a:1:2', monthlyNetCents: 12000 }],
    },
    discounts: {
      enabled: true,
      lines: [{ key: 'a:1:2', finalCents: 14000 }],
    },
    newSignups: [{ slotKey: 'a:1:2', incrementalMonthly: 150 }],
  }
  assert.equal(resolvePerClassMonthlyAmountCents(preview, 'a:1:2', { netMonthlyCents: 11000 }), 11000)
  assert.equal(resolvePerClassMonthlyAmountCents(preview, 'a:1:2'), 12000)
  assert.equal(
    resolvePerClassMonthlyAmountCents(
      { ...preview, firstMonth: { items: [] } },
      'a:1:2',
    ),
    14000,
  )
})

test('stripSignupBatchPayload drops analytics before signup Joi validation', async () => {
  const { stripSignupBatchPayload } = await import('../stripeEnrollmentCheckout.js')
  const stripped = stripSignupBatchPayload({
    signups: [{ formId: 1, slotGroupId: 2 }],
    signupAuthToken: 'tok',
    analytics: { gaClientId: 'x', gaSessionId: 'y' },
  })
  assert.equal('analytics' in stripped, false)
  assert.equal(stripped.signupAuthToken, 'tok')
  assert.equal(stripped.signups.length, 1)
})

test('checkout member resolution rejects a forged memberId in an unsigned JWT payload', async () => {
  const validToken = issueSignupAuthToken({
    formId: 12,
    memberId: 61,
    email: 'athlete@example.com',
    programsId: 5,
  })
  const [header, payload, signature] = validToken.split('.')
  const forgedClaims = JSON.parse(Buffer.from(payload, 'base64url').toString('utf8'))
  forgedClaims.memberId = 9999
  const forgedPayload = Buffer.from(JSON.stringify(forgedClaims)).toString('base64url')
  const forgedToken = `${header}.${forgedPayload}.${signature}`

  await assert.rejects(
    resolveVerifiedEnrollmentMemberId(
      { query: async () => ({ rows: [{ programs_id: 5 }] }) },
      { signupAuthToken: forgedToken, signups: [{ formId: 12 }] },
      13,
    ),
    (error) => error?.code === 'ENROLLMENT_CHECKOUT_TOKEN_INVALID',
  )
})

test('resolveSubscriptionTrialEndUnix clamps past anchors into the future', async () => {
  const { resolveSubscriptionTrialEndUnix } = await import('../stripeEnrollmentCheckout.js')
  const nowSec = Math.floor(Date.UTC(2026, 6, 27, 12, 0, 0) / 1000)
  const past = resolveSubscriptionTrialEndUnix('2020-01-01', nowSec)
  assert.equal(past, nowSec + 60)
  const future = resolveSubscriptionTrialEndUnix('2026-09-01', nowSec)
  assert.ok(future > nowSec + 60)
})

test('verified athlete token keeps child fee scope instead of using the payer id', async () => {
  const token = issueSignupAuthToken({
    formId: 31,
    memberId: 62,
    email: 'child@example.com',
    programsId: 7,
    actorMemberId: 13,
    familyBillingAccountId: 8,
    authorityGrant: 'household_payer',
  })
  assert.equal(
    await resolveVerifiedEnrollmentMemberId(
      { query: async () => ({ rows: [{ programs_id: 7 }] }) },
      { signupAuthToken: token, signups: [{ formId: 31 }] },
      13,
      { familyBillingAccountId: 8 },
    ),
    62,
  )
})

test('verified athlete token rejects a delegated actor that is not the authenticated payer', async () => {
  const token = issueSignupAuthToken({
    formId: 31,
    memberId: 62,
    email: 'child@example.com',
    programsId: 7,
    actorMemberId: 14,
    familyBillingAccountId: 8,
    authorityGrant: 'household_payer',
  })
  await assert.rejects(
    resolveVerifiedEnrollmentMemberId(
      { query: async () => ({ rows: [{ programs_id: 7 }] }) },
      { signupAuthToken: token, signups: [{ formId: 31 }] },
      13,
      { familyBillingAccountId: 8 },
    ),
    (error) => error?.code === 'ENROLLMENT_CHECKOUT_FORBIDDEN',
  )
})

test('pending enrollment token refresh preserves durable payer and billing-account authority', async () => {
  const refreshed = await refreshSignupAuthForCommit(
    {
      async query(sql) {
        if (/SELECT \* FROM member WHERE id = \$1/.test(String(sql))) {
          return { rows: [{ id: 62, email: 'child@example.com', is_active: true }] }
        }
        if (/SELECT programs_id FROM scheduling_form/.test(String(sql))) {
          return { rows: [{ programs_id: 7 }] }
        }
        throw new Error(`Unexpected query: ${sql}`)
      },
    },
    { signups: [{ formId: 31 }], signupAuthToken: 'expired-token' },
    62,
    { actorMemberId: 13, familyBillingAccountId: 8 },
  )
  const decoded = verifySignupAuthToken(refreshed.signupAuthToken, 31, { programsId: 7 })
  assert.deepEqual(decoded.signupAuthority, {
    version: 1,
    actorMemberId: 13,
    targetMemberId: 62,
    familyBillingAccountId: 8,
    grant: 'pending_checkout',
  })
})

test('pass-only pending enrollment refresh preserves payer authority without a form id', async () => {
  const refreshed = await refreshSignupAuthForCommit(
    {
      async query(sql) {
        if (/SELECT \* FROM member WHERE id = \$1/.test(String(sql))) {
          return { rows: [{ id: 62, email: 'child@example.com', is_active: true }] }
        }
        throw new Error(`Unexpected query: ${sql}`)
      },
    },
    { signups: [{ lineType: 'multi_class_pass', programsId: 7, packageId: 'ten' }] },
    62,
    { actorMemberId: 13, familyBillingAccountId: 8 },
  )
  const decoded = verifySignupAuthToken(refreshed.signupAuthToken, null, { programsId: 7 })
  assert.equal(decoded.signupAuthority.actorMemberId, 13)
  assert.equal(decoded.signupAuthority.familyBillingAccountId, 8)
  assert.equal(decoded.signupAuthority.grant, 'pending_checkout')
})

test('pending checkout session binding rejects a stale or foreign payer', () => {
  assert.throws(
    () => assertEnrollmentCheckoutSessionBinding(
      {
        id: 44,
        family_billing_account_id: 8,
        member_id: 62,
        payer_member_id: 13,
        stripe_checkout_session_id: 'cs_test_44',
      },
      {
        id: 'cs_test_44',
        metadata: {
          checkoutType: 'enrollment',
          pendingEnrollmentId: '44',
          familyBillingAccountId: '8',
          memberId: '62',
          payerMemberId: '14',
        },
      },
    ),
    (error) => error?.code === 'ENROLLMENT_CHECKOUT_FORBIDDEN',
  )
})

function enrollmentMemberScopePool({
  account = { id: 8, familyId: 20, payerMemberId: 13, active: true },
  members = [],
  memberships = [],
} = {}) {
  return {
    async query(sql, [accountId, memberId, payerMemberId]) {
      assert.match(String(sql), /account\.is_active = TRUE/)
      assert.match(String(sql), /member\.is_active = TRUE/)
      assert.match(String(sql), /membership\.is_active = TRUE/)
      assert.match(String(sql), /NOT EXISTS[\s\S]*historical_membership/)
      const member = members.find((row) => Number(row.id) === Number(memberId))
      const anyMembership = memberships.some((row) => Number(row.memberId) === Number(memberId))
      const activeMembership = memberships.some(
        (row) =>
          Number(row.memberId) === Number(memberId) &&
          Number(row.familyId) === Number(account.familyId) &&
          row.active === true,
      )
      const directFamilyFallback =
        Number(member?.familyId) === Number(account.familyId) && !anyMembership
      const authorized =
        Number(account.id) === Number(accountId) &&
        account.active === true &&
        member?.active === true &&
        (payerMemberId == null || Number(account.payerMemberId) === Number(payerMemberId)) &&
        (activeMembership || directFamilyFallback)
      return { rows: authorized ? [{ id: Number(memberId) }] : [] }
    },
  }
}

test('checkout scope rejects a member from another family', async () => {
  const pool = enrollmentMemberScopePool({
    members: [{ id: 62, familyId: 99, active: true }],
  })
  await assert.rejects(
    assertEnrollmentCheckoutMemberScope(pool, {
      familyBillingAccountId: 8,
      memberId: 62,
      payerMemberId: 13,
    }),
    (error) => error?.code === 'ENROLLMENT_CHECKOUT_FORBIDDEN',
  )
})

test('checkout scope rejects inactive family links and inactive members', async (t) => {
  await t.test('inactive family_member link disables direct-family fallback', async () => {
    const pool = enrollmentMemberScopePool({
      members: [{ id: 62, familyId: 20, active: true }],
      memberships: [{ familyId: 20, memberId: 62, active: false }],
    })
    await assert.rejects(
      assertEnrollmentCheckoutMemberScope(pool, {
        familyBillingAccountId: 8,
        memberId: 62,
      }),
      (error) => error?.code === 'ENROLLMENT_CHECKOUT_FORBIDDEN',
    )
  })

  await t.test('inactive member is denied despite an active family_member link', async () => {
    const pool = enrollmentMemberScopePool({
      members: [{ id: 62, familyId: 20, active: false }],
      memberships: [{ familyId: 20, memberId: 62, active: true }],
    })
    await assert.rejects(
      assertEnrollmentCheckoutMemberScope(pool, {
        familyBillingAccountId: 8,
        memberId: 62,
      }),
      (error) => error?.code === 'ENROLLMENT_CHECKOUT_FORBIDDEN',
    )
  })
})

test('checkout scope accepts the legacy direct-family fallback only without link history', async () => {
  const pool = enrollmentMemberScopePool({
    members: [{ id: 62, familyId: 20, active: true }],
  })
  assert.equal(
    await assertEnrollmentCheckoutMemberScope(pool, {
      familyBillingAccountId: 8,
      memberId: 62,
      payerMemberId: 13,
    }),
    62,
  )
})

test('checkout scope accepts an active family_member child link', async () => {
  const pool = enrollmentMemberScopePool({
    members: [{ id: 62, familyId: null, active: true }],
    memberships: [{ familyId: 20, memberId: 62, active: true }],
  })
  assert.equal(
    await assertEnrollmentCheckoutMemberScope(pool, {
      familyBillingAccountId: 8,
      memberId: 62,
      payerMemberId: 13,
    }),
    62,
  )
})

test('pending checkout authorization blocks webhook recovery for an out-of-family athlete', async () => {
  let queryCount = 0
  const scopePool = enrollmentMemberScopePool({
    members: [{ id: 62, familyId: 99, active: true }],
  })
  const pool = {
    async query(sql, params) {
      queryCount += 1
      if (/FROM stripe_pending_enrollment pending/.test(String(sql))) {
        return {
          rows: [{
            id: 44,
            family_billing_account_id: 8,
            member_id: 62,
            stripe_checkout_session_id: 'cs_test_44',
            status: 'pending',
            family_id: 20,
            payer_member_id: 13,
          }],
        }
      }
      return scopePool.query(sql, params)
    },
  }

  await assert.rejects(
    authorizePendingEnrollmentCheckout(pool, {
      pendingEnrollmentId: 44,
      stripeSession: {
        id: 'cs_test_44',
        metadata: {
          checkoutType: 'enrollment',
          pendingEnrollmentId: '44',
          familyBillingAccountId: '8',
          memberId: '62',
          payerMemberId: '13',
        },
      },
    }),
    (error) => error?.code === 'ENROLLMENT_CHECKOUT_FORBIDDEN',
  )
  assert.equal(queryCount, 2)
})

test('pending checkout confirmation requires the authenticated payer family', async () => {
  const pool = {
    async query(sql) {
      assert.match(String(sql), /FROM stripe_pending_enrollment pending/)
      return {
        rows: [{
          id: 44,
          family_billing_account_id: 8,
          member_id: 62,
          stripe_checkout_session_id: 'cs_test_44',
          status: 'pending',
          family_id: 20,
          payer_member_id: 13,
        }],
      }
    },
  }
  await assert.rejects(
    authorizePendingEnrollmentCheckout(pool, {
      pendingEnrollmentId: 44,
      expectedFamilyId: 21,
      expectedPayerMemberId: 13,
    }),
    (error) => error?.code === 'ENROLLMENT_CHECKOUT_FORBIDDEN',
  )
})

test('stale subscription-mode enrollment checkout is quarantined before signup commit', async () => {
  const writes = []
  const scopePool = enrollmentMemberScopePool({
    members: [{ id: 62, familyId: 20, active: true }],
  })
  const pending = {
    id: 44,
    family_billing_account_id: 8,
    member_id: 62,
    stripe_checkout_session_id: 'cs_test_44',
    status: 'pending',
    family_id: 20,
    payer_member_id: 13,
  }
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (/FROM stripe_pending_enrollment pending/.test(text)) return { rows: [pending] }
      if (/UPDATE stripe_pending_enrollment/.test(text) && /error_message = \$2/.test(text)) {
        writes.push({ text, params })
        return { rows: [] }
      }
      if (/INSERT INTO stripe_billing_alert/.test(text)) {
        writes.push({ text, params })
        return { rows: [] }
      }
      return scopePool.query(sql, params)
    },
  }
  const session = {
    id: 'cs_test_44',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    subscription: 'sub_stale_44',
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: '44',
      familyBillingAccountId: '8',
      memberId: '62',
      payerMemberId: '13',
    },
  }

  await assert.rejects(
    commitPendingEnrollment(pool, {
      pendingEnrollmentId: 44,
      stripeSession: session,
    }),
    (error) => (
      error?.code === 'STRIPE_CHECKOUT_SUBSCRIPTION_MODE_FORBIDDEN'
      && error.stripeSubscriptionId === 'sub_stale_44'
    ),
  )
  assert.equal(writes.some(({ text }) => /SET status = 'processing'/.test(text)), false)
  assert.equal(writes.filter(({ text }) => /UPDATE stripe_pending_enrollment/.test(text)).length, 1)
  assert.equal(writes.filter(({ text }) => /INSERT INTO stripe_billing_alert/.test(text)).length, 1)
  assert.match(String(writes[0].params[1]), /sub_stale_44/)
})
