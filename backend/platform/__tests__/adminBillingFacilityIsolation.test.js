import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import path from 'node:path'
import test from 'node:test'
import { fileURLToPath } from 'node:url'

import express from 'express'
import jwt from 'jsonwebtoken'

import {
  authenticatedAdminBillingScope,
  registerPlatformRoutes,
} from '../registerRoutes.js'

const JWT_SECRET = 'admin-billing-facility-isolation-secret'
const testDirectory = path.dirname(fileURLToPath(import.meta.url))

function authenticationResult(sql) {
  if (sql.includes('FROM app_user au')) {
    return {
      rows: [{
        id: 91,
        facility_id: 7,
        role: 'ADMIN',
        is_active: true,
        is_master_admin: false,
      }],
    }
  }
  if (sql.includes('FROM app_user_role')) return { rows: [] }
  if (sql.includes('FROM role r')) return { rows: [{ key: 'billing.view' }, { key: 'billing.manage' }] }
  if (sql.includes('FROM app_user_permission_override')) return { rows: [] }
  return null
}

function createApp(pool) {
  const app = express()
  app.use(express.json())
  registerPlatformRoutes(app, pool, { jwtSecret: JWT_SECRET })
  return app
}

async function invokeRoute(app, { method = 'GET', path, params = {}, query = {}, body = {} }) {
  const routeLayer = app._router.stack.find((layer) => (
    layer.route?.path === path && layer.route.methods[method.toLowerCase()] === true
  ))
  assert.ok(routeLayer, `route ${method} ${path} must be registered`)
  const request = {
    method,
    path,
    params,
    query,
    body,
    headers: {
      authorization: `Bearer ${jwt.sign({ userId: 91 }, JWT_SECRET, { expiresIn: '5m' })}`,
    },
    get(name) { return this.headers[String(name).toLowerCase()] },
  }
  return new Promise((resolve, reject) => {
    let statusCode = 200
    const response = {
      status(code) { statusCode = Number(code); return this },
      setHeader() {},
      json(payload) { resolve({ status: statusCode, body: payload }); return this },
      send(payload) { resolve({ status: statusCode, body: payload }); return this },
    }
    let index = 0
    const next = (error) => {
      if (error) return reject(error)
      const handler = routeLayer.route.stack[index]?.handle
      index += 1
      if (!handler) return reject(new Error(`Route ${method} ${path} completed without a response.`))
      Promise.resolve(handler(request, response, next)).catch(reject)
    }
    next()
  })
}

test('route scope comes only from authenticated facility and grants global scope only to master admin', () => {
  assert.deepEqual(
    authenticatedAdminBillingScope({ user: { facility_id: 7 }, isMasterAdmin: false }),
    { facilityId: 7, allowGlobal: false },
  )
  assert.deepEqual(
    authenticatedAdminBillingScope({ user: { facility_id: null }, isMasterAdmin: true }),
    { facilityId: null, allowGlobal: true },
  )
  assert.throws(
    () => authenticatedAdminBillingScope({ user: { facility_id: null }, isMasterAdmin: false }),
    /authenticated facility scope is required/i,
  )
})

test('forged facility input cannot expand billing-alert reads or resolve another facility alert over HTTP', async () => {
  const targetCalls = []
  const pool = {
    async query(sql, params = []) {
      const text = String(sql)
      const auth = authenticationResult(text)
      if (auth) return auth
      targetCalls.push({ text, params })
      if (text.includes('FROM stripe_billing_alert a')) {
        return { rows: params[0] === 7 ? [{ id: 71, message: 'Facility A alert' }] : [{ id: 990, message: 'Facility B alert' }] }
      }
      if (text.includes('UPDATE stripe_billing_alert')) return { rows: [] }
      if (text.includes('FROM stripe_billing_alert alert')) return { rows: [] }
      throw new Error(`Unexpected query: ${text}`)
    },
  }
  const app = createApp(pool)

  const list = await invokeRoute(app, {
    path: '/api/admin/stripe/billing-alerts',
    query: { facilityId: '99' },
    body: { facilityId: 99 },
  })
  assert.equal(list.status, 200)
  assert.deepEqual(list.body.data.map((row) => row.id), [71])
  const listQuery = targetCalls.find(({ text }) => text.includes('FROM stripe_billing_alert a'))
  assert.deepEqual(listQuery.params, [7])
  assert.match(listQuery.text, /scoped_family\.facility_id = \$1/)

  const resolve = await invokeRoute(app, {
    method: 'PATCH',
    path: '/api/admin/stripe/billing-alerts/:id/resolve',
    params: { id: '990' },
    body: {
      facilityId: 99,
      resolutionNote: 'Forged facility B resolution.',
    },
  })
  assert.equal(resolve.status, 404)
  const update = targetCalls.find(({ text }) => text.includes('UPDATE stripe_billing_alert'))
  assert.equal(update.params[3], 7)
  assert.match(update.text, /scoped_family\.facility_id = \$4/)
})

test('all billing operations routes derive facility scope from platform authentication', async () => {
  const source = await fs.readFile(path.resolve(testDirectory, '../registerRoutes.js'), 'utf8')
  const routes = [
    '/api/admin/billing/payment-registration-report',
    '/api/admin/stripe/billing-alerts',
    '/api/admin/billing/cancellation-requests',
    '/api/admin/billing/cancellation-requests/:id/review',
    '/api/admin/billing/disputes',
    '/api/admin/billing/disputes/:id/evidence',
    '/api/admin/stripe/operations',
    '/api/admin/stripe/billing-alerts/:id/access',
    '/api/admin/stripe/billing-alerts/:id/resolve',
  ]

  for (const route of routes) {
    const start = source.indexOf(`'${route}'`)
    assert.ok(start >= 0, `${route} must remain registered`)
    const next = source.indexOf('\n  app.', start + route.length)
    const block = source.slice(start, next === -1 ? source.length : next)
    assert.match(block, /authenticatedAdminBillingScope\(req\.platformAuth\)/, `${route} must use authenticated scope`)
    assert.doesNotMatch(block, /(?:body|query)\?*\.facilityId/, `${route} must not accept caller facility scope`)
  }

  const reconcileStart = source.indexOf("'/api/admin/stripe/reconcile'")
  const reconcileEnd = source.indexOf('\n  app.', reconcileStart + 1)
  const reconcileBlock = source.slice(reconcileStart, reconcileEnd)
  assert.match(reconcileBlock, /isMasterAdmin !== true/)
})
