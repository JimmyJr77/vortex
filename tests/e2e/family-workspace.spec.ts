import { expect, test, type Page } from '@playwright/test'

const people = [
  { id: 10, name: 'Alex Rivera', firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.test', phone: '5550100000', dateOfBirth: '1987-02-10', active: true, enrolled: false, archived: false, isActive: true, currentHousehold: true, guardianFor: [11] },
  { id: 11, name: 'Jordan Rivera', firstName: 'Jordan', lastName: 'Rivera', email: null, phone: null, dateOfBirth: '2016-06-10', active: false, enrolled: true, archived: false, isActive: true, currentHousehold: true, guardianFor: [] },
]
const history = { rows: [{ key: 'signup:20', date: '2026-10-01', kind: 'enrollment', memberId: 11, title: 'Youth Gymnastics', summary: 'confirmed · Start 2026-10-01', source: 'Vortex', amountCents: null }], nextCursor: 'older-fixture' }
const workspace = {
  family: { id: 42, name: 'Rivera Family', active: false, enrolled: true, archived: false, memberSince: '2018-03-03' }, people, today: '2026-11-12',
  participation: [{ id: 20, memberId: 11, className: 'Youth Gymnastics', status: 'active', startDate: '2026-10-01', cancelDate: null, slots: [{ day: 1, start: '16:00', end: '17:00', week: null, date: null }] }],
  trials: { rows: [{ id: 31, memberId: 11, className: 'Youth Gymnastics', date: '2026-09-25', kind: 'free_trial', status: 'attended' }], total: 1 },
  leads: { rows: [{ id: 55, name: 'Alex Rivera', status: 'qualified', createdAt: '2026-09-20', contactedAt: '2026-09-21', followUp: true, archived: false, linkType: 'contact_match', message: 'Interested in a first class.', notes: 'Trial booked.' }], total: 1 },
  financial: { accountId: 7, payerMemberId: 10, billingEmail: 'alex@example.test', billingPhone: '5550100000', outstandingBalanceCents: 12500, futureCreditsCents: 0, balanceCents: 12500, nextBillDate: '2026-12-01', recurringBillingMonth: '2026-12',
    memberships: [{ memberId: 11, active: false, membershipDate: '2025-10-01', renewalDate: '2026-10-01', autoRenewal: false }],
    paymentMethod: { available: false, syncStatus: 'pending', syncedAt: null, brand: null, last4: null } },
  permissions: { canViewBilling: true }, history, generatedAt: '2026-11-09T12:00:00Z', coverage: 'Imported records retain original dates and source references.',
}
async function prepare(page: Page, billing = true, permissions = ['members.view']) {
  const requests: string[] = [], errors: string[] = []
  const directoryRequests: Array<{ path: string; params: Record<string, string> }> = []
  const noteWrites: unknown[] = []
  const memberWrites: unknown[] = []
  const credentialWrites: unknown[] = []
  let username = 'alex-original'
  const lifecycleWrites: string[] = []
  let household = people
  let archivedLogins = [{ id: 99, fullName: 'Orphaned Login', email: 'archived@example.test', username: 'old-login' }]
  const notes = [
    { id: 1, subjectType: 'member', subjectId: 11, noteType: 'staff_note', body: 'Shared household correspondence', authorName: 'Coach Taylor', createdAt: '2026-11-09T12:00:00Z' },
    { id: 2, subjectType: 'registration', subjectId: 55, noteType: 'staff_note', body: 'Trial reminder sent', authorName: 'Coach Morgan', createdAt: '2026-11-10T12:00:00Z' },
  ]
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
    if (path === '/api/admin/new-admin/families' || path === '/api/admin/account-directory') directoryRequests.push({ path, params: Object.fromEntries(url.searchParams) })
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: billing, permissions, roles: ['ADMIN'], user: { id: 1 } }
    if (path === '/api/admin/new-admin/crm') data = { rows: archivedLogins.map(login => ({ ...login, name: login.fullName, kind: 'staff', archived: true })), total: archivedLogins.length, page: 1, pageSize: 25, totalPages: 1 }
    if (path === '/api/admin/notifications') data = { notifications: [], unreadCount: 0 }
    if (path === '/api/admin/accounting/options') data = { members: [], classes: [] }
    if (path === '/api/admin/accounting/lines') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0, timezone: 'America/New_York', summary: { billedCents: 0, paidCents: 0, creditAppliedCents: 0, openCents: 0, creditCents: 0, openCount: 0 } }
    if (path === '/api/admin/new-admin/families') data = { rows: [{ ...workspace.family, peopleCount: 2 }], total: 1, page: 1, pageSize: 25, totalPages: 1 }
    if (path === '/api/admin/account-directory') {
      const rows = household.filter(person => (!url.searchParams.get('active') || person.active === (url.searchParams.get('active') === 'true'))
        && (!url.searchParams.get('enrolled') || person.enrolled === (url.searchParams.get('enrolled') === 'true'))).map(person => ({
        ...person, recordStatus: person.archived ? 'archived' : 'active', family: { id: 42, name: 'Rivera Family' },
        household: { badges: person.id === 10 ? ['guardian', 'payer'] : ['dependent'] },
        staffAccess: { roles: [] }, portalAccess: { status: 'active' }, participation: { current: person.enrolled ? 1 : 0, upcoming: 0 },
      }))
      data = { rows, total: rows.length, page: 1, pageSize: 25, totalPages: 1 }
    }
    if (path === '/api/admin/new-admin/families/42/workspace') data = { ...workspace, people: household, financial: billing ? workspace.financial : null, permissions: { canViewBilling: billing } }
    if (path === '/api/admin/members/11/archive-check') return route.fulfill({ json: { success: true, canArchive: true } })
    if (path === '/api/admin/members/11/archive' && route.request().method() === 'PATCH') {
      lifecycleWrites.push('archive member')
      const active = route.request().postDataJSON().archived !== true
      household = household.map(person => person.id === 11 ? { ...person, archived: !active, isActive: active, currentHousehold: active } : person)
    }
    if (path === '/api/admin/members/11' && route.request().method() === 'DELETE') {
      lifecycleWrites.push('delete member')
      household = household.filter(person => person.id !== 11)
    }
    if (path === '/api/admin/members/10/portal-access') data = { username, hasPassword: true, status: 'active', memberIsActive: true, accountIsActive: true, suspensionReasons: [] }
    if (path === '/api/admin/members/10' && route.request().method() === 'PUT') {
      const payload = route.request().postDataJSON()
      credentialWrites.push(payload)
      if (payload.username !== undefined) username = payload.username
    }
    if (path === '/api/admin/access/users' && url.searchParams.get('scope') === 'archived-logins') data = archivedLogins
    if (path === '/api/admin/access/users/99' && route.request().method() === 'DELETE') {
      lifecycleWrites.push('delete login')
      archivedLogins = []
    }
    if (path === '/api/admin/new-admin/members' && route.request().method() === 'POST') {
      const { familyId, legalGuardianMemberId, ...member } = route.request().postDataJSON()
      memberWrites.push({ familyId, legalGuardianMemberId, ...member })
      const memberId = 12
      household = household.map(person => person.id === legalGuardianMemberId
        ? { ...person, guardianFor: [...person.guardianFor, memberId] }
        : person)
      household.push({ ...member, id: memberId, name: `${member.firstName} ${member.lastName}`, active: false, enrolled: false, archived: false, isActive: true, currentHousehold: true, guardianFor: [] })
      data = { familyId, memberId }
    }
    if (path === '/api/admin/new-admin/families/42/notes' || path === '/api/admin/new-admin/leads/55/notes') data = notes
    if (path === '/api/admin/new-admin/leads') data = { rows: [{ id: 55, firstName: 'Alex', lastName: 'Rivera', email: 'alex@example.test', phone: '5550100000', status: 'converted', convertedMemberId: 10, contacted: true, followUp: true, createdAt: '2026-09-20', message: 'Interested in a first class.', inquiry: {} }], total: 1, page: 1, pageSize: 25, totalPages: 1 }
    if (path === '/api/admin/notes' && route.request().method() === 'POST') {
      const payload = route.request().postDataJSON()
      noteWrites.push(payload)
      const note = { ...payload, id: notes.length + 1, authorName: 'Workspace Admin', createdAt: '2026-11-11T12:00:00Z' }
      notes.push(note); data = note
    }
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
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Members & accounts' }).click()
  await page.getByRole('button', { name: 'Open family', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Rivera Family', exact: true })).toBeVisible()
  return { requests, directoryRequests, errors, noteWrites, memberWrites, lifecycleWrites, credentialWrites }
}

test('family and people directories filter active status independently from enrollment and record lifecycle', async ({ page }) => {
  const { directoryRequests, errors } = await prepare(page)
  const region = page.getByRole('region', { name: 'Unified family workspace' })
  const familyStatus = region.locator('header').getByRole('group', { name: 'Active status and enrollment' })
  await expect(familyStatus.getByText('Inactive', { exact: true })).toBeVisible()
  await expect(familyStatus.getByText('Enrolled', { exact: true })).toBeVisible()
  const payer = region.getByRole('article', { name: 'Alex Rivera', exact: true })
  await expect(payer.getByText('Active', { exact: true })).toBeVisible()
  await expect(payer.getByText('Not enrolled', { exact: true })).toBeVisible()
  const student = region.getByRole('article', { name: 'Jordan Rivera', exact: true })
  await expect(student.getByText('Inactive', { exact: true })).toBeVisible()
  await expect(student.getByText('Enrolled', { exact: true })).toBeVisible()
  await expect(student.getByRole('button', { name: 'Account security for Jordan Rivera' })).toBeVisible()
  await expect(student.getByRole('button', { name: 'Archive Jordan Rivera', exact: true })).toBeVisible()
  await expect(student.getByRole('button', { name: 'Restore Jordan Rivera', exact: true })).toHaveCount(0)

  await region.getByRole('button', { name: 'All families and people' }).click()
  const families = page.getByRole('table', { name: 'Families', exact: true })
  const familyRow = families.getByRole('row').filter({ has: page.getByRole('button', { name: 'Rivera Family', exact: true }) })
  await expect(familyRow.getByRole('cell').nth(2)).toHaveText('Inactive')
  await expect(familyRow.getByRole('cell').nth(3)).toHaveText('Enrolled')
  await page.getByRole('combobox', { name: 'Active status', exact: true }).selectOption('false')
  await page.getByRole('combobox', { name: 'Enrollment', exact: true }).selectOption('true')
  await expect.poll(() => directoryRequests.at(-1)).toMatchObject({ path: '/api/admin/new-admin/families', params: { active: 'false', enrolled: 'true', page: '1', record: 'active' } })

  await page.getByRole('button', { name: 'People', exact: true }).click()
  const peopleTable = page.getByRole('table', { name: 'People', exact: true })
  const payerRow = peopleTable.getByRole('row').filter({ has: page.getByRole('button', { name: 'Alex Rivera', exact: true }) })
  await expect(payerRow.getByRole('cell').nth(2)).toHaveText('Active')
  await expect(payerRow.getByRole('cell').nth(3)).toHaveText('Not enrolled')
  await page.getByRole('combobox', { name: 'Active status', exact: true }).selectOption('false')
  await page.getByRole('combobox', { name: 'Enrollment', exact: true }).selectOption('true')
  await expect.poll(() => directoryRequests.at(-1)).toMatchObject({ path: '/api/admin/account-directory', params: { active: 'false', enrolled: 'true', page: '1', record: 'active' } })
  await expect(peopleTable.getByRole('button', { name: 'Jordan Rivera', exact: true })).toBeVisible()
  await expect(peopleTable.getByRole('button', { name: 'Alex Rivera', exact: true })).toHaveCount(0)
  await expect(peopleTable.getByRole('button', { name: 'Archive Jordan Rivera', exact: true })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.route('**/api/admin/new-admin/members/11/workspace', route => route.fulfill({ status: 404, json: { success: false, message: 'No family workspace is available.' } }))
  await page.route('**/api/admin/new-admin/members/11?*', route => route.fulfill({ json: { success: true, data: {
    member: { ...people[1], familyId: 42 }, household: { id: 42, name: 'Rivera Family', payerMemberId: 10, members: people },
    enrollments: [], billingAccountId: 7,
  } } }))
  await peopleTable.getByRole('button', { name: 'Jordan Rivera', exact: true }).click()
  await page.getByRole('button', { name: 'Open individual profile', exact: true }).click()
  const profile = page.getByRole('region', { name: 'Individual member profile', exact: true })
  const profileStatus = profile.getByRole('group', { name: 'Active status and enrollment' }).first()
  await expect(profileStatus.getByText('Inactive', { exact: true })).toBeVisible()
  await expect(profileStatus.getByText('Enrolled', { exact: true })).toBeVisible()
  await expect(profile.getByRole('button', { name: 'Account security', exact: true })).toBeVisible()
  await expect(profile.getByRole('button', { name: 'Archive Jordan Rivera', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})

test('family and people rows use direct actions, first membership dates and super-admin archive icons', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 })
  const { requests, errors } = await prepare(page)
  const workspaceRegion = page.getByRole('region', { name: 'Unified family workspace' })
  await expect(workspaceRegion.locator('header')).toContainText('Member sinceMar 3, 2018')
  await workspaceRegion.getByRole('button', { name: 'All families and people', exact: true }).click()
  const families = page.getByRole('table', { name: 'Families', exact: true })
  const row = families.getByRole('row').filter({ has: page.getByRole('button', { name: 'Rivera Family', exact: true }) })
  await expect(families.getByRole('columnheader', { name: 'Member since', exact: true })).toBeVisible()
  await expect(row.getByRole('time')).toHaveText('Mar 3, 2018')
  const archive = row.getByRole('button', { name: 'Archive Rivera Family', exact: true })
  await expect(archive).toHaveText('')
  await page.mouse.move(5, 5)
  await expect(archive).toHaveCSS('opacity', '0')
  await row.hover()
  await expect(archive).toHaveCSS('opacity', '1')
  await page.mouse.move(5, 5)
  await expect(archive).toHaveCSS('opacity', '0')
  await archive.focus()
  await expect(archive).toHaveCSS('opacity', '1')
  await row.getByRole('button', { name: 'Billing', exact: true }).click()
  await expect.poll(() => requests.includes('/api/admin/customer-billing/families/42/overview')).toBe(true)
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Members & accounts', exact: true }).click()
  await page.getByRole('button', { name: 'People', exact: true }).click()
  const peopleTable = page.getByRole('table', { name: 'People', exact: true })
  const person = peopleTable.getByRole('row').filter({ has: page.getByRole('button', { name: 'Jordan Rivera', exact: true }) })
  await expect(person.getByRole('button', { name: 'View', exact: true })).toHaveCount(0)
  const personArchive = person.getByRole('button', { name: 'Archive Jordan Rivera', exact: true })
  await expect(personArchive).toHaveText('')
  await page.mouse.move(5, 5)
  await expect(personArchive).toHaveCSS('opacity', '0')
  await person.hover()
  await expect(personArchive).toHaveCSS('opacity', '1')
  const priorReads = requests.filter(path => path === '/api/admin/new-admin/families/42/workspace').length
  await person.getByRole('button', { name: 'Open family', exact: true }).click()
  await expect(workspaceRegion.getByRole('heading', { name: 'Rivera Family', exact: true })).toBeVisible()
  expect(requests.filter(path => path === '/api/admin/new-admin/families/42/workspace')).toHaveLength(priorReads + 1)
  expect(errors).toEqual([])
})

test('ordinary admins cannot see row archive actions even with lifecycle permission', async ({ page }) => {
  await prepare(page, false, ['members.view', 'accounts.lifecycle'])
  await page.getByRole('button', { name: 'All families and people', exact: true }).click()
  const families = page.getByRole('table', { name: 'Families', exact: true })
  await expect(families.getByRole('button', { name: /^Archive / })).toHaveCount(0)
  await expect(families.getByRole('button', { name: 'Billing', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'People', exact: true }).click()
  const peopleTable = page.getByRole('table', { name: 'People', exact: true })
  await expect(peopleTable.getByRole('button', { name: /^Archive / })).toHaveCount(0)
  await expect(peopleTable.getByRole('button', { name: 'Open family', exact: true })).toHaveCount(2)
})

test('family workspace saves and reloads a member login username', async ({ page }) => {
  const { credentialWrites } = await prepare(page)
  await page.getByRole('button', { name: 'Account security for Alex Rivera' }).click()
  const dialog = page.getByRole('dialog', { name: 'Alex Rivera · Account security' })
  const username = dialog.getByLabel('Username', { exact: true })
  await expect(username).toHaveValue('alex-original')
  await username.fill('alex-updated')
  await dialog.getByRole('button', { name: 'Save login credentials' }).click()
  await expect(dialog.getByText('Login credentials updated.')).toBeVisible()
  expect(credentialWrites).toEqual([{ username: 'alex-updated' }])
  await dialog.getByRole('button', { name: /Close/ }).click()
  await page.getByRole('button', { name: 'Account security for Alex Rivera' }).click()
  await expect(username).toHaveValue('alex-updated')
})

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
  await tabs.getByRole('button', { name: 'Trials and drop-ins', exact: true }).click()
  await region.getByLabel('Show person').selectOption('11')
  await expect(region.getByText('attended', { exact: true })).toBeVisible()
  await tabs.getByRole('button', { name: 'Leads & Notes', exact: true }).click()
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

test('staff can add a youth member directly to the open family', async ({ page }) => {
  const { requests, errors, memberWrites } = await prepare(page)
  const region = page.getByRole('region', { name: 'Unified family workspace' })
  await expect(region.getByRole('button', { name: 'Enroll family member', exact: true })).toBeVisible()
  await region.getByRole('button', { name: 'New family member', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'New family member', exact: true })
  await dialog.getByLabel('First name').fill('Casey')
  await dialog.getByLabel('Last name').fill('Rivera')
  await dialog.getByLabel('Date of birth').fill('2018-05-14')
  await dialog.getByLabel('Email (optional)').fill('casey@example.test')
  const phone = dialog.getByLabel('Phone (optional)')
  await phone.fill('55501')
  await dialog.getByLabel('Legal guardian').selectOption('10')
  const submit = dialog.getByRole('button', { name: 'Add family member', exact: true })
  await submit.click()
  await expect(phone).toBeFocused()
  expect(memberWrites).toEqual([])

  await phone.fill('+1 (555) 010-0012')
  await expect(phone).toHaveValue('555-010-0012')
  await submit.click()

  await expect(dialog).toHaveCount(0)
  await expect(region.getByRole('button', { name: 'People', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(region.getByText('Casey Rivera', { exact: true })).toBeVisible()
  await expect(region.getByText(/555-010-0012/)).toBeVisible()
  await expect(region.getByText('Guardian for Jordan Rivera, Casey Rivera', { exact: true })).toBeVisible()
  expect(memberWrites).toEqual([{
    familyId: 42, legalGuardianMemberId: 10, firstName: 'Casey', lastName: 'Rivera', dateOfBirth: '2018-05-14',
    email: 'casey@example.test', phone: '555-010-0012',
  }])
  expect(requests.filter(path => path === '/api/admin/new-admin/families/42/workspace')).toHaveLength(2)
  expect(errors).toEqual([])
})

test('staff with member edit access can add an adult without scheduling access', async ({ page }) => {
  const { memberWrites } = await prepare(page, false, ['members.view', 'members.edit'])
  const region = page.getByRole('region', { name: 'Unified family workspace' })
  await expect(region.getByRole('button', { name: 'Enroll family member', exact: true })).toHaveCount(0)
  await expect(region.getByRole('button', { name: 'Archive Jordan Rivera', exact: true })).toHaveCount(0)
  await region.getByRole('button', { name: 'New family member', exact: true }).click()

  const dialog = page.getByRole('dialog', { name: 'New family member', exact: true })
  await dialog.getByLabel('First name').fill('Taylor')
  await dialog.getByLabel('Last name').fill('Rivera')
  await dialog.getByLabel('Date of birth').fill('2008-11-12')
  await expect(dialog.getByLabel('Legal guardian')).toHaveCount(0)
  await dialog.getByRole('button', { name: 'Add family member', exact: true }).click()

  await expect(region.getByText('Taylor Rivera', { exact: true })).toBeVisible()
  expect(memberWrites).toEqual([{
    familyId: 42, legalGuardianMemberId: null, firstName: 'Taylor', lastName: 'Rivera', dateOfBirth: '2008-11-12',
    email: null, phone: null,
  }])
})

test('owner archives a person before deleting the record and can remove an archived unlinked login', async ({ page }) => {
  const { lifecycleWrites } = await prepare(page)
  const region = page.getByRole('region', { name: 'Unified family workspace' })
  await expect(region.getByRole('button', { name: 'Permanently delete Jordan Rivera' })).toHaveCount(0)
  await region.getByRole('button', { name: 'Archive Jordan Rivera' }).click()
  const archiveDialog = page.getByRole('dialog', { name: 'Archive item' })
  await archiveDialog.getByLabel('Type ARCHIVE to confirm').fill('ARCHIVE')
  await archiveDialog.getByRole('button', { name: 'Archive', exact: true }).click()

  await region.getByRole('button', { name: 'Permanently delete Jordan Rivera' }).click()
  const deleteDialog = page.getByRole('dialog', { name: 'Delete permanently' })
  const confirmDelete = deleteDialog.getByRole('button', { name: 'Delete permanently', exact: true })
  await expect(confirmDelete).toBeDisabled()
  await deleteDialog.getByLabel('Type DELETE to confirm').fill('DELETE')
  await confirmDelete.click()
  await expect(region.getByText('Jordan Rivera', { exact: true })).toHaveCount(0)
  expect(lifecycleWrites).toEqual(['archive member', 'delete member'])

  await region.getByRole('button', { name: 'All families and people' }).click()
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'CRM', exact: true }).click()
  await page.getByRole('button', { name: 'View Archives', exact: true }).click()
  await page.getByRole('searchbox', { name: 'Search people and families' }).fill('archived@example.test')
  await page.getByRole('button', { name: 'Permanently delete Orphaned Login' }).first().click()
  await deleteDialog.getByLabel('Type DELETE to confirm').fill('DELETE')
  await confirmDelete.click()
  await expect(page.getByText('No CRM records match these filters.')).toBeVisible()
  expect(lifecycleWrites).toEqual(['archive member', 'delete member', 'delete login'])
})

test('member-view-only staff can browse family history without billing or edit controls', async ({ page }) => {
  const { errors } = await prepare(page, false)
  const region = page.getByRole('region', { name: 'Unified family workspace' })
  await expect(region.getByText('Billing and financial history require billing access.')).toBeVisible()
  await expect(region.getByRole('button', { name: 'Billing & payments' })).toHaveCount(0)
  await expect(region.getByRole('button', { name: 'Edit', exact: true })).toHaveCount(0)
  await expect(region.getByRole('button', { name: 'Enroll family member' })).toHaveCount(0)
  await expect(region.getByRole('button', { name: 'New family member', exact: true })).toHaveCount(0)
  await expect(region.getByRole('button', { name: /^Archive / })).toHaveCount(0)
  await region.getByRole('button', { name: 'Leads & Notes', exact: true }).click()
  await region.getByRole('searchbox', { name: 'Search notes' }).fill('coach taylor')
  await expect(region.getByRole('region', { name: 'Notes', exact: true })).toContainText('Shared household correspondence')
  await expect(region.getByText('Trial reminder sent')).toHaveCount(0)
  await expect(region.getByRole('button', { name: 'Add note', exact: true })).toHaveCount(0)
  await region.getByRole('button', { name: 'Overview', exact: true }).click()
  await region.getByRole('button', { name: 'Load older history' }).click()
  await expect(region.getByText('Older imported enrollment')).toBeVisible()
  expect(errors).toEqual([])
})

test('family notes are searchable beside the composer and shared with linked leads', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 })
  const { errors, noteWrites } = await prepare(page)
  const region = page.getByRole('region', { name: 'Unified family workspace' })
  await expect(page.getByRole('button', { name: 'Refresh family', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Refresh Admin', exact: true })).toBeVisible()
  await region.getByRole('button', { name: 'Leads & Notes', exact: true }).click()
  const search = region.getByRole('searchbox', { name: 'Search notes' })
  const notes = region.getByRole('region', { name: 'Notes', exact: true })
  const composer = region.getByRole('heading', { name: 'Account notes & correspondence', exact: true })
  await expect(notes.getByText('Shared household correspondence')).toBeVisible()
  await expect(notes.getByText('Trial reminder sent')).toBeVisible()
  await expect(region.getByLabel('Note for', { exact: true })).toHaveCount(0)
  const composerBox = (await composer.boundingBox())!
  const notesBox = (await notes.boundingBox())!
  const searchBox = (await search.boundingBox())!
  expect(notesBox.x).toBeGreaterThanOrEqual(composerBox.x + composerBox.width)
  expect(searchBox.y + searchBox.height).toBeLessThan(composerBox.y)
  expect(searchBox.y + searchBox.height).toBeLessThan(notesBox.y)

  await search.fill('  HOUSEHOLD  ')
  await expect(notes.getByText('Shared household correspondence')).toBeVisible()
  await expect(notes.getByText('Trial reminder sent')).toHaveCount(0)
  await search.fill('missing keyword')
  await expect(notes.getByText('No notes match your search.')).toBeVisible()
  await search.clear()
  await expect(notes.getByText('Trial reminder sent')).toBeVisible()

  await region.getByLabel('Add a note', { exact: true }).fill('Added in the family workspace')
  await region.getByRole('button', { name: 'Add note', exact: true }).click()
  await expect(notes.getByText('Added in the family workspace')).toBeVisible()
  expect(noteWrites).toEqual([{ subjectType: 'family', subjectId: 42, noteType: 'staff_note', body: 'Added in the family workspace', nonContact: false }])
  const navigation = page.getByRole('navigation', { name: 'Admin sections' })
  await navigation.getByRole('button', { name: 'Leads', exact: true }).click()
  await page.getByRole('button', { name: 'Notes', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Notes · Alex Rivera' })
  await expect(dialog.getByText('Added in the family workspace')).toBeVisible()
  await dialog.getByRole('checkbox', { name: 'Non-contact note', exact: true }).check()
  await dialog.getByLabel('Add a note', { exact: true }).fill('Added from the lead')
  await dialog.getByRole('button', { name: 'Add note', exact: true }).click()
  await expect(dialog.getByText('Added from the lead')).toBeVisible()
  expect(noteWrites.at(-1)).toMatchObject({ nonContact: true })
  await expect(dialog.getByRole('article').filter({ hasText: 'Added from the lead' })).toContainText('Non-contact note')
  await dialog.getByRole('button', { name: 'Close Notes · Alex Rivera', exact: true }).click()
  await navigation.getByRole('button', { name: 'Members & accounts', exact: true }).click()
  await page.getByRole('button', { name: 'Open family', exact: true }).click()
  await region.getByRole('button', { name: 'Leads & Notes', exact: true }).click()
  await expect(notes.getByText('Added from the lead')).toBeVisible()
  await expect(notes.getByRole('article').filter({ hasText: 'Added from the lead' })).toContainText('Non-contact note')
  await page.setViewportSize({ width: 390, height: 844 })
  await search.fill('from the lead')
  await expect(notes.getByText('Added from the lead')).toBeVisible()
  await expect(notes.getByText('Added in the family workspace')).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  expect(errors).toEqual([])
})
