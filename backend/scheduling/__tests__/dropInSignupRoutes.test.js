import test from 'node:test'
import assert from 'node:assert/strict'
import jwt from 'jsonwebtoken'
import { resolveJwtSecret } from '../../auth/jwtSecret.js'
import { registerDropInRoutes, resolveBookingMember } from '../dropIns.js'

const payer = { id: 7, app_user_id: 17, facility_id: 1, family_id: 3, email: 'parent@example.test', phone: '2025550123' }
const athlete = { id: 8, facility_id: 1, family_id: 3, first_name: 'Avery', last_name: 'Stone' }
const tomorrow = new Date(Date.now() + 86400000).toISOString().slice(0, 10)

function routeFixture({ authorized = true, signed = true, annualMember = false, annualUsed = 0 } = {}) {
  const calls = []
  const client = {
    release() {},
    async query(sql, params) {
      calls.push({ sql, params })
      if (sql.includes('FROM v_app_user_access_context')) return { rows: [{
        user_id: 17, member_id: 7, facility_id: 1, is_active: true,
        can_access_member_portal: true, member_portal_status: 'active',
      }] }
      if (sql.includes('SELECT * FROM member WHERE id = $1 AND app_user_id = $2')) return { rows: [payer] }
      if (sql.includes('WITH viewer AS')) return { rows: [{ family_id: 3 }] }
      if (sql.includes('FROM member athlete')) {
        assert.match(sql, /facility_id = \$5/)
        assert.match(sql, /household_membership\.family_id = \$2/)
        assert.match(sql, /household_membership\.is_active = TRUE/)
        assert.equal(params[5], 8)
        return { rows: authorized ? [athlete] : [] }
      }
      if (sql.includes('FROM waiver_template template')) return { rows: [{
        id: 1, waiver_type: 'PAYMENT_POLICY', member_id: signed ? 8 : null,
        signature_name: signed ? 'Parent Stone' : null, payment_policy_acknowledged: signed,
      }] }
      if (sql.includes('FROM additional_fee_redemption r')) {
        assert.equal(params[0], 8)
        return { rows: annualMember ? [{
          fee_id: 2, satisfied_at: new Date(Date.now() - 86400000),
          period_key: new Date(Date.now() + 300 * 86400000).toISOString().slice(0, 10),
        }] : [] }
      }
      if (sql.includes('AS annual_used')) return { rows: [{ annual_used: annualUsed, admin_used: 0, trials_used: 0 }] }
      if (sql.includes('SELECT lifetime_trial_granted')) return { rows: [{
        lifetime_trial_granted: 1, annual_credits_granted: annualMember ? 4 : 0, admin_credits_granted: 0,
      }] }
      if (sql.includes('FROM scheduling_slot_group sg') && sql.includes('FOR UPDATE OF sg')) return { rows: [{
        id: 20, form_id: 4, max_participants: 10, title: 'Gymnastics',
        specific_date: tomorrow, monthly_enrolled: 0, fallback_monthly_cents: 12000,
      }] }
      if (sql.includes('SELECT COUNT(*)::int AS count FROM drop_in_registration')) return { rows: [{ count: 0 }] }
      if (sql.includes('INSERT INTO drop_in_registration')) return { rows: [{ id: 50 }] }
      if (sql.includes('FROM family_billing_account WHERE family_id=$1')) return { rows: [{ id: 90 }] }
      return { rows: [] }
    },
  }
  const pool = { ...client, async connect() { return client } }
  const routes = new Map()
  const app = new Proxy({}, { get: (_, method) => (path, handler) => routes.set(`${method}:${path}`, handler) })
  registerDropInRoutes(app, pool)
  return { calls, client, async request(method, path, { body = {}, query = {}, authenticated = true } = {}) {
    const req = {
      body, query,
      headers: authenticated ? { authorization: `Bearer ${jwt.sign({ userId: 17 }, resolveJwtSecret())}` } : {},
    }
    let status = 200, response
    const res = { set() { return this }, status(code) { status = code; return this }, json(value) { response = value; return this } }
    await routes.get(`${method}:${path}`)(req, res)
    return { status, body: response }
  } }
}

test('explicit athlete ids require a signed-in account and canonical household membership', async () => {
  const noQuery = { async query() { assert.fail('must reject before looking up a member') } }
  await assert.rejects(resolveBookingMember(noQuery, null, { memberId: 8 }), { statusCode: 401 })
  for (const memberId of [0, -2, 'bad', 1.5]) {
    await assert.rejects(resolveBookingMember(noQuery, payer, { memberId }), { statusCode: 400 })
  }
  const fixture = routeFixture({ authorized: false })
  await assert.rejects(resolveBookingMember(fixture.client, payer, { memberId: 8 }), { statusCode: 403 })
  assert.equal(fixture.calls.some(({ sql }) => sql.includes('member_drop_in_entitlement')), false)
})

