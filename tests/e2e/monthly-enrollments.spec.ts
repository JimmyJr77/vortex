import { expect, test } from '@playwright/test'

test('monthly program and sport filters contain only programs represented by active class schedules', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'e2e-admin-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Enrollment Manager' }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  const summary = {
    rowKey: 'foundations-monday', formId: 10, slotGroupId: 20, timeSlotId: 30,
    sportName: 'Gymnastics', programName: 'Gymnastics', className: 'Monday Foundations',
    programId: 1, skillLevel: null, offeringLabel: null, offeringDates: null,
    schedule: 'Monday · 16:00–17:00', formActive: false,
    enrollmentCount: 2, maxParticipants: 12, statusLabel: '2 enrolled',
  }
  await page.route('**/api/**', route => {
    const path = new URL(route.request().url()).pathname
    let data: unknown = []
    if (path === '/api/admin/access/me') data = { isMasterAdmin: true, permissions: [], user: { id: 1 } }
    if (path === '/api/admin/scheduling/enrollments/class-summaries') data = { rows: [summary,
      { ...summary, rowKey: 'foundations-tuesday', timeSlotId: 31, className: 'Tuesday Foundations' },
      { ...summary, rowKey: 'strength', formId: 11, slotGroupId: 21, timeSlotId: 32,
        className: 'Evening Strength', programId: 2, programName: 'Athleticism', sportName: 'Fitness' },
    ] }
    if (path === '/api/public/classes-offered') data = { programs: [
      { id: 99, displayName: 'Tramp & Tumble', primarySportName: 'Trampoline', classes: [] },
    ] }
    return route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/')
  await page.getByRole('navigation', { name: 'Admin sections', exact: true }).getByRole('button', { name: 'Enrollments', exact: true }).click()
  await expect(page.getByRole('tab', { name: 'Monthly Enrollments', exact: true })).toHaveAttribute('aria-selected', 'true')
  const programs = page.getByRole('combobox', { name: 'Filter monthly enrollments by program', exact: true })
  await expect(programs.locator('option')).toHaveText(['All programs', 'Athleticism', 'Gymnastics'])
  await expect(page.getByRole('combobox', { name: 'Filter monthly enrollments by sport', exact: true }).locator('option')).toHaveText(['All sports', 'Fitness', 'Gymnastics'])
  await expect(page.getByRole('row', { name: /Monday Foundations/ })).toBeVisible()
  await programs.selectOption('2')
  await expect(page.getByRole('row', { name: /Evening Strength/ })).toBeVisible()
  await expect(page.getByRole('row', { name: /Foundations/ })).toHaveCount(0)
})
