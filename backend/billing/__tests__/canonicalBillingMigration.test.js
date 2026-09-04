import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import {
  authoritativeBillingDateExceptions,
  buildLockedBillingParityDimensions,
  CANONICAL_DROP_IN_CHARGE_SOURCE_TYPES,
  classifyBillingMigrationIssues,
  evaluateBillingMigrationParity,
  missingDropInChargeExceptions,
  payerExceptions,
} from '../canonicalBillingMigrationAudit.js'
import {
  adoptCanonicalHouseholdBillingMigration,
  advanceCanonicalBillingMigration,
  auditPassesCanonicalCutoverGates,
  assertFirstArmCreationBarrierAudit,
  assertBoundaryRevalidationContract,
  assertBoundaryRevalidationInvariant,
  assertRecurringSummaryMatchesAcceptedPricing,
  assertUniqueLocalStripeCustomerOwner,
  auditCanonicalBillingMigration,
  buildCanonicalLocalEnrollmentRepairPlans,
  buildPaidLegacyInvoiceSettlementPlan,
  buildProvableLegacyAdjustmentGroups,
  canReleaseProcessingCollectionDeferral,
  canonicalHouseholdForwardAdoptionGateFailures,
  clearRemoteCollectionForRollback,
  inspectCustomerCollectorsBeforeHouseholdActivation,
  inspectRemoteCutoverReversibility,
  maySupersedePreActivationBillingMigrationAudit,
  prepareCanonicalBillingMigration,
  preparePaidLegacyInvoiceSettlementEntry,
  recoverBoundaryRetirementBeforeDetachment,
  repairBundleEntitlementBalances,
  repairProvableFamilyMemberLinks,
  repairCanonicalBillingMigration,
  repairMissingCanonicalBillingAccounts,
  retireRemoteCollection,
  restoreFrozenLocalCollectionAfterRollback,
  rollbackCanonicalBillingMigration,
  storedMigrationPassesCanonicalCutoverGates,
  verifyCanonicalBillingAccount,
  withCanonicalFirstArmCollectorFreeze,
} from '../canonicalBillingMigration.js'
import { billingMigrationSnapshotHash } from '../canonicalBillingMigrationState.js'
import { withBillingAccountCollectionLock } from '../billingAccountCollectionLock.js'

test('only explicit pre-activation audit cohorts can be superseded', () => {
  assert.equal(maySupersedePreActivationBillingMigrationAudit({
    configuration: { forwardAdoption: true },
    cohort: 'forward-adoption-september',
  }), true)
  assert.equal(maySupersedePreActivationBillingMigrationAudit({
    configuration: {},
    cohort: 'fully-waived-entitlement-repair',
  }), true)
  assert.equal(maySupersedePreActivationBillingMigrationAudit({
    configuration: {},
    cohort: 'manual',
  }), false)
})

test('paid legacy invoices require exact frozen item, period, price, currency, and amount coverage', () => {
  const boundaryUnix = Date.parse('2026-09-01T00:00:00.000Z') / 1000
  const nextBoundaryUnix = Date.parse('2026-10-01T00:00:00.000Z') / 1000
  const migration = {
    family_billing_account_id: 7,
    accepted_account_snapshot: { id: 7, stripeCustomerId: 'cus_1' },
    accepted_pricing_snapshot: {
      targetMonth: '2026-09-01',
      timezone: 'UTC',
      parity: {
        canonical: { grossCents: 15_000, discountCents: 3_000, netCents: 12_000 },
        lines: [{ signupId: 10, subscriptionId: 22, grossCents: 15_000, discountCents: 3_000, netCents: 12_000 }],
      },
    },
  }
  const item = {
    id: 31,
    source_id: '22',
    target_id: '22',
    billing_subscription_id: 22,
    former_stripe_subscription_id: 'sub_22',
    former_stripe_item_id: 'si_22',
    source_snapshot: {
      local: { id: 22, stripeSubscriptionId: 'sub_22', stripeSubscriptionItemId: 'si_22' },
      remote: {
        id: 'sub_22',
        customerId: 'cus_1',
        items: [{ id: 'si_22', priceId: 'price_22', currency: 'usd', unitAmount: 12_000, quantity: 1 }],
      },
    },
  }
  const invoice = {
    id: 'in_22',
    status: 'paid',
    subscriptionId: 'sub_22',
    customerId: 'cus_1',
    currency: 'usd',
    amountDue: 12_000,
    amountPaid: 12_000,
    amountRemaining: 0,
    amountOverpaid: 0,
    startingBalance: 0,
    endingBalance: 0,
    prePaymentCreditNotesAmount: 0,
    postPaymentCreditNotesAmount: 0,
    collectionMethod: 'charge_automatically',
    paymentIntentId: 'pi_22',
    paymentIntentStatus: 'succeeded',
    paymentIntentAmountReceived: 12_000,
    lineCount: 1,
    nonZeroLineCount: 1,
    nonZeroLineIds: ['il_22'],
    matchingLinePeriods: [{
      id: 'il_22',
      subscriptionId: 'sub_22',
      subscriptionItemId: 'si_22',
      priceId: 'price_22',
      currency: 'usd',
      quantity: 1,
      amountCents: 12_000,
      periodStart: boundaryUnix,
      periodEnd: nextBoundaryUnix,
      proration: false,
    }],
  }
  const plan = buildPaidLegacyInvoiceSettlementPlan({
    migration,
    items: [item],
    invoices: [{ ...invoice, item }],
    targetMonth: '2026-09-01',
    boundary: { boundaryUnix, timeZone: 'UTC' },
  })
  assert.equal(plan.length, 1)
  assert.equal(plan[0].billingSubscriptionId, 22)
  assert.equal(plan[0].stripeInvoiceId, 'in_22')
  assert.equal(plan[0].stripePaymentIntentId, 'pi_22')
  assert.equal(plan[0].amountCents, 12_000)

  assert.throws(
    () => buildPaidLegacyInvoiceSettlementPlan({
      migration,
      items: [item],
      invoices: [{
        ...invoice,
        item,
        matchingLinePeriods: [{ ...invoice.matchingLinePeriods[0], amountCents: 11_999 }],
      }],
      targetMonth: '2026-09-01',
      boundary: { boundaryUnix, timeZone: 'UTC' },
    }),
    (error) => error.code === 'target_month_paid_legacy_invoice_parity_failed' &&
      error.details.issues.some((issue) => issue.code === 'legacy_invoice_line_evidence_mismatch'),
  )
  assert.throws(
    () => buildPaidLegacyInvoiceSettlementPlan({
      migration,
      items: [item],
      invoices: [{
        ...invoice,
        item,
        lineCount: 2,
        nonZeroLineCount: 2,
        nonZeroLineIds: ['il_22', 'il_unrelated'],
      }],
      targetMonth: '2026-09-01',
      boundary: { boundaryUnix, timeZone: 'UTC' },
    }),
    (error) => error.code === 'target_month_paid_legacy_invoice_parity_failed' &&
      error.details.issues.some((issue) => issue.code === 'legacy_invoice_line_evidence_mismatch'),
  )
  assert.throws(
    () => buildPaidLegacyInvoiceSettlementPlan({
      migration,
      items: [item],
      invoices: [{
        ...invoice,
        item,
        paymentIntentAmountReceived: 10_000,
        startingBalance: -2_000,
      }],
      targetMonth: '2026-09-01',
      boundary: { boundaryUnix, timeZone: 'UTC' },
    }),
    (error) => error.code === 'target_month_paid_legacy_invoice_parity_failed' &&
      error.details.issues.some((issue) => issue.code === 'legacy_invoice_line_evidence_mismatch'),
  )
})

test('paid legacy settlement recheck uses exact Invoice Payments proof when invoice.payment_intent is omitted', async () => {
  const invoice = {
    id: 'in_paid_without_legacy_pi',
    status: 'paid',
    paid: true,
    subscription: 'sub_22',
    customer: 'cus_1',
    currency: 'usd',
    amount_due: 12_000,
    amount_paid: 12_000,
    amount_remaining: 0,
    amount_overpaid: 0,
    starting_balance: 0,
    ending_balance: 0,
    pre_payment_credit_notes_amount: 0,
    post_payment_credit_notes_amount: 0,
    collection_method: 'charge_automatically',
  }
  const invoicePaymentCalls = []
  const invoicePayment = (boundInvoice) => ({
    id: 'inpay_22',
    status: 'paid',
    invoice: boundInvoice,
    amount_paid: 12_000,
    currency: 'usd',
    payment: { type: 'payment_intent', payment_intent: 'pi_22' },
  })
  const invoiceRetrieveCalls = []
  const stripe = {
    invoices: {
      async retrieve(...args) {
        invoiceRetrieveCalls.push(args)
        return invoice
      },
    },
    invoicePayments: {
      async list(params) {
        invoicePaymentCalls.push(params)
        return {
          data: [invoicePayment(params.invoice ? invoice.id : invoice)],
          has_more: false,
        }
      },
    },
    paymentIntents: {
      async retrieve(id) {
        assert.equal(id, 'pi_22')
        return {
          id,
          status: 'succeeded',
          amount_received: 12_000,
          currency: 'usd',
          customer: 'cus_1',
          payment_method: {
            id: 'pm_22',
            type: 'card',
            customer: 'cus_1',
            card: { brand: 'visa', last4: '4242' },
          },
          latest_charge: {
            payment_method_details: {
              type: 'card',
              card: { brand: 'visa', last4: '4242' },
            },
          },
        }
      },
    },
  }
  const db = {
    async query(sql) {
      assert.match(String(sql), /FROM billing_subscription/)
      return { rows: [] }
    },
  }
  const entry = {
    stripeInvoiceId: invoice.id,
    stripeSubscriptionId: 'sub_22',
    stripeCustomerId: 'cus_1',
    stripePaymentIntentId: 'pi_22',
    amountCents: 12_000,
  }

  const result = await preparePaidLegacyInvoiceSettlementEntry(db, stripe, entry, {
    accountId: 7,
  })

  assert.equal(Object.hasOwn(invoice, 'payment_intent'), false)
  assert.deepEqual(invoiceRetrieveCalls, [[invoice.id]])
  assert.equal(invoicePaymentCalls.length, 2)
  assert.equal(result.prepared.paymentIntentId, 'pi_22')
  assert.equal(result.prepared.accountId, 7)
  assert.equal(result.prepared.amountCents, 12_000)
  assert.equal(result.prepared.method, 'Visa •••• 4242')
})

test('paid legacy settlement rejects per-enrollment pricing drift even when account totals are unchanged', () => {
  const migration = {
    accepted_pricing_snapshot: {
      parity: {
        canonical: { grossCents: 30_000, discountCents: 6_000, netCents: 24_000 },
        lines: [
          { signupId: 10, subscriptionId: 22, grossCents: 15_000, discountCents: 3_000, netCents: 12_000 },
          { signupId: 11, subscriptionId: 23, grossCents: 15_000, discountCents: 3_000, netCents: 12_000 },
        ],
      },
    },
  }
  assert.doesNotThrow(() => assertRecurringSummaryMatchesAcceptedPricing(migration, {
    expectedChargeCount: 2,
    expectedGrossCents: 30_000,
    expectedDiscountCents: 6_000,
    expectedNetCents: 24_000,
    expectedLines: [
      { signupId: 11, subscriptionId: 23, grossCents: 15_000, discountCents: 3_000, netCents: 12_000 },
      { signupId: 10, subscriptionId: 22, grossCents: 15_000, discountCents: 3_000, netCents: 12_000 },
    ],
  }))
  assert.throws(
    () => assertRecurringSummaryMatchesAcceptedPricing(migration, {
      expectedChargeCount: 2,
      expectedGrossCents: 30_000,
      expectedDiscountCents: 6_000,
      expectedNetCents: 24_000,
      expectedLines: [
        { signupId: 10, subscriptionId: 22, grossCents: 14_000, discountCents: 2_000, netCents: 12_000 },
        { signupId: 11, subscriptionId: 23, grossCents: 16_000, discountCents: 4_000, netCents: 12_000 },
      ],
    }),
    (error) => error.code === 'paid_legacy_invoice_current_pricing_drift' && error.forwardOnly === true,
  )
})

