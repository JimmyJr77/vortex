import test from 'node:test'
import assert from 'node:assert/strict'
import {
  adminBillingIdempotencyScopeKey,
  adjustAdminMultiClassPass,
  assertAdminExternalPaymentReplayMatches,
  loadAdminCustomerBillingAccount,
  loadAdminCustomerBillingMigrationStatus,
  loadScopedAdminReceiptReplay,
  recordAdminExternalPayment,
  updateAdminCustomerBillingAccount,
} from '../customerBillingAdminOperations.js'

test('modern admin billing services fail closed without an authenticated facility', async () => {
  let queried = false
  const pool = { async query() { queried = true; return { rows: [] } } }
  await assert.rejects(
    loadAdminCustomerBillingAccount(pool, 7, null),
    (error) => error.statusCode === 403,
  )
  assert.equal(queried, false)
})

test('pass adjustments resolve canonical household membership within the admin facility', async () => {
  let scopeSql = ''
  const client = {
    async query(sql, params = []) {
      const text = String(sql)
      if (text === 'BEGIN' || text === 'ROLLBACK' || text.includes('pg_advisory_xact_lock')) return { rows: [] }
      if (text.includes('FROM member_multi_class_pass pass')) {
        scopeSql = text
        return { rows: [] }
      }
      throw new Error(`Unexpected query: ${text}`)
    },
    release() {},
  }
  const pool = { async connect() { return client } }

  await assert.rejects(
    adjustAdminMultiClassPass(pool, {
      passId: 10,
      facilityId: 2,
      requestKey: 'pass-adjustment:test-key',
      input: { delta: 1, reason: 'Correction' },
    }),
    /not found/,
  )
  assert.match(scopeSql, /family\.facility_id = \$2/)
  assert.match(scopeSql, /FROM family_member household_membership/)
  assert.match(scopeSql, /NOT EXISTS[\s\S]*household_membership_history/)
  assert.doesNotMatch(scopeSql, /family\.id = member\.family_id/)
})

