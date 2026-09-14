import { expect, test, type Page } from '@playwright/test'

async function openAccelerator(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_member_token', 'e2e-coach-token')
    localStorage.setItem('vortex_member', JSON.stringify({
      id: 42, fullName: 'Coach Test', email: 'coach@example.com',
      roles: ['COACH'], isCoach: true, availablePortals: ['coach'],
    }))
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const data = url.pathname === '/api/coach/portal-config' ? {
      hiddenTabs: [],
      // Deliberately use a saved layout from before this feature existed.
      tabOrder: ['home', 'library', 'workout'],
      navLayout: [
        { type: 'tab', key: 'home' },
        { type: 'section', id: 'session-design', label: 'Session Design' },
        { type: 'tab', key: 'library' },
        { type: 'tab', key: 'workout' },
      ],
    } : []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Member Portal', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'VORTEX COACH' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Athleticism Accelerator View athletic plans by class/ })).toBeVisible()
  const menu = page.getByRole('button', { name: 'Open navigation menu', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.locator('nav').getByRole('button', { name: 'Athleticism Accelerator', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Athleticism Accelerator', exact: true })).toBeVisible()
}


test('lower-body twelve-week plan preserves all classes and coach delivery details', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  page.setDefaultTimeout(10_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await openAccelerator(page)
  await page.getByRole('combobox', { name: 'Search programs', exact: true }).fill('lower body force')
  const card = page.getByRole('button', { name: 'Lower Body Force Generation 12 Classes', exact: true })
  await expect(card).toContainText('twelve weekly classes')
  await card.click()
  await expect(page.getByRole('heading', { name: 'Lower Body Force Generation 12 Classes', exact: true })).toBeVisible()
  await expect(page.getByText('12 weeks · 1 class per week · Ages 12–14 · Coach-led', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Class \d+:/ })).toHaveCount(12)
  for (let n = 1; n <= 12; n++) {
    await page.getByRole('button', { name: new RegExp(`^Class ${n}: Week ${n} —`) }).click()
    for (const [phase, count] of [['2. Explosiveness', 6], ['3. Resilience', 2], ['4. Primary strength', 6]] as const) {
      await page.getByRole('tab', { name: phase }).click()
      await expect(page.getByRole('tabpanel', { name: phase }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(count)
    }
  }
  await expect(page.getByRole('button', { name: 'Next class', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: /^Class 1: Week 1 —/ }).click()
  await page.getByRole('button', { name: 'Coaching notes for Split Squat — stationary, two dumbbells', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('1 × 3 per leg')
  await expect(page.getByRole('dialog')).toContainText('30 s between legs')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Coaching notes for Hamstring Walkout — complete out-and-back cycle', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('eight placements')
  await expect(page.getByRole('dialog')).toContainText('1 × 1 cycles')
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: '1. Prepare' }).click()
  await expect(page.getByRole('tabpanel', { name: '1. Prepare' })).toContainText('existing predetermined Access & Prepare 1')
  await page.getByRole('button', { name: '59–66 min + preparation', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('total booking fit remain unresolved')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: /^Class 6: Week 6 —/ }).click()
  await page.getByRole('tab', { name: '2. Explosiveness' }).click()
  await expect(page.getByRole('tabpanel', { name: '2. Explosiveness' })).toContainText('1 × 1 per leg')
  await page.getByRole('button', { name: /^Class 11: Week 11 —/ }).click()
  await expect(page.getByRole('tabpanel', { name: '2. Explosiveness' })).toContainText('between-rep gaps 0 / 15 / 0 s')
  await page.getByRole('button', { name: /^Class 12: Week 12 —/ }).click()
  await page.screenshot({ path: testInfo.outputPath('lower-force-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Quality, scaling & readiness', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('missing baseline is not zero')
  expect((await page.getByRole('dialog').boundingBox())!.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('lower-force-mobile-notes.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Plan overview', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('reduce work at Week 6')
  await expect(page.getByRole('dialog').getByRole('button', { name: /Class \d+ ·/ })).toHaveCount(12)
  expect(errors).toEqual([])
})
