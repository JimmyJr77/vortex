import test from 'node:test'
import assert from 'node:assert/strict'
import {
  assertEnrollmentCheckoutMemberScope,
  assertEnrollmentCheckoutSessionBinding,
  assertPaidEnrollmentCheckoutSettlementBinding,
  authorizePendingEnrollmentCheckout,
  buildCheckoutLineItems,
  computeEnrollmentCheckoutCarriedBalanceCents,
  computeEnrollmentDueNowCents,
  computeFirstMonthBillingAnchorDate,
  computeFirstMonthTuitionLineItems,
  computeSubscriptionBillingAnchorDate,
  commitPendingEnrollment,
  createAndBindEnrollmentCheckoutSession,
  createEnrollmentAnnualMembershipSubscriptions,
  createEnrollmentStripeSubscriptions,
  enrollmentCheckoutSessionCanFinalize,
  enrollmentHasRecurringMembership,
  formatEnrollmentCheckoutSubmitMessage,
  formatFirstMonthTuitionLineName,
  formatPerClassStripeProductName,
  preserveEnrollmentCheckoutPaymentMethod,
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

function paymentMethodPreservationPool({
  accountId = 8,
  customerIds = ['cus_8'],
  familyId = null,
  extraQuery = null,
} = {}) {
  const statements = []
  let canonicalReads = 0
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      statements.push(text)
      if (/pg_advisory_(?:lock|unlock)/.test(text)) return { rows: [{}] }
      if (/stripe-enrollment-payment-method:canonical-account/.test(text)) {
        const customerId = customerIds[Math.min(canonicalReads, customerIds.length - 1)]
        canonicalReads += 1
        return {
          rows: customerId == null ? [] : [{
            id: accountId,
            stripe_customer_id: customerId,
            stripe_customer_owner_count: 1,
            is_active: true,
          }],
        }
      }
      if (/SELECT family_id FROM family_billing_account/.test(text)) {
        return { rows: familyId == null ? [] : [{ family_id: familyId }] }
      }
      if (extraQuery) {
        const result = await extraQuery(text, params)
        if (result != null) return result
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  return {
    pool,
    statements,
    canonicalReadCount: () => canonicalReads,
  }
}

function enrollmentPaymentMethodStripe({
  sessionCustomerId = 'cus_8',
  paymentMethodCustomerId = 'cus_8',
  remoteCustomerId = 'cus_8',
  remoteCustomerOwner = '8',
} = {}) {
  const updates = []
  return {
    updates,
    stripe: {
      checkout: {
        sessions: {
          async retrieve() {
            return {
              id: 'cs_8',
              mode: 'payment',
              status: 'complete',
              payment_status: 'paid',
              customer: sessionCustomerId,
              metadata: {
                checkoutType: 'enrollment',
                familyBillingAccountId: '8',
              },
              payment_intent: {
                id: 'pi_8',
                status: 'succeeded',
                customer: sessionCustomerId,
                payment_method: 'pm_8',
              },
            }
          },
        },
      },
      customers: {
        async retrieve() {
          return {
            id: remoteCustomerId,
            metadata: { familyBillingAccountId: remoteCustomerOwner },
          }
        },
        async update(customerId, payload) {
          updates.push({ customerId, payload })
        },
      },
      paymentMethods: {
        async retrieve() {
          return { id: 'pm_8', customer: paymentMethodCustomerId, type: 'card' }
        },
      },
    },
  }
}

function carriedBalanceEnrollmentPreview() {
  return {
    additionalFeesOneTime: 0,
    additionalFees: { items: [] },
    firstMonth: {
      enabled: true,
      totalCents: 1000,
      items: [{
        displayLine: 'Gymnastics',
        proratedCents: 1000,
        prepaidFirstMonthCents: 0,
        classesPerMonth: 4,
        remainingClasses: 2,
        ratio: 0.5,
      }],
    },
    passPurchaseTotalCents: 0,
    passPurchases: [],
    carriedForward: { totalCents: 5000 },
    estimatedMonthlyTotal: 0,
    newSignups: [],
  }
}

function enrollmentCheckoutCreationHarness({
  conflict = null,
  purchaseConflict = null,
  failFirstCreate = false,
} = {}) {
  const preview = carriedBalanceEnrollmentPreview()
  const requestFingerprint = 'a'.repeat(64)
  const state = {
    pending: null,
    lockDepth: 0,
    createCalls: 0,
    createLockDepths: [],
    createIdempotencyKeys: [],
    previewLoads: 0,
    queries: [],
    sessions: [],
  }
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      state.queries.push({ text, params })
      if (/pg_advisory_lock/.test(text)) {
        state.lockDepth += 1
        return { rows: [{}] }
      }
      if (/pg_advisory_unlock/.test(text)) {
        state.lockDepth -= 1
        return { rows: [{ pg_advisory_unlock: true }] }
      }
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
      if (/FROM family_billing_account account/.test(text) && /FOR UPDATE/.test(text)) {
        return {
          rows: [{
            id: 8,
            family_id: 20,
            payer_member_id: 13,
            billing_email: 'payer@example.test',
            stripe_customer_id: 'cus_8',
            stripe_customer_owner_count: 1,
            is_active: true,
          }],
        }
      }
      if (/JOIN member ON member\.id = \$2/.test(text)) return { rows: [{ id: 62 }] }
      if (/FROM stripe_pending_enrollment pending/.test(text) && /JOIN family_billing_account account/.test(text)) {
        return {
          rows: state.pending ? [{
            ...state.pending,
            family_id: 20,
            payer_member_id: 13,
            stripe_customer_id: 'cus_8',
            stripe_customer_owner_count: 1,
            is_active: true,
          }] : [],
        }
      }
      if (/FROM stripe_pending_enrollment/.test(text) && /request_key = \$2/.test(text)) {
        return { rows: state.pending ? [{ ...state.pending }] : [] }
      }
      if (/SELECT owner_kind, owner_id, owner_status/.test(text)) {
        const owner = /annual_membership_checkout_request/.test(text)
          ? purchaseConflict
          : conflict
        return { rows: owner ? [owner] : [] }
      }
      if (/WITH active_enrollment_checkout AS/.test(text)) return { rows: [] }
      if (/WITH completed_owner AS/.test(text)) return { rows: [] }
      if (/INSERT INTO stripe_pending_enrollment/.test(text)) {
        state.pending = {
          id: 44,
          family_billing_account_id: params[0],
          member_id: params[1],
          payload: JSON.parse(params[2]),
          preview_snapshot: JSON.parse(params[3]),
          due_now_cents: params[4],
          checkout_mode: params[5],
          status: 'pending',
          request_key: params[6],
          request_fingerprint: params[7],
          stripe_checkout_session_id: null,
          stripe_checkout_session_url: null,
        }
        return { rows: [{ ...state.pending }] }
      }
      if (/UPDATE stripe_pending_enrollment/.test(text) && /expires_at = to_timestamp/.test(text)) {
        state.pending = {
          ...state.pending,
          stripe_checkout_session_id: params[1],
          stripe_checkout_session_url: params[5] === 'open' ? params[2] : null,
          expires_at: new Date(params[4] * 1000),
          status: params[5] === 'expired' ? 'expired' : state.pending.status,
          error_message: params[5] === 'expired' ? 'Stripe Checkout Session expired.' : null,
        }
        return { rows: [{ ...state.pending }] }
      }
      throw new Error(`Unexpected enrollment creation query: ${text}`)
    },
  }
  const stripe = {
    customers: {
      async retrieve(customerId) {
        return { id: customerId, metadata: { familyBillingAccountId: '8' } }
      },
    },
    checkout: {
      sessions: {
        async create(params, options) {
          state.createCalls += 1
          state.createLockDepths.push(state.lockDepth)
          state.createIdempotencyKeys.push(options.idempotencyKey)
          if (failFirstCreate && state.createCalls === 1) {
            throw new Error('simulated lost Stripe create response')
          }
          const session = {
            id: 'cs_enrollment_44',
            mode: 'payment',
            status: 'open',
            payment_status: 'unpaid',
            amount_total: 6000,
            currency: 'usd',
            customer: 'cus_8',
            url: 'https://checkout.test/cs_enrollment_44',
            expires_at: 2_000_000_000,
            metadata: params.metadata,
          }
          state.sessions.push({ params, options, session })
          return session
        },
        async retrieve(sessionId) {
          const found = state.sessions.find(({ session }) => session.id === sessionId)?.session
          if (!found) throw new Error(`Unknown test Checkout Session ${sessionId}`)
          return found
        },
      },
    },
  }
  const options = {
    account: {
      id: 8,
      family_id: 20,
      payer_member_id: 13,
      stripe_customer_id: 'cus_8',
      billing_email: 'payer@example.test',
    },
    enrolledMemberId: 62,
    payerMemberId: 13,
    batchPayload: { signups: [] },
    successUrl: 'https://app.test/success',
    cancelUrl: 'https://app.test/cancel',
    requestKey: 'enrollment-request-44',
    requestFingerprint,
    previewRequest: {},
    loadPreview: async () => {
      state.previewLoads += 1
      return preview
    },
  }
  return { pool, stripe, state, options, preview }
}

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
  const { pool } = paymentMethodPreservationPool()
  const stripe = {
    checkout: {
      sessions: {
        async retrieve() {
          return {
            id: 'cs_8',
            mode: 'setup',
            status: 'complete',
            customer: 'cus_8',
            metadata: {
              checkoutType: 'enrollment',
              familyBillingAccountId: '8',
            },
            setup_intent: {
              id: 'seti_8',
              status: 'succeeded',
              customer: 'cus_8',
              payment_method: 'pm_8',
            },
          }
        },
      },
    },
    customers: {
      async retrieve() {
        return { id: 'cus_8', metadata: { familyBillingAccountId: '8' } }
      },
      async update(customerId, payload) {
        updates.push({ customerId, payload })
      },
    },
    paymentMethods: {
      async retrieve() {
        return { id: 'pm_8', customer: 'cus_8', type: 'card' }
      },
    },
    subscriptions: {
      async create() {
        remoteCreationCalls += 1
      },
    },
  }
  const result = await createEnrollmentStripeSubscriptions(pool, stripe, {
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
  const { pool } = paymentMethodPreservationPool({
    customerIds: ['cus_annual'],
    extraQuery: async (text) => {
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
      return null
    },
  })
  const stripe = {
    checkout: {
      sessions: {
        async retrieve() {
          return {
            id: 'cs_annual',
            mode: 'payment',
            status: 'complete',
            payment_status: 'paid',
            customer: 'cus_annual',
            metadata: {
              checkoutType: 'enrollment',
              familyBillingAccountId: '8',
            },
            payment_intent: {
              id: 'pi_annual',
              status: 'succeeded',
              customer: 'cus_annual',
              payment_method: 'pm_annual',
            },
          }
        },
      },
    },
    customers: {
      async retrieve() {
        return { id: 'cus_annual', metadata: { familyBillingAccountId: '8' } }
      },
      async update(customerId, payload) {
        customerUpdates.push({ customerId, payload })
      },
    },
    paymentMethods: {
      async retrieve() {
        return { id: 'pm_annual', customer: 'cus_annual', type: 'link' }
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
  let customerUpdates = 0
  let subscriptionCreateCalls = 0
  const { pool, statements } = paymentMethodPreservationPool()
  const stripe = {
    customers: {
      async retrieve() {
        return { id: 'cus_8', metadata: { familyBillingAccountId: '8' } }
      },
      async update() {
        customerUpdates += 1
      },
    },
    paymentMethods: {
      async retrieve() {
        return { id: 'pm_8', customer: 'cus_8', type: 'card' }
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
  assert.equal(statements.filter((sql) => /canonical-account/.test(sql)).length, 2)
  assert.equal(statements.some((sql) => /^BEGIN|^COMMIT/.test(sql)), false)
  assert.match(statements.at(-1), /SELECT family_id FROM family_billing_account/)
})

test('payment-method preservation rejects a Checkout Session owned by another customer', async () => {
  const { pool } = paymentMethodPreservationPool()
  const { stripe, updates } = enrollmentPaymentMethodStripe({
    sessionCustomerId: 'cus_foreign',
  })

  await assert.rejects(
    preserveEnrollmentCheckoutPaymentMethod(pool, stripe, {
      stripeSession: 'cs_8',
      familyBillingAccountId: 8,
    }),
    (error) => error?.code === 'STRIPE_ENROLLMENT_PAYMENT_METHOD_BINDING_CONFLICT',
  )
  assert.equal(updates.length, 0)
})

test('payment-method preservation rejects a method attached to another customer', async () => {
  const { pool } = paymentMethodPreservationPool()
  const { stripe, updates } = enrollmentPaymentMethodStripe({
    paymentMethodCustomerId: 'cus_foreign',
  })

  await assert.rejects(
    preserveEnrollmentCheckoutPaymentMethod(pool, stripe, {
      stripeSession: 'cs_8',
      familyBillingAccountId: 8,
    }),
    (error) => error?.code === 'STRIPE_ENROLLMENT_PAYMENT_METHOD_BINDING_CONFLICT',
  )
  assert.equal(updates.length, 0)
})

test('payment-method preservation fails closed if the canonical customer changes during Stripe verification', async () => {
  const { pool, statements, canonicalReadCount } = paymentMethodPreservationPool({
    customerIds: ['cus_8', 'cus_reassigned'],
  })
  const { stripe, updates } = enrollmentPaymentMethodStripe()

  await assert.rejects(
    preserveEnrollmentCheckoutPaymentMethod(pool, stripe, {
      stripeSession: 'cs_8',
      familyBillingAccountId: 8,
    }),
    (error) => (
      error?.code === 'STRIPE_ENROLLMENT_PAYMENT_METHOD_BINDING_CONFLICT'
      && /changed during payment-method verification/.test(error.message)
    ),
  )
  assert.equal(canonicalReadCount(), 2)
  assert.equal(updates.length, 0)
  assert.match(statements[0], /pg_advisory_lock/)
  assert.match(statements.at(-1), /pg_advisory_unlock/)
  assert.equal(statements.some((sql) => /^BEGIN|^COMMIT|^ROLLBACK/.test(sql)), false)
  const ownershipQuery = statements.find((sql) => /stripe_customer_owner_count/.test(sql))
  assert.doesNotMatch(ownershipQuery, /customer_owner\.is_active/)
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

test('enrollment Checkout includes the exact carried account-balance slice as a line item', async () => {
  const preview = carriedBalanceEnrollmentPreview()
  const lines = await buildCheckoutLineItems({ query: async () => ({ rows: [] }) }, preview)
  const total = lines.reduce(
    (sum, line) => sum + Number(line.price_data?.unit_amount ?? 0) * Number(line.quantity ?? 1),
    0,
  )
  assert.equal(computeEnrollmentCheckoutCarriedBalanceCents(preview), 5000)
  assert.equal(total, computeEnrollmentDueNowCents(preview))
  assert.deepEqual(lines.at(-1), {
    quantity: 1,
    price_data: {
      currency: 'usd',
      unit_amount: 5000,
      product_data: { name: 'Vortex Athletics account balance' },
    },
  })
})

test('carried-balance enrollment creation holds the account lock through reservation and Stripe binding', async () => {
  const { pool, stripe, state, options } = enrollmentCheckoutCreationHarness()
  const result = await createAndBindEnrollmentCheckoutSession(pool, stripe, options)

  assert.equal(result.pendingEnrollmentId, 44)
  assert.equal(result.session.id, 'cs_enrollment_44')
  assert.deepEqual(state.createLockDepths, [1])
  assert.equal(state.lockDepth, 0)
  assert.equal(state.pending.stripe_checkout_session_id, 'cs_enrollment_44')
  assert.equal(state.pending.expires_at.toISOString(), '2033-05-18T03:33:20.000Z')
  assert.match(
    state.sessions[0].options.idempotencyKey,
    /^member-enrollment-checkout:8:[0-9a-f]{64}$/,
  )
  assert.equal(
    state.sessions[0].params.line_items.reduce(
      (sum, line) => sum + Number(line.price_data?.unit_amount ?? 0),
      0,
    ),
    6000,
  )
  const outerLock = state.queries.findIndex(({ text }) => /pg_advisory_lock/.test(text))
  const inserted = state.queries.findIndex(({ text }) => /INSERT INTO stripe_pending_enrollment/.test(text))
  const linked = state.queries.findIndex(({ text }) => /expires_at = to_timestamp/.test(text))
  const finalUnlock = state.queries.findLastIndex(({ text }) => /pg_advisory_unlock/.test(text))
  assert.ok(outerLock >= 0 && outerLock < inserted && inserted < linked && linked < finalUnlock)
})

test('carried-balance enrollment creation rejects an existing collector before creating Stripe Session', async () => {
  const { pool, stripe, state, options } = enrollmentCheckoutCreationHarness({
    conflict: { owner_kind: 'monthly_invoice', owner_id: 91, owner_status: 'open' },
  })
  await assert.rejects(
    createAndBindEnrollmentCheckoutSession(pool, stripe, options),
    (error) => (
      error?.code === 'ENROLLMENT_CHECKOUT_COLLECTION_CONFLICT'
      && error.ownerKind === 'monthly_invoice'
      && error.ownerId === 91
    ),
  )
  assert.equal(state.createCalls, 0)
  assert.equal(state.pending, null)
  assert.equal(state.lockDepth, 0)
})

test('enrollment creation rejects an active annual-membership Checkout even without carried balance', async () => {
  const preview = carriedBalanceEnrollmentPreview()
  preview.carriedForward.totalCents = 0
  const { pool, stripe, state, options } = enrollmentCheckoutCreationHarness({
    purchaseConflict: {
      owner_kind: 'annual_membership',
      owner_id: 92,
      owner_status: 'pending',
    },
  })
  options.loadPreview = async () => preview
  await assert.rejects(
    createAndBindEnrollmentCheckoutSession(pool, stripe, options),
    (error) => (
      error?.code === 'ENROLLMENT_CHECKOUT_COLLECTION_CONFLICT'
      && error.ownerKind === 'annual_membership'
      && error.ownerId === 92
    ),
  )
  assert.equal(state.createCalls, 0)
  assert.equal(state.pending, null)
})

test('a different enrollment request key cannot open a second payable Checkout', async () => {
  const preview = carriedBalanceEnrollmentPreview()
  preview.carriedForward.totalCents = 0
  const { pool, stripe, state, options } = enrollmentCheckoutCreationHarness({
    purchaseConflict: {
      owner_kind: 'enrollment',
      owner_id: 43,
      owner_status: 'pending',
    },
  })
  options.loadPreview = async () => preview
  await assert.rejects(
    createAndBindEnrollmentCheckoutSession(pool, stripe, options),
    (error) => (
      error?.code === 'ENROLLMENT_CHECKOUT_COLLECTION_CONFLICT'
      && error.ownerKind === 'enrollment'
      && error.ownerId === 43
    ),
  )
  assert.equal(state.createCalls, 0)
  assert.equal(state.pending, null)
  const admissionQuery = state.queries.find(
    ({ text }) => /SELECT owner_kind, owner_id, owner_status/.test(text),
  )?.text
  assert.ok(admissionQuery)
  assert.doesNotMatch(admissionQuery, /expires_at\s*>\s*now\(\)/)
})

test('lost Stripe create response keeps reservation and same-key replay binds the exact Session', async () => {
  const { pool, stripe, state, options } = enrollmentCheckoutCreationHarness({
    failFirstCreate: true,
  })
  await assert.rejects(
    createAndBindEnrollmentCheckoutSession(pool, stripe, options),
    /simulated lost Stripe create response/,
  )
  assert.equal(state.pending.status, 'pending')
  assert.equal(state.pending.stripe_checkout_session_id, null)

  const replay = await createAndBindEnrollmentCheckoutSession(pool, stripe, options)
  assert.equal(replay.session.id, 'cs_enrollment_44')
  assert.equal(state.createCalls, 2)
  assert.deepEqual(state.createLockDepths, [1, 1])
  assert.equal(state.previewLoads, 1)
  assert.equal(new Set(state.createIdempotencyKeys).size, 1)
  assert.equal(state.pending.stripe_checkout_session_id, 'cs_enrollment_44')
  const activeGuardCall = state.queries.find(
    ({ text, params }) => /WITH active_enrollment_checkout AS/.test(text) && params[1] === 44,
  )
  assert.ok(activeGuardCall)
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
        due_now_cents: 5100,
        checkout_mode: 'payment',
        stripe_customer_id: 'cus_family',
        stripe_checkout_session_id: 'cs_test_44',
      },
      {
        id: 'cs_test_44',
        mode: 'payment',
        currency: 'usd',
        amount_total: 5100,
        customer: 'cus_family',
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

test('pending enrollment requires the exact account customer, USD amount, and Checkout session', () => {
  const pending = {
    id: 44,
    family_billing_account_id: 8,
    member_id: 62,
    payer_member_id: 13,
    due_now_cents: 5100,
    checkout_mode: 'payment',
    stripe_customer_id: 'cus_family',
    stripe_checkout_session_id: 'cs_test_44',
  }
  const session = {
    id: 'cs_test_44',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 5100,
    currency: 'usd',
    customer: 'cus_family',
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: '44',
      familyBillingAccountId: '8',
      memberId: '62',
      payerMemberId: '13',
    },
  }

  assert.doesNotThrow(() => assertEnrollmentCheckoutSessionBinding(pending, session))
  assert.equal(enrollmentCheckoutSessionCanFinalize(session, pending), true)
  for (const mismatch of [
    { amount_total: 5000 },
    { currency: 'cad' },
    { customer: 'cus_other' },
    { id: 'cs_other' },
  ]) {
    const changed = { ...session, ...mismatch }
    assert.throws(
      () => assertEnrollmentCheckoutSessionBinding(pending, changed),
      (error) => error?.code === 'ENROLLMENT_CHECKOUT_FORBIDDEN',
    )
    assert.equal(enrollmentCheckoutSessionCanFinalize(changed, pending), false)
  }
})

test('paid enrollment settlement binds to the exact durable pending owner without current customer state', () => {
  const pending = {
    id: 44,
    family_billing_account_id: 8,
    member_id: 62,
    due_now_cents: 5100,
    checkout_mode: 'payment',
    stripe_checkout_session_id: 'cs_test_44',
  }
  const session = {
    id: 'cs_test_44',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 5100,
    currency: 'usd',
    customer: 'cus_historical',
    payment_intent: 'pi_test_44',
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: '44',
      familyBillingAccountId: '8',
      memberId: '62',
      payerMemberId: '13',
    },
  }

  assert.deepEqual(assertPaidEnrollmentCheckoutSettlementBinding(pending, session), {
    pendingId: 44,
    accountId: 8,
    memberId: 62,
    payerMemberId: 13,
    expectedAmountCents: 5100,
  })
  assert.throws(
    () => assertPaidEnrollmentCheckoutSettlementBinding(pending, {
      ...session,
      id: 'cs_foreign',
    }),
    (error) => (
      error?.code === 'ENROLLMENT_CHECKOUT_SETTLEMENT_CONFLICT'
      && error.details.problems.includes('checkout_session_mismatch')
    ),
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

test('stale paid subscription-mode enrollment records cash before quarantine and grants no signup', async () => {
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
    due_now_cents: 5100,
    checkout_mode: 'subscription',
    stripe_customer_id: 'cus_family',
  }
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) {
        writes.push({ text, params })
        return { rows: [] }
      }
      if (/FROM stripe_pending_enrollment\s+WHERE id = \$1/.test(text)) return { rows: [pending] }
      if (/FROM stripe_pending_enrollment pending/.test(text)) return { rows: [pending] }
      if (/INSERT INTO billing_payment/.test(text)) {
        writes.push({ text, params })
        return { rows: [{
          id: 503,
          family_billing_account_id: 8,
          amount_cents: 5100,
          external_processor: 'stripe',
          external_status: params[9],
          stripe_customer_id: 'cus_family',
          stripe_payment_intent_id: null,
          stripe_checkout_session_id: 'cs_test_44',
          stripe_invoice_id: null,
          newly_inserted: true,
          note: params[10],
        }] }
      }
      if (/UPDATE billing_payment/.test(text)) {
        writes.push({ text, params })
        return { rows: [{
          id: 503,
          family_billing_account_id: 8,
          amount_cents: 5100,
          external_processor: 'stripe',
          external_status: 'reconciliation_required',
          stripe_customer_id: 'cus_family',
          stripe_payment_intent_id: null,
          stripe_checkout_session_id: 'cs_test_44',
          stripe_invoice_id: null,
          note: params[8],
        }] }
      }
      if (/UPDATE stripe_pending_enrollment/.test(text) && /error_message = \$2/.test(text)) {
        writes.push({ text, params })
        return { rows: /RETURNING status/.test(text) ? [{ status: 'failed' }] : [] }
      }
      if (/INSERT INTO stripe_billing_alert/.test(text)) {
        writes.push({ text, params })
        return { rows: [] }
      }
      if (/FROM billing_payment p/.test(text)) return { rows: [] }
      return scopePool.query(sql, params)
    },
  }
  const session = {
    id: 'cs_test_44',
    mode: 'subscription',
    status: 'complete',
    payment_status: 'paid',
    subscription: 'sub_stale_44',
    amount_total: 5100,
    currency: 'usd',
    customer: 'cus_family',
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: '44',
      familyBillingAccountId: '8',
      memberId: '62',
      payerMemberId: '13',
    },
  }

  const result = await commitPendingEnrollment(pool, {
    pendingEnrollmentId: 44,
    stripeSession: session,
  })
  assert.equal(result.status, 'quarantined')
  assert.equal(result.payment.external_status, 'reconciliation_required')
  assert.equal(writes.some(({ text }) => /SET status = 'processing'/.test(text)), false)
  assert.equal(writes.filter(({ text }) => /INSERT INTO billing_payment/.test(text)).length, 1)
  assert.equal(writes.filter(({ text }) => /UPDATE stripe_pending_enrollment/.test(text)).length, 1)
  assert.equal(writes.filter(({ text }) => /INSERT INTO stripe_billing_alert/.test(text)).length, 2)
  assert.equal(writes.filter(({ text }) => /UPDATE billing_payment/.test(text)).length, 1)
  const quarantineBegin = writes.findIndex(({ text }) => text === 'BEGIN')
  const ownerQuarantine = writes.findIndex(({ text }) => /UPDATE stripe_pending_enrollment/.test(text))
  const paymentQuarantine = writes.findIndex(({ text }) => /UPDATE billing_payment/.test(text))
  const quarantineCommit = writes.findIndex(({ text }, index) => index > paymentQuarantine && text === 'COMMIT')
  assert.ok(
    quarantineBegin >= 0
    && quarantineBegin < ownerQuarantine
    && ownerQuarantine < paymentQuarantine
    && paymentQuarantine < quarantineCommit,
  )
})

test('paid enrollment cash is recorded before inactive-account quarantine and replay stays quarantined', async () => {
  const calls = []
  let pendingStatus = 'pending'
  let pendingError = null
  let insertCount = 0
  let paymentStatus = 'settled'
  let paymentNote = null
  const pending = () => ({
    id: 44,
    family_billing_account_id: 8,
    member_id: 62,
    due_now_cents: 5100,
    checkout_mode: 'payment',
    stripe_checkout_session_id: 'cs_paid_inactive',
    status: pendingStatus,
    error_message: pendingError,
  })
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
      if (/FROM stripe_pending_enrollment\s+WHERE id = \$1/.test(text)) {
        return { rows: [pending()] }
      }
      if (/INSERT INTO billing_payment/.test(text)) {
        insertCount += 1
        return {
          rows: [{
            id: 501,
            family_billing_account_id: params[0],
            amount_cents: params[1],
            external_processor: 'stripe',
            external_status: insertCount === 1 ? params[10] : paymentStatus,
            stripe_customer_id: params[4],
            stripe_payment_intent_id: params[5],
            stripe_checkout_session_id: params[6],
            stripe_invoice_id: params[7],
            newly_inserted: insertCount === 1,
            note: insertCount === 1 ? params[11] : paymentNote,
          }],
        }
      }
      if (/FROM stripe_pending_enrollment pending/.test(text)) return { rows: [] }
      if (/UPDATE stripe_pending_enrollment/.test(text) && /RETURNING status/.test(text)) {
        pendingStatus = 'failed'
        pendingError = params[1]
        return { rows: [{ status: 'failed' }] }
      }
      if (/UPDATE billing_payment/.test(text)) {
        paymentStatus = 'reconciliation_required'
        paymentNote = params[8]
        return { rows: [{
          id: 501,
          family_billing_account_id: 8,
          amount_cents: 5100,
          external_processor: 'stripe',
          external_status: paymentStatus,
          stripe_customer_id: 'cus_historical',
          stripe_payment_intent_id: 'pi_paid_inactive',
          stripe_checkout_session_id: 'cs_paid_inactive',
          stripe_invoice_id: null,
          note: paymentNote,
        }] }
      }
      if (/INSERT INTO stripe_billing_alert/.test(text)) return { rows: [] }
      throw new Error(`Unexpected paid enrollment quarantine query: ${text}`)
    },
  }
  const session = {
    id: 'cs_paid_inactive',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 5100,
    currency: 'usd',
    customer: 'cus_historical',
    payment_intent: 'pi_paid_inactive',
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: '44',
      familyBillingAccountId: '8',
      memberId: '62',
      payerMemberId: '13',
    },
  }

  const first = await commitPendingEnrollment(pool, {
    pendingEnrollmentId: 44,
    stripeSession: session,
  })
  assert.equal(first.status, 'quarantined')
  assert.equal(first.payment.id, 501)
  assert.equal(first.payment.external_status, 'reconciliation_required')
  const paymentWriteIndex = calls.findIndex(({ text }) => /INSERT INTO billing_payment/.test(text))
  const currentAuthorizationIndex = calls.findIndex(({ text }) => /FROM stripe_pending_enrollment pending/.test(text))
  assert.ok(paymentWriteIndex >= 0 && paymentWriteIndex < currentAuthorizationIndex)
  assert.equal(calls.some(({ text }) => /SET status = 'processing'/.test(text)), false)
  assert.equal(calls.filter(({ text }) => /INSERT INTO stripe_billing_alert/.test(text)).length, 1)
  assert.match(pendingError, /^\[paid-checkout-refund-required\]/)

  const second = await commitPendingEnrollment(pool, {
    pendingEnrollmentId: 44,
    stripeSession: session,
  })
  assert.equal(second.status, 'quarantined')
  assert.equal(second.reason, 'paid_checkout_refund_required')
  assert.equal(second.payment.external_status, 'reconciliation_required')
  assert.equal(insertCount, 2)
  assert.equal(calls.filter(({ text }) => /FROM stripe_pending_enrollment pending/.test(text)).length, 1)
  assert.equal(calls.filter(({ text }) => /INSERT INTO stripe_billing_alert/.test(text)).length, 2)
  assert.equal(
    new Set(
      calls
        .filter(({ text }) => /INSERT INTO stripe_billing_alert/.test(text))
        .map(({ params }) => params[0]),
    ).size,
    1,
  )
})

test('paid enrollment customer, payer, and member drift cannot hide cash or create a signup', async (t) => {
  for (const scenario of [
    { name: 'remapped customer', currentCustomerId: 'cus_remapped' },
    { name: 'changed payer', currentPayerMemberId: 99 },
    { name: 'removed athlete', denyMember: true },
  ]) {
    await t.test(scenario.name, async () => {
      const calls = []
      const durablePending = {
        id: 44,
        family_billing_account_id: 8,
        member_id: 62,
        due_now_cents: 5100,
        checkout_mode: 'payment',
        stripe_checkout_session_id: 'cs_paid_drift',
        status: 'pending',
        error_message: null,
      }
      const currentPending = {
        ...durablePending,
        family_id: 20,
        payer_member_id: scenario.currentPayerMemberId ?? 13,
        stripe_customer_id: scenario.currentCustomerId ?? 'cus_historical',
      }
      const pool = {
        async query(sql, params = []) {
          const text = String(sql)
          calls.push({ text, params })
          if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
          if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
          if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
          if (/FROM stripe_pending_enrollment\s+WHERE id = \$1/.test(text)) {
            return { rows: [durablePending] }
          }
          if (/INSERT INTO billing_payment/.test(text)) {
            return {
              rows: [{
                id: 502,
                family_billing_account_id: params[0],
                amount_cents: params[1],
                external_processor: 'stripe',
                external_status: params[10],
                stripe_customer_id: params[4],
                stripe_payment_intent_id: params[5],
                stripe_checkout_session_id: params[6],
                stripe_invoice_id: params[7],
                newly_inserted: true,
                note: params[11],
              }],
            }
          }
          if (/FROM stripe_pending_enrollment pending/.test(text)) return { rows: [currentPending] }
          if (/FROM family_billing_account account/.test(text)) {
            return { rows: scenario.denyMember ? [] : [{ id: 62 }] }
          }
          if (/UPDATE stripe_pending_enrollment/.test(text) && /RETURNING status/.test(text)) {
            return { rows: [{ status: 'failed' }] }
          }
          if (/UPDATE billing_payment/.test(text)) {
            return { rows: [{
              id: 502,
              family_billing_account_id: 8,
              amount_cents: 5100,
              external_processor: 'stripe',
              external_status: 'reconciliation_required',
              stripe_customer_id: 'cus_historical',
              stripe_payment_intent_id: 'pi_paid_drift',
              stripe_checkout_session_id: 'cs_paid_drift',
              stripe_invoice_id: null,
              note: params[8],
            }] }
          }
          if (/INSERT INTO stripe_billing_alert/.test(text)) return { rows: [] }
          throw new Error(`Unexpected paid enrollment drift query: ${text}`)
        },
      }
      const session = {
        id: 'cs_paid_drift',
        mode: 'payment',
        status: 'complete',
        payment_status: 'paid',
        amount_total: 5100,
        currency: 'usd',
        customer: 'cus_historical',
        payment_intent: 'pi_paid_drift',
        metadata: {
          checkoutType: 'enrollment',
          pendingEnrollmentId: '44',
          familyBillingAccountId: '8',
          memberId: '62',
          payerMemberId: '13',
        },
      }

      const result = await commitPendingEnrollment(pool, {
        pendingEnrollmentId: 44,
        stripeSession: session,
      })
      assert.equal(result.status, 'quarantined')
      assert.equal(result.payment.id, 502)
      assert.equal(result.payment.external_status, 'reconciliation_required')
      assert.equal(calls.filter(({ text }) => /INSERT INTO billing_payment/.test(text)).length, 1)
      assert.equal(calls.filter(({ text }) => /INSERT INTO stripe_billing_alert/.test(text)).length, 1)
      assert.equal(calls.some(({ text }) => /SET status = 'processing'/.test(text)), false)
    })
  }
})

test('paid enrollment rechecks current authorization after winning the collection lock', async () => {
  const calls = []
  let authorizationReads = 0
  const durablePending = {
    id: 45,
    family_billing_account_id: 8,
    member_id: 62,
    due_now_cents: 5100,
    checkout_mode: 'payment',
    stripe_checkout_session_id: 'cs_paid_lock_drift',
    status: 'pending',
    error_message: null,
  }
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (/pg_advisory_lock/.test(text)) return { rows: [{}] }
      if (/pg_advisory_unlock/.test(text)) return { rows: [{ pg_advisory_unlock: true }] }
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text.trim())) return { rows: [] }
      if (/^LOCK TABLE family_member IN SHARE MODE$/.test(text.trim())) return { rows: [] }
      if (/JOIN member enrolled_member/.test(text)) return { rows: [{ id: 45 }] }
      if (/FROM stripe_pending_enrollment\s+WHERE id = \$1/.test(text)) {
        return { rows: [durablePending] }
      }
      if (/INSERT INTO billing_payment/.test(text)) {
        return {
          rows: [{
            id: 503,
            family_billing_account_id: params[0],
            amount_cents: params[1],
            external_processor: 'stripe',
            external_status: params[10],
            stripe_customer_id: params[4],
            stripe_payment_intent_id: params[5],
            stripe_checkout_session_id: params[6],
            stripe_invoice_id: params[7],
            newly_inserted: true,
            note: params[11],
          }],
        }
      }
      if (/FROM stripe_pending_enrollment pending/.test(text)) {
        authorizationReads += 1
        return {
          rows: [{
            ...durablePending,
            family_id: 20,
            payer_member_id: 13,
            stripe_customer_id: authorizationReads === 1 ? 'cus_historical' : 'cus_remapped',
          }],
        }
      }
      if (/FROM family_billing_account account/.test(text)) return { rows: [{ id: 62 }] }
      if (/UPDATE stripe_pending_enrollment/.test(text) && /RETURNING status/.test(text)) {
        return { rows: [{ status: 'failed' }] }
      }
      if (/UPDATE billing_payment/.test(text)) {
        return { rows: [{
          id: 503,
          family_billing_account_id: 8,
          amount_cents: 5100,
          external_processor: 'stripe',
          external_status: 'reconciliation_required',
          stripe_customer_id: 'cus_historical',
          stripe_payment_intent_id: 'pi_paid_lock_drift',
          stripe_checkout_session_id: 'cs_paid_lock_drift',
          stripe_invoice_id: null,
          note: params[8],
        }] }
      }
      if (/INSERT INTO stripe_billing_alert/.test(text)) return { rows: [] }
      throw new Error(`Unexpected paid enrollment lock-drift query: ${text}`)
    },
  }
  const session = {
    id: 'cs_paid_lock_drift',
    mode: 'payment',
    status: 'complete',
    payment_status: 'paid',
    amount_total: 5100,
    currency: 'usd',
    customer: 'cus_historical',
    payment_intent: 'pi_paid_lock_drift',
    metadata: {
      checkoutType: 'enrollment',
      pendingEnrollmentId: '45',
      familyBillingAccountId: '8',
      memberId: '62',
      payerMemberId: '13',
    },
  }

  const result = await commitPendingEnrollment(pool, {
    pendingEnrollmentId: 45,
    stripeSession: session,
  })

  assert.equal(result.status, 'quarantined')
  assert.equal(result.payment.external_status, 'reconciliation_required')
  assert.equal(authorizationReads, 2)
  const transactionStart = calls.findIndex(({ text }) => text.trim() === 'BEGIN')
  const membershipLock = calls.findIndex(({ text }) => /LOCK TABLE family_member/.test(text))
  const scopeRowLock = calls.findIndex(({ text }) => /FOR UPDATE OF pending/.test(text))
  const lockedAuthorization = calls.findIndex(({ text }, index) => (
    index > scopeRowLock && /FROM stripe_pending_enrollment pending/.test(text)
  ))
  const transactionRollback = calls.findIndex(({ text }, index) => (
    index > lockedAuthorization && text.trim() === 'ROLLBACK'
  ))
  assert.ok(transactionStart >= 0)
  assert.ok(transactionStart < membershipLock)
  assert.ok(membershipLock < scopeRowLock)
  assert.ok(scopeRowLock < lockedAuthorization)
  assert.ok(lockedAuthorization < transactionRollback)
  assert.equal(calls.some(({ text }) => /SET status = 'processing'/.test(text)), false)
  assert.equal(calls.filter(({ text }) => /INSERT INTO stripe_billing_alert/.test(text)).length, 1)
})
