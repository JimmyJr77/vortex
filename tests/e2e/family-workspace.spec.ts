import { expect, test, type Page } from '@playwright/test'

const people = [
  { id: 10, name: 'Alex Rivera', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.test', phone: '5550100000', dateOfBirth: '1987-02-10', isActive: true, currentHousehold: true, guardianFor: [11] },
  { id: 11, name: 'Jordan Rivera', firstName: 'Jordan', lastName: 'Rivera', email: null, phone: null, dateOfBirth: '2016-06-10', isActive: true, currentHousehold: true, guardianFor: [] },
]
const history = { rows: [{ key: 'signup:20', date: '2026-10-01', kind: 'enrollment', memberId: 11, title: 'Youth Gymnastics', summary: 'confirmed · Start 2026-10-01', source: 'Vortex', amountCents: null }], nextCursor: 'older-fixture' }
const workspace = {
  family: { id: 42, name: 'Rivera Family', archived: false }, people,
  participation: [{ id: 20, memberId: 11, className: 'Youth Gymnastics', status: 'active', startDate: '2026-10-01', cancelDate: null, slots: [{ day: 1, start: '16:00', end: '17:00', week: null, date: null }] }],
  trials: { rows: [{ id: 31, memberId: 11, className: 'Youth Gymnastics', date: '2026-09-25', kind: 'free_trial', status: 'attended' }], total: 1 },
  leads: { rows: [{ id: 55, name: 'Alex Rivera', status: 'qualified', createdAt: '2026-09-20', contactedAt: '2026-09-21', followUp: true, archived: false, linkType: 'contact_match', message: 'Interested in a first class.', notes: 'Trial booked.' }], total: 1 },
  financial: { accountId: 7, payerMemberId: 10, billingEmail: 'alex@example.test', billingPhone: '5550100000', outstandingBalanceCents: 12500, futureCreditsCents: 0, balanceCents: 12500, nextBillDate: '2026-12-01', recurringBillingMonth: '2026-12',
    memberships: [{ memberId: 11, active: true, membershipDate: '2026-10-01', renewalDate: '2027-10-01', autoRenewal: true }],
    paymentMethod: { available: false, syncStatus: 'pending', syncedAt: null, brand: null, last4: null } },
  permissions: { canViewBilling: true }, history, generatedAt: '2026-11-09T12:00:00Z', coverage: 'Imported records retain original dates and source references.',
}
async function prepare(page: Page, billing = true) {
  const requests: string[] = [], errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Workspace Admin', isMaster: true }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url()), path = url.pathname
    requests.push(path)
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: billing, permissions: ['members.view'], roles: ['ADMIN'], user: { id: 1 } }
    if (path === '/api/admin/notifications') data = { notifications: [], unreadCount: 0 }
    if (path === '/api/admin/accounting/options') data = { members: [], classes: [] }
    if (path === '/api/admin/accounting/lines') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0, timezone: 'America/New_York', summary: { billedCents: 0, paidCents: 0, creditAppliedCents: 0, openCents: 0, creditCents: 0, openCount: 0 } }
    if (path === '/api/admin/new-admin/families') data = { rows: [{ id: 42, name: 'Rivera Family', archived: false, peopleCount: 2 }], total: 1, page: 1, pageSize: 25, totalPages: 1 }
    if (path === '/api/admin/new-admin/families/42/workspace') data = { ...workspace, financial: billing ? workspace.financial : null, permissions: { canViewBilling: billing } }
    if (path === '/api/admin/new-admin/families/42/history') data = { rows: [{ key: 'jackrabbit:1', date: null, kind: 'enrollment', memberId: 11, title: 'Older imported enrollment', summary: 'Source JR-100', source: 'Jackrabbit', amountCents: null }], nextCursor: null }
    if (path.endsWith('/overview')) data = {
      revision: 'fixture', account: { id: 7, familyId: 42, familyName: 'Rivera Family', payerMemberId: 10, billingEmail: 'alex@example.test', isActive: true, accountStatus: 'active' }, selectedMemberId: null, members: people,
      summary: { chargesCents: 12500, paymentsCents: 0, refundsCents: 0, balanceCents: 12500, outstandingBalanceCents: 12500, collectibleBalanceCents: 12500, monthlyRecurringCents: 0, monthlyRecurringDiscountCents: 0, futureCreditsCents: 0, paidThisMonthCents: 0, monthlyTotals: { grossCents: 0, discountCents: 0, netCents: 0 }, nextBillDate: null, latestPayment: null, stripeSync: { status: 'not_linked', message: '' } },
      paymentMethod: { available: false, stripeEnabled: false, paymentMethod: null }, alerts: [], enrollments: [], waitlists: [], annualMemberships: [], monthlyInvoices: [], bundlePasses: [], bundleUsage: [], subscriptions: [], adjustments: [],
    }
    if (path.endsWith('/transactions') || path.endsWith('/activity')) data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'New Admin sections' }).getByRole('button', { name: 'Members & accounts' }).click()
  await page.getByRole('button', { name: 'Open family', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Rivera Family', exact: true })).toBeVisible()
  return { requests, errors }
}

test('family tabs share one response; history, billing return and mobile navigation work', async ({ page }) => {
  const { requests, errors } = await prepare(page)
  const region = page.getByRole('region', { name: 'Unified family workspace' })
  const tabs = region.getByRole('navigation', { name: 'Family workspace sections' })
  await expect(region.getByText('$125.00', { exact: true })).toBeVisible()
  await expect(region.getByText('Guardian for Jordan Rivera')).toBeVisible()
  await tabs.getByRole('button', { name: 'Classes', exact: true }).click()
  await expect(region.getByRole('table')).toContainText('Jordan Rivera')
  await region.getByLabel('Show person').selectOption('10')
  await expect(region.getByRole('table')).not.toContainText('Youth Gymnastics')
  await tabs.getByRole('button', { name: 'Trials', exact: true }).click()
  await region.getByLabel('Show person').selectOption('11')
  await expect(region.getByText('attended', { exact: true })).toBeVisible()
  await tabs.getByRole('button', { name: 'Leads', exact: true }).click()
  await expect(region.getByText('Interested in a first class.')).toBeVisible()
  await expect(region.getByText(/Sep 20, 2026 · Contact match/)).toBeVisible()
  await tabs.getByRole('button', { name: 'History', exact: true }).click()
  await region.getByRole('button', { name: 'Load older history' }).click()
  await expect(region.getByText('Older imported enrollment')).toBeVisible()
  await expect(region.getByText('Jackrabbit · Not recorded')).toBeVisible()
  expect(requests.filter(p => p.endsWith('/workspace'))).toHaveLength(1)
  expect(requests.filter(p => p.includes('/customer-billing/'))).toHaveLength(0)
  expect(requests.filter(p => p.includes('/scheduling/members/'))).toHaveLength(0)
  await region.getByRole('button', { name: 'Billing & payments' }).click()
  await expect.poll(() => requests.includes('/api/admin/customer-billing/families/42/overview')).toBe(true)
  await page.getByRole('button', { name: 'Back to family workspace' }).click()
  await expect(region.getByRole('heading', { name: 'Rivera Family', exact: true })).toBeVisible()
  expect(requests.filter(p => p.endsWith('/workspace'))).toHaveLength(2)
  await page.setViewportSize({ width: 390, height: 844 })
  await tabs.getByRole('button', { name: 'History', exact: true }).click()
  await expect(region.getByRole('button', { name: 'Load older history' })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: '/tmp/vortex-family-workspace-mobile.png', fullPage: true })
  await page.setViewportSize({ width: 1440, height: 1050 })
  await tabs.getByRole('button', { name: 'Overview', exact: true }).click()
  await page.screenshot({ path: '/tmp/vortex-family-workspace.png', fullPage: true })
  expect(errors).toEqual([])
})

test('member-view-only staff can browse family history without billing or edit controls', async ({ page }) => {
  const { errors } = await prepare(page, false)
  const region = page.getByRole('region', { name: 'Unified family workspace' })
  await expect(region.getByText('Billing and financial history require billing access.')).toBeVisible()
  await expect(region.getByRole('button', { name: 'Billing & payments' })).toHaveCount(0)
  await expect(region.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await expect(region.getByRole('button', { name: 'Enroll family member' })).toHaveCount(0)
  await region.getByRole('button', { name: 'Load older history' }).click()
  await expect(region.getByText('Older imported enrollment')).toBeVisible()
  expect(errors).toEqual([])
})