test('admin migration status is read-only and returns parity plus unresolved evidence', async () => {
  const calls = []
  const pool = {
    async query(sql) {
      calls.push(sql)
      if (sql.includes('FROM family\n')) {
        return { rows: [{
          account_id: 8,
          migration_id: 18,
          state: 'blocked',
          parity_status: 'mismatched',
          parity_snapshot: { balanceCents: { legacy: 100, canonical: 90 } },
          cutover_month: '2026-10-01',
          attempt_count: 2,
          last_error: null,
          migration_updated_at: '2026-08-31T12:00:00Z',
          run_id: 4,
          migration_key: 'canonical-household-billing-v1',
          run_mode: 'shadow',
          run_status: 'running',
          code_version: 'abc123',
          manifest_checksum: 'def456',
          run_configuration: { cohort: 'pilot' },
        }] }
      }
      if (sql.includes('FROM billing_migration_exception')) {
        return { rows: [{
          id: 31,
          exception_type: 'payer_missing',
          severity: 'blocking',
          status: 'open',
          message: 'A payer is required.',
          details: {},
          resolution_note: null,
          detected_at: '2026-08-31T11:00:00Z',
          resolved_at: null,
        }] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
  }

  const status = await loadAdminCustomerBillingMigrationStatus(pool, { familyId: 7, facilityId: 2 })
  assert.equal(status.state, 'blocked')
  assert.equal(status.parityStatus, 'mismatched')
  assert.equal(status.run.id, 4)
  assert.equal(status.exceptions[0].type, 'payer_missing')
  assert.equal(calls.some((sql) => /\b(?:INSERT|UPDATE|DELETE|CREATE|ALTER|DROP)\b/i.test(sql)), false)
})

test('account PATCH preserves omitted contact fields and never guesses a payer', async () => {
  const calls = []
  const before = {
    id: 8,
    family_id: 7,
    family_name: 'O’Brien',
    payer_member_id: 44,
    billing_email: 'old@example.com',
    billing_phone: '555-0100',
    billing_street: '1 Main St',
    billing_city: 'New York',
    billing_state: 'NY',
    billing_zip: '10001',
    is_active: true,
    updated_at: '2026-08-30T12:00:00Z',
  }
  const client = {
    async query(sql, params = []) {
      calls.push({ sql, params })
      if (sql === 'BEGIN' || sql === 'COMMIT' || sql === 'ROLLBACK' || sql.includes('pg_advisory_xact_lock')) return { rows: [] }
      if (sql.includes('SELECT id, family_name')) return { rows: [{ id: 7, family_name: 'O’Brien' }] }
      if (sql.includes('FROM family_billing_account account') && sql.includes('FOR UPDATE')) return { rows: [before] }
      if (sql.includes('FROM member') && sql.includes('family_member')) return { rows: [{ id: 44 }] }
      if (sql.includes('UPDATE family_billing_account')) {
        return { rows: [{
          ...before,
          payer_member_id: params[1],
          billing_email: params[2],
          billing_phone: params[3],
          billing_street: params[4],
          billing_city: params[5],
          billing_state: params[6],
          billing_zip: params[7],
          is_active: params[8],
          updated_at: '2026-08-31T12:00:00Z',
        }] }
      }
      if (sql.includes('INSERT INTO billing_account_activity')) return { rows: [] }
      throw new Error(`Unexpected query: ${sql}`)
    },
    release() {},
  }
  const pool = { async connect() { return client } }

  const updated = await updateAdminCustomerBillingAccount(pool, {
    familyId: 7,
    facilityId: 2,
    actorUserId: 9,
    input: { billingEmail: 'new@example.com' },
  })

  assert.equal(updated.payerMemberId, 44)
  assert.equal(updated.billingEmail, 'new@example.com')
  assert.equal(updated.billingPhone, '555-0100')
  const update = calls.find((call) => call.sql.includes('UPDATE family_billing_account'))
  const payerValidation = calls.find((call) => call.sql.includes('FROM member') && call.sql.includes('family_member'))
  assert.equal(update.params[1], 44)
  assert.equal(update.params[3], '555-0100')
  assert.match(payerValidation.sql, /member\.family_id = \$2/)
  assert.match(payerValidation.sql, /membership\.is_active = TRUE/)
  assert.equal(calls.some((call) => call.sql.includes('INSERT INTO family_billing_account')), false)
})

test('external payment recording and allocation share the household invoice session lock', async () => {
  const events = []
  let locked = false
  let connectCalls = 0
  const payment = {
    id: 71,
    family_billing_account_id: 8,
    amount_cents: 10000,
    paid_at: new Date('2026-08-31T18:00:00Z'),
    method: 'check',
    note: 'Front desk',
    external_processor: 'manual_admin',
    external_reference: 'check-123',
    external_status: 'settled',
    request_key: 'manual-payment:test-replay',
  }
  const client = {
    async query(sql) {
      const text = String(sql)
      if (text.includes('pg_advisory_lock(hashtextextended')) {
        locked = true
        events.push('lock')
        return { rows: [] }
      }
      if (text.includes('pg_advisory_unlock(hashtextextended')) {
        events.push('unlock')
        locked = false
        return { rows: [] }
      }
      if (text.includes('request_key = ANY') && text.includes('FROM billing_payment')) {
        events.push(`payment-read:${locked}`)
        return { rows: [payment] }
      }
      if (text.includes('SELECT c.id,') && text.includes('FROM billing_charge c')) {
        events.push(`allocation-read:${locked}`)
        return { rows: [] }
      }
      return { rows: [], rowCount: 0 }
    },
    release() {
      events.push('release')
    },
  }
  const pool = {
    async query(sql) {
      if (String(sql).includes('FROM family')) {
        return {
          rows: [{
            id: 8,
            family_id: 7,
            family_name: 'O’Brien',
            billing_email: null,
            is_active: true,
          }],
        }
      }
      throw new Error(`Unexpected pool query outside the locked client: ${sql}`)
    },
    async connect() {
      connectCalls += 1
      return client
    },
  }

  const result = await recordAdminExternalPayment(pool, {
    familyId: 7,
    facilityId: 2,
    actorUserId: 9,
    requestKey: payment.request_key,
    input: { amountCents: 10000, method: 'check', note: 'Front desk', externalReference: 'check-123' },
  })

  assert.equal(result.replayed, true)
  assert.equal(connectCalls, 1)
  assert.ok(events.includes('payment-read:true'))
  assert.ok(events.includes('allocation-read:true'))
  assert.ok(events.indexOf('lock') < events.indexOf('payment-read:true'))
  assert.ok(events.indexOf('allocation-read:true') < events.indexOf('unlock'))
  assert.deepEqual(events.slice(-2), ['unlock', 'release'])
})

test('modern admin idempotency keys are scoped by account and related resource', () => {
  const base = {
    operation: 'payment-receipt-resent',
    accountId: 8,
    resourceType: 'payment',
    resourceId: 71,
    requestKey: 'payment-receipt:request-1234',
  }
  const exact = adminBillingIdempotencyScopeKey(base)
  assert.equal(adminBillingIdempotencyScopeKey(base), exact)
  assert.notEqual(adminBillingIdempotencyScopeKey({ ...base, accountId: 9 }), exact)
  assert.notEqual(adminBillingIdempotencyScopeKey({ ...base, resourceId: 72 }), exact)
  assert.match(exact, /^payment-receipt-resent:v2:[0-9a-f]{64}$/)
})

test('receipt replay lookup accepts legacy keys only for the exact account and resource', async () => {
  let captured = null
  const pool = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return {
        rows: [{
          event_key: 'payment-receipt-resent:payment-receipt:legacy-key',
          details: { recipientEmail: 'payer@example.com' },
        }],
      }
    },
  }
  const result = await loadScopedAdminReceiptReplay(pool, {
    operation: 'payment-receipt-resent',
    accountId: 8,
    resourceType: 'payment',
    resourceId: 71,
    requestKey: 'payment-receipt:legacy-key',
  })

  assert.equal(result.replay.recipientEmail, 'payer@example.com')
  assert.match(captured.sql, /family_billing_account_id = \$1/)
  assert.match(captured.sql, /payment_id = \$2/)
  assert.deepEqual(captured.params.slice(0, 2), [8, 71])
  assert.ok(captured.params[2].includes('payment-receipt-resent:payment-receipt:legacy-key'))
  assert.ok(captured.params[2].includes(result.eventKey))
})

test('external payment replay requires an exact immutable request payload', () => {
  const payment = {
    amount_cents: 5000,
    paid_at: '2026-08-31T18:00:00.000Z',
    method: 'check',
    note: 'Front desk',
    external_processor: 'manual_admin',
    external_reference: 'check-123',
    external_status: 'settled',
  }
  assert.equal(assertAdminExternalPaymentReplayMatches(payment, {
    amountCents: 5000,
    paidAt: '2026-08-31T18:00:00.000Z',
    method: 'check',
    note: 'Front desk',
    externalReference: 'check-123',
  }), payment)
  assert.throws(
    () => assertAdminExternalPaymentReplayMatches(payment, {
      amountCents: 6000,
      paidAt: '2026-08-31T18:00:00.000Z',
      method: 'cash',
      note: 'Changed',
      externalReference: 'cash-drawer',
    }),
    (error) => error.statusCode === 409 && error.code === 'IDEMPOTENCY_CONFLICT',
  )
})

function manualPaymentAdmissionPool({ owner = null, collectibleBalanceCents = 10_000, allowInsert = false } = {}) {
  const statements = []
  const insertedPayment = {
    id: 81,
    family_billing_account_id: 8,
    amount_cents: 5_000,
    paid_at: new Date('2026-08-31T18:00:00Z'),
    method: 'cash',
    external_processor: 'manual_admin',
    external_status: 'settled',
    request_key: 'manual-payment:paid-history',
  }
  const client = {
    async query(sql, params = []) {
      const text = String(sql)
      statements.push(text)
      if (
        text.includes('pg_advisory_lock')
        || text.includes('pg_advisory_unlock')
        || text.includes('pg_advisory_xact_lock')
      ) return { rows: [] }
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text)) return { rows: [] }
      if (text.includes('request_key = ANY') && text.includes('FROM billing_payment')) return { rows: [] }
      if (text.includes('SELECT owner_kind, owner_id, owner_status')) return { rows: owner ? [owner] : [] }
      if (text.includes('canonical-billing:collectible-balance')) {
        return { rows: [{ collectible_balance_cents: collectibleBalanceCents }] }
      }
      if (text.includes('INSERT INTO billing_payment')) {
        if (allowInsert) {
          insertedPayment.paid_at = params[2]
          insertedPayment.method = params[3]
          insertedPayment.note = params[4]
          insertedPayment.external_reference = params[5]
          insertedPayment.request_key = params[7]
          return { rows: [insertedPayment] }
        }
        throw new Error('manual payment must not be inserted')
      }
      if (allowInsert) return { rows: [], rowCount: 0 }
      throw new Error(`Unexpected manual-payment admission query: ${text}`)
    },
    release() {},
  }
  return {
    statements,
    get storedRequestKey() { return insertedPayment.request_key },
    async query(sql) {
      if (String(sql).includes('FROM family')) {
        return { rows: [{ id: 8, family_id: 7, family_name: 'O’Brien', is_active: true }] }
      }
      throw new Error(`Unexpected pool query: ${sql}`)
    },
    async connect() { return client },
  }
}

