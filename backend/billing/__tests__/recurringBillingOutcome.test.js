import test from 'node:test'
import assert from 'node:assert/strict'
import { recurringBillingOutcome, recordRecurringBillingExceptions } from '../recurringBillingOutcome.js'

const clean = () => ({ preparation: [], result: { blockedAccounts: [] }, review: { accounts: [] } })

test('accounting holds are explicit completed-with-review results, not infrastructure failures', () => {
  const input = clean()
  input.preparation.push({ accountId: 9, status: 'blocked', code: 'target_month_recurring_charge_parity_failed' })
  input.result.blockedAccounts.push({ accountId: 9, code: 'target_month_recurring_charge_parity_failed' })
  input.review.accounts.push({ accountId: 9, verified: false, issues: [{ code: 'target_month_recurring_charge_extra' }] })
  assert.deepEqual(recurringBillingOutcome(input), {
    status: 'completed_with_review_holds', exitCode: 0, attentionAccountIds: [9], failures: [],
  })
  assert.equal(recurringBillingOutcome(clean()).status, 'completed')
})

test('unknown worker failures and failed audits cannot become successful cron runs', () => {
  for (const code of ['ECONNRESET', '42P01', 'recurring_schedule_no_progress', undefined]) {
    for (const stage of ['preparation', 'result']) {
      const input = clean()
      const entry = { accountId: 9, status: 'blocked', code }
      if (stage === 'preparation') input.preparation.push(entry)
      else input.result.blockedAccounts.push(entry)
      assert.equal(recurringBillingOutcome(input).exitCode, 1)
      assert.equal(recurringBillingOutcome(input).status, 'failed')
    }
  }
  for (const row of [
    { accountId: 9, verified: false, operationalFailure: true, issues: [{ code: '42P01' }] },
    { accountId: 9, verified: false, issues: [{ code: 'billing_review_failed' }] },
  ]) {
    const input = clean()
    input.review.accounts.push(row)
    assert.equal(recurringBillingOutcome(input).exitCode, 1)
  }
})

test('persisted holds retain the exact account and issue details and only successful accounts are resolved', async () => {
  const calls = []
  const entry = { accountId: 9, code: 'target_month_recurring_charge_parity_failed',
    message: 'Review required', details: { issues: [{ chargeId: 123 }] } }
  await recordRecurringBillingExceptions({ query: async (sql, params) => { calls.push({ sql, params }); return { rows: [] } } },
    { blockedAccounts: [entry], completedAccountIds: [10] })
  assert.equal(calls.length, 2)
  assert.deepEqual(calls[0].params, ['recurring-billing:9', 9, 'Review required', JSON.stringify(entry)])
  assert.deepEqual(calls[1].params, [[10]])
  await assert.rejects(recordRecurringBillingExceptions({ query: async () => { throw new Error('database unavailable') } },
    { blockedAccounts: [entry] }), /database unavailable/)
})


test('enrollment recovery reports missing setup as account attention and retains unexpected failures', () => {
  for (const code of ['payment_method_required', 'migration_review_required']) {
    assert.deepEqual(recurringBillingOutcome({ ...clean(), enrollmentRecovery: [{ accountId: 12, code }] }), {
      status: 'completed_with_review_holds', exitCode: 0, attentionAccountIds: [12], failures: [],
    })
  }
  for (const code of ['stripe_unavailable', 'ECONNRESET', undefined]) {
    const entry = { accountId: 12, code }
    const outcome = recurringBillingOutcome({ ...clean(), enrollmentRecovery: [entry] })
    assert.equal(outcome.status, 'failed')
    assert.equal(outcome.exitCode, 1)
    assert.deepEqual(outcome.failures, [entry])
  }
})
