import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))
const backendDirectory = path.join(testDirectory, '../..')

function source(relativePath) {
  return fs.readFileSync(path.join(backendDirectory, relativePath), 'utf8')
}

test('billing workers assert required schema before their first mutation or Stripe operation', () => {
  const recurring = source('scheduling/runRecurringCharges.js')
  const recurringGuard = recurring.indexOf('await assertRequiredBillingSchema(pool)')
  assert.ok(recurringGuard >= 0)
  for (const operation of ['prepareUpcomingBilling', 'generateRecurringCharges']) {
    const operationAt = recurring.indexOf(`await ${operation}(pool`)
    assert.ok(operationAt >= 0, `${operation} must remain covered by the startup check`)
    assert.ok(recurringGuard < operationAt, `Schema readiness must precede ${operation}`)
  }
  assert.equal(recurring.includes('await autoCompleteEndedEnrollments(pool)'), false)
  assert.match(recurring, /if \(Number\(result\.accountsBlocked\) > 0\)[\s\S]*process\.exitCode = 1/)

  const reconciliation = source('billing/runStripeReconciliation.js')
  const reconciliationGuard = reconciliation.indexOf('await assertRequiredBillingSchema(pool)')
  assert.ok(reconciliationGuard >= 0)
  assert.ok(reconciliationGuard < reconciliation.indexOf('await getStripeClient()'))
  assert.ok(reconciliationGuard < reconciliation.indexOf('await runStripeReconciliation(pool'))
})
