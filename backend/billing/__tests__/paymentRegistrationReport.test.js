import assert from 'node:assert/strict'
import test from 'node:test'

import { buildPaymentRegistrationReport } from '../paymentRegistrationReport.js'

test('payment registration report scopes both payments and failures to the authenticated facility', async () => {
  const calls = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      calls.push({ text, params })
      if (text.includes('information_schema.tables')) return { rows: [{ table_name: 'programs' }] }
      if (text.includes('information_schema.columns')) return { rows: [] }
      return { rows: [] }
    },
  }

  const report = await buildPaymentRegistrationReport(pool, { days: 45, facilityId: 7 })
  assert.equal(report.paymentCount, 0)
  assert.equal(report.failureCount, 0)

  const payments = calls.find(({ text }) => text.includes('FROM billing_payment bp'))
  const failures = calls.find(({ text }) => text.includes('FROM stripe_billing_alert a'))
  assert.deepEqual(payments.params, [45, 7])
  assert.match(payments.text, /JOIN family f ON f\.id = fba\.family_id/)
  assert.match(payments.text, /f\.facility_id = \$2/)
  assert.deepEqual(failures.params, [45, 7])
  assert.match(failures.text, /f\.facility_id = \$2/)
})

test('payment registration report fails closed without authenticated facility scope', async () => {
  let queryCount = 0
  const pool = {
    async query() {
      queryCount += 1
      return { rows: [] }
    },
  }

  await assert.rejects(
    buildPaymentRegistrationReport(pool, { days: 30 }),
    /authenticated facility scope is required/i,
  )
  assert.equal(queryCount, 0)
})