test('a cleared processing invoice releases only its temporary next-month deferral', () => {
  const migration = {
    parity_snapshot: {
      collectionDeferredFromMonth: '2026-09-01',
      collectionDeferredToMonth: '2026-10-01',
      targetMonthLegacyInvoiceDisposition: 'processing_defer_next_month',
    },
  }
  assert.equal(canReleaseProcessingCollectionDeferral(migration, {
    disposition: 'clear',
    reviewRequired: false,
  }), true)
  assert.equal(canReleaseProcessingCollectionDeferral(migration, {
    disposition: 'paid_defer_next_month',
    deferToMonth: '2026-10-01',
  }), false)
  assert.equal(canReleaseProcessingCollectionDeferral({
    parity_snapshot: {
      collectionDeferredToMonth: '2026-10-01',
      targetMonthLegacyInvoiceDisposition: 'paid_defer_next_month',
    },
  }, { disposition: 'clear' }), false)
})

test('all-family audit surfaces active families missing canonical accounts without writes', async () => {
  const queries = []
  const db = {
    async query(sql, params) {
      queries.push({ sql: String(sql), params })
      return {
        rows: [{
          family_id: 7,
          family_name: 'O’Brien',
          facility_id: 2,
          facility_timezone: 'America/New_York',
          account_id: null,
          account_is_active: null,
          payer_member_id: null,
        }],
      }
    },
  }
  const report = await auditCanonicalBillingMigration(db, {
    accountIds: [],
    includeAllActiveFamilies: true,
    targetMonth: '2026-09-01',
    apply: false,
  })

  assert.equal(queries.length, 1)
  assert.match(queries[0].sql, /LEFT JOIN family_billing_account/)
  assert.match(queries[0].sql, /COALESCE\(family\.archived, FALSE\) = FALSE/)
  assert.match(queries[0].sql, /family_member inventory_membership/)
  assert.deepEqual(report.inventory, {
    activeFamilyCount: 1,
    billingAccountCount: 0,
    missingBillingAccountCount: 1,
  })
  assert.equal(report.accounts[0].familyId, 7)
  assert.equal(report.accounts[0].accountId, null)
  assert.equal(report.accounts[0].state, 'missing')
  assert.equal(report.accounts[0].classification, 'repairable')
  assert.equal(report.accounts[0].exceptions[0].code, 'billing_account_missing')
})

test('family account provisioning dry run is read-only and fails closed across facilities', async () => {
  const queries = []
  const db = {
    async query(sql) {
      queries.push(String(sql))
      return {
        rows: [
          {
            family_id: 7,
            family_name: 'One',
            facility_id: 2,
            facility_timezone: 'America/New_York',
            account_id: null,
            account_is_active: null,
            payer_member_id: null,
          },
          {
            family_id: 8,
            family_name: 'Two',
            facility_id: 3,
            facility_timezone: 'America/Chicago',
            account_id: null,
            account_is_active: null,
            payer_member_id: null,
          },
        ],
      }
    },
  }
  await assert.rejects(repairMissingCanonicalBillingAccounts(db, {
    familyIds: [7, 8],
    targetMonth: '2026-09-01',
    apply: false,
  }), /exactly one facility and timezone/)
  assert.equal(queries.length, 1)
  assert.equal(queries.some((sql) => /INSERT|UPDATE|DELETE|BEGIN|COMMIT/.test(sql)), false)
})

test('family account provisioning rejects any candidate missing facility or timezone', async () => {
  const db = {
    async query() {
      return { rows: [
        {
          family_id: 7,
          facility_id: 2,
          facility_timezone: 'America/New_York',
          account_id: null,
          account_is_active: null,
          payer_member_id: null,
        },
        {
          family_id: 8,
          facility_id: null,
          facility_timezone: null,
          account_id: null,
          account_is_active: null,
          payer_member_id: null,
        },
      ] }
    },
  }
  await assert.rejects(repairMissingCanonicalBillingAccounts(db, {
    familyIds: [7, 8],
    targetMonth: '2026-09-01',
    apply: false,
  }), /positive facility ID and valid timezone: 8/)
})

