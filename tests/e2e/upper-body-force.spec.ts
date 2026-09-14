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
  await expect(page.getByRole('button', { name: /Custom Programs View custom athletic plans by class/ })).toBeVisible()
  const menu = page.getByRole('button', { name: 'Open navigation menu', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.locator('nav').getByRole('button', { name: 'Custom Programs', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Custom Programs', exact: true })).toBeVisible()
}

test('upper-body force course preserves 12 class views, doses and coaching detail', async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  page.setDefaultTimeout(10_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await openAccelerator(page)
  const card = page.getByRole('button', { name: 'Upper Body Force Generation 12 Classes', exact: true })
  await expect(card).toContainText('pushing, pulling and straight-line projection')
  await card.click()
  await expect(page.getByRole('heading', { name: 'Upper Body Force Generation 12 Classes', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Class \d+:/ })).toHaveCount(12)
  for (let n = 1; n <= 12; n++) {
    await page.getByRole('button', { name: `Class ${n}:`, exact: false }).click()
    for (const [phase, count] of [['2. Explosiveness', 6], ['3. Resilience', 2], ['4. Primary strength', 6]] as const) {
      await page.getByRole('tab', { name: phase }).click()
      await expect(page.getByRole('tabpanel', { name: phase }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(count)
    }
  }
  await expect(page.getByRole('button', { name: 'Next class', exact: true })).toBeDisabled()
  await page.getByRole('button', { name: 'Class 1:', exact: false }).click()
  await page.getByRole('button', { name: 'Coaching notes for Floor Press — two dumbbells, neutral grip', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Load preparation')
  await expect(page.getByRole('dialog')).toContainText('1 × 6 then 1 × 3')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Quality, scaling & readiness', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('37 repetitions')
  await expect(page.getByRole('dialog')).toContainText('2–3 technically sound repetitions in reserve')
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: '1. Prepare' }).click()
  await expect(page.getByRole('tabpanel', { name: '1. Prepare' })).toContainText('existing predetermined Access & Prepare 1')
  await page.getByRole('button', { name: '65–75 min + preparation', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('complete session duration is unresolved')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Class 5:', exact: false }).click()
  await page.getByRole('tab', { name: '2. Explosiveness' }).click()
  await expect(page.getByRole('tabpanel', { name: '2. Explosiveness' })).toContainText('0 / 15 / 0 s between-rep gaps')
  await page.getByRole('button', { name: 'Class 12:', exact: false }).click()
  await page.screenshot({ path: testInfo.outputPath('upper-force-desktop.png'), fullPage: true })
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Quality, scaling & readiness', exact: true }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('baseline unavailable')
  expect((await dialog.boundingBox())!.width).toBeLessThanOrEqual(390)
  await page.screenshot({ path: testInfo.outputPath('upper-force-mobile-notes.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Plan overview', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('consolidate at Class 6')
  await expect(page.getByRole('dialog').getByRole('button', { name: /Class \d+:/ })).toHaveCount(12)
  expect(errors).toEqual([])
})
