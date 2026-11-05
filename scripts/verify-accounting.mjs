import assert from 'node:assert/strict'
import fs from 'node:fs/promises'
import { performance } from 'node:perf_hooks'

const base = process.env.NEW_ADMIN_API_URL || 'http://127.0.0.1:3101'
if (!['localhost', '127.0.0.1', '[::1]'].includes(new URL(base).hostname)) {
  throw new Error('This fictional-account verification accepts only a loopback API.')
}
const login = await fetch(`${base}/api/admin/login`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ usernameOrEmail: 'admin2', password: 'adminadmin' }),
})
const auth = await login.json()
assert.ok(login.ok && auth.token, 'Normal fictional admin login succeeds')
const checks = [], requests = []
async function get(path) {
  const start = performance.now()
  const response = await fetch(`${base}/api/admin/accounting${path}`, { headers: { Authorization: `Bearer ${auth.token}` } })
  const body = await response.json()
  requests.push({ path, status: response.status, durationMs: Math.round((performance.now() - start) * 100) / 100 })
  assert.equal(response.status, 200, `${path}: ${body.message || 'request succeeds'}`)
  assert.notEqual(body.success, false)
  return body.data
}
async function check(name, run) { await run(); checks.push(name) }
let first, open, paymentPage
await check('Unauthenticated financial reporting is denied', async () => {
  const response = await fetch(`${base}/api/admin/accounting/lines`)
  assert.equal(response.status, 401)
})
await check('All-bill pagination retains totals for the complete filtered result', async () => {
  first = await get('/lines?pageSize=7&sortBy=date&sortDir=desc')
  assert.ok(first.total > 7, 'Fictional seed exercises multiple pages')
  const second = await get('/lines?pageSize=7&page=2&sortBy=date&sortDir=desc')
  assert.deepEqual(first.summary, second.summary)
  assert.equal(first.total, second.total)
  assert.equal(new Set([...first.rows, ...second.rows].map(row => row.id)).size, first.rows.length + second.rows.length)
})
await check('Open bills include only positive unpaid remainders and sort by balance', async () => {
  open = await get('/lines?status=open&sortBy=balance&sortDir=desc&pageSize=100')
  assert.ok(open.rows.length > 0)
  assert.ok(open.rows.every(row => row.openCents > 0))
  assert.ok(open.rows.every((row, index) => !index || open.rows[index - 1].openCents >= row.openCents))
})
await check('Person and class filters return exact IDs and retain accessible bill history', async () => {
  const sample = [...first.rows, ...open.rows].find(row => row.memberId && row.classId)
  assert.ok(sample, 'Seed contains a class bill for a person')
  const result = await get(`/lines?memberId=${sample.memberId}&classId=${sample.classId}&pageSize=100`)
  assert.ok(result.rows.length > 0)
  assert.ok(result.rows.every(row => Number(row.memberId) === Number(sample.memberId) && Number(row.classId) === Number(sample.classId)))
  const detail = await get(`/lines/${sample.id}`)
  assert.equal(Number(detail.line.id), Number(sample.id))
  assert.ok(Array.isArray(detail.allocations))
  assert.ok(Array.isArray(detail.refunds))
})
await check('An inclusive bill-date interval selects only dates inside it', async () => {
  const date = first.rows[0].billedDate
  assert.match(date, /^\d{4}-\d{2}-\d{2}$/)
  const result = await get(`/lines?from=${date}&through=${date}&dateField=billed&pageSize=100`)
  assert.ok(result.rows.length > 0)
  assert.ok(result.rows.every(row => row.billedDate === date))
})
await check('Payments and refunds remain separate dated cash events', async () => {
  paymentPage = await get('/payments?pageSize=100')
  assert.ok(paymentPage.rows.some(row => row.kind === 'payment'))
  const refunds = await get('/payments?kind=refund&pageSize=100')
  assert.ok(refunds.rows.length > 0)
  assert.ok(refunds.rows.every(row => row.kind === 'refund'))
  assert.equal(refunds.summary.receiptsCents, 0)
  assert.equal(refunds.summary.netCashCents, -refunds.summary.refundsCents)
})
await check('Payment-date selection finds the bill allocations actually paid that day', async () => {
  const receipt = paymentPage.rows.find(row => row.kind === 'payment' && row.settled && row.appliedCents > 0)
  assert.ok(receipt)
  const result = await get(`/lines?dateField=paid&from=${receipt.occurredDate}&through=${receipt.occurredDate}&pageSize=100`)
  assert.ok(result.rows.length > 0)
  assert.ok(result.rows.every(row => row.paymentCount > 0))
})
await check('Scoped searchable filter options are available', async () => {
  const options = await get('/options?q=Casey')
  assert.ok(Array.isArray(options.members) && Array.isArray(options.classes))
  assert.ok(options.members.length <= options.limit && options.classes.length <= options.limit)
})
await check('Invalid date ranges fail validation', async () => {
  const response = await fetch(`${base}/api/admin/accounting/lines?from=2026-12-31&through=2026-01-01`, { headers: { Authorization: `Bearer ${auth.token}` } })
  assert.equal(response.status, 400)
})
await check('Filtered CSV is served as a downloadable financial report', async () => {
  const response = await fetch(`${base}/api/admin/accounting/export.csv?view=lines&status=open`, { headers: { Authorization: `Bearer ${auth.token}` } })
  assert.equal(response.status, 200)
  assert.match(response.headers.get('content-type') || '', /text\/csv/)
  assert.match(response.headers.get('content-disposition') || '', /attachment/)
  assert.ok((await response.text()).length > 100)
})
const evidence = {
  verifiedAt: new Date().toISOString(),
  environment: 'Normal admin2 authentication; isolated fictional loopback database; read-only reporting requests; no Stripe calls or financial mutations.',
  status: 'passed', checks, requests,
  observed: { billLines: first.total, openLines: open.total, cashEvents: paymentPage.total, billSummary: first.summary, cashSummary: paymentPage.summary },
}
await fs.writeFile('docs/accounting-api-verification.json', JSON.stringify(evidence, null, 2) + '\n')
console.log(JSON.stringify({ status: evidence.status, checks: checks.length, observed: evidence.observed }, null, 2))
