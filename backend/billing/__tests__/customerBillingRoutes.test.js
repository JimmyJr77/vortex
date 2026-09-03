import test from 'node:test'
import assert from 'node:assert/strict'
import express from 'express'
import { retrySyncHttpStatus } from '../customerBillingRoutes.js'
import { registerCustomerBillingRoutes } from '../customerBillingRoutes.js'

test('a retry that leaves an active adjustment unsynchronized returns accepted, not success', () => {
  assert.equal(
    retrySyncHttpStatus({
      adjustment: { status: 'active' },
      syncStatus: 'failed',
    }),
    202,
  )
})

test('a completed Stripe retry returns success', () => {
  assert.equal(
    retrySyncHttpStatus({
      adjustment: { status: 'active' },
      syncStatus: 'synced',
    }),
    200,
  )
})

test('billing anomaly route uses the authenticated facility instead of caller input', async () => {
  let captured = null
  const app = express()
  const pool = {
    async query(sql, params) {
      captured = { sql: String(sql), params }
      return { rows: [] }
    },
  }
  registerCustomerBillingRoutes(app, pool, {
    jwtSecret: 'test-secret',
    requirePermission: () => [
      (req, _res, next) => {
        req.platformAuth = { user: { facility_id: 42, id: 9 } }
        next()
      },
    ],
  })

  const route = app._router.stack.find((layer) => layer.route?.path === '/api/admin/customer-billing/anomalies')
  assert.ok(route)
  const request = { query: { facilityId: '999' }, body: {}, get: () => null }
  const response = await new Promise((resolve, reject) => {
    let index = 0
    const res = {
      status() { return this },
      json(payload) { resolve(payload); return this },
    }
    const next = (error) => {
      if (error) return reject(error)
      const handler = route.route.stack[index++]?.handle
      if (!handler) return reject(new Error('Route completed without a response.'))
      Promise.resolve(handler(request, res, next)).catch(reject)
    }
    next()
  })

  assert.equal(response.success, true)
  assert.deepEqual(captured.params, [42])
  assert.match(captured.sql, /family\.facility_id = \$1/)
})

test('canonical Stripe refund creation rejects a missing Idempotency-Key before database work', async () => {
  let queryCount = 0
  const app = express()
  const pool = {
    async query() {
      queryCount += 1
      throw new Error('Refund route must not query before validating idempotency.')
    },
  }
  registerCustomerBillingRoutes(app, pool, {
    jwtSecret: 'test-secret',
    requirePermission: () => [
      (req, _res, next) => {
        req.platformAuth = { user: { facility_id: 42, id: 9 } }
        next()
      },
    ],
  })

  const route = app._router.stack.find(
    (layer) => layer.route?.path === '/api/admin/customer-billing/families/:familyId/refunds',
  )
  assert.ok(route)
  const response = await new Promise((resolve, reject) => {
    let index = 0
    const request = {
      params: { familyId: '51' },
      body: {},
      get: () => null,
    }
    const res = {
      statusCode: 200,
      status(code) { this.statusCode = code; return this },
      json(payload) { resolve({ statusCode: this.statusCode, payload }); return this },
    }
    const next = (error) => {
      if (error) return reject(error)
      const handler = route.route.stack[index++]?.handle
      if (!handler) return reject(new Error('Route completed without a response.'))
      Promise.resolve(handler(request, res, next)).catch(reject)
    }
    next()
  })

  assert.equal(response.statusCode, 400)
  assert.equal(response.payload.success, false)
  assert.match(response.payload.message, /Idempotency-Key header is required/i)
  assert.equal(queryCount, 0)
})