test('manual payment rejects an account owned by an open Checkout attempt', async () => {
  const pool = manualPaymentAdmissionPool({
    owner: { owner_kind: 'payment_attempt', owner_id: 91, owner_status: 'pending' },
  })
  await assert.rejects(
    recordAdminExternalPayment(pool, {
      familyId: 7,
      facilityId: 2,
      requestKey: 'manual-payment:blocked-checkout',
      input: { amountCents: 10_000, method: 'cash' },
    }),
    /active remote payment attempt \(pending\).*resolve or cancel/i,
  )
  assert.equal(pool.statements.some((sql) => sql.includes('INSERT INTO billing_payment')), false)
})

test('manual payment rejects open and failed household invoice reservations', async (t) => {
  for (const status of ['open', 'failed']) {
    await t.test(status, async () => {
      const pool = manualPaymentAdmissionPool({
        owner: { owner_kind: 'monthly_invoice', owner_id: 71, owner_status: status },
      })
      await assert.rejects(
        recordAdminExternalPayment(pool, {
          familyId: 7,
          facilityId: 2,
          requestKey: `manual-payment:blocked-invoice:${status}`,
          input: { amountCents: 10_000, method: 'check' },
        }),
        new RegExp(`active household monthly invoice \\(${status}\\).*resolve or cancel`, 'i'),
      )
      assert.equal(pool.statements.some((sql) => sql.includes('INSERT INTO billing_payment')), false)
    })
  }
})