function familyProvisioningPool({ failRunInsert = false } = {}) {
  const queries = []
  let released = false
  const run = {
    id: 91,
    migration_key: 'canonical-household-billing-v1',
    mode: 'apply',
    status: 'running',
    code_version: 'release-1',
    manifest_checksum: 'a'.repeat(64),
    facility_id: 2,
    target_month: '2026-09-01',
    facility_timezone: 'America/New_York',
    cohort: 'family-account-bootstrap',
    configuration: {
      accountIds: [401],
      familyIds: [7],
      targetMonth: '2026-09-01',
      cohort: 'family-account-bootstrap',
      operation: 'family_account_provisioning',
    },
  }
  const client = {
    async query(sql, params = []) {
      const text = String(sql)
      queries.push({ sql: text, params })
      if (/^(BEGIN|COMMIT|ROLLBACK)$/.test(text)) return { rows: [] }
      if (/pg_advisory_xact_lock/.test(text)) return { rows: [{}] }
      if (/SELECT family\.id AS family_id/.test(text)) {
        return { rows: [{
          family_id: 7,
          family_name: 'O’Brien',
          facility_id: 2,
          facility_timezone: 'America/New_York',
          account_id: null,
          account_is_active: null,
          payer_member_id: null,
        }] }
      }
      if (/SELECT \* FROM family_billing_account WHERE family_id/.test(text)) return { rows: [] }
      if (/WITH inserted AS/.test(text)) {
        return { rows: [{
          id: 401,
          family_id: 7,
          payer_member_id: null,
          is_active: true,
          billing_email: null,
          billing_phone: null,
          billing_street: null,
          billing_city: null,
          billing_state: null,
          billing_zip: null,
          stripe_customer_id: null,
          household_monthly_billing_enabled: false,
        }] }
      }
      if (/INSERT INTO billing_migration_run/.test(text)) {
        if (failRunInsert) throw new Error('injected run failure')
        return { rows: [run] }
      }
      if (/SELECT family_billing_account_id, billing_migration_run_id/.test(text)) return { rows: [] }
      if (/INSERT INTO billing_account_migration/.test(text)) {
        return { rows: [{
          id: 501,
          billing_migration_run_id: 91,
          family_billing_account_id: 401,
          state: 'discovered',
          lock_version: 0,
        }] }
      }
      if (/INSERT INTO billing_migration_exception/.test(text)) return { rows: [{ id: 601, status: 'open' }] }
      if (/UPDATE billing_account_migration migration/.test(text)) {
        return { rows: [{
          id: 501,
          billing_migration_run_id: 91,
          family_billing_account_id: 401,
          state: 'blocked',
          lock_version: 1,
        }] }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
    release() { released = true },
  }
  return {
    pool: { async connect() { return client } },
    client,
    queries,
    released: () => released,
  }
}

test('family account provisioning atomically creates a payerless blocked account and exception', async () => {
  const fixture = familyProvisioningPool()
  const report = await repairMissingCanonicalBillingAccounts(fixture.pool, {
    familyIds: [7],
    targetMonth: '2026-09-01',
    now: new Date('2026-08-15T12:00:00.000Z'),
    apply: true,
    codeVersion: 'release-1',
    manifestChecksum: 'a'.repeat(64),
    environment: {
      BILLING_CANONICAL_READ_MODE: 'shadow',
      BILLING_ENROLLMENT_AUTO_REPAIR_ENABLED: 'true',
    },
  })

  assert.equal(report.runId, 91)
  assert.equal(report.operation, 'family_account_provisioning')
  assert.deepEqual(report.accounts.map((account) => ({
    familyId: account.familyId,
    accountId: account.accountId,
    classification: account.classification,
    state: account.state,
    provisioned: account.provisioned,
    exception: account.exceptions[0].code,
  })), [{
    familyId: 7,
    accountId: 401,
    classification: 'blocked',
    state: 'blocked',
    provisioned: true,
    exception: 'payer_missing',
  }])
  const accountInsert = fixture.queries.find((entry) => /INSERT INTO family_billing_account/.test(entry.sql))
  assert.deepEqual(accountInsert.params, [7])
  const runInsert = fixture.queries.find((entry) => /INSERT INTO billing_migration_run/.test(entry.sql))
  assert.match(runInsert.params[11], /"accountIds":\[401\]/)
  assert.match(runInsert.params[11], /"familyIds":\[7\]/)
  assert.equal(fixture.queries.some((entry) => /UPDATE billing_migration_run/.test(entry.sql)), false)
  const exceptionInsert = fixture.queries.find((entry) => /INSERT INTO billing_migration_exception/.test(entry.sql))
  assert.equal(exceptionInsert.params[2], 'account:401:audit:payer_missing')
  assert.equal(fixture.queries.at(-1).sql, 'COMMIT')
  assert.equal(fixture.released(), true)
})

test('family account provisioning rolls back the account when run creation fails', async () => {
  const fixture = familyProvisioningPool({ failRunInsert: true })
  await assert.rejects(repairMissingCanonicalBillingAccounts(fixture.pool, {
    familyIds: [7],
    targetMonth: '2026-09-01',
    now: new Date('2026-08-15T12:00:00.000Z'),
    apply: true,
    codeVersion: 'release-1',
    manifestChecksum: 'a'.repeat(64),
    environment: {
      BILLING_CANONICAL_READ_MODE: 'shadow',
      BILLING_ENROLLMENT_AUTO_REPAIR_ENABLED: 'true',
    },
  }), /injected run failure/)
  assert.equal(fixture.queries.some((entry) => entry.sql === 'ROLLBACK'), true)
  assert.equal(fixture.queries.some((entry) => entry.sql === 'COMMIT'), false)
  assert.equal(fixture.released(), true)
})

test('family provisioning reuses a passed PoolClient without reconnecting or releasing it', async () => {
  const fixture = familyProvisioningPool()
  fixture.client.connect = async () => assert.fail('a checked-out PoolClient must not reconnect')

  const report = await repairMissingCanonicalBillingAccounts(fixture.client, {
    familyIds: [7],
    targetMonth: '2026-09-01',
    now: new Date('2026-08-15T12:00:00.000Z'),
    apply: true,
    codeVersion: 'release-1',
    manifestChecksum: 'a'.repeat(64),
    environment: {
      BILLING_CANONICAL_READ_MODE: 'shadow',
      BILLING_ENROLLMENT_AUTO_REPAIR_ENABLED: 'true',
    },
  })

  assert.equal(report.runId, 91)
  assert.equal(fixture.queries[0].sql, 'BEGIN')
  assert.equal(fixture.queries.at(-1).sql, 'COMMIT')
  assert.equal(fixture.released(), false)
})

test('target-month parity excludes a subscription whose cancellation is effective at the boundary', () => {
  const parity = evaluateBillingMigrationParity({
    targetMonth: '2026-09-01',
    pricing: {
      grossCents: 15_000,
      discountCents: 3_000,
      netCents: 12_000,
      missingSubscriptionSignupIds: [],
      lines: [{
        signupId: 1,
        subscriptionId: 10,
        grossCents: 15_000,
        discountCents: 3_000,
        netCents: 12_000,
        localGrossCents: 15_000,
        localDiscountCents: 3_000,
        localNetCents: 12_000,
      }],
    },
    subscriptions: [
      {
        id: 10, status: 'active', sourceType: 'scheduling_signup', sourceId: '1',
        signupId: 1, signupStatus: 'confirmed', enrollmentStartDate: '2026-08-01',
      },
      {
        id: 11, status: 'active', sourceType: 'scheduling_signup', sourceId: '2',
        signupId: 2, signupStatus: 'confirmed', enrollmentStartDate: '2026-08-01',
        cancelEffectiveDate: '2026-09-01',
      },
    ],
  })
  assert.equal(parity.matched, true)
  assert.deepEqual(parity.extraActiveSubscriptionIds, [])
})

test('shadow parity shares future-start lifecycle exclusions with cutover posting', () => {
  const parity = evaluateBillingMigrationParity({
    targetMonth: '2026-09-01',
    pricing: {
      grossCents: 15_000,
      discountCents: 3_000,
      netCents: 12_000,
      missingSubscriptionSignupIds: [],
      lines: [{
        signupId: 1,
        subscriptionId: 10,
        grossCents: 15_000,
        discountCents: 3_000,
        netCents: 12_000,
        localGrossCents: 15_000,
        localDiscountCents: 3_000,
        localNetCents: 12_000,
      }],
    },
    subscriptions: [
      {
        id: 10, status: 'active', sourceType: 'scheduling_signup', sourceId: '1',
        signupId: 1, signupStatus: 'confirmed', enrollmentStartDate: '2026-08-01',
      },
      {
        id: 11, status: 'active', sourceType: 'scheduling_signup', sourceId: '2',
        signupId: 2, signupStatus: 'confirmed', enrollmentStartDate: '2026-10-03',
        classActiveStart: '2026-10-03', nextBillDate: '2026-10-01',
      },
    ],
  })
  assert.equal(parity.matched, true)
  assert.deepEqual(parity.extraActiveSubscriptionIds, [])
  assert.deepEqual(
    parity.lifecycleManifest.filter((entry) => entry.billable === false).map((entry) => entry.reason),
    ['enrollment_starts_after_target_month'],
  )
})

test('shadow parity blocks stale schedules hidden behind valid lifecycle exclusions', () => {
  for (const subscription of [
    {
      id: 11, status: 'active', sourceType: 'scheduling_signup', sourceId: '2',
      signupId: 2, signupStatus: 'confirmed', enrollmentStartDate: '2026-10-03',
      classActiveStart: '2026-10-03', nextBillDate: '2026-08-01',
    },
    {
      id: 12, status: 'active', sourceType: 'scheduling_signup', sourceId: '3',
      signupId: 3, signupStatus: 'confirmed', enrollmentStartDate: '2026-08-01',
      cancelEffectiveDate: '2026-09-01', nextBillDate: '2026-08-01',
    },
  ]) {
    const parity = evaluateBillingMigrationParity({
      targetMonth: '2026-09-01',
      pricing: {
        grossCents: 0,
        discountCents: 0,
        netCents: 0,
        missingSubscriptionSignupIds: [],
        lines: [],
      },
      subscriptions: [subscription],
    })
    assert.equal(parity.matched, false)
    assert.equal(parity.invalidActiveSubscriptions.length, 1)
    assert.match(
      parity.invalidActiveSubscriptions[0].exclusionScheduleReason,
      /future_enrollment_schedule_before_service_month|excluded_subscription_prior_period_due/,
    )
    assert.equal(parity.extraActiveSubscriptionIds.length, 0)
  }
})

test('shadow parity blocks orphaned and stale ended active subscriptions', () => {
  for (const subscription of [
    {
      id: 11, status: 'active', sourceType: 'scheduling_signup', sourceId: '2',
      signupId: 2, signupStatus: 'confirmed', signupOrphanedAt: '2026-08-20T12:00:00.000Z',
      enrollmentStartDate: '2026-08-01',
    },
    {
      id: 12, status: 'active', sourceType: 'scheduling_signup', sourceId: '3',
      signupId: 3, signupStatus: 'confirmed', enrollmentStartDate: '2026-07-01',
      classActiveEnd: '2026-08-31', cancelEffectiveDate: '2026-09-01',
    },
  ]) {
    const parity = evaluateBillingMigrationParity({
      targetMonth: '2026-09-01',
      pricing: {
        grossCents: 0,
        discountCents: 0,
        netCents: 0,
        missingSubscriptionSignupIds: [],
        lines: [],
      },
      subscriptions: [subscription],
    })
    assert.equal(parity.matched, false)
    assert.equal(parity.invalidActiveSubscriptions.length, 1)
    assert.equal(parity.extraActiveSubscriptionIds.length, 0)
  }
})

test('locked parity records every legacy-to-canonical dimension explicitly', () => {
  const artifacts = [
    {
      itemType: 'billing_charge',
      sourceSnapshot: {
        id: 1, member_id: 7, charge_type: 'recurring', amount_cents: 10_000,
        applied_amount_cents: 10_000, remaining_amount_cents: 0,
        service_period_start: '2026-08-01', created_at: '2026-08-01T12:00:00.000Z', metadata: {},
      },
    },
    {
      itemType: 'billing_payment',
      sourceSnapshot: {
        id: 2, amount_cents: 10_000, applied_amount_cents: 10_000,
        remaining_amount_cents: 0, paid_at: '2026-08-02T12:00:00.000Z',
      },
    },
    {
      itemType: 'bundle_pass',
      sourceSnapshot: { id: 3, member_id: 7, class_count_purchased: 10, classes_remaining: 7 },
    },
    {
      itemType: 'bundle_usage',
      sourceSnapshot: { id: 4, member_pass_id: 3, credit_delta: -3 },
    },
  ]
  const pricingParity = {
    matched: true,
    localEligible: { grossCents: 15_000, discountCents: 3_000, netCents: 12_000 },
    canonical: { grossCents: 15_000, discountCents: 3_000, netCents: 12_000 },
    missingSignupIds: [],
    extraActiveSubscriptionIds: [],
    lines: [{ signupId: 11, subscriptionId: 12 }],
  }
  const dimensions = buildLockedBillingParityDimensions({
    artifacts,
    financial: {
      ledger: {
        charge_cents: 10_000, payment_cents: 10_000, refund_cents: 0,
        ledger_running_balance_cents: 0,
      },
    },
    pricingParity,
    subscriptions: [{
      id: 12, memberId: 7, sourceId: '11', sourceType: 'scheduling_signup',
      status: 'active', nextBillDate: '2026-09-01', netMonthlyCents: 12_000,
      discountAmountCents: 3_000, signupId: 11, signupStatus: 'confirmed',
      enrollmentStartDate: '2026-08-01',
    }],
    evidence: {
      canonicalFinancial: {
        chargesCents: 10_000, paymentsCents: 10_000, refundsCents: 0,
        balanceCents: 0, outstandingBalanceCents: 0, recurringBillingMonth: '2026-09',
      },
      visibleTransactions: [
        {
          entry_kind: 'charge', ref_id: 1, member_id: 7, amount_cents: 10_000,
          occurred_at: '2026-08-01T12:00:00.000Z', billing_month: '2026-08-01',
        },
        {
          entry_kind: 'payment', ref_id: 2, member_id: null, amount_cents: -10_000,
          occurred_at: '2026-08-02T12:00:00.000Z', billing_month: '2026-08-02',
        },
      ],
      membershipOwnership: [],
      paidThrough: [{
        subscription_id: 12, member_id: 7, next_bill_date: '2026-09-01',
        paid_through_date: '2026-08-31', derived_next_bill_date: '2026-09-01',
        owner_mismatch_count: 0,
      }],
    },
    targetMonth: '2026-09-01',
    now: new Date('2026-08-31T12:00:00.000Z'),
  })

  assert.deepEqual(Object.keys(dimensions), [
    'balance',
    'outstandingAmount',
    'nextMonthRecurringFee',
    'enrollments',
    'membershipsAndPaidThroughOwnership',
    'transactionsVisibleRecordManifest',
    'twelveMonthHistory',
    'bundlesAndRecomputedEntitlementBalance',
  ])
  assert.equal(Object.values(dimensions).every((dimension) => dimension.matched), true)
  assert.equal(Object.values(dimensions).every((dimension) => (
    dimension.legacyHash && dimension.canonicalHash &&
    Object.hasOwn(dimension, 'legacy') && Object.hasOwn(dimension, 'canonical')
  )), true)
})

const neverDb = {
  async query() {
    throw new Error('database should not be reached while feature flag is off')
  },
}

test('mutating commands fail closed before touching the database', async () => {
  const off = {}
  await assert.rejects(
    repairCanonicalBillingMigration(neverDb, {
      runId: 1, accountIds: [1], targetMonth: '2026-09-01', apply: true, environment: off,
    }),
    /BILLING_ENROLLMENT_AUTO_REPAIR_ENABLED/,
  )
  await assert.rejects(
    prepareCanonicalBillingMigration(neverDb, {
      runId: 1, accountIds: [1], apply: true, environment: off,
    }),
    /BILLING_COLLECTION_CUTOVER_ENABLED/,
  )
  await assert.rejects(
    advanceCanonicalBillingMigration(neverDb, {
      runId: 1, accountIds: [1], stripe: {}, apply: true, environment: off,
    }),
    /BILLING_COLLECTION_CUTOVER_ENABLED/,
  )
  await assert.rejects(
    adoptCanonicalHouseholdBillingMigration(neverDb, {
      runId: 1, accountIds: [1], stripe: {}, apply: true, environment: off,
    }),
    /BILLING_COLLECTION_CUTOVER_ENABLED/,
  )
  await assert.rejects(
    rollbackCanonicalBillingMigration(neverDb, {
      runId: 1, accountIds: [1], stripe: {}, apply: true, environment: off,
    }),
    /BILLING_COLLECTION_CUTOVER_ENABLED/,
  )
})

test('prepare and advance require the global class-subscription cutoff before any mutation', async () => {
  let stripeCalls = 0
  const stripe = new Proxy({}, {
    get() {
      stripeCalls += 1
      throw new Error('Stripe must not be reached before the global cutoff gate.')
    },
  })
  const legacyEnvironment = {
    BILLING_CANONICAL_READ_MODE: 'shadow',
    BILLING_COLLECTION_CUTOVER_ENABLED: 'true',
    BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'legacy',
  }

  for (const operation of [
    () => prepareCanonicalBillingMigration(neverDb, {
      runId: 1,
      accountIds: [1],
      apply: true,
      environment: legacyEnvironment,
    }),
    () => advanceCanonicalBillingMigration(neverDb, {
      runId: 1,
      accountIds: [1],
      stripe,
      apply: true,
      environment: legacyEnvironment,
    }),
  ]) {
    await assert.rejects(operation(), (error) => {
      assert.equal(error.code, 'feature_disabled')
      assert.equal(error.preserveMigrationState, true)
      assert.match(error.message, /BILLING_CLASS_SUBSCRIPTION_CREATION_MODE=household_only/)
      return true
    })
  }
  assert.equal(stripeCalls, 0)
})

test('forward adoption requires explicit activation and the permanent subscription cutoff', async () => {
  await assert.rejects(
    adoptCanonicalHouseholdBillingMigration(neverDb, {
      runId: 1,
      accountIds: [1],
      stripe: {},
      apply: true,
      environment: {
        BILLING_COLLECTION_CUTOVER_ENABLED: 'true',
        BILLING_CANONICAL_READ_MODE: 'shadow',
        BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'household_only',
      },
    }),
    /BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED/,
  )
  await assert.rejects(
    adoptCanonicalHouseholdBillingMigration(neverDb, {
      runId: 1,
      accountIds: [1],
      stripe: {},
      apply: true,
      environment: {
        BILLING_COLLECTION_CUTOVER_ENABLED: 'true',
        BILLING_HOUSEHOLD_AUTO_ACTIVATE_ENABLED: 'true',
        BILLING_CANONICAL_READ_MODE: 'shadow',
        BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'legacy',
      },
    }),
    /BILLING_CLASS_SUBSCRIPTION_CREATION_MODE=household_only/,
  )
})

function forwardAdoptionAuthorizationDb(forwardAdoption) {
  let migrationReadCount = 0
  const run = {
    id: 9,
    migration_key: 'canonical-household-billing-v1',
    mode: 'apply',
    status: 'running',
    code_version: 'release-1',
    manifest_checksum: 'a'.repeat(64),
    facility_id: 2,
    target_month: '2026-09-01',
    facility_timezone: 'America/New_York',
    cohort: 'forward-adoption-manual',
    configuration: {
      accountIds: [101],
      targetMonth: '2026-09-01',
      cohort: 'forward-adoption-manual',
      ...(forwardAdoption == null ? {} : { forwardAdoption }),
    },
  }
  return {
    get migrationReadCount() { return migrationReadCount },
    async query(sql) {
      const text = String(sql)
      if (/SELECT \* FROM billing_migration_run/.test(text)) return { rows: [run] }
      if (/SELECT family_billing_account_id, cutover_month/.test(text)) {
        return { rows: [{ family_billing_account_id: 101, cutover_month: '2026-09-01' }] }
      }
      if (/SELECT \*\s+FROM billing_account_migration\s+WHERE/.test(text)) {
        migrationReadCount += 1
        return { rows: [] }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
}

test('forward adoption rejects an ordinary immutable audit run before reading account state', async () => {
  for (const marker of [null, false]) {
    const db = forwardAdoptionAuthorizationDb(marker)
    await assert.rejects(
      adoptCanonicalHouseholdBillingMigration(db, {
        runId: 9,
        accountIds: [101],
        stripe: {},
        apply: false,
      }),
      (error) => error.code === 'forward_adoption_run_not_authorized',
    )
    assert.equal(db.migrationReadCount, 0)
  }
})

test('forward adoption accepts a run carrying the immutable authorization marker', async () => {
  const db = forwardAdoptionAuthorizationDb(true)
  const report = await adoptCanonicalHouseholdBillingMigration(db, {
    runId: 9,
    accountIds: [101],
    stripe: {},
    apply: false,
  })
  assert.equal(db.migrationReadCount, 1)
  assert.equal(report.accounts[0].accountId, 101)
  assert.match(report.accounts[0].error, /does not contain billing account/)
})

test('household-only collection phase opens the migration gate without weakening other checks', async () => {
  const environment = {
    BILLING_CANONICAL_READ_MODE: 'shadow',
    BILLING_COLLECTION_CUTOVER_ENABLED: 'true',
    BILLING_CLASS_SUBSCRIPTION_CREATION_MODE: 'household_only',
  }
  await assert.rejects(
    prepareCanonicalBillingMigration(neverDb, {
      runId: 1,
      accountIds: [1],
      apply: true,
      environment,
    }),
    /database should not be reached while feature flag is off/,
  )
})

test('first-arm barrier accepts only the same eligible frozen inventory', () => {
  const before = {
    snapshotHash: 'a'.repeat(64),
    eligible: true,
    exceptions: [],
    parityStatus: 'matched',
    paritySnapshot: { matched: true },
    payerValidationStatus: 'verified',
    sourceCollectionMode: 'household_monthly',
  }
  const after = { ...before }
  assert.equal(assertFirstArmCreationBarrierAudit(before, after), after)
  assert.throws(
    () => assertFirstArmCreationBarrierAudit(before, {
      snapshotHash: 'b'.repeat(64),
      eligible: true,
      exceptions: [],
    }),
    (error) => error.code === 'first_arm_creation_barrier_drift',
  )
  assert.throws(
    () => assertFirstArmCreationBarrierAudit(before, {
      ...before,
      eligible: false,
      exceptions: [{ code: 'legacy_collector_added' }],
    }),
    (error) => (
      error.code === 'first_arm_creation_barrier_blocked'
      && error.details.exceptionCodes[0] === 'legacy_collector_added'
    ),
  )
})

test('first-arm freeze takes the global barrier first and waits for an in-flight account mutator', async () => {
  const events = []
  const waiters = []
  let accountLockOwner = null
  let nextClientId = 0

  const pool = {
    async connect() {
      const clientId = ++nextClientId
      return {
        release(error) {
          assert.equal(error, undefined)
          events.push(`client-${clientId}:released`)
        },
        async query(text) {
          if (text.includes('pg_advisory_lock(hashtextextended')) {
            events.push(`client-${clientId}:account-lock-requested`)
            if (accountLockOwner != null) {
              await new Promise((resolve) => waiters.push(resolve))
            }
            accountLockOwner = clientId
            events.push(`client-${clientId}:account-lock-acquired`)
            return { rows: [{}] }
          }
          if (text.includes('pg_advisory_unlock(hashtextextended')) {
            assert.equal(accountLockOwner, clientId)
            events.push(`client-${clientId}:account-lock-released`)
            accountLockOwner = null
            waiters.shift()?.()
            return { rows: [{ pg_advisory_unlock: true }] }
          }
          if (text.includes('pg_advisory_lock($1::integer')) {
            events.push(`client-${clientId}:global-lock-acquired`)
            return { rows: [{}] }
          }
          if (text.includes('pg_advisory_unlock($1::integer')) {
            events.push(`client-${clientId}:global-lock-released`)
            return { rows: [{ pg_advisory_unlock: true }] }
          }
          throw new Error(`Unexpected query: ${text}`)
        },
      }
    },
  }

  let releaseLegacyMutator
  let legacyMutatorEntered
  const legacyMutatorEnteredPromise = new Promise((resolve) => {
    legacyMutatorEntered = resolve
  })
  const releaseLegacyMutatorPromise = new Promise((resolve) => {
    releaseLegacyMutator = resolve
  })
  const legacyMutation = withBillingAccountCollectionLock(pool, 7, async () => {
    events.push('legacy-remote-mutation-started')
    legacyMutatorEntered()
    await releaseLegacyMutatorPromise
    events.push('legacy-remote-mutation-finished')
  })
  await legacyMutatorEnteredPromise

  let armed = false
  const firstArm = withCanonicalFirstArmCollectorFreeze(pool, 7, async () => {
    armed = true
    events.push('durable-armed-transition')
  })
  await new Promise((resolve) => setImmediate(resolve))

  assert.equal(armed, false)
  assert.ok(events.indexOf('client-2:global-lock-acquired') < events.indexOf('client-2:account-lock-requested'))
  assert.equal(events.includes('client-2:account-lock-acquired'), false)

  releaseLegacyMutator()
  await Promise.all([legacyMutation, firstArm])

  assert.ok(events.indexOf('legacy-remote-mutation-finished') < events.indexOf('durable-armed-transition'))
  assert.ok(events.indexOf('client-2:account-lock-acquired') < events.indexOf('durable-armed-transition'))
  assert.ok(events.indexOf('durable-armed-transition') < events.indexOf('client-2:account-lock-released'))
  assert.ok(events.indexOf('client-2:account-lock-released') < events.indexOf('client-2:global-lock-released'))
})

test('canonical cutover gates independently require audit, parity, payer, and Stripe evidence', () => {
  const audit = {
    eligible: true,
    exceptions: [],
    parityStatus: 'matched',
    paritySnapshot: { matched: true },
    payerValidationStatus: 'verified',
    sourceCollectionMode: 'legacy_per_class',
    initialStripeSnapshot: {
      customer: {
        customerId: 'cus_1',
        hasDefaultPaymentMethod: true,
      },
      customerSubscriptionInventory: {
        subscriptions: [{ id: 'sub_1' }],
      },
    },
    items: [{
      local: { stripeSubscriptionId: 'sub_1' },
      remote: { id: 'sub_1', customerId: 'cus_1' },
    }],
  }
  assert.equal(auditPassesCanonicalCutoverGates(audit), true)
  assert.equal(auditPassesCanonicalCutoverGates({ ...audit, eligible: false }), false)
  assert.equal(auditPassesCanonicalCutoverGates({ ...audit, parityStatus: 'mismatched' }), false)
  assert.equal(auditPassesCanonicalCutoverGates({ ...audit, paritySnapshot: { matched: false } }), false)
  assert.equal(auditPassesCanonicalCutoverGates({ ...audit, payerValidationStatus: 'invalid' }), false)
  assert.equal(auditPassesCanonicalCutoverGates({
    ...audit,
    exceptions: [{ severity: 'blocking', code: 'current_blocker' }],
  }), false)
  assert.equal(auditPassesCanonicalCutoverGates({
    ...audit,
    initialStripeSnapshot: {
      ...audit.initialStripeSnapshot,
      customer: { ...audit.initialStripeSnapshot.customer, hasDefaultPaymentMethod: false },
    },
  }), false)
  assert.equal(auditPassesCanonicalCutoverGates({
    ...audit,
    items: [{ local: { stripeSubscriptionId: 'sub_1' }, remote: null }],
  }), false)
  assert.equal(auditPassesCanonicalCutoverGates({
    ...audit,
    initialStripeSnapshot: {
      ...audit.initialStripeSnapshot,
      customerSubscriptionInventory: {
        subscriptions: [
          { id: 'sub_1', classification: 'nonannual' },
          { id: 'sub_annual', classification: 'annual_membership' },
        ],
      },
    },
  }), false)
})

function forwardAdoptionGateFixture(overrides = {}) {
  return {
    audit: {
      sourceCollectionMode: 'manual',
      payerValidationStatus: 'verified',
      parityStatus: 'matched',
      paritySnapshot: {
        matched: true,
        dimensions: {
          balance: { matched: true },
          outstandingAmount: { matched: true },
        },
      },
      ledgerSnapshot: {
        ledger: {
          charge_cents: 48_500,
          payment_cents: 0,
          refund_cents: 0,
          ledger_running_balance_cents: 48_500,
        },
        lockedDimensions: {
          balance: { matched: true },
          outstandingAmount: { matched: true },
        },
      },
      accountSnapshot: { stripeCustomerId: null },
      initialStripeSnapshot: { customerSubscriptionInventory: null },
      exceptions: [{
        code: 'manual_collection_requires_review',
        severity: 'blocking',
      }],
    },
    localCollectors: [],
    scheduleInventory: {
      verified: true,
      snapshot: { liveScheduleCount: 0, schedules: [] },
    },
    paymentMethodReadiness: {
      ready: false,
      reason: 'stripe_customer_missing',
    },
    activationEvidence: { verified: true },
    verification: { verified: true, issues: [] },
    ...overrides,
  }
}

test('forward adoption accepts only explicit ledger-only evidence and no-card status', () => {
  assert.deepEqual(
    canonicalHouseholdForwardAdoptionGateFailures(forwardAdoptionGateFixture()),
    [],
  )
  const remote = forwardAdoptionGateFixture()
  remote.audit = {
    ...remote.audit,
    accountSnapshot: { stripeCustomerId: 'cus_9' },
    initialStripeSnapshot: {
      customerSubscriptionInventory: {
        liveSubscriptionCount: 1,
        subscriptions: [{ id: 'sub_9' }],
      },
    },
  }
  remote.paymentMethodReadiness = { ready: true, reason: null }
  assert.ok(
    canonicalHouseholdForwardAdoptionGateFailures(remote)
      .includes('active_remote_recurring_subscription_present'),
  )
})

test('forward adoption inventories schedules before subscriptions while holding the collection lock', () => {
  const source = fs.readFileSync(new URL('../canonicalBillingMigration.js', import.meta.url), 'utf8')
  const inspection = source.slice(
    source.indexOf('async function inspectForwardAdoptionAccount'),
    source.indexOf('async function activateForwardAdoptedAccount'),
  )
  assert.ok(
    inspection.indexOf('inspectStripeCustomerSubscriptionScheduleInventory')
      < inspection.indexOf('auditCanonicalBillingAccount'),
  )
  const adoption = source.slice(
    source.indexOf('export async function adoptCanonicalHouseholdBillingMigration'),
    source.indexOf('export async function advanceCanonicalBillingMigration'),
  )
  assert.match(adoption, /withBillingAccountCollectionLock[\s\S]*inspectForwardAdoptionAccount/)
})

test('forward adoption rejects local collectors, schedules, unproven activation, and invoice drift', () => {
  const fixture = forwardAdoptionGateFixture({
    localCollectors: [{ id: 22, stripeSubscriptionId: 'sub_22' }],
    scheduleInventory: {
      verified: false,
      snapshot: { liveScheduleCount: 1, schedules: [{ id: 'sub_sched_1' }] },
    },
    activationEvidence: { verified: false },
    verification: { verified: false, issues: [{ code: 'household_invoice_line_mismatch' }] },
  })
  fixture.audit = {
    ...fixture.audit,
    sourceCollectionMode: 'household_monthly',
    exceptions: [{ code: 'target_household_invoice_exists', severity: 'blocking' }],
  }
  const failures = canonicalHouseholdForwardAdoptionGateFailures(fixture)
  assert.ok(failures.includes('active_local_recurring_collector_present'))
  assert.ok(failures.includes('active_remote_subscription_schedule_present'))
  assert.ok(failures.includes('household_activation_evidence_missing'))
  assert.ok(failures.includes('unreviewed_blocking_audit_exception'))
  assert.ok(failures.includes('canonical_household_verification_failed'))
})

test('stored migration cutover gates fail closed on payer, parity, or Stripe evidence', () => {
  assert.equal(storedMigrationPassesCanonicalCutoverGates({
    payer_validation_status: 'verified',
    parity_status: 'matched',
  }), true)
  assert.equal(storedMigrationPassesCanonicalCutoverGates({
    payer_validation_status: 'invalid',
    parity_status: 'matched',
  }), false)
  assert.equal(storedMigrationPassesCanonicalCutoverGates({
    payer_validation_status: 'verified',
    parity_status: 'mismatched',
  }), false)

  const legacyMigration = {
    payer_validation_status: 'verified',
    parity_status: 'matched',
    source_collection_mode: 'legacy_per_class',
    initial_stripe_snapshot: {
      customer: { customerId: 'cus_1', hasDefaultPaymentMethod: true },
      subscriptions: [{ id: 'sub_1', customerId: 'cus_1' }],
      customerSubscriptionInventory: { subscriptions: [{ id: 'sub_1' }] },
    },
  }
  assert.equal(storedMigrationPassesCanonicalCutoverGates(legacyMigration), true)
  assert.equal(storedMigrationPassesCanonicalCutoverGates({
    ...legacyMigration,
    initial_stripe_snapshot: {
      ...legacyMigration.initial_stripe_snapshot,
      customerSubscriptionInventory: { subscriptions: [] },
    },
  }), false)
  assert.equal(storedMigrationPassesCanonicalCutoverGates({
    ...legacyMigration,
    initial_stripe_snapshot: {
      ...legacyMigration.initial_stripe_snapshot,
      customer: { customerId: 'cus_1', hasDefaultPaymentMethod: false },
    },
  }), false)
  assert.equal(storedMigrationPassesCanonicalCutoverGates({
    ...legacyMigration,
    accepted_stripe_snapshot: {
      ...legacyMigration.initial_stripe_snapshot,
      customerSubscriptionInventory: {
        subscriptions: [
          { id: 'sub_1', classification: 'nonannual' },
          { id: 'sub_annual', classification: 'annual_membership' },
        ],
      },
    },
  }), false)
})

test('persisted audit is gated by canonical read shadow, not collection cutover', async () => {
  await assert.rejects(
    auditCanonicalBillingMigration(neverDb, {
      accountIds: [1], targetMonth: '2026-09-01', apply: true, environment: {},
    }),
    /BILLING_CANONICAL_READ_MODE/,
  )
  await assert.rejects(
    auditCanonicalBillingMigration(neverDb, {
      accountIds: [1], targetMonth: '2026-09-01', apply: true,
      environment: { BILLING_CANONICAL_READ_MODE: 'shadow' },
    }),
    /database should not be reached/,
  )
})

test('advance stops the cohort before touching a later account after a structural failure', async () => {
  const requestedMigrationAccounts = []
  const run = {
    id: 9,
    migration_key: 'canonical-household-billing-v1',
    mode: 'apply',
    status: 'running',
    code_version: 'release-1',
    manifest_checksum: 'a'.repeat(64),
    facility_id: 2,
    target_month: '2026-09-01',
    facility_timezone: 'America/New_York',
    cohort: 'pilot',
    configuration: {
      accountIds: [101, 202],
      targetMonth: '2026-09-01',
      cohort: 'pilot',
    },
  }
  const firstMigration = {
    id: 501,
    billing_migration_run_id: 9,
    family_billing_account_id: 101,
    state: 'armed',
    cutover_month: '2026-09-01',
    parity_snapshot: { timezone: 'America/New_York' },
  }
  const db = {
    async query(sql, params = []) {
      const text = String(sql)
      if (/SELECT \* FROM billing_migration_run/.test(text)) return { rows: [run] }
      if (/SELECT family_billing_account_id, cutover_month/.test(text)) {
        return { rows: [
          { family_billing_account_id: 101, cutover_month: '2026-09-01' },
          { family_billing_account_id: 202, cutover_month: '2026-09-01' },
        ] }
      }
      if (/SELECT \*\s+FROM billing_account_migration\s+WHERE/.test(text)) {
        requestedMigrationAccounts.push(Number(params[1]))
        if (Number(params[1]) === 101) return { rows: [firstMigration] }
        throw new Error('The second account was touched after the cohort should have stopped.')
      }
      if (/SELECT \* FROM billing_account_migration_item/.test(text)) {
        const error = new Error('Frozen local and remote subscription mappings do not match.')
        error.code = 'local_remote_subscription_mismatch'
        throw error
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }

  const report = await advanceCanonicalBillingMigration(db, {
    runId: 9,
    accountIds: [101, 202],
    stripe: {},
    now: new Date('2026-08-15T12:00:00.000Z'),
    apply: false,
  })

  assert.deepEqual(requestedMigrationAccounts, [101])
  assert.equal(report.cohortStopped, true)
  assert.deepEqual(report.accounts, [{
    accountId: 101,
    state: 'error',
    error: 'Frozen local and remote subscription mappings do not match.',
    code: 'local_remote_subscription_mismatch',
    forwardOnly: false,
  }])
  assert.deepEqual(report.cohortStop, {
    failedAccountId: 101,
    code: 'local_remote_subscription_mismatch',
    error: 'Frozen local and remote subscription mappings do not match.',
    unprocessedAccountIds: [202],
  })
})

test('household activation fails closed when customer-wide inventory finds an orphan legacy collector', async () => {
  const boundaryUnix = Date.parse('2026-09-01T04:00:00.000Z') / 1000
  const nextBoundaryUnix = Date.parse('2026-10-01T04:00:00.000Z') / 1000
  const db = {
    async query(sql) {
      if (String(sql).includes('canonical-migration:stripe-customer-owner')) {
        return { rows: [{ id: 9, is_active: true }] }
      }
      if (String(sql).includes('FROM billing_subscription')) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const stripe = {
    subscriptionSchedules: {
      async list() {
        return { data: [], has_more: false }
      },
    },
    subscriptions: {
      async list() {
        return { data: [], has_more: false }
      },
    },
    invoices: {
      async list() {
        return {
          data: [
            {
              id: 'in_orphan', status: 'open', subscription: 'sub_orphan', metadata: {},
              period_start: boundaryUnix, period_end: nextBoundaryUnix,
            },
            {
              id: 'in_annual', status: 'open', subscription: 'sub_annual', metadata: {},
              period_start: boundaryUnix, period_end: nextBoundaryUnix,
            },
          ],
          has_more: false,
        }
      },
      async listLineItems(invoiceId) {
        const subscription = invoiceId === 'in_annual' ? 'sub_annual' : 'sub_orphan'
        return {
          data: [{
            id: `il_${invoiceId}`,
            period: { start: boundaryUnix, end: nextBoundaryUnix },
            parent: { subscription_item_details: { subscription } },
          }],
          has_more: false,
        }
      },
    },
  }

  await assert.rejects(
    inspectCustomerCollectorsBeforeHouseholdActivation(db, stripe, {
      account: { id: 9, stripe_customer_id: 'cus_9' },
      billingMonth: '2026-09-01',
      facilityTimezone: 'America/New_York',
    }),
    (error) => {
      assert.equal(error.code, 'target_month_collector_inventory_failed')
      assert.equal(error.forwardOnly, true)
      assert.deepEqual(
        error.details.inventory.invoices.map((invoice) => invoice.id).sort(),
        ['in_annual', 'in_orphan'],
      )
      return true
    },
  )
})

test('household activation rejects a live annual Stripe subscription after schedule-first inventory', async () => {
  const calls = []
  const db = {
    async query(sql) {
      if (String(sql).includes('canonical-migration:stripe-customer-owner')) {
        return { rows: [{ id: 9, is_active: true }] }
      }
      if (String(sql).includes('FROM billing_subscription')) {
        return {
          rows: [{
            id: 20,
            status: 'active',
            source_type: 'annual_membership',
            pricing_option_key: 'annual_membership',
            stripe_subscription_id: 'sub_annual',
          }],
        }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const stripe = {
    subscriptionSchedules: {
      async list() {
        calls.push('schedules')
        return {
          data: [{ id: 'sub_sched_released', status: 'released', customer: 'cus_9' }],
          has_more: false,
        }
      },
    },
    subscriptions: {
      async list() {
        calls.push('subscriptions')
        return {
          data: [{
            id: 'sub_annual',
            status: 'active',
            customer: 'cus_9',
            metadata: {},
            items: { data: [] },
          }],
          has_more: false,
        }
      },
    },
    invoices: {
      async list() {
        calls.push('invoices')
        return { data: [], has_more: false }
      },
    },
  }

  await assert.rejects(
    inspectCustomerCollectorsBeforeHouseholdActivation(db, stripe, {
      account: { id: 9, stripe_customer_id: 'cus_9' },
      billingMonth: '2026-09-01',
      facilityTimezone: 'America/New_York',
    }),
    (error) => {
      assert.equal(error.code, 'stripe_customer_live_subscription_present')
      assert.equal(error.forwardOnly, true)
      assert.equal(error.details.inventory.liveSubscriptionCount, 1)
      assert.equal(error.details.inventory.annualMembershipCount, 1)
      return true
    },
  )
  assert.deepEqual(calls, ['schedules', 'subscriptions'])
})

test('canonical account verification inventories the whole Stripe customer by default', async () => {
  const boundaryUnix = Date.parse('2026-09-01T04:00:00.000Z') / 1000
  const nextBoundaryUnix = Date.parse('2026-10-01T04:00:00.000Z') / 1000
  const db = {
    async query(sql) {
      const text = String(sql)
      if (/SELECT \* FROM family_billing_account/.test(text)) {
        return { rows: [{ id: 9, stripe_customer_id: 'cus_9', household_monthly_billing_enabled: true }] }
      }
      if (/SELECT id, status, next_bill_date/.test(text)) return { rows: [] }
      if (/SELECT invoice\.\*/.test(text)) return { rows: [] }
      if (text.includes('canonical-billing:collectible-balance')) {
        return { rows: [{ collectible_balance_cents: 0 }] }
      }
      if (/SELECT COUNT\(\*\)::int AS count/.test(text)) return { rows: [{ count: 0, cents: 0 }] }
      if (/SELECT \* FROM billing_account_migration_item/.test(text)) return { rows: [] }
      if (/SELECT stripe_subscription_id/.test(text)) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  const stripe = {
    invoices: {
      async list() {
        return {
          data: [{
            id: 'in_unlinked', status: 'open', subscription: 'sub_unlinked', metadata: {},
            period_start: boundaryUnix, period_end: nextBoundaryUnix,
          }],
          has_more: false,
        }
      },
      async listLineItems() {
        return {
          data: [{
            id: 'il_unlinked', period: { start: boundaryUnix, end: nextBoundaryUnix },
            parent: { subscription_item_details: { subscription: 'sub_unlinked' } },
          }],
          has_more: false,
        }
      },
    },
  }
  const verification = await verifyCanonicalBillingAccount(db, {
    migration: {
      id: 44,
      family_billing_account_id: 9,
      cutover_month: '2026-09-01',
      parity_snapshot: { timezone: 'America/New_York' },
    },
    stripe,
    now: new Date('2026-09-02T12:00:00.000Z'),
  })

  assert.equal(verification.verified, false)
  assert.ok(verification.issues.some((issue) => issue.code === 'legacy_target_month_collector_present'))
  assert.equal(verification.snapshot.collectorInventory.legacyCollectorCount, 1)
})

test('forward-adoption verification preserves no-card accounts without weakening invoice ownership', async () => {
  let invalidSourceCount = 0
  const db = {
    async query(sql) {
      const text = String(sql)
      if (/SELECT \* FROM family_billing_account/.test(text)) {
        return {
          rows: [{
            id: 9,
            stripe_customer_id: null,
            household_monthly_billing_enabled: false,
          }],
        }
      }
      if (/SELECT id, status, next_bill_date/.test(text)) return { rows: [] }
      if (/SELECT invoice\.\*/.test(text)) {
        return {
          rows: [{
            id: 31,
            billing_month: '2026-09-01',
            status: 'payment_method_required',
            subtotal_cents: 48_500,
            credit_cents: 0,
            total_cents: 48_500,
            stripe_invoice_id: null,
            line_subtotal_cents: 48_500,
            line_credit_cents: 0,
            line_total_cents: 48_500,
            line_count: 1,
            invalid_source_count: invalidSourceCount,
            credit_applied_cents: 0,
            invoice_lines: [{
              id: 41,
              billingChargeId: 51,
              amountCents: 48_500,
              stripeInvoiceItemId: null,
            }],
          }],
        }
      }
      if (text.includes('canonical-billing:collectible-balance')) {
        return { rows: [{ collectible_balance_cents: 48_500 }] }
      }
      if (/SELECT \* FROM billing_account_migration_item/.test(text)) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  const options = {
    migration: {
      id: 44,
      family_billing_account_id: 9,
      cutover_month: '2026-09-01',
      parity_snapshot: { timezone: 'America/New_York' },
    },
    stripe: {},
    now: new Date('2026-09-02T12:00:00.000Z'),
    inspectCollectorInventory: false,
    requireHouseholdCollectionActive: false,
    allowPaymentMethodRequired: true,
    paymentMethodReadiness: { ready: false, reason: 'stripe_customer_missing' },
    recurringChargeInspector: async () => ({ issues: [], expectedChargeCount: 1 }),
  }
  const verified = await verifyCanonicalBillingAccount(db, options)
  assert.equal(verified.verified, true)
  assert.equal(verified.snapshot.paymentMethod.status, 'payment_method_required')
  assert.equal(verified.snapshot.remoteTargetInvoices[0].localOnly, true)

  invalidSourceCount = 1
  const rejected = await verifyCanonicalBillingAccount(db, options)
  assert.equal(rejected.verified, false)
  assert.ok(rejected.issues.some((issue) => (
    issue.code === 'household_invoice_line_ownership_mismatch'
  )))
})

test('forward adoption defers recurring-charge reconciliation until its future billing boundary', async () => {
  let recurringChargeInspectionCount = 0
  const db = {
    async query(sql) {
      const text = String(sql)
      if (/SELECT \* FROM family_billing_account/.test(text)) {
        return {
          rows: [{
            id: 9,
            stripe_customer_id: null,
            household_monthly_billing_enabled: false,
          }],
        }
      }
      if (/SELECT id, status, next_bill_date/.test(text)) return { rows: [] }
      if (/SELECT invoice\.\*/.test(text)) return { rows: [] }
      if (text.includes('canonical-billing:collectible-balance')) {
        return { rows: [{ collectible_balance_cents: 0 }] }
      }
      if (/SELECT \* FROM billing_account_migration_item/.test(text)) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }

  const verification = await verifyCanonicalBillingAccount(db, {
    migration: {
      id: 45,
      family_billing_account_id: 9,
      cutover_month: '2026-10-01',
      parity_snapshot: { timezone: 'America/New_York' },
    },
    stripe: {},
    now: new Date('2026-09-03T12:00:00.000Z'),
    inspectCollectorInventory: false,
    requireHouseholdCollectionActive: false,
    allowPaymentMethodRequired: true,
    allowFutureRecurringChargeDeferral: true,
    paymentMethodReadiness: { ready: false, reason: 'stripe_customer_missing' },
    recurringChargeInspector: async () => {
      recurringChargeInspectionCount += 1
      throw new Error('Recurring reconciliation must not run before the target month.')
    },
  })

  assert.equal(verification.verified, true)
  assert.equal(recurringChargeInspectionCount, 0)
  assert.equal(verification.snapshot.recurringChargeParity.deferredUntil, '2026-10-01')
})

test('forward adoption ignores a cancelled historical Stripe link but not active local collectors', async () => {
  const db = {
    async query(sql) {
      const text = String(sql)
      if (/SELECT \* FROM family_billing_account/.test(text)) {
        return { rows: [{ id: 9, stripe_customer_id: null, household_monthly_billing_enabled: false }] }
      }
      if (/SELECT id, status, next_bill_date/.test(text)) {
        return {
          rows: [{
            id: 26,
            status: 'cancelled',
            next_bill_date: null,
            stripe_subscription_id: 'sub_historical',
            stripe_subscription_item_id: null,
            stripe_subscription_schedule_id: null,
          }],
        }
      }
      if (/SELECT invoice\.\*/.test(text)) return { rows: [] }
      if (text.includes('canonical-billing:collectible-balance')) {
        return { rows: [{ collectible_balance_cents: 0 }] }
      }
      if (/SELECT \* FROM billing_account_migration_item/.test(text)) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  const options = {
    migration: {
      id: 46,
      family_billing_account_id: 9,
      cutover_month: '2026-10-01',
      parity_snapshot: { timezone: 'America/New_York' },
    },
    stripe: {},
    now: new Date('2026-09-03T12:00:00.000Z'),
    inspectCollectorInventory: false,
    requireHouseholdCollectionActive: false,
    allowPaymentMethodRequired: true,
    allowFutureRecurringChargeDeferral: true,
    paymentMethodReadiness: { ready: false, reason: 'stripe_customer_missing' },
  }

  const strict = await verifyCanonicalBillingAccount(db, options)
  assert.equal(strict.verified, false)
  assert.ok(strict.issues.some((issue) => issue.code === 'local_legacy_collection_attached'))

  const forwardAdoption = await verifyCanonicalBillingAccount(db, {
    ...options,
    allowInactiveLocalLegacyLinks: true,
  })
  assert.equal(forwardAdoption.verified, true)
  assert.deepEqual(forwardAdoption.snapshot.ignoredInactiveLocalSubscriptionIds, [26])
})

test('family-link repair normalizes only active direct-family evidence and never changes payer', async () => {
  const calls = []
  const db = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params })
      if (/SELECT account\.family_id/.test(String(sql))) {
        return {
          rows: [
            { family_id: 3, payer_member_id: 8, member_id: 8, membership_is_active: null },
            { family_id: 3, payer_member_id: 8, member_id: 9, membership_is_active: true },
          ],
        }
      }
      if (/INSERT INTO family_member/.test(String(sql))) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }
  const result = await repairProvableFamilyMemberLinks(db, { accountId: 4, apply: true })
  assert.deepEqual(result, {
    familyId: 3,
    candidateMemberIds: [8],
    normalizedMemberIds: [8],
    payerLinkCandidate: true,
    payerChanged: false,
  })
  const insert = calls.find((call) => /INSERT INTO family_member/.test(call.sql))
  assert.ok(insert)
  assert.match(insert.sql, /m\.family_id = \$1/)
  assert.match(insert.sql, /m\.is_active = TRUE/)
  assert.equal(calls.some((call) => /UPDATE\s+family_billing_account/i.test(call.sql)), false)
})

test('payer audit blocks invalid billing contact and duplicate Stripe customer ownership', () => {
  const issues = payerExceptions({
    id: 1,
    is_active: true,
    payer_member_id: 8,
    payer_id: 8,
    payer_is_active: true,
    payer_family_membership_active: true,
    payer_direct_family_active: true,
    billing_email: 'not-an-email',
    payer_email: 'payer@example.com',
    stripe_customer_id: 'cus_shared',
    // The second owner may be inactive; historical ownership is still
    // ambiguous and must block any new canonical collector.
    stripe_customer_account_count: 2,
    family_facility_id: 2,
    payer_facility_id: 2,
    facility_ids: [2],
    family_facility_count: 1,
    family_active_member_count: 1,
    family_member_facility_count: 1,
    facility_timezone: 'America/New_York',
  })
  assert.deepEqual(issues.map((issue) => issue.code), [
    'billing_contact_email_invalid',
    'stripe_customer_shared_between_accounts',
  ])
})

test('canonical activation rejects a Stripe customer retained by an inactive local account', async () => {
  const db = {
    async query(sql, params) {
      assert.match(String(sql), /canonical-migration:stripe-customer-owner/)
      assert.deepEqual(params, ['cus_shared'])
      return {
        rows: [
          { id: 8, is_active: true },
          { id: 19, is_active: false },
        ],
      }
    },
  }

  await assert.rejects(
    assertUniqueLocalStripeCustomerOwner(db, {
      accountId: 8,
      stripeCustomerId: 'cus_shared',
    }),
    (error) => (
      error?.code === 'stripe_customer_shared_between_accounts'
      && error?.forwardOnly === true
      && error?.details?.ownerAccountIds?.join(',') === '8,19'
    ),
  )
})

test('inactive direct-family payer is blocked rather than classified as repairable', () => {
  const issues = payerExceptions({
    is_active: true,
    payer_member_id: 8,
    payer_id: 8,
    payer_is_active: false,
    // Defense in depth: even a stale/precomputed truthy direct-family flag
    // cannot make an inactive payer eligible for deterministic link repair.
    payer_direct_family_active: true,
    payer_family_membership_active: false,
    billing_email: 'billing@example.com',
    payer_email: 'payer@example.com',
    stripe_customer_id: null,
    stripe_customer_active_account_count: 0,
    family_facility_id: 2,
    payer_facility_id: 2,
    facility_ids: [2],
    family_facility_count: 1,
    family_active_member_count: 1,
    family_member_facility_count: 1,
    facility_timezone: 'America/New_York',
  })
  const payerIssue = issues.find((issue) => issue.code === 'payer_not_active_family_member')
  assert.ok(payerIssue)
  assert.equal(payerIssue.repairable, false)
})

test('payer audit quarantines family, payer, member, and migration-run facility drift', () => {
  const issues = payerExceptions({
    is_active: true,
    payer_member_id: 8,
    payer_id: 8,
    payer_is_active: true,
    payer_family_membership_active: true,
    payer_direct_family_active: true,
    billing_email: 'billing@example.com',
    payer_email: 'payer@example.com',
    stripe_customer_id: null,
    stripe_customer_active_account_count: 0,
    family_facility_id: 2,
    payer_facility_id: 3,
    facility_ids: [2, 4],
    family_facility_count: 2,
    family_active_member_count: 2,
    family_member_facility_count: 2,
    facility_timezone: 'America/New_York',
  }, { runFacilityId: 5 })

  const facilityIssue = issues.find((issue) => issue.code === 'facility_scope_mismatch')
  assert.ok(facilityIssue)
  assert.equal(facilityIssue.severity, 'blocking')
  assert.deepEqual(facilityIssue.details.mismatches, [
    'payer_facility_mismatch',
    'active_member_facility_mismatch',
    'migration_run_facility_mismatch',
  ])
  assert.equal(classifyBillingMigrationIssues(issues), 'blocked')
})

test('date audit keeps signup, effective, class, and service periods authoritative', () => {
  const issues = authoritativeBillingDateExceptions({
    subscriptions: [{
      id: 4,
      status: 'active',
      sourceType: 'scheduling_signup',
      sourceId: '10',
      signupStatus: 'confirmed',
      signupCreatedAt: null,
      enrollmentStartDate: null,
      classActiveStart: '2026-10-01',
      classActiveEnd: '2026-09-01',
    }],
    artifacts: [{
      itemType: 'billing_charge',
      sourceSnapshot: {
        id: 7,
        charge_type: 'recurring',
        billing_interval: 'month',
        source_type: 'scheduling_signup',
        subscription_id: 4,
        service_period_start: null,
        service_period_end: null,
      },
    }],
  })
  assert.deepEqual(issues.map((issue) => issue.code), [
    'recurring_signup_timestamp_missing',
    'enrollment_effective_date_missing',
    'class_active_dates_invalid',
    'recurring_charge_service_period_missing',
  ])
  assert.equal(issues.at(-1).repairable, true)
})

test('migration classification is ready, repairable, or blocked from explicit taxonomy', () => {
  assert.equal(classifyBillingMigrationIssues([]), 'ready')
  assert.equal(classifyBillingMigrationIssues([
    { severity: 'blocking', repairable: true },
    { severity: 'warning', repairable: false },
  ]), 'repairable')
  assert.equal(classifyBillingMigrationIssues([
    { severity: 'blocking', repairable: true },
    { severity: 'critical', repairable: false },
  ]), 'blocked')
})

test('drop-in audit recognizes the production and historical charge source names', () => {
  assert.deepEqual(CANONICAL_DROP_IN_CHARGE_SOURCE_TYPES, ['drop_in', 'drop_in_registration'])
})

test('a positive confirmed drop-in without a canonical charge blocks cutover', () => {
  const issues = missingDropInChargeExceptions({
    artifacts: [{
      itemType: 'other',
      sourceSnapshot: {
        id: 701,
        member_id: 8,
        record_type: 'drop_in',
        amount_cents: 2_500,
        status: 'confirmed',
        class_date: '2026-08-20',
      },
    }, {
      itemType: 'other',
      sourceSnapshot: {
        id: 702,
        member_id: 8,
        record_type: 'drop_in',
        amount_cents: 0,
        status: 'confirmed',
        class_date: '2026-08-21',
      },
    }],
  })
  assert.equal(issues.length, 1)
  assert.equal(issues[0].code, 'drop_in_charge_missing')
  assert.equal(issues[0].severity, 'blocking')
  assert.equal(issues[0].repairable, false)
  assert.equal(classifyBillingMigrationIssues(issues), 'blocked')
})

test('bundle repair updates only the derived pass balance from signed ledger evidence', async () => {
  const calls = []
  let releases = 0
  const db = {
    async connect() { assert.fail('a checked-out PoolClient must not reconnect') },
    async query(sql, params) {
      const text = String(sql)
      calls.push({ sql: text, params })
      if (/SELECT pass\.id/.test(text)) {
        return { rows: [{
          id: 5,
          member_id: 8,
          class_count_purchased: 10,
          classes_remaining: 9,
          recomputed_classes_remaining: 7,
        }] }
      }
      if (/UPDATE member_multi_class_pass/.test(text)) return { rows: [{ id: 5 }] }
      return { rows: [] }
    },
    release() { releases += 1 },
  }
  const dryRun = await repairBundleEntitlementBalances(db, { accountId: 2, apply: false })
  assert.equal(dryRun.candidates[0].recomputedClassesRemaining, 7)
  assert.equal(calls.some((call) => /UPDATE member_multi_class_pass/.test(call.sql)), false)

  calls.length = 0
  const applied = await repairBundleEntitlementBalances(db, { accountId: 2, apply: true })
  assert.equal(applied.repaired[0].beforeClassesRemaining, 9)
  const update = calls.find((call) => /UPDATE member_multi_class_pass/.test(call.sql))
  assert.deepEqual(update.params, [5, 7, 9])
  assert.equal(calls.some((call) => /INSERT INTO multi_class_pass_redemption/.test(call.sql)), false)
  assert.equal(releases, 0)
})

test('canonical local enrollment repair plans only provable recurring pricing and no Stripe action', () => {
  const result = buildCanonicalLocalEnrollmentRepairPlans([
    {
      signup_id: 10, member_id: 8, slot_group_id: 2,
      enrollment_start_date: '2026-08-28', form_title: 'Tornadoes', pricing_option_key: 'monthly',
    },
    { signup_id: 11, member_id: 8, slot_group_id: null, enrollment_start_date: '2026-08-28' },
    { signup_id: 12, member_id: 8, slot_group_id: 2, enrollment_start_date: '2026-08-28' },
  ], {
    lines: [{ signupId: 10, grossCents: 15_000, discountCents: 3_000, netCents: 12_000 }],
  }, '2026-09-01')
  assert.deepEqual(result.planned, [{
    signupId: 10,
    memberId: 8,
    description: 'Tornadoes',
    enrollmentStartDate: '2026-08-28',
    pricingOptionKey: 'monthly',
    grossCents: 15_000,
    discountCents: 3_000,
    netCents: 12_000,
    nextBillDate: '2026-09-01',
  }])
  assert.deepEqual(result.skipped, [
    { signupId: 11, reason: 'class_link_ambiguous' },
    { signupId: 12, reason: 'pricing_unresolved' },
  ])
  assert.equal(JSON.stringify(result).includes('stripe'), false)
})

test('legacy discount repair accepts only rule-backed promo attribution', () => {
  const result = buildProvableLegacyAdjustmentGroups([
    {
      id: 1,
      manual_discount_rule_id: 7,
      manual_discount_reason: 'Original promo SAVE20',
      rule_type: 'promo_code',
      rule_config: { code: 'SAVE20' },
    },
    {
      id: 2,
      manual_discount_rule_id: null,
      manual_discount_reason: 'manual courtesy',
      rule_type: null,
      rule_config: {},
    },
  ])
  assert.deepEqual(result.planned, [{
    ruleId: 7,
    reason: 'Original promo SAVE20',
    signupIds: [1],
  }])
  assert.deepEqual(result.skipped, [{ signupId: 2, reason: 'legacy_discount_attribution_ambiguous' }])
})

function cutoverItem(overrides = {}) {
  return {
    id: 31,
    billing_account_migration_id: 12,
    item_type: 'billing_subscription',
    source_id: '22',
    target_id: '22',
    state: 'planned',
    lock_version: 0,
    billing_subscription_id: 22,
    former_stripe_subscription_id: 'sub_22',
    former_stripe_item_id: 'si_22',
    former_stripe_schedule_id: null,
    source_snapshot: {
      local: {
        id: 22,
        stripeSubscriptionId: 'sub_22',
        stripeSubscriptionItemId: 'si_22',
        stripeSubscriptionScheduleId: null,
        priceSyncStatus: 'synced',
      },
      remote: { id: 'sub_22', customerId: 'cus_1', cancelAt: null },
    },
    target_snapshot: {
      cancellationScheduled: true,
      cancellationOwnedByMigration: true,
      cancelAt: 1_787_895_200,
    },
    ...overrides,
  }
}

function reversibleStripe({ status = 'active', cancelAt = 1_787_895_200 } = {}) {
  const state = { status, cancelAt, updates: [] }
  return {
    state,
    subscriptions: {
      async retrieve(id) {
        return {
          id,
          status: state.status,
          customer: 'cus_1',
          cancel_at: state.cancelAt,
          cancel_at_period_end: false,
          items: { data: [{ id: 'si_22', quantity: 1, price: { id: 'price_1', unit_amount: 1000, currency: 'usd', recurring: { interval: 'month' } } }] },
        }
      },
      async update(id, payload, options) {
        state.updates.push({ id, payload, options })
        state.cancelAt = null
        return { id }
      },
    },
  }
}

test('remote cutover preflight distinguishes reversible and irreversible subscriptions', async () => {
  const active = await inspectRemoteCutoverReversibility(reversibleStripe(), [cutoverItem()], {
    boundaryUnix: 1_787_895_200,
  })
  assert.equal(active.allReversible, true)
  assert.equal(active.hasIrreversibleRetirement, false)

  const retired = await inspectRemoteCutoverReversibility(
    reversibleStripe({ status: 'canceled', cancelAt: null }),
    [cutoverItem()],
    { boundaryUnix: 1_787_895_200 },
  )
  assert.equal(retired.allReversible, false)
  assert.equal(retired.hasIrreversibleRetirement, true)
})

test('boundary revalidation rejects facility and timezone drift from the frozen run contract', () => {
  const run = {
    facility_id: 2,
    facility_timezone: 'America/New_York',
    target_month: '2026-09-01',
  }
  const migration = {
    family_billing_account_id: 7,
    account_snapshot: {
      id: 7,
      familyId: 3,
      payerMemberId: 8,
      stripeCustomerId: 'cus_1',
      facilityId: 2,
      facilityTimezone: 'America/New_York',
    },
    parity_snapshot: {
      timezone: 'America/New_York',
      targetMonth: '2026-09-01',
    },
  }
  const matchingAudit = {
    accountId: 7,
    targetMonth: '2026-09-01',
    facilityTimezone: 'America/New_York',
    accountSnapshot: { ...migration.account_snapshot },
  }

  assert.equal(assertBoundaryRevalidationContract({
    run,
    migration,
    audit: matchingAudit,
    targetMonth: '2026-09-01',
  }), true)

  assert.throws(
    () => assertBoundaryRevalidationContract({
      run,
      migration,
      audit: {
        ...matchingAudit,
        facilityTimezone: 'America/Chicago',
        accountSnapshot: {
          ...matchingAudit.accountSnapshot,
          facilityId: 4,
          facilityTimezone: 'America/Chicago',
        },
      },
      targetMonth: '2026-09-01',
    }),
    (error) => {
      assert.equal(error.code, 'boundary_revalidation_contract_drift')
      assert.equal(error.preserveMigrationState, true)
      assert.ok(error.details.mismatches.some((entry) => entry.field === 'run facility'))
      assert.ok(error.details.mismatches.some((entry) => entry.field === 'run facility timezone'))
      return true
    },
  )
})

test('boundary revalidation uses the accepted repair baseline without rewriting discovery evidence', () => {
  const run = {
    facility_id: 2,
    facility_timezone: 'America/New_York',
    target_month: '2026-09-01',
  }
  const migration = {
    family_billing_account_id: 7,
    account_snapshot: {
      id: 7, familyId: 3, payerMemberId: 999, stripeCustomerId: 'cus_old',
      facilityId: 2, facilityTimezone: 'America/New_York',
    },
    pricing_snapshot: { timezone: 'America/New_York', targetMonth: '2026-09-01' },
    accepted_account_snapshot: {
      id: 7, familyId: 3, payerMemberId: 8, stripeCustomerId: 'cus_1',
      facilityId: 2, facilityTimezone: 'America/New_York',
    },
    accepted_pricing_snapshot: { timezone: 'America/New_York', targetMonth: '2026-09-01' },
  }
  assert.equal(assertBoundaryRevalidationContract({
    run,
    migration,
    targetMonth: '2026-09-01',
    audit: {
      accountId: 7,
      targetMonth: '2026-09-01',
      facilityTimezone: 'America/New_York',
      accountSnapshot: { ...migration.accepted_account_snapshot },
    },
  }), true)
  assert.equal(migration.account_snapshot.payerMemberId, 999)
})

test('boundary revalidation normalizes only its exact migration-owned Stripe cancellation', () => {
  const boundaryUnix = Date.parse('2026-09-01T04:00:00.000Z') / 1000
  const accepted = {
    accountSnapshot: {
      id: 7, familyId: 3, payerMemberId: 8, stripeCustomerId: 'cus_1',
      facilityId: 2, facilityTimezone: 'America/New_York',
    },
    pricingSnapshot: {
      targetMonth: '2026-09-01', timezone: 'America/New_York',
      boundary: {
        targetMonth: '2026-09-01', currentMonth: '2026-08-01',
        facilityDate: '2026-08-20', boundaryReached: false, boundaryUnix,
      },
      parity: { canonical: { netCents: 12_000 } },
    },
    ledgerSnapshot: { ledger: { balance_cents: 4_000 }, artifactManifestHash: 'ledger-v1' },
    initialStripeSnapshot: {
      customer: { customerId: 'cus_1', hasDefaultPaymentMethod: true },
      subscriptions: [{
        id: 'sub_1', status: 'active', customerId: 'cus_1',
        cancelAt: null, cancelAtPeriodEnd: false,
        items: [{ id: 'si_1', unitAmount: 12_000, interval: 'month', intervalCount: 1 }],
      }],
      customerSubscriptionInventory: {
        customerId: 'cus_1', liveSubscriptionCount: 1,
        subscriptions: [{
          id: 'sub_1', status: 'active', customerId: 'cus_1',
          classification: 'nonannual', cancelAt: null, cancelAtPeriodEnd: false,
          items: [{ id: 'si_1', unitAmount: 12_000, interval: 'month', intervalCount: 1 }],
        }],
      },
    },
    rollbackSnapshot: {
      account: { id: 7, householdMonthlyBillingEnabled: false, stripeCustomerId: 'cus_1' },
      subscriptions: [{ id: 21, status: 'active', nextBillDate: '2026-09-01' }],
    },
  }
  const migration = {
    family_billing_account_id: 7,
    accepted_account_snapshot: accepted.accountSnapshot,
    accepted_pricing_snapshot: accepted.pricingSnapshot,
    accepted_ledger_snapshot: accepted.ledgerSnapshot,
    accepted_stripe_snapshot: accepted.initialStripeSnapshot,
    accepted_rollback_snapshot: accepted.rollbackSnapshot,
    accepted_snapshot_hash: billingMigrationSnapshotHash(accepted),
  }
  const audit = {
    accountId: 7,
    accountSnapshot: structuredClone(accepted.accountSnapshot),
    pricingSnapshot: structuredClone(accepted.pricingSnapshot),
    ledgerSnapshot: structuredClone(accepted.ledgerSnapshot),
    initialStripeSnapshot: structuredClone(accepted.initialStripeSnapshot),
    rollbackSnapshot: structuredClone(accepted.rollbackSnapshot),
  }
  audit.initialStripeSnapshot.subscriptions[0].cancelAt = boundaryUnix
  audit.initialStripeSnapshot.subscriptions[0].cancelAtPeriodEnd = true
  audit.initialStripeSnapshot.customerSubscriptionInventory.subscriptions[0].cancelAt = boundaryUnix
  audit.initialStripeSnapshot.customerSubscriptionInventory.subscriptions[0].cancelAtPeriodEnd = true
  audit.pricingSnapshot.boundary.currentMonth = '2026-08-01'
  audit.pricingSnapshot.boundary.facilityDate = '2026-08-31'
  audit.pricingSnapshot.boundary.boundaryReached = false

  const matched = assertBoundaryRevalidationInvariant({ migration, audit, boundaryUnix })
  assert.equal(matched.acceptedInvariantHash, matched.currentInvariantHash)

  const priceDrift = structuredClone(audit)
  priceDrift.pricingSnapshot.parity.canonical.netCents = 13_000
  assert.throws(
    () => assertBoundaryRevalidationInvariant({ migration, audit: priceDrift, boundaryUnix }),
    (error) => error.code === 'boundary_revalidation_snapshot_drift' && error.preserveMigrationState === true,
  )

  const remoteDrift = structuredClone(audit)
  remoteDrift.initialStripeSnapshot.subscriptions[0].items[0].unitAmount = 13_000
  assert.throws(
    () => assertBoundaryRevalidationInvariant({ migration, audit: remoteDrift, boundaryUnix }),
    (error) => error.code === 'boundary_revalidation_snapshot_drift',
  )

  const ledgerDrift = structuredClone(audit)
  ledgerDrift.ledgerSnapshot.ledger.balance_cents = 5_000
  assert.throws(
    () => assertBoundaryRevalidationInvariant({ migration, audit: ledgerDrift, boundaryUnix }),
    (error) => error.code === 'boundary_revalidation_snapshot_drift',
  )
})

test('remote retirement becomes durably forward-only before Stripe cancellation begins', async () => {
  let migration = {
    id: 12,
    billing_migration_run_id: 5,
    family_billing_account_id: 7,
    state: 'detached',
    lock_version: 3,
    lease_owner: 'worker-1',
    lease_expires_at: new Date(Date.now() + 60_000),
    payer_validation_status: 'verified',
    parity_status: 'matched',
    parity_snapshot: { timezone: 'America/New_York' },
    stripe_snapshot: {},
  }
  const secondItem = cutoverItem({
    id: 32,
    source_id: '23',
    target_id: '23',
    billing_subscription_id: 23,
    former_stripe_subscription_id: 'sub_23',
    former_stripe_item_id: 'si_23',
    source_snapshot: {
      local: {
        id: 23,
        stripeSubscriptionId: 'sub_23',
        stripeSubscriptionItemId: 'si_23',
        stripeSubscriptionScheduleId: null,
        priceSyncStatus: 'synced',
      },
      remote: { id: 'sub_23', customerId: 'cus_1', cancelAt: null },
    },
  })
  let items = [cutoverItem(), secondItem]
  const calls = []
  const db = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (/SELECT \* FROM billing_account_migration_item/.test(text)) return { rows: items }
      if (/SET payer_validation_status = \$3/.test(text)) {
        migration = {
          ...migration,
          parity_snapshot: JSON.parse(params[4]),
          stripe_snapshot: JSON.parse(params[5]),
          last_error: params[6],
          lock_version: migration.lock_version + 1,
        }
        return { rows: [migration] }
      }
      if (/SET state = \$4/.test(text)) {
        migration = {
          ...migration,
          state: params[3],
          last_error: params[5],
          lock_version: migration.lock_version + 1,
        }
        return { rows: [migration] }
      }
      if (/SET lease_expires_at = now\(\)/.test(text)) {
        migration = { ...migration, lock_version: migration.lock_version + 1 }
        return { rows: [migration] }
      }
      if (/UPDATE billing_account_migration_item item/.test(text)) {
        items = items.map((item) => item.id === Number(params[0])
          ? {
              ...item,
              state: params[2],
              target_snapshot: JSON.parse(params[4]),
              lock_version: item.lock_version + 1,
            }
          : item)
        return { rows: [items.find((item) => item.id === Number(params[0]))] }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  const remoteStatus = new Map([['sub_22', 'active'], ['sub_23', 'active']])
  const stripe = {
    subscriptions: {
      async retrieve(id) {
        return {
          id,
          status: remoteStatus.get(id),
          customer: 'cus_1',
          cancel_at: null,
          cancel_at_period_end: false,
          items: { data: [{ id: id === 'sub_22' ? 'si_22' : 'si_23' }] },
        }
      },
      async cancel(id) {
        assert.equal(migration.state, 'failed_forward_only')
        if (id === 'sub_23') throw new Error('simulated Stripe interruption')
        remoteStatus.set(id, 'canceled')
        return { id }
      },
    },
  }

  await assert.rejects(
    retireRemoteCollection(db, stripe, migration, {
      runId: 5,
      accountId: 7,
      targetMonth: '2026-09-01',
      leaseOwner: 'worker-1',
      apply: true,
    }),
    /simulated Stripe interruption/,
  )

  assert.equal(migration.state, 'failed_forward_only')
  assert.equal(migration.parity_snapshot.remoteRetirementIntent, 'forward_only_remote_retirement')
  assert.equal(items[0].target_snapshot.remoteRetired, true)
  assert.equal(items[1].target_snapshot.remoteRetired, undefined)
  const forwardOnlyTransition = calls.find((call) => /SET state = \$4/.test(call.text))
  assert.equal(forwardOnlyTransition.params[2], 'detached')
  assert.equal(forwardOnlyTransition.params[3], 'failed_forward_only')
})

test('rollback remote clearing resumes idempotently after an interruption', async () => {
  let item = cutoverItem()
  const db = {
    async query(sql, params) {
      const text = String(sql)
      if (/SELECT \* FROM billing_account_migration_item/.test(text)) return { rows: [item] }
      if (/UPDATE billing_account_migration_item item/.test(text)) {
        item = {
          ...item,
          state: params[2],
          target_id: params[3],
          target_snapshot: JSON.parse(params[4]),
          lock_version: item.lock_version + 1,
        }
        return { rows: [item] }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  const stripe = reversibleStripe()
  const migration = { id: 12, state: 'detached' }
  const first = await clearRemoteCollectionForRollback(db, stripe, migration, {
    accountId: 7,
    targetMonth: '2026-09-01',
    boundaryUnix: 1_787_895_200,
  })
  assert.equal(first.cleared, 1)
  assert.equal(stripe.state.cancelAt, null)
  assert.equal(item.state, 'rollback_required')

  const resumed = await clearRemoteCollectionForRollback(db, stripe, migration, {
    accountId: 7,
    targetMonth: '2026-09-01',
    boundaryUnix: 1_787_895_200,
  })
  assert.equal(resumed.cleared, 0)
  assert.equal(stripe.state.updates.length, 1)
  assert.equal(stripe.state.updates[0].options.idempotencyKey, 'billing-cutover:7:2026-09-01:rollback:sub_22')
})

test('detached rollback atomically restores the exact frozen local Stripe links', async () => {
  let migration = {
    id: 12,
    billing_migration_run_id: 5,
    family_billing_account_id: 7,
    state: 'detached',
    lock_version: 3,
    lease_owner: 'worker-1',
    lease_expires_at: new Date(Date.now() + 60_000),
  }
  let item = cutoverItem({
    state: 'rollback_required',
    target_snapshot: { ...cutoverItem().target_snapshot, rollbackRemoteClearedAt: '2026-08-31T00:00:00.000Z' },
  })
  const calls = []
  const db = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK' || /pg_advisory_xact_lock/.test(text)) return { rows: [] }
      if (/SELECT \*\s+FROM billing_account_migration\s+WHERE/.test(text)) return { rows: [migration] }
      if (/SELECT household_monthly_billing_enabled/.test(text)) return { rows: [{ household_monthly_billing_enabled: false }] }
      if (/SELECT \* FROM billing_account_migration_item/.test(text)) return { rows: [item] }
      if (/SELECT stripe_subscription_id, stripe_subscription_item_id/.test(text)) {
        return { rows: [{
          stripe_subscription_id: null,
          stripe_subscription_item_id: null,
          stripe_subscription_schedule_id: null,
          price_sync_status: 'not_required',
        }] }
      }
      if (/UPDATE billing_subscription/.test(text)) return { rows: [{ id: 22 }] }
      if (/UPDATE billing_account_migration_item item/.test(text)) {
        item = { ...item, state: params[2], target_snapshot: JSON.parse(params[4]), lock_version: item.lock_version + 1 }
        return { rows: [item] }
      }
      if (/UPDATE billing_account_migration migration/.test(text)) {
        migration = { ...migration, state: params[3], lock_version: migration.lock_version + 1 }
        return { rows: [migration] }
      }
      if (/INSERT INTO billing_account_activity/.test(text)) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  const restored = await restoreFrozenLocalCollectionAfterRollback(db, migration, {
    runId: 5,
    accountId: 7,
    targetMonth: '2026-09-01',
    leaseOwner: 'worker-1',
  })
  assert.equal(restored.state, 'rolled_back')
  const localUpdate = calls.find((call) => /UPDATE billing_subscription/.test(call.text))
  assert.deepEqual(localUpdate.params, [22, 'sub_22', 'si_22', null, 'synced'])
  assert.equal(item.target_snapshot.localLinksRestored, true)
  assert.ok(calls.find((call) => call.text === 'COMMIT'))
})

test('boundary outage recovery detaches still-matching local links after remote retirement', async () => {
  let migration = {
    id: 12,
    billing_migration_run_id: 5,
    family_billing_account_id: 7,
    state: 'cancellation_scheduled',
    lock_version: 3,
    lease_owner: 'worker-1',
    lease_expires_at: new Date(Date.now() + 60_000),
  }
  let item = cutoverItem()
  const calls = []
  const db = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text === 'BEGIN' || text === 'COMMIT' || text === 'ROLLBACK' || /pg_advisory_xact_lock/.test(text)) return { rows: [] }
      if (/SELECT \*\s+FROM billing_account_migration\s+WHERE/.test(text)) return { rows: [migration] }
      if (/SELECT \* FROM billing_account_migration_item/.test(text)) return { rows: [item] }
      if (/SELECT \* FROM billing_subscription/.test(text)) {
        return { rows: [{
          id: 22,
          stripe_subscription_id: 'sub_22',
          stripe_subscription_item_id: 'si_22',
          stripe_subscription_schedule_id: null,
        }] }
      }
      if (/UPDATE billing_subscription/.test(text)) return { rows: [] }
      if (/UPDATE billing_account_migration_item item/.test(text)) {
        item = { ...item, state: params[2], target_snapshot: JSON.parse(params[4]), lock_version: item.lock_version + 1 }
        return { rows: [item] }
      }
      if (/UPDATE billing_account_migration migration/.test(text)) {
        migration = { ...migration, state: params[3], lock_version: migration.lock_version + 1 }
        return { rows: [migration] }
      }
      if (/INSERT INTO billing_account_activity/.test(text)) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  const recovered = await recoverBoundaryRetirementBeforeDetachment(
    db,
    reversibleStripe({ status: 'canceled', cancelAt: null }),
    migration,
    {
      runId: 5,
      accountId: 7,
      targetMonth: '2026-09-01',
      boundary: { boundaryUnix: 1_787_895_200, timeZone: 'America/New_York' },
      leaseOwner: 'worker-1',
      apply: true,
    },
  )
  assert.equal(recovered.migration.state, 'detached')
  assert.equal(item.target_snapshot.recoveredAfterRemoteRetirement, true)
  assert.ok(calls.find((call) => /SET stripe_subscription_id = NULL/.test(call.text)))
  assert.ok(calls.find((call) => call.text === 'COMMIT'))
})
