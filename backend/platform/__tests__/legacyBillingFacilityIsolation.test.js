import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import { loadBillingAccountForFacility } from '../registerRoutes.js'

const testDirectory = path.dirname(fileURLToPath(import.meta.url))

async function routeSource() {
  return fs.readFile(path.resolve(testDirectory, '../registerRoutes.js'), 'utf8')
}

function routeBlocks(source, route) {
  const marker = `'${route}'`
  const blocks = []
  let cursor = 0
  while (cursor < source.length) {
    const start = source.indexOf(marker, cursor)
    if (start === -1) break
    const next = source.indexOf('\n  app.', start + marker.length)
    blocks.push(source.slice(start, next === -1 ? source.length : next))
    cursor = start + marker.length
  }
  return blocks
}

function routeBlock(source, route) {
  const blocks = routeBlocks(source, route)
  assert.ok(blocks.length > 0, `route ${route} must be registered`)
  return blocks[0]
}

test('legacy billing account lookup is read-only and strictly facility scoped', async () => {
  const calls = []
  const pool = {
    async query(sql, params) {
      calls.push({ sql: String(sql), params })
      return { rows: [{ id: 71, family_id: 42 }] }
    },
  }

  const account = await loadBillingAccountForFacility(pool, { familyId: 42, facilityId: 9 })

  assert.equal(account.id, 71)
  assert.equal(calls.length, 1)
  assert.deepEqual(calls[0].params, [42, 9])
  assert.match(calls[0].sql, /family\.facility_id = \$2/)
  assert.doesNotMatch(calls[0].sql, /\bINSERT\b/i)
  assert.doesNotMatch(calls[0].sql, /\$2::bigint IS NULL/)
})

test('legacy billing account lookup fails closed without a valid facility', async () => {
  let queryCount = 0
  const pool = {
    async query() {
      queryCount += 1
      return { rows: [] }
    },
  }

  assert.equal(await loadBillingAccountForFacility(pool, { familyId: 42, facilityId: null }), null)
  assert.equal(await loadBillingAccountForFacility(pool, { familyId: 42, facilityId: 'invalid' }), null)
  assert.equal(await loadBillingAccountForFacility(pool, { familyId: null, facilityId: 9 }), null)
  assert.equal(queryCount, 0)
})

test('every legacy admin family billing route uses the authenticated facility lookup', async () => {
  const source = await routeSource()
  const activeRoutes = new Map([
    ['/api/admin/families/:familyId/billing-account', 2],
    ['/api/admin/families/:familyId/charges', 2],
    ['/api/admin/families/:familyId/payments', 2],
    ['/api/admin/families/:familyId/billing-actions', 1],
    ['/api/admin/families/:familyId/payment-link', 1],
    ['/api/admin/families/:familyId/payments/:paymentId/resend-receipt', 1],
    ['/api/admin/families/:familyId/refunds/:refundId/resend-receipt', 1],
    ['/api/admin/families/:familyId/refunds', 1],
  ])

  for (const [route, expectedCount] of activeRoutes) {
    const blocks = routeBlocks(source, route)
    assert.equal(blocks.length, expectedCount, `${route} registration count changed`)
    for (const block of blocks) {
      assert.match(block, /loadBillingAccountForFacility/)
      assert.match(block, /req\.platformAuth\?\.user\?\.facility_id/)
    }
  }
  const statementBlocks = routeBlocks(source, '/api/admin/families/:familyId/statements')
  assert.equal(statementBlocks.length, 2)
  assert.ok(statementBlocks.some((block) => /loadBillingAccountForFacility/.test(block)))
  assert.ok(statementBlocks.some((block) => /rejectLegacyStatementWrite/.test(block)))
  assert.doesNotMatch(source, /ensureBillingAccount/)
  assert.doesNotMatch(source, /INSERT INTO family_billing_account/i)
  assert.match(routeBlock(source, '/api/admin/families/:familyId/charges'), /memberBelongsToFamily/)
})

test('legacy external payment writes share the household invoice lock through allocation', async () => {
  const source = await routeSource()
  const paymentWrite = routeBlocks(source, '/api/admin/families/:familyId/payments')
    .find((block) => block.includes('INSERT INTO billing_payment'))

  assert.ok(paymentWrite, 'legacy external payment write route must remain discoverable during rollback')
  assert.match(paymentWrite, /withHouseholdMonthlyInvoiceAccountLock\(pool, account\.id, async \(client\) =>/)
  assert.match(paymentWrite, /await client\.query\([\s\S]*INSERT INTO billing_payment/)
  assert.match(paymentWrite, /allocateHouseholdPayments\(client, \{ accountId: account\.id, actorType: 'admin' \}\)/)
  assert.match(paymentWrite, /recordBillingActivityBestEffort\(client,/)
  assert.match(paymentWrite, /externalStatus = normalizeLegacyManualPaymentStatus\(req\.body\?\.externalStatus\)/)
  assert.match(paymentWrite, /\n\s+externalStatus,\n/)
  assert.doesNotMatch(paymentWrite, /req\.body\?\.externalStatus \?\? 'recorded'/)
  assert.match(source, /status === 'recorded' \|\| status === 'settled'\) return 'settled'/)
  assert.match(source, /externalStatus must identify a completed payment/)
  assert.doesNotMatch(paymentWrite, /allocateHouseholdPayments\(pool,/)
  assert.ok(
    paymentWrite.indexOf('withHouseholdMonthlyInvoiceAccountLock')
      < paymentWrite.indexOf('INSERT INTO billing_payment'),
  )
  assert.ok(
    paymentWrite.indexOf('recordBillingActivityBestEffort(client')
      < paymentWrite.indexOf('notifyPaymentReceipt(pool'),
  )
})

test('profile payment history and statements resolve active server-side household identity', async () => {
  const source = await routeSource()

  for (const route of ['/api/members/billing/statements', '/api/members/billing/payments']) {
    const block = routeBlock(source, route)
    assert.match(block, /resolveActiveMemberBillingFamilyId/)
    assert.match(block, /loadBillingAccountForFacility/)
    assert.match(block, /ctx\.user\.facility_id/)
    assert.doesNotMatch(block, /ctx\.user\.family_id/)
    assert.doesNotMatch(block, /INSERT INTO family_billing_account/i)
  }
})

test('unsafe direct subscription and pass mutations are permanently retired', async () => {
  const source = await routeSource()
  const subscriptionRoute = routeBlock(source, '/api/admin/subscriptions/:id/status')
  const passRoute = routeBlock(source, '/api/admin/members/:memberId/passes/:passId/adjust')

  assert.match(subscriptionRoute, /rejectDirectSubscriptionStatusWrite/)
  assert.doesNotMatch(subscriptionRoute, /UPDATE billing_subscription/)
  assert.match(source, /BILLING_SUBSCRIPTION_STATUS_WRITE_RETIRED/)
  assert.match(source, /customer-billing\/enrollments\/:signupId\/cancellation/)

  assert.match(passRoute, /rejectLegacyPassAdjustmentWrite/)
  assert.doesNotMatch(passRoute, /UPDATE member_multi_class_pass/)
  assert.match(source, /BILLING_LEGACY_PASS_ADJUSTMENT_RETIRED/)
  assert.match(source, /entitlements\/multi-class-passes\/:passId\/adjustments/)
})
