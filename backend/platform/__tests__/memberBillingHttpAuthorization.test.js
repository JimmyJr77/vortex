import assert from 'node:assert/strict'
import test from 'node:test'

import express from 'express'
import jwt from 'jsonwebtoken'

import { registerPlatformRoutes } from '../registerRoutes.js'

const JWT_SECRET = 'member-http-authorization-test-secret'

function authenticationRows(sql, userOverrides = {}) {
  if (sql.includes('FROM app_user au')) {
    return {
      rows: [{
        id: 9,
        member_id: 74,
        family_id: 999,
        facility_id: 3,
        role: 'MEMBER',
        is_active: true,
        is_master_admin: false,
        ...userOverrides,
      }],
    }
  }
  if (sql.includes('FROM app_user_role')) return { rows: [] }
  if (sql.includes('FROM role r')) return { rows: [] }
  if (sql.includes('FROM app_user_permission_override')) return { rows: [] }
  return null
}

function createPlatformApp(pool) {
  const app = express()
  app.use(express.json())
  registerPlatformRoutes(app, pool, { jwtSecret: JWT_SECRET })
  return app
}

async function invokeRoute(app, {
  method = 'GET',
  path,
  headers = {},
  body = {},
  params = {},
  query = {},
}) {
  const routeLayer = app._router.stack.find((layer) => (
    layer.route?.path === path && layer.route.methods[method.toLowerCase()] === true
  ))
  assert.ok(routeLayer, `route ${method} ${path} must be registered`)
  const normalizedHeaders = Object.fromEntries(
    Object.entries(headers).map(([key, value]) => [key.toLowerCase(), value]),
  )
  const request = {
    method,
    path,
    headers: normalizedHeaders,
    body,
    params,
    query,
    get(name) { return normalizedHeaders[String(name).toLowerCase()] },
  }
  return new Promise((resolve, reject) => {
    let statusCode = 200
    const responseHeaders = {}
    const response = {
      status(code) { statusCode = Number(code); return this },
      setHeader(name, value) { responseHeaders[String(name).toLowerCase()] = value },
      json(payload) { resolve({ status: statusCode, headers: responseHeaders, body: payload }); return this },
      send(payload) { resolve({ status: statusCode, headers: responseHeaders, body: payload }); return this },
    }
    let index = 0
    const next = (error) => {
      if (error) {
        reject(error)
        return
      }
      const handler = routeLayer.route.stack[index]?.handle
      index += 1
      if (!handler) {
        reject(new Error(`Route ${method} ${path} completed without a response.`))
        return
      }
      Promise.resolve(handler(request, response, next)).catch(reject)
    }
    next()
  })
}

function memberHeaders(extra = {}) {
  return {
    Authorization: `Bearer ${jwt.sign({ userId: 9 }, JWT_SECRET, { expiresIn: '5m' })}`,
    'Content-Type': 'application/json',
    ...extra,
  }
}

test('canonical member HTTP endpoints fail closed while the read rollout is inactive', { concurrency: false }, async () => {
  const previousReadMode = process.env.BILLING_CANONICAL_READ_MODE
  const previousV2 = process.env.MEMBER_BILLING_READ_V2
  process.env.BILLING_CANONICAL_READ_MODE = 'off'
  process.env.MEMBER_BILLING_READ_V2 = 'true'
  const statements = []
  const pool = {
    async query(sql) {
      const statement = String(sql)
      statements.push(statement)
      const auth = authenticationRows(statement)
      if (auth) return auth
      throw new Error(`Billing query ran while canonical reads were off: ${statement}`)
    },
  }

  try {
    const response = await invokeRoute(createPlatformApp(pool), {
      path: '/api/members/billing/customer-account',
      headers: memberHeaders(),
    })
    assert.equal(response.status, 503)
    assert.equal(response.body.code, 'BILLING_CANONICAL_READ_INACTIVE')
  } finally {
    if (previousReadMode == null) delete process.env.BILLING_CANONICAL_READ_MODE
    else process.env.BILLING_CANONICAL_READ_MODE = previousReadMode
    if (previousV2 == null) delete process.env.MEMBER_BILLING_READ_V2
    else process.env.MEMBER_BILLING_READ_V2 = previousV2
  }
  assert.equal(statements.some((statement) => statement.includes('family_billing_account')), false)
})