test('manual payment cannot exceed the canonical unreserved collectible balance', async () => {
  const pool = manualPaymentAdmissionPool({ collectibleBalanceCents: 4_000 })
  await assert.rejects(
    recordAdminExternalPayment(pool, {
      familyId: 7,
      facilityId: 2,
      requestKey: 'manual-payment:over-collectible',
      input: { amountCents: 5_000, method: 'bank_transfer' },
    }),
    /cannot exceed the unreserved collectible balance of 4000 cents/i,
  )
})

test('paid household invoice history does not block a later manual payment', async () => {
  const pool = manualPaymentAdmissionPool({ allowInsert: true, collectibleBalanceCents: 5_000 })
  const result = await recordAdminExternalPayment(pool, {
    familyId: 7,
    facilityId: 2,
    requestKey: 'manual-payment:paid-history',
    input: { amountCents: 5_000, method: 'cash' },
  })

  assert.equal(result.replayed, false)
  assert.equal(result.payment.id, 81)
  assert.equal(result.payment.requestKey, 'manual-payment:paid-history')
  assert.notEqual(pool.storedRequestKey, result.payment.requestKey)
  assert.match(pool.storedRequestKey, /^external-payment:v2:[0-9a-f]{64}$/)
  assert.match(pool.statements.find((sql) => sql.includes('INSERT INTO billing_payment')), /'settled'/)
  const ownerSelector = pool.statements.find((sql) => sql.includes('SELECT owner_kind, owner_id, owner_status'))
  assert.match(ownerSelector, /invoice\.status IN \('draft', 'open', 'failed', 'payment_method_required'\)/)
  assert.doesNotMatch(ownerSelector, /invoice\.status IN \([^)]*'paid'/)
})