test('athlete-specific catalog uses the athlete membership rather than the payer membership', async () => {
  const fixture = routeFixture({ annualMember: true, annualUsed: 1 })
  const response = await fixture.request('get', '/api/public/drop-ins', { query: { memberId: '8' } })
  assert.equal(response.status, 200)
  assert.equal(response.body.data.benefits.annualMember, true)
  assert.equal(response.body.data.benefits.annualCreditsRemaining, 3)
  assert.ok(fixture.calls.some(({ sql, params }) => sql.includes('member_drop_in_entitlement') && params[0] === 8))
})

test('athlete-specific catalog rejects guests and athletes outside the household', async () => {
  const guest = await routeFixture().request('get', '/api/public/drop-ins', { query: { memberId: '8' }, authenticated: false })
  assert.equal(guest.status, 401)
  const other = await routeFixture({ authorized: false }).request('get', '/api/public/drop-ins', { query: { memberId: '8' } })
  assert.equal(other.status, 403)
})

test('registration after membership checkout uses the selected athlete credit and canonical identity', async () => {
  const fixture = routeFixture({ annualMember: true })
  const response = await fixture.request('post', '/api/public/drop-ins/register', {
    body: { memberId: 8, slotGroupId: 20, classDate: tomorrow, firstName: 'Forged', lastName: 'Name', email: 'forged@example.test' },
  })
  assert.equal(response.status, 201)
  assert.equal(response.body.data.status, 'confirmed')
  assert.equal(response.body.data.benefitType, 'annual_credit')
  assert.equal(response.body.data.totalCents, 0)
  const saved = fixture.calls.find(({ sql }) => sql.includes('INSERT INTO drop_in_registration')).params
  assert.equal(saved[0], 8)
  assert.deepEqual(saved.slice(4, 8), ['Avery', 'Stone', 'parent@example.test', '202-555-0123'])
  assert.equal(fixture.calls.some(({ sql }) => sql.includes('INSERT INTO billing_charge')), false)
  const waiverIndex = fixture.calls.findIndex(({ sql }) => sql.includes('FROM waiver_template template'))
  const bookingIndex = fixture.calls.findIndex(({ sql }) => sql.includes('INSERT INTO drop_in_registration'))
  assert.ok(waiverIndex >= 0 && waiverIndex < bookingIndex)
})

test('explicit member registration needs no duplicate identity form and remains pending until payment', async () => {
  for (const annualMember of [false, true]) {
    const fixture = routeFixture({ annualMember, annualUsed: 4 })
    const response = await fixture.request('post', '/api/public/drop-ins/register', {
      body: { memberId: 8, slotGroupId: 20, classDate: tomorrow },
    })
    assert.equal(response.status, 201)
    assert.equal(response.body.data.status, 'payment_pending')
    assert.equal(response.body.data.benefitType, 'paid')
    assert.equal(response.body.data.totalCents, annualMember ? 3000 : 4000)
    const charge = fixture.calls.find(({ sql }) => sql.includes('INSERT INTO billing_charge'))
    assert.equal(charge.params[1], 8)
    assert.equal(charge.params[4], annualMember ? 3000 : 4000)
  }
})

test('registration with unsigned athlete waivers cannot create a booking, use credits, or start billing', async () => {
  const fixture = routeFixture({ signed: false, annualMember: true })
  const response = await fixture.request('post', '/api/public/drop-ins/register', {
    body: { memberId: 8, slotGroupId: 20, classDate: tomorrow },
  })
  assert.equal(response.status, 400)
  assert.equal(response.body.code, 'DROP_IN_WAIVERS_REQUIRED')
  assert.ok(fixture.calls.some(({ sql }) => sql === 'ROLLBACK'))
  assert.equal(fixture.calls.some(({ sql }) => /INSERT INTO (drop_in_registration|billing_charge|member_drop_in_entitlement)/.test(sql)), false)
})

test('registration cannot substitute an athlete from another household', async () => {
  const fixture = routeFixture({ authorized: false })
  const response = await fixture.request('post', '/api/public/drop-ins/register', {
    body: { memberId: 8, slotGroupId: 20, classDate: tomorrow },
  })
  assert.equal(response.status, 403)
  assert.equal(fixture.calls.some(({ sql }) => sql.includes('INSERT INTO drop_in_registration')), false)
})