test('an inactive household cannot reach canonical overview or payment checkout over HTTP', { concurrency: false }, async () => {
  const previousReadMode = process.env.BILLING_CANONICAL_READ_MODE
  const previousV2 = process.env.MEMBER_BILLING_READ_V2
  const previousStripeEnabled = process.env.STRIPE_ENABLED
  const previousStripeSecret = process.env.STRIPE_SECRET_KEY
  process.env.BILLING_CANONICAL_READ_MODE = 'active'
  process.env.MEMBER_BILLING_READ_V2 = 'true'
  process.env.STRIPE_ENABLED = 'true'
  process.env.STRIPE_SECRET_KEY = 'sk_test_member_http_authorization'
  const accountQueries = []
  const pool = {
    async query(sql) {
      const statement = String(sql)
      const auth = authenticationRows(statement)
      if (auth) return auth
      if (statement.includes('WITH viewer AS')) return { rows: [{ family_id: 42 }] }
      if (statement.includes('JOIN family_billing_account account')) {
        accountQueries.push(statement)
        // The only stored account is inactive, so the canonical lookup must
        // behave as though no manageable account exists.
        return { rows: [] }
      }
      throw new Error(`Unexpected query: ${statement}`)
    },
  }

  try {
    const app = createPlatformApp(pool)
    const overview = await invokeRoute(app, {
      path: '/api/members/billing/customer-account',
      headers: memberHeaders(),
    })
    assert.equal(overview.status, 404)

    const checkout = await invokeRoute(app, {
      method: 'POST',
      path: '/api/members/billing/payments/checkout',
      headers: memberHeaders({ 'Idempotency-Key': 'inactive-account-request' }),
      body: {},
    })
    assert.equal(checkout.status, 400)
    assert.match(checkout.body.message, /No family billing account/i)
  } finally {
    if (previousReadMode == null) delete process.env.BILLING_CANONICAL_READ_MODE
    else process.env.BILLING_CANONICAL_READ_MODE = previousReadMode
    if (previousV2 == null) delete process.env.MEMBER_BILLING_READ_V2
    else process.env.MEMBER_BILLING_READ_V2 = previousV2
    if (previousStripeEnabled == null) delete process.env.STRIPE_ENABLED
    else process.env.STRIPE_ENABLED = previousStripeEnabled
    if (previousStripeSecret == null) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = previousStripeSecret
  }

  assert.equal(accountQueries.length, 2)
  for (const statement of accountQueries) {
    assert.match(statement, /account\.is_active = TRUE/)
    assert.match(statement, /family\.facility_id = \$2/)
  }
})

test('unlinked staff ID collisions cannot access any member billing read or payer mutation', { concurrency: false }, async () => {
  const previousReadMode = process.env.BILLING_CANONICAL_READ_MODE
  const previousV2 = process.env.MEMBER_BILLING_READ_V2
  const previousStripeEnabled = process.env.STRIPE_ENABLED
  process.env.BILLING_CANONICAL_READ_MODE = 'active'
  process.env.MEMBER_BILLING_READ_V2 = 'true'
  process.env.STRIPE_ENABLED = 'true'

  const protectedRoutes = [
    { method: 'GET', path: '/api/members/billing/customer-account' },
    { method: 'GET', path: '/api/members/billing/customer-account/transactions' },
    { method: 'POST', path: '/api/members/billing/payments/checkout', headers: { 'Idempotency-Key': 'staff-collision-payment' } },
    { method: 'POST', path: '/api/members/billing/payment-method-session' },
    { method: 'POST', path: '/api/members/billing/enrollment-checkout-session' },
    { method: 'POST', path: '/api/members/billing/confirm-enrollment-checkout' },
  ]

  try {
    for (const role of ['ADMIN', 'COACH']) {
      const statements = []
      const pool = {
        async query(sql) {
          const statement = String(sql)
          statements.push(statement)
          const auth = authenticationRows(statement, {
            // app_user.id is 9 and may collide with member.id=9, but there is
            // deliberately no member.app_user_id relationship.
            member_id: null,
            family_id: null,
            role,
          })
          if (auth) return auth
          throw new Error(`Unlinked ${role} reached a billing query: ${statement}`)
        },
      }
      const app = createPlatformApp(pool)

      for (const route of protectedRoutes) {
        const response = await invokeRoute(app, {
          ...route,
          headers: memberHeaders(route.headers),
        })
        assert.equal(response.status, 403, `${role} ${route.method} ${route.path}`)
        assert.equal(response.body.code, 'MEMBER_ACCOUNT_LINK_REQUIRED')
      }
      assert.equal(statements.some((statement) => statement.includes('WITH viewer AS')), false)
      assert.equal(statements.some((statement) => statement.includes('family_billing_account')), false)
    }
  } finally {
    if (previousReadMode == null) delete process.env.BILLING_CANONICAL_READ_MODE
    else process.env.BILLING_CANONICAL_READ_MODE = previousReadMode
    if (previousV2 == null) delete process.env.MEMBER_BILLING_READ_V2
    else process.env.MEMBER_BILLING_READ_V2 = previousV2
    if (previousStripeEnabled == null) delete process.env.STRIPE_ENABLED
    else process.env.STRIPE_ENABLED = previousStripeEnabled
  }
})