function passAdjustmentPool() {
  const passes = new Map([
    [10, {
      id: 10,
      member_id: 74,
      programs_id: 6,
      classes_remaining: 5,
      status: 'active',
      family_id: 7,
      account_id: 8,
    }],
    [11, {
      id: 11,
      member_id: 75,
      programs_id: 6,
      classes_remaining: 4,
      status: 'active',
      family_id: 9,
      account_id: 12,
    }],
  ])
  const redemptions = new Map()
  const calls = []
  let updateCount = 0
  const client = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (['BEGIN', 'COMMIT', 'ROLLBACK'].includes(text) || text.includes('pg_advisory_xact_lock')) {
        return { rows: [] }
      }
      if (text.includes('FROM member_multi_class_pass pass')) {
        const pass = passes.get(Number(params[0]))
        return { rows: pass ? [{ ...pass }] : [] }
      }
      if (text.includes('FROM multi_class_pass_redemption') && text.includes('request_key')) {
        const prior = redemptions.get(String(params[0]))
        return { rows: prior ? [{ ...prior }] : [] }
      }
      if (text.includes('UPDATE member_multi_class_pass')) {
        updateCount += 1
        passes.get(Number(params[0])).classes_remaining = Number(params[1])
        return { rows: [] }
      }
      if (text.includes('INSERT INTO multi_class_pass_redemption')) {
        const row = {
          member_pass_id: Number(params[0]),
          member_id: Number(params[1]),
          programs_id: Number(params[2]),
          classes_used: Number(params[3]),
          classes_remaining_after: Number(params[4]),
          entry_type: 'adjust',
          credit_delta: Number(params[5]),
          reason: params[6],
          request_key: params[7],
          idempotency_fingerprint: params[8],
        }
        redemptions.set(String(row.request_key), row)
        return { rows: [row] }
      }
      if (text.includes('INSERT INTO billing_account_activity')) return { rows: [] }
      throw new Error(`Unexpected pass-adjustment query: ${text}`)
    },
    release() {},
  }
  return {
    calls,
    redemptions,
    get updateCount() { return updateCount },
    async connect() { return client },
  }
}

test('pass adjustment replays only the exact account, pass, and payload', async () => {
  const pool = passAdjustmentPool()
  const request = {
    passId: 10,
    facilityId: 2,
    actorUserId: 9,
    requestKey: 'pass-adjustment:exact-replay',
    input: { delta: 2, reason: 'Front desk correction' },
  }

  const first = await adjustAdminMultiClassPass(pool, request)
  const replay = await adjustAdminMultiClassPass(pool, request)

  assert.deepEqual(first, { passId: 10, classesRemaining: 7, appliedDelta: 2, replayed: false })
  assert.deepEqual(replay, { passId: 10, classesRemaining: 7, appliedDelta: 2, replayed: true })
  assert.equal(pool.updateCount, 1)
  const stored = pool.redemptions.get(request.requestKey)
  assert.match(stored.idempotency_fingerprint, /^[0-9a-f]{64}$/)
  assert.ok(pool.calls.some(({ text, params }) => (
    text.includes('hashtextextended') && params[0] === request.requestKey
  )))
})

test('pass adjustment rejects a reused key with different payload', async () => {
  const pool = passAdjustmentPool()
  const requestKey = 'pass-adjustment:payload-conflict'
  await adjustAdminMultiClassPass(pool, {
    passId: 10,
    facilityId: 2,
    requestKey,
    input: { delta: 2, reason: 'Correction' },
  })

  await assert.rejects(
    adjustAdminMultiClassPass(pool, {
      passId: 10,
      facilityId: 2,
      requestKey,
      input: { delta: 3, reason: 'Correction' },
    }),
    (error) => error.statusCode === 409 && error.code === 'IDEMPOTENCY_CONFLICT',
  )
  assert.equal(pool.updateCount, 1)
})

test('pass adjustment rejects a global key already owned by another pass and account', async () => {
  const pool = passAdjustmentPool()
  const requestKey = 'pass-adjustment:pass-conflict'
  await adjustAdminMultiClassPass(pool, {
    passId: 10,
    facilityId: 2,
    requestKey,
    input: { delta: 1, reason: 'Correction' },
  })

  await assert.rejects(
    adjustAdminMultiClassPass(pool, {
      passId: 11,
      facilityId: 2,
      requestKey,
      input: { delta: 1, reason: 'Correction' },
    }),
    (error) => error.statusCode === 409 && /different pass adjustment/i.test(error.message),
  )
  assert.equal(pool.updateCount, 1)
})
