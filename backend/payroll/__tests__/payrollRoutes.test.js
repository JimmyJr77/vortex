import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import { registerPayrollRoutes } from '../registerRoutes.js'
import { registerPayrollEmployeeRoutes } from '../employeeRoutes.js'
import { createPayrollToken, hashPayrollToken } from '../employeeAuth.js'

test('payroll routes stay inside the authenticated admin namespace', () => {
  const registered = []
  const app = {
    get(path, ...handlers) { registered.push({ method: 'GET', path, handlers }) },
    post(path, ...handlers) { registered.push({ method: 'POST', path, handlers }) },
    patch(path, ...handlers) { registered.push({ method: 'PATCH', path, handlers }) },
  }
  registerPayrollRoutes(app, {})
  assert.ok(registered.length >= 15)
  assert.ok(registered.every((route) => route.path.startsWith('/api/admin/payroll/')))
  assert.ok(registered.some((route) => route.path.endsWith('/ai-review') && route.handlers.length === 2))
  assert.ok(registered.some((route) => route.path.endsWith('/reports/quickbooks.csv')))
})

test('legacy admin permission bridge protects payroll reads and writes separately', () => {
  const serverSource = fs.readFileSync(new URL('../../server.js', import.meta.url), 'utf8')
  assert.match(serverSource, /path\.startsWith\('\/payroll'\).*method === 'GET' \? 'payroll\.view' : 'payroll\.manage'/)
  assert.match(serverSource, /registerPayrollRoutes\(app, pool\)/)
})

test('employee payroll portal exposes a separate narrow route surface', () => {
  const registered = []
  const app = {
    get(path, ...handlers) { registered.push({ method: 'GET', path, handlers }) },
    post(path, ...handlers) { registered.push({ method: 'POST', path, handlers }) },
    patch(path, ...handlers) { registered.push({ method: 'PATCH', path, handlers }) },
  }
  registerPayrollEmployeeRoutes(app, {})
  assert.deepEqual(registered.map((route) => route.path).sort(), [
    '/api/payroll/employee/clock',
    '/api/payroll/employee/invitations/redeem',
    '/api/payroll/employee/logout',
    '/api/payroll/employee/me',
    '/api/payroll/employee/profile',
    '/api/payroll/employee/time-entries/:id/attest',
  ].sort())
  assert.ok(registered.every((route) => route.path.startsWith('/api/payroll/employee/')))
})

test('employee invitation and session tokens are high-entropy and only compared by hash', () => {
  const first = createPayrollToken()
  const second = createPayrollToken()
  assert.notEqual(first, second)
  assert.ok(first.length >= 40)
  assert.match(hashPayrollToken(first), /^[a-f0-9]{64}$/)
  assert.equal(hashPayrollToken(first), hashPayrollToken(first))
  assert.notEqual(hashPayrollToken(first), hashPayrollToken(second))
})
