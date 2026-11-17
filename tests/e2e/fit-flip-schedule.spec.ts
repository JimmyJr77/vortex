import { expect, test, type Page } from '@playwright/test'

const fitAndFlip = 'Fit & Flip'
const bookingPath = `/enroll?program=${encodeURIComponent(fitAndFlip)}`
const younger = 'Cyclones ages 8–11'
const older = 'Cyclones ages 12–15'
const currentDay = '2026-11-17'

function recurringGroup(formId: number, groupId: number, offeringId: number, dayOfWeek: number, startTime: string, endTime: string) {
  return {
    id: groupId, formId, offeringId, scheduleMode: 'day', isActive: true,
    occurrences: [{ id: groupId + 100, formId, slotGroupId: groupId, scheduleMode: 'day', dayOfWeek,
      startTime, endTime, isActive: true }],
  }
}

async function mockSchedule(page: Page, unavailableForms: number[] = []) {
  // It is already November 18 UTC, but November 17 at the gym.
  await page.clock.setFixedTime(new Date('2026-11-18T02:00:00Z'))
  const formRequests: number[] = []
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const json = (data: unknown) => route.fulfill({ json: { success: true, data } })
    if (path === '/api/public/classes-offered') {
      return json({ programs: [
        { id: 9, displayName: fitAndFlip, classes: [
          { displayName: older, ageMin: 12, formId: 31, enrollVisible: true },
          { displayName: younger, ageMin: 8, formId: 30, enrollVisible: true },
          { displayName: 'Unpublished Cyclones', formId: 32, enrollVisible: false },
        ] },
        { id: 5, displayName: 'Adult Fitness & Acrobatics', classes: [
          { displayName: 'Typhoons', ageMin: 18, formId: 3, enrollVisible: true },
        ] },
      ] })
    }

    const formMatch = path.match(/^\/api\/scheduling\/forms\/(\d+)(\/offerings)?$/)
    if (!formMatch) return json({})
    const formId = Number(formMatch[1])
    if (formMatch[2]) {
      return json([
        { id: 1, formId, startDate: currentDay, endDate: currentDay },
        { id: 2, formId, startDate: '2026-11-18' },
      ])
    }

    formRequests.push(formId)
    if (formId !== 30 && formId !== 31) return json({})
    if (unavailableForms.includes(formId)) return route.fulfill({ status: 503, json: { success: false } })
    const [startTime, endTime] = formId === 30 ? ['18:00', '19:30'] : ['19:00', '20:30']
    return json({
      id: formId, programsId: 9, isActive: true, startDate: currentDay, endDate: currentDay,
      slotGroups: [
        { ...recurringGroup(formId, 1, 1, 2, startTime, endTime), activeStart: currentDay, activeEnd: currentDay },
        recurringGroup(formId, 2, 2, 4, '17:00', '18:30'),
        { ...recurringGroup(formId, 3, 1, 5, '17:00', '18:30'), activeEnd: '2026-11-16' },
      ],
    })
  })
  return formRequests
}

test('shows the current Eastern schedule by age and keeps the enrollment link on mobile', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const formRequests = await mockSchedule(page)
  await page.goto('/fit-and-flip')
  const schedule = page.getByRole('region', { name: 'Recurring Fit & Flip class times' })
  const cohorts = schedule.locator('.np-recurring-schedule > ul > li')
  await expect(cohorts).toHaveCount(2)
  await expect(cohorts.nth(0)).toContainText(younger)
  await expect(cohorts.nth(0)).toContainText('Tuesday · 6:00 PM – 7:30 PM')
  await expect(cohorts.nth(1)).toContainText(older)
  await expect(cohorts.nth(1)).toContainText('Tuesday · 7:00 PM – 8:30 PM')
  await expect(schedule.getByText(/Thursday|Friday|Unpublished|Typhoons/)).toHaveCount(0)
  await expect(schedule.getByRole('link', { name: 'Check dates and availability' })).toHaveAttribute('href', bookingPath)
  expect([...new Set(formRequests)].sort()).toEqual([30, 31])

  await page.getByRole('navigation', { name: 'Other Vortex programs' }).getByRole('link', { name: 'Youth Gymnastics', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Youth gymnastics classes in Bowie, MD' })).toBeVisible()
  await expect(schedule).toHaveCount(0)
  await expect(page.getByText(younger, { exact: true })).toHaveCount(0)
})

test('keeps the healthy Fit & Flip group visible when the other form fails', async ({ page }) => {
  await mockSchedule(page, [30])
  await page.goto('/fit-and-flip')
  const schedule = page.getByRole('region', { name: 'Recurring Fit & Flip class times' })
  const cohorts = schedule.locator('.np-recurring-schedule > ul > li')
  await expect(cohorts).toHaveCount(1)
  await expect(cohorts).toContainText(older)
  await expect(schedule.getByRole('link', { name: 'Check dates and availability' })).toHaveAttribute('href', bookingPath)
})

test('keeps filtered enrollment available if weekly times cannot load', async ({ page }) => {
  await mockSchedule(page, [30, 31])
  await page.goto('/fit-and-flip')
  const schedule = page.getByRole('region', { name: 'Recurring Fit & Flip class times' })
  await expect(schedule.getByText('Check enrollment for current class times or contact Vortex for help.')).toBeVisible()
  await expect(schedule.getByRole('link', { name: 'Check dates and availability' })).toHaveAttribute('href', bookingPath)
})
