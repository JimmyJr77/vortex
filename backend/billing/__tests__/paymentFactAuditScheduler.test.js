import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { auditSummary, paymentFactStatus } from '../paymentFactAuditScheduler.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const migrationPath = path.join(testDirectory, '../../migrations/810_billing_payment_fact_audit_jobs.sql')

test('payment fact statuses preserve the processor state without optimistic settlement', () => {
  assert.equal(paymentFactStatus('pending'), 'pending')
  assert.equal(paymentFactStatus('processing'), 'processing')
  assert.equal(paymentFactStatus('reconciliation_required'), 'reconciliation_required')
  assert.equal(paymentFactStatus('succeeded'), 'settled')
  assert.equal(paymentFactStatus('settled'), 'settled')
  assert.equal(paymentFactStatus('failed'), 'failed')
  assert.equal(paymentFactStatus('canceled'), 'canceled')
  assert.equal(paymentFactStatus('cancelled'), 'canceled')
})

test('payment fact audit summary distinguishes an executed audit from a clean audit', () => {
  const result = auditSummary({
    inventory: { activeFamilyCount: 2, billingAccountCount: 2, missingBillingAccountCount: 0 },
    accounts: [
      { familyId: 48, accountId: 10895, classification: 'ready', exceptions: [] },
      { familyId: 59, accountId: 10906, classification: 'blocked', exceptions: [{ code: 'pricing_mismatch' }] },
    ],
  })
  assert.equal(result.readyAccountCount, 1)
  assert.equal(result.nonReadyAccountCount, 1)
  assert.deepEqual(result.nonReadyAccounts, [{
    familyId: 59,
    accountId: 10906,
    classification: 'blocked',
    exceptionCodes: ['pricing_mismatch'],
  }])
})

test('payment state changes enqueue a durable audit job at the database boundary', () => {
  const migration = fs.readFileSync(migrationPath, 'utf8')
  assert.match(migration, /CREATE TABLE IF NOT EXISTS billing_payment_fact_audit_job/)
  assert.match(migration, /UNIQUE \(billing_payment_id, payment_external_status\)/)
  assert.match(migration, /AFTER INSERT OR UPDATE OF external_status ON billing_payment/)
  assert.match(migration, /'pending', 'processing', 'reconciliation_required',\s*'settled', 'succeeded', 'failed', 'canceled', 'cancelled'/)
})
