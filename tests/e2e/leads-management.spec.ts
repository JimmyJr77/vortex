import { expect, test, type Locator, type Page } from '@playwright/test'
import type { Lead } from '../../src/components/newAdmin/leadTypes'

function lead(id: number, fields: Partial<Lead> = {}): Lead {
  return { id, firstName: 'Jordan', lastName: 'Rivera', email: `lead${id}@example.test`, phone: null,
    status: 'qualified', displayStatus: 'lead', participationTags: ['inquiry'], notes: null, message: '',
    convertedMemberId: null, contacted: false, followUp: false, firstContactedAt: null,
    createdAt: '2026-11-20T16:00:00Z', ...fields }
}

async function openLeads(page: Page, records: Lead[], isMasterAdmin = false, permissions = ['members.view', 'members.edit', 'accounts.lifecycle']) {
  const queries: URLSearchParams[] = []
  const requests: string[] = []
  const writes: Array<{ id: number; body: Record<string, unknown> }> = []
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'fixture')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    requests.push(url.pathname)
    let data: unknown = []
    if (url.pathname === '/api/admin/access/me') data = { isMasterAdmin, permissions, roles: ['ADMIN'], user: { id: 1 } }
    if (url.pathname === '/api/admin/new-admin/families') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (url.pathname === '/api/admin/new-admin/leads') {
      queries.push(url.searchParams)
      let rows = records
      if (url.searchParams.get('sortBy') === 'name') rows = [...records].sort((left, right) => {
        const comparison = left.lastName.localeCompare(right.lastName) || left.firstName.localeCompare(right.firstName)
        return url.searchParams.get('sortDirection') === 'desc' ? -comparison : comparison
      })
      const currentPage = Number(url.searchParams.get('page'))
      const pageSize = Number(url.searchParams.get('pageSize'))
      data = { rows: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize), total: rows.length, page: currentPage, pageSize, totalPages: Math.ceil(rows.length / pageSize) }
    }
    const id = Number(url.pathname.match(/\/new-admin\/leads\/(\d+)$/)?.[1])
    if (id && route.request().method() === 'PATCH') {
      const body = route.request().postDataJSON()
      writes.push({ id, body })
      const record = records.find(record => record.id === id)!
      Object.assign(record, body)
      data = record
    }
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Leads', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: 'Actions', exact: true })).toBeVisible()
  return { queries, requests, writes }
}

async function rowCell(page: Page, name: string, header: string) {
  const headers = await page.getByRole('columnheader').allTextContents()
  return page.getByRole('row').filter({ has: page.getByRole('button', { name, exact: true }) }).getByRole('cell').nth(headers.indexOf(header))
}

