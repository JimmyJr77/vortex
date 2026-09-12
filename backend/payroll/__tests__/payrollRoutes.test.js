import {payrollPermissionFor} from '../../platform/canonicalAdminAuth.js'
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
    post(path, ...handlers) { for(const routePath of [path].flat())registered.push({ method: 'POST', path:routePath, handlers }) },
    patch(path, ...handlers) { registered.push({ method: 'PATCH', path, handlers }) },
  }
  registerPayrollRoutes(app, {})
  assert.ok(registered.length >= 15)
  assert.ok(registered.some(route=>route.path==='/api/admin/payroll/runs/:id/retirement-remittance/preview'&&route.method==='POST'))
  assert.ok(registered.some(route=>route.path==='/api/admin/payroll/retirement-remittance-sources'&&route.method==='GET'))
  for(const [method,suffix] of [['GET',''],['POST',''],['POST','/preview'],['POST','/:id/verify'],['POST','/:id/suspend']])assert.ok(registered.some(route=>route.path===`/api/admin/payroll/retirement-plans/:planId/destination${suffix}`&&route.method===method))
  for(const path of ['/api/admin/payroll/retirement-plans','/api/admin/payroll/employees/:employeeId/retirement-participant/:planId','/api/admin/payroll/employees/:employeeId/retirement-eligibility/:planId','/api/admin/payroll/employees/:employeeId/retirement-annual-sources/:planId'])for(const method of ['GET','POST'])assert.ok(registered.some(route=>route.path===path&&route.method===method))
  for(const method of ['GET','POST'])assert.ok(registered.some(route=>route.path==='/api/admin/payroll/benefit-coverage'&&route.method===method))
  for(const [method,suffix] of [['GET',''],['POST',''],['POST','/preview'],['POST','/:noticeId/cancel'],['POST','/:noticeId/process'],['POST','/:noticeId/return-review/preview'],['POST','/:noticeId/return-review'],['POST','/:noticeId/release-unsent/preview'],['POST','/:noticeId/release-unsent']])assert.ok(registered.some(route=>route.path===`/api/admin/payroll/carrier-payment-authorizations/:id/remittance-notices${suffix}`&&route.method===method))
  for(const method of ['GET','POST'])assert.ok(registered.some(route=>route.path==='/api/admin/payroll/benefit-carrier-invoices/:id/remittance-recipient'&&route.method===method))
  assert.ok(registered.some(route=>route.path==='/api/admin/payroll/carrier-payment-authorizations/:id/alternate-delivery'&&route.method==='POST'))
  for(const suffix of ['remittance-advice','remittance-advice/download','alternate-delivery'])assert.ok(registered.some(route=>route.path===`/api/admin/payroll/carrier-payment-authorizations/:id/${suffix}`&&route.method==='GET'))
  for(const [method,path] of [['GET','/federal-remittance-review'],['GET','/federal-remittance-preview'],['POST','/federal-remittance-reviews']])assert.ok(registered.some(route=>route.path===`/api/admin/payroll${path}`&&route.method===method))
  assert.ok(registered.some(route=>route.path.endsWith('/checks/:employeeId/evidence')&&route.method==='GET'))
  assert.ok(registered.some(route=>route.path.endsWith('/payment-closeout')&&route.method==='POST'))
  assert.ok(registered.some(route=>route.path.endsWith('/finalize')&&route.method==='POST'))
  assert.ok(registered.every((route) => route.path.startsWith('/api/admin/payroll/')))
  assert.ok(registered.some((route) => route.path.endsWith('/ai-review') && route.handlers.length === 2))
  assert.ok(registered.some((route) => route.path.endsWith('/reports/quickbooks.csv')))
})