test('an active linked non-payer cannot mutate household payment state', { concurrency: false }, async () => {
  const previousReadMode = process.env.BILLING_CANONICAL_READ_MODE
  const previousV2 = process.env.MEMBER_BILLING_READ_V2
  const previousStripeEnabled = process.env.STRIPE_ENABLED
  const previousStripeSecret = process.env.STRIPE_SECRET_KEY
  process.env.BILLING_CANONICAL_READ_MODE = 'active'
  process.env.MEMBER_BILLING_READ_V2 = 'true'
  process.env.STRIPE_ENABLED = 'true'
  process.env.STRIPE_SECRET_KEY = 'sk_test_linked_nonpayer'
  const statements = []
  const pool = {
    async query(sql) {
      const statement = String(sql)
      statements.push(statement)
      const auth = authenticationRows(statement, { member_id: 74, family_id: 42 })
      if (auth) return auth
      if (statement.includes('WITH viewer AS')) return { rows: [{ family_id: 42 }] }
      if (statement.includes('SELECT account.*, family.family_name')) {
        return {
          rows: [{
            id: 11,
            family_id: 42,
            family_name: 'Rivera',
            family_facility_id: 3,
            payer_member_id: 75,
            is_active: true,
          }],
        }
      }
      throw new Error(`Non-payer reached a post-authorization billing query: ${statement}`)
    },
  }

  try {
    const app = createPlatformApp(pool)
    const checkout = await invokeRoute(app, {
      method: 'POST',
      path: '/api/members/billing/payments/checkout',
      headers: memberHeaders({ 'Idempotency-Key': 'linked-nonpayer-payment' }),
    })
    assert.equal(checkout.status, 403)
    assert.match(checkout.body.message, /Only the family payer/i)

    const paymentMethod = await invokeRoute(app, {
      method: 'POST',
      path: '/api/members/billing/payment-method-session',
      headers: memberHeaders(),
    })
    assert.equal(paymentMethod.status, 403)
    assert.match(paymentMethod.body.message, /Only the family payer/i)
  } finally {
    if (previousReadMode == null) delete process.env.BILLING_CANONICAL_READ_MODE
    else process.env.BILLING_CANONICAL_READ_MODE = previousReadMode
    if (previousV2 == null) delete process.env.MEMBER_BILLING_READ_V2
    else process.env.MEMBER_BILLING_READ_V2 = previousV2
    if (previousStripeEnabled == null) delete process.env.STRIPE_ENABLED
    else process.env.STRIPE_ENABLED = previousStripeEnabled
    if (previousStripeSecret == null) delete process.env.STRIPE_SECRET_KEY
    else process.env.STRIPE_SECRET_KEY = previousStripeSecret
  }

  assert.equal(statements.filter((statement) => statement.includes('SELECT account.*, family.family_name')).length, 2)
})