test('lead headers sort by last name and dates on the server and reset pagination', async ({ page }) => {
  const records = [lead(1, { firstName: 'Alice', lastName: 'Zulu' }), lead(2, { firstName: 'Zoe', lastName: 'Alpha' }),
    ...Array.from({ length: 24 }, (_, index) => lead(index + 3, { firstName: `Prospect ${index}`, lastName: 'Middle' }))]
  const { queries } = await openLeads(page, records)
  await expect(page.getByRole('group', { name: 'Contact', exact: true }).getByRole('button')).toHaveText(['All', 'Contacted', 'Not contacted', 'Follow-up Needed'])
  await expect(page.getByRole('group', { name: 'Lead type', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Gender (kid)', exact: true })).toBeVisible()
  expect(queries[0].get('gender')).toBe('')
  await expect(page.getByRole('columnheader', { name: 'Date of inquiry', exact: true })).toHaveAttribute('aria-sort', 'descending')
  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect.poll(() => queries.at(-1)?.get('page')).toBe('2')
  await page.getByRole('button', { name: 'Sort by last name', exact: true }).click()
  await expect.poll(() => Object.fromEntries(queries.at(-1) ?? [])).toMatchObject({ sortBy: 'name', sortDirection: 'asc', page: '1' })
  await expect(page.locator('tbody > tr').first()).toContainText('Zoe Alpha')
  await expect(page.getByRole('columnheader', { name: 'Name', exact: true })).toHaveAttribute('aria-sort', 'ascending')
  await page.getByRole('button', { name: 'Sort by last name', exact: true }).click()
  await expect.poll(() => Object.fromEntries(queries.at(-1) ?? [])).toMatchObject({ sortBy: 'name', sortDirection: 'desc' })
  await expect(page.locator('tbody > tr').first()).toContainText('Alice Zulu')
  for (const [label, field, header] of [
    ['Sort by date of inquiry', 'inquiryDate', 'Date of inquiry'],
    ['Sort by date of free trial', 'freeTrialDate', 'Date of free trial'],
    ['Sort by conversion date', 'conversionDate', 'Conversion Date'],
  ]) {
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect.poll(() => Object.fromEntries(queries.at(-1) ?? [])).toMatchObject({ sortBy: field, sortDirection: 'desc', page: '1' })
    await expect(page.getByRole('columnheader', { name: header, exact: true })).toHaveAttribute('aria-sort', 'descending')
    await page.getByRole('button', { name: label, exact: true }).click()
    await expect.poll(() => Object.fromEntries(queries.at(-1) ?? [])).toMatchObject({ sortBy: field, sortDirection: 'asc' })
    await expect(page.getByRole('columnheader', { name: header, exact: true })).toHaveAttribute('aria-sort', 'ascending')
  }
})

test('last contacted can be edited and cleared in Notes without changing first contact history', async ({ page }) => {
  const record = lead(7, { contacted: true, firstContactedAt: '2026-01-02T16:00:00Z', lastContactedAt: '2026-11-25' })
  const { writes } = await openLeads(page, [record])
  const headers = await page.getByRole('columnheader').allTextContents()
  expect(headers[headers.indexOf('Date of inquiry') + 1]).toBe('Last contacted')
  const contactDate = await rowCell(page, 'Jordan Rivera', 'Last contacted')
  await expect(contactDate).toHaveText('Nov 25, 2026')
  await (await rowCell(page, 'Jordan Rivera', 'Actions')).getByRole('button', { name: 'Notes', exact: true }).click()
  const dialog = page.getByRole('dialog', { name: 'Notes · Jordan Rivera', exact: true })
  await expect(dialog.getByLabel('Last contacted', { exact: true })).toHaveValue('2026-11-25')
  await dialog.getByLabel('Last contacted', { exact: true }).fill('2026-11-27')
  await dialog.getByRole('button', { name: 'Save last contacted', exact: true }).click()
  await expect.poll(() => writes).toEqual([{ id: 7, body: { lastContactedAt: '2026-11-27' } }])
  await dialog.getByRole('button', { name: 'Close Notes · Jordan Rivera', exact: true }).click()
  await expect(contactDate).toHaveText('Nov 27, 2026')
  expect(record.firstContactedAt).toBe('2026-01-02T16:00:00Z')
  await (await rowCell(page, 'Jordan Rivera', 'Actions')).getByRole('button', { name: 'Notes', exact: true }).click()
  await expect(dialog.getByLabel('Last contacted', { exact: true })).toHaveValue('2026-11-27')
  await dialog.getByLabel('Last contacted', { exact: true }).clear()
  await dialog.getByRole('button', { name: 'Save last contacted', exact: true }).click()
  await expect.poll(() => writes.at(-1)).toEqual({ id: 7, body: { lastContactedAt: null } })
  await dialog.getByRole('button', { name: 'Close Notes · Jordan Rivera', exact: true }).click()
  await expect(contactDate).toHaveText('—')
  expect(record.firstContactedAt).toBe('2026-01-02T16:00:00Z')
})

async function effectiveOpacity(locator: Locator) {
  return locator.evaluate(element => {
    let opacity = 1
    for (let current: Element | null = element; current; current = current.parentElement) opacity *= Number(getComputedStyle(current).opacity)
    return opacity
  })
}

test('only master admins see the archive icon and it appears on row hover or keyboard focus', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1050 })
  const { writes } = await openLeads(page, [lead(7, { inquiry: { campers: [
    { firstName: 'Casey', lastName: 'Rivera' }, { firstName: 'Alex', lastName: 'Rivera' },
  ] } })], true)
  const archive = page.getByRole('button', { name: 'Archive Jordan Rivera', exact: true })
  await expect(archive).toHaveText('')
  await expect(archive.locator('svg')).toHaveCount(1)
  await page.mouse.move(5, 5)
  await expect.poll(() => effectiveOpacity(archive)).toBe(0)
  await archive.focus()
  await expect.poll(() => effectiveOpacity(archive)).toBe(1)
  await page.getByRole('heading', { name: 'Leads', exact: true }).click()
  await page.mouse.move(5, 5)
  await expect.poll(() => effectiveOpacity(archive)).toBe(0)
  await page.getByRole('row').filter({ has: page.getByText('Alex Rivera', { exact: true }) }).hover()
  await expect.poll(() => effectiveOpacity(archive)).toBe(1)
  await page.locator('table').evaluate(table => { if (table.parentElement) table.parentElement.scrollLeft = 0 })
  await page.screenshot({ path: '/tmp/vortex-leads-management-desktop.png', fullPage: true })
  await archive.click()
  const confirmation = page.getByRole('dialog', { name: 'Archive item', exact: true })
  await expect(confirmation).toBeVisible()
  await confirmation.getByRole('button', { name: 'Cancel', exact: true }).click()
  expect(writes).toEqual([])
})

