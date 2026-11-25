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
  expect(headers.slice(headers.indexOf('Kid details'), headers.indexOf('Free Trials') + 1)).toEqual(['Kid details', 'Date of inquiry', 'Free Trials'])
  const prospectRow = page.getByRole('row').filter({ has: page.getByRole('button', { name: 'Jordan Prospect', exact: true }) })
  const inquiryDate = prospectRow.getByRole('cell').nth(headers.indexOf('Date of inquiry'))
  await expect(inquiryDate).toHaveText('Nov 20, 2026')
  await expect(inquiryDate).toHaveAttribute('rowspan', '2')
  await expect(page.getByRole('cell', { name: 'Nov 20, 2026', exact: true })).toHaveCount(25)

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
