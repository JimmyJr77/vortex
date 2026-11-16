import { expect, test } from '@playwright/test'
import fs from 'node:fs/promises'
import { scheduleExportPdf } from '../../backend/newAdmin/scheduleExport.js'

test('class viewers download both schedule views as a PDF and can retry download errors', async ({ page }, testInfo) => {
  const bytes = await scheduleExportPdf({ facilityName: 'Test Vortex', asOf: '2026-11-16', timezone: 'America/New_York', rows: [
    { classId: 1, className: 'Tumbling', programName: 'Gymnastics', groupId: 1, slotId: 1, dayOfWeek: 1, startTime: '16:00', endTime: '17:00', capacity: 12, enrolled: 7, reserved: 2, available: 3 },
  ] })
  let attempts = 0
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'fixture')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', async route => {
    const url = new URL(route.request().url())
    let data: unknown = []
    if (url.pathname === '/api/admin/access/me') data = { isMasterAdmin: false, permissions: ['classes.view'], roles: ['ADMIN'], user: { id: 1 } }
    if (url.pathname === '/api/admin/new-admin/classes') data = { rows: [], total: 0, page: 1, pageSize: 25, totalPages: 0 }
    if (url.pathname === '/api/admin/new-admin/classes/schedule.pdf') {
      attempts++
      expect(route.request().headers().authorization).toBe('Bearer fixture')
      expect(url.search).toBe('')
      if (attempts === 1) return route.fulfill({ status: 503, json: { success: false, message: 'Unable to prepare the schedule.' } })
      return route.fulfill({ headers: { 'content-type': 'application/pdf', 'content-disposition': 'attachment; filename="vortex-class-schedule-2026-11-16.pdf"', 'access-control-expose-headers': 'Content-Disposition' }, body: bytes })
    }
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Classes & schedules', exact: true }).click()
  await page.getByRole('button', { name: 'Download schedule', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Unable to prepare the schedule')
  const downloaded = page.waitForEvent('download')
  await page.getByRole('button', { name: 'Retry', exact: true }).click()
  const download = await downloaded
  expect(download.suggestedFilename()).toBe('vortex-class-schedule-2026-11-16.pdf')
  const path = testInfo.outputPath('schedule.pdf')
  await download.saveAs(path)
  expect(await fs.readFile(path)).toEqual(bytes)
  await expect(page.getByRole('button', { name: 'Download schedule', exact: true })).toBeEnabled()
  await expect(page.getByRole('alert')).toHaveCount(0)
})