test('lead actions distinguish conversions and free trials already reserved or used', async ({ page }) => {
  const booking = { id: 1, memberId: 100, childName: 'Casey', childIndex: 0, date: '2026-11-25', className: 'Gymnastics', status: 'confirmed' }
  const records = [
    lead(1, { firstName: 'Converted', lastName: 'Family', displayStatus: 'converted', convertedMemberId: 200, hasFreeTrialUsed: true }),
    lead(2, { firstName: 'Unused', lastName: 'Trial', participationTags: ['free_trial'], inquiry: { source: 'free_trial' }, hasFreeTrialUsed: false }),
    lead(3, { firstName: 'Scheduled', lastName: 'Trial', hasFreeTrialUsed: true, freeTrials: [booking] }),
    lead(4, { firstName: 'Attended', lastName: 'Trial', hasFreeTrialUsed: true, freeTrials: [{ ...booking, id: 2, status: 'attended' }] }),
    lead(5, { firstName: 'Cancelled', lastName: 'Trial', hasFreeTrialUsed: false, freeTrials: [{ ...booking, id: 3, status: 'cancelled' }] }),
    lead(6, { firstName: 'Legacy', lastName: 'Booking', freeTrials: [{ ...booking, id: 4 }] }),
    lead(7, { firstName: 'Linked', lastName: 'Prospect', linkedMemberId: 300, hasFreeTrialUsed: false }),
  ]
  await openLeads(page, records)
  const convertedActions = await rowCell(page, 'Converted Family', 'Actions')
  await expect(convertedActions.getByRole('button')).toHaveText(['Notes', 'Member'])
  const convertedStatus = (await rowCell(page, 'Converted Family', 'Status')).getByText('Converted', { exact: true })
  const green = (await convertedStatus.evaluate(element => getComputedStyle(element).color)).match(/[\d.]+/g)!.map(Number)
  expect(green[1]).toBeGreaterThan(green[0])
  expect(green[1]).toBeGreaterThan(green[2])
  for (const name of ['Unused Trial', 'Cancelled Trial']) {
    const actions = await rowCell(page, name, 'Actions')
    await expect(actions.getByRole('button', { name: 'Notes', exact: true })).toBeVisible()
    await expect(actions.getByRole('button', { name: /^add free trial$/i })).toBeVisible()
    await expect(actions.getByRole('button', { name: 'Convert', exact: true })).toBeVisible()
  }
  for (const name of ['Scheduled Trial', 'Attended Trial', 'Legacy Booking']) {
    const actions = await rowCell(page, name, 'Actions')
    await expect(actions.getByRole('button', { name: /^add free trial$/i })).toHaveCount(0)
    await expect(actions.getByRole('button', { name: 'Convert', exact: true })).toBeVisible()
  }
  const leadStatus = (await rowCell(page, 'Unused Trial', 'Status')).getByText('Lead', { exact: true })
  const red = (await leadStatus.evaluate(element => getComputedStyle(element).color)).match(/[\d.]+/g)!.map(Number)
  expect(red[0]).toBeGreaterThan(red[1])
  expect(red[0]).toBeGreaterThan(red[2])
  const linkedActions = await rowCell(page, 'Linked Prospect', 'Actions')
  await expect(linkedActions.getByRole('button', { name: /^add free trial$/i })).toBeDisabled()
  await expect(linkedActions.getByRole('button', { name: 'Convert', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Archive / })).toHaveCount(0)
})