test('legacy admin permission bridge protects payroll reads and writes separately', () => {
  const serverSource = fs.readFileSync(new URL('../../server.js', import.meta.url), 'utf8')
  assert.ok(/path\.startsWith\('\/payroll'\).*payrollPermissionFor\(method\)/.test(serverSource))
  assert.equal(payrollPermissionFor('GET'),'payroll.view')
  for(const method of ['POST','PATCH','PUT','DELETE'])assert.equal(payrollPermissionFor(method),'payroll.manage')
  assert.ok(serverSource.indexOf("app.use('/api/admin'")<serverSource.indexOf('registerPayrollRoutes(app, pool)'))
  assert.ok(serverSource.includes('createCanonicalAdminAuth(pool,JWT_SECRET)'))
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
    '/api/payroll/employee/bank-enrollment',
    '/api/payroll/employee/bank-enrollment',
    '/api/payroll/employee/bank-enrollment/advance',
    '/api/payroll/employee/bank-enrollment/history',
    '/api/payroll/employee/bank-enrollment/recover',
    '/api/payroll/employee/bank-enrollment/restart',
    '/api/payroll/employee/bank-enrollment/link',
    '/api/payroll/employee/payment-authorization',
    '/api/payroll/employee/payment-authorization',
    '/api/payroll/employee/w2-documents',
    '/api/payroll/employee/w2-documents/:publicationId/pdf',
    '/api/payroll/employee/w2-electronic/terms',
    '/api/payroll/employee/w2-electronic/proof',
    '/api/payroll/employee/w2-electronic/consent',
    '/api/payroll/employee/w2-electronic/consent',
    '/api/payroll/employee/filing-identity',
    '/api/payroll/employee/filing-identity/review',
    '/api/payroll/employee/clock',
    '/api/payroll/employee/access',
    '/api/payroll/employee/login',
    '/api/payroll/employee/leave-availability',
    '/api/payroll/employee/documents/:documentId',
    '/api/payroll/employee/onboarding',
    '/api/payroll/employee/onboarding/:taskId',
    '/api/payroll/employee/onboarding/:taskId/acknowledgments',
    '/api/payroll/employee/benefits-election',
    '/api/payroll/employee/retirement',
    '/api/payroll/employee/retirement-contributions',
    '/api/payroll/employee/retirement/:planId/elections',
    '/api/payroll/employee/benefit-contributions',
    '/api/payroll/employee/benefit-coverage',
    '/api/payroll/employee/benefits-deduction-authorization',
    '/api/payroll/employee/benefits-deduction-authorization/withdraw',
    '/api/payroll/employee/onboarding/:taskId/documents',
    '/api/payroll/employee/onboarding/:taskId/draft',
    '/api/payroll/employee/onboarding/:taskId/i9/draft',
    '/api/payroll/employee/onboarding/:taskId/i9/draft',
    '/api/payroll/employee/maryland-agreement-proposals',
    '/api/payroll/employee/maryland-agreement-proposals/:id/respond',
    '/api/payroll/employee/onboarding/:taskId/w4/draft',
    '/api/payroll/employee/onboarding/:taskId/w4/draft',
    '/api/payroll/employee/onboarding/:taskId/w4/page',
    '/api/payroll/employee/onboarding/:taskId/w4/preview',
    '/api/payroll/employee/onboarding/:taskId/w4/sign',
    '/api/payroll/employee/onboarding/:taskId/mw507/draft',
    '/api/payroll/employee/onboarding/:taskId/mw507/draft',
    '/api/payroll/employee/onboarding/:taskId/mw507/page',
    '/api/payroll/employee/onboarding/:taskId/mw507/preview',
    '/api/payroll/employee/onboarding/:taskId/mw507/sign',
    '/api/payroll/employee/salary-changes',
    '/api/payroll/employee/salary-changes/:id/acknowledge',
    '/api/payroll/employee/pay-schedule-notices',
    '/api/payroll/employee/pay-schedule-notices/:id/acknowledge',
    '/api/payroll/employee/pay-rates',
    '/api/payroll/employee/pay-rates/:id/acknowledge',
    '/api/payroll/employee/pay-statements/:id.pdf',
    '/api/payroll/employee/payment-replacement-receipts',
    '/api/payroll/employee/payment-replacement-receipts/:receiptId/download',
    '/api/payroll/employee/check-receipts',
    '/api/payroll/employee/check-receipts/:receiptId/download',
    '/api/payroll/employee/check-receipts/:id/acknowledge',
    '/api/payroll/employee/requests',
    '/api/payroll/employee/requests/:requestId/cancel',
    '/api/payroll/employee/invitations/redeem',
    '/api/payroll/employee/logout',
    '/api/payroll/employee/me',
    '/api/payroll/employee/profile',
    '/api/payroll/employee/time-entries/:id/attest',
  ].sort())
  assert.ok(registered.every((route) => route.path.startsWith('/api/payroll/employee/')))
  assert.ok(registered.filter(route=>!route.path.endsWith('/invitations/redeem')).every(route=>route.handlers.length >= 2))
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
