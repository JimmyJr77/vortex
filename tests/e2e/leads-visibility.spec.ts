import { expect, test } from '@playwright/test'
import type { Lead } from '../../src/components/newAdmin/leadTypes'

test('read-only staff can show member inquiries with their original lead dates and return to prospects', async ({ page }) => {
  const lead = (id: number, fields: Partial<Lead> = {}): Lead => ({
    id, firstName: `Prospect ${id}`, lastName: 'Family', email: `prospect${id}@example.test`, phone: null,
    status: 'new', notes: null, convertedMemberId: null, matchedMemberId: null,
    contacted: false, followUp: false, firstContactedAt: null, message: '',
    createdAt: '2026-11-20T16:00:00Z', ...fields,
  })
  const prospect = lead(1, {
    firstName: 'Jordan', lastName: 'Prospect',
    inquiry: { campers: [{ firstName: 'Casey', lastName: 'Prospect' }, { firstName: 'Alex', lastName: 'Prospect' }] },
  })
  const activeMember = lead(101, {
    firstName: 'Riley', lastName: 'Active', matchedMemberId: 201, createdAt: '2026-03-12T16:00:00Z',
  })
  const previouslyConverted = lead(102, {
    firstName: 'Taylor', lastName: 'Former', status: 'converted', convertedMemberId: 202,
    createdAt: '2024-02-14T16:00:00Z',
  })
  const prospects = [prospect, ...Array.from({ length: 25 }, (_, index) => lead(index + 2))]
  const requests: URLSearchParams[] = []

  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'fixture')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    let data: unknown = []
    if (url.pathname === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: ['members.view'], roles: ['ADMIN'], user: { id: 1 } }
    if (url.pathname.endsWith('/new-admin/families')) data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 1 }
    if (url.pathname.endsWith('/new-admin/leads')) {
      requests.push(url.searchParams)
      const rows = url.searchParams.get('includeMembers') === 'true' ? [activeMember, previouslyConverted, ...prospects] : prospects
      const currentPage = Number(url.searchParams.get('page'))
      const pageSize = Number(url.searchParams.get('pageSize'))
      data = { rows: rows.slice((currentPage - 1) * pageSize, currentPage * pageSize), total: rows.length, page: currentPage, pageSize, totalPages: Math.ceil(rows.length / pageSize) }
    }
    await route.fulfill({ json: { success: true, data } })
  })

  await page.goto('/')
  await page.getByRole('button', { name: 'Leads', exact: true }).click()
  await expect(page.getByRole('button', { name: 'Jordan Prospect', exact: true })).toBeVisible()
  const showMembers = page.getByRole('button', { name: 'Show active and converted members', exact: true })
  await expect(showMembers).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Add lead', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Riley Active', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Taylor Former', exact: true })).toHaveCount(0)
  expect(requests[0].get('includeMembers')).toBe('false')

  const headers = await page.getByRole('columnheader').allTextContents()
  expect(headers.slice(headers.indexOf('Kid details'), headers.indexOf('Date of free trial') + 1)).toEqual(['Kid details', 'Date of inquiry', 'Last contacted', 'Date of free trial'])
  const prospectRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Jordan Prospect', exact: true }) })
  const inquiryDate = prospectRow.getByRole('cell').nth(headers.indexOf('Date of inquiry'))
  await expect(inquiryDate).toHaveText('Nov 20, 2026')
  await expect(inquiryDate).toHaveAttribute('rowspan', '2')
  await expect(page.getByRole('cell', { name: 'Nov 20, 2026', exact: true })).toHaveCount(25)
  await prospectRow.getByRole('button', { name: 'Notes', exact: true }).click()
  const notes = page.getByRole('dialog', { name: 'Notes · Jordan Prospect', exact: true })
  await expect(notes.getByLabel('Last contacted', { exact: true })).toBeDisabled()
  await expect(notes.getByRole('button', { name: 'Save last contacted', exact: true })).toHaveCount(0)
  await notes.getByRole('button', { name: 'Close Notes · Jordan Prospect', exact: true }).click()

  await page.getByRole('button', { name: 'Next', exact: true }).click()
  await expect(page.getByText('26 records · Page 2 of 2', { exact: true })).toBeVisible()
  expect(requests.at(-1)?.get('page')).toBe('2')
  await showMembers.click()

  await expect(page.getByRole('button', { name: 'Hide active and converted members', exact: true })).toHaveAttribute('aria-pressed', 'true')
  await expect(page.getByRole('button', { name: 'Riley Active', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Taylor Former', exact: true })).toBeVisible()
  await expect(page.getByRole('row').filter({ hasText: 'Riley Active' })).toContainText('Mar 12, 2026')
  await expect(page.getByRole('row').filter({ hasText: 'Taylor Former' })).toContainText('Feb 14, 2024')
  await expect(page.getByText('28 records · Page 1 of 2', { exact: true })).toBeVisible()
  expect(requests.at(-1)?.get('includeMembers')).toBe('true')
  expect(requests.at(-1)?.get('page')).toBe('1')

  await page.getByRole('button', { name: 'Hide active and converted members', exact: true }).click()
  await expect(showMembers).toHaveAttribute('aria-pressed', 'false')
  await expect(page.getByRole('button', { name: 'Riley Active', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Taylor Former', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Jordan Prospect', exact: true })).toBeVisible()
  expect(requests.at(-1)?.get('includeMembers')).toBe('false')
})

test('leads show conversion dates and participation badges without duplicating children or trial bookings', async ({ page }) => {
  const trial = { id: 1, memberId: 10, childName: 'Casey Rivera', childIndex: 2, date: '2026-11-20', className: 'Casey Foundations', status: 'attended' }
  const lead = (id: number, fields: Partial<Lead>): Lead => ({
    id, firstName: 'Jordan', lastName: 'Rivera', email: 'jordan@example.test', phone: null,
    status: 'qualified', notes: null, convertedMemberId: null, contacted: true, followUp: false,
    firstContactedAt: null, message: '', createdAt: '2026-03-12T16:00:00Z', ...fields,
  })
  const records = [
    lead(7, {
      convertedMemberId: 200, convertedAt: '2026-11-24T16:00:00Z',
      participationTags: ['inquiry', 'free_trial', 'drop_in', 'recent_drop'],
      inquiry: { campers: [
        { memberId: 10, firstName: 'Casey', lastName: 'Rivera' },
        { memberId: 10, firstName: 'Casey', lastName: 'Rivera' },
        { memberId: 11, firstName: 'Alex', lastName: 'Rivera' },
        { firstName: 'Morgan', lastName: 'Rivera' },
      ] },
      freeTrials: [trial, { id: 2, memberId: 11, childName: 'Alex Rivera', childIndex: 0, date: '2026-11-21', className: 'Alex Tumbling', status: 'confirmed' },
        { id: 3, memberId: 12, childName: 'Morgan Rivera', childIndex: 3, date: '2026-11-22', className: 'Morgan Gymnastics', status: 'confirmed' },
        { id: 4, memberId: 13, childName: 'Dana Rivera', childIndex: 0, date: '2026-11-23', className: 'Dana Trampoline', status: 'confirmed' }, trial],
    }),
    lead(8, { firstName: 'Qualified', lastName: 'Prospect', participationTags: ['inquiry'], convertedAt: null }),
    lead(9, { firstName: 'Contacted', lastName: 'Prospect', status: 'contacted', participationTags: ['free_trial'], convertedAt: null }),
    lead(10, { firstName: 'Legacy', lastName: 'Converted', status: 'converted', participationTags: [], convertedAt: null }),
    lead(11, { firstName: 'Trial', lastName: 'Contact', status: 'converted', displayStatus: 'lead', convertedMemberId: 300, participationTags: ['free_trial'], convertedAt: null }),
  ]
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'fixture')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', route => {
    const { pathname } = new URL(route.request().url())
    let data: unknown = []
    if (pathname === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: ['members.view'], roles: ['ADMIN'], user: { id: 1 } }
    if (pathname.endsWith('/new-admin/families')) data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 1 }
    if (pathname.endsWith('/new-admin/leads')) data = { rows: records, total: records.length, page: 1, pageSize: 25, totalPages: 1 }
    return route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Leads', exact: true }).click()
  await expect(page.getByRole('columnheader', { name: 'Conversion Date', exact: true })).toBeVisible()
  const headers = await page.getByRole('columnheader').allTextContents()
  expect(headers.slice(headers.indexOf('Date of free trial'), headers.indexOf('Date of free trial') + 3)).toEqual(['Date of free trial', 'Conversion Date', 'Actions'])
  const primary = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Jordan Rivera', exact: true }) })
  const status = primary.getByRole('cell').nth(headers.indexOf('Status'))
  for (const badge of ['Converted', 'Inquiry', 'Free Trial', 'Non-Member Drop-in', 'Recent Drop']) await expect(status.getByText(badge, { exact: true })).toBeVisible()
  await expect(status.getByText('qualified', { exact: true })).toHaveCount(0)
  await expect(status.getByText('contacted', { exact: true })).toHaveCount(0)
  const conversion = primary.getByRole('cell').nth(headers.indexOf('Conversion Date'))
  await expect(conversion).toHaveText('Nov 24, 2026')
  await expect(conversion).toHaveAttribute('rowspan', '4')
  await expect(conversion.locator('time')).toHaveAttribute('datetime', '2026-11-24T16:00:00Z')
  await expect(primary.getByRole('cell').nth(headers.indexOf('Date of inquiry'))).toHaveText('Mar 12, 2026')
  for (const [child, ownClass] of [['Casey', 'Casey Foundations'], ['Alex', 'Alex Tumbling'], ['Morgan', 'Morgan Gymnastics'], ['Dana', 'Dana Trampoline']]) {
    await expect(page.getByText(`${child} Rivera`, { exact: true })).toHaveCount(1)
    const childTrials = page.getByRole('list', { name: `Free trials for ${child} Rivera`, exact: true })
    await expect(childTrials.getByRole('listitem')).toHaveCount(1)
    await expect(childTrials).toHaveText(new RegExp(ownClass))
  }
  await expect(page.locator('tbody > tr')).toHaveCount(8)
  for (const name of ['Qualified Prospect', 'Contacted Prospect', 'Trial Contact']) {
    const row = page.getByRole('row').filter({ has: page.getByRole('button', { name, exact: true }) })
    await expect(row.getByRole('cell').nth(headers.indexOf('Status')).getByText('Lead', { exact: true })).toBeVisible()
    await expect(row.getByRole('cell').nth(headers.indexOf('Conversion Date'))).toHaveText('—')
  }
  const legacy = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Legacy Converted', exact: true }) })
  await expect(legacy.getByRole('cell').nth(headers.indexOf('Status'))).toHaveText('Converted')
  await expect(legacy.getByRole('cell').nth(headers.indexOf('Conversion Date'))).toHaveText('—')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