test('staff book a linked lead trial through the authenticated admin flow and its action disappears after refresh', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-27T15:00:00Z'))
  const record = lead(7, { linkedMemberId: 200, hasFreeTrialUsed: false,
    inquiry: { campers: [{ memberId: 100, firstName: 'Casey', lastName: 'Rivera', dateOfBirth: '2016-01-01' }] } })
  const { queries, requests } = await openLeads(page, [record], false, ['members.view', 'members.edit', 'scheduling.manage'])
  const bookingWrites: unknown[] = []
  const availability: URLSearchParams[] = []
  await page.route('**/api/admin/new-admin/leads/7/trial-booking', async route => {
    expect(route.request().headers().authorization).toBe('Bearer fixture')
    if (route.request().method() === 'GET') return route.fulfill({ json: { success: true, data: {
      facilityId: 1, children: [{ memberId: 100, memberIndex: 1, firstName: 'Casey', lastName: 'Rivera', dateOfBirth: '2016-01-01' }], bookings: [],
    } } })
    bookingWrites.push(route.request().postDataJSON())
    record.hasFreeTrialUsed = true
    record.freeTrials = [{ id: 50, memberId: 100, childName: 'Casey Rivera', childIndex: 0, date: '2026-12-01', className: 'Cyclones', status: 'confirmed' }]
    return route.fulfill({ json: { success: true, data: { id: 50, memberId: 100, status: 'confirmed', benefitType: 'free_trial', totalCents: 0, classDate: '2026-12-01' } } })
  })
  await page.route('**/api/public/free-trials?*', route => {
    availability.push(new URL(route.request().url()).searchParams)
    return route.fulfill({ json: { success: true, data: { program: 'fit-flip', sessions: [
      { classId: 20, className: 'Cyclones', slotGroupId: 30, date: '2026-12-01', startTime: '16:00', endTime: '17:00', isFull: false, facilityId: 1, timeZone: 'America/New_York' },
    ] } } })
  })
  const initialRequests = requests.length
  const initialReads = queries.length
  await (await rowCell(page, 'Jordan Rivera', 'Actions')).getByRole('button', { name: /^Add Free trial$/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Free trial · Jordan Rivera', exact: true })
  const child = dialog.getByRole('region', { name: 'Casey Rivera', exact: true })
  await child.getByRole('combobox', { name: 'Program for Casey', exact: true }).selectOption('fit-flip')
  await child.getByRole('button', { name: 'Find trial dates', exact: true }).click()
  expect(availability.map(query => [query.get('program'), query.get('age')])).toEqual([['fit-flip', '10']])
  await child.getByRole('combobox', { name: 'Free trial class and date for Casey', exact: true }).selectOption('30:2026-12-01')
  await child.getByRole('button', { name: 'Confirm free trial · $0', exact: true }).click()
  await expect(child.getByRole('status')).toContainText('Free trial confirmed · $0')
  expect(bookingWrites).toEqual([{ memberId: 100, freeTrial: { program: 'fit-flip', slotGroupId: 30, classDate: '2026-12-01' } }])
  await dialog.getByRole('button', { name: 'Done', exact: true }).click()
  await expect((await rowCell(page, 'Jordan Rivera', 'Actions')).getByRole('button', { name: /^Add Free trial$/i })).toHaveCount(0)
  await expect(page.getByRole('list', { name: 'Free trials for Casey Rivera', exact: true })).toContainText('Dec 1, 2026')
  expect(queries.length).toBeGreaterThan(initialReads)
  expect(requests.slice(initialRequests).filter(path => path.includes('/signup/') || path.includes('/members/'))).toEqual([])
})

test('a matching contact must be explicitly linked before staff can find or book trial dates', async ({ page }) => {
  await page.clock.setFixedTime(new Date('2026-11-27T15:00:00Z'))
  const record = lead(8, { firstName: 'Matched', lastName: 'Inquiry', matchedMemberId: 200, hasFreeTrialUsed: false })
  await openLeads(page, [record], false, ['members.view', 'members.edit', 'scheduling.manage'])
  const writes: unknown[] = []
  const availability: string[] = []
  const children = [{ memberId: 101, memberIndex: 1, firstName: 'Casey', lastName: 'Rivera', dateOfBirth: '2018-01-01' }]
  await page.route('**/api/admin/new-admin/leads/8/trial-booking', route => {
    expect(route.request().headers().authorization).toBe('Bearer fixture')
    if (route.request().method() === 'GET') return route.fulfill({ json: { success: true, data: {
      facilityId: 1, children: [], bookings: [], matchedContact: { memberId: 200, name: 'Verified Parent', email: 'lead8@example.test' },
    } } })
    const body = route.request().postDataJSON()
    writes.push(body)
    if (body.confirmContact) {
      record.linkedMemberId = 200
      return route.fulfill({ json: { success: true, data: { facilityId: 1, children, bookings: [] } } })
    }
    expect(record.linkedMemberId).toBe(200)
    record.hasFreeTrialUsed = true
    return route.fulfill({ json: { success: true, data: { id: 51, memberId: 101, status: 'confirmed', benefitType: 'free_trial', totalCents: 0, classDate: '2026-12-01' } } })
  })
  await page.route('**/api/public/free-trials?*', route => {
    availability.push(route.request().url())
    return route.fulfill({ json: { success: true, data: { program: 'fit-flip', sessions: [
      { classId: 20, className: 'Cyclones', slotGroupId: 30, date: '2026-12-01', startTime: '16:00', endTime: '17:00', isFull: false, facilityId: 1 },
    ] } } })
  })
  await (await rowCell(page, 'Matched Inquiry', 'Actions')).getByRole('button', { name: /^Add Free trial$/i }).click()
  const dialog = page.getByRole('dialog', { name: 'Add Free trial · Matched Inquiry', exact: true })
  await expect(dialog).toContainText('Confirm this is the same family')
  await expect(dialog.getByRole('button', { name: 'Review member', exact: true })).toBeVisible()
  await expect(dialog.getByRole('combobox')).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: 'Find trial dates', exact: true })).toHaveCount(0)
  expect(availability).toEqual([])
  expect(writes).toEqual([])
  await dialog.getByRole('button', { name: 'Use this member for this lead', exact: true }).click()
  const child = dialog.getByRole('region', { name: 'Casey Rivera', exact: true })
  await expect(child).toBeVisible()
  expect(writes).toEqual([{ linkMemberId: 200, confirmContact: true }])
  await child.getByRole('combobox', { name: 'Program for Casey', exact: true }).selectOption('fit-flip')
  await child.getByRole('button', { name: 'Find trial dates', exact: true }).click()
  await child.getByRole('combobox', { name: 'Free trial class and date for Casey', exact: true }).selectOption('30:2026-12-01')
  await child.getByRole('button', { name: 'Confirm free trial · $0', exact: true }).click()
  await expect(child.getByRole('status')).toContainText('Free trial confirmed · $0')
  expect(writes).toEqual([{ linkMemberId: 200, confirmContact: true }, { memberId: 101, freeTrial: { program: 'fit-flip', slotGroupId: 30, classDate: '2026-12-01' } }])
  expect(availability).toHaveLength(1)
})
