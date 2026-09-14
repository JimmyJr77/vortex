import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { AcceleratorSession } from '../../src/coach/athleticismAccelerator'

const sessions = JSON.parse(readFileSync(new URL('../../src/coach/data/acceleratorPrograms.json', import.meta.url), 'utf8'))['speed-agility'] as AcceleratorSession[]

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

test('every Speed & Agility class integrates all three courses', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await openAccelerator(page)
  const card = page.getByRole('button', { name: 'Speed & Agility 36 Classes', exact: true })
  await expect(card).toContainText('Sprinting, acceleration, mobile agility and reactive agility')
  await card.screenshot({ path: testInfo.outputPath('speed-agility-card.png') })
  await card.click()
  await expect(page.getByRole('heading', { name: 'Speed & Agility 36 Classes', exact: true })).toBeVisible()
  await expect(page.getByText('36 weeks · 1 class per week · Ages 12–14 · Coach-led', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Class \d+:/ })).toHaveCount(36)
  await expect(page.getByRole('button', { name: 'Previous class', exact: true })).toBeDisabled()
  for (const session of sessions) {
    await page.getByRole('button', { name: `Class ${session.n}: ${session.title}`, exact: true }).click()
    await expect(page.getByRole('heading', { name: session.title, exact: true })).toBeVisible()
    for (const [phase, prefix, count] of [['2. Explosiveness', 'E', 6], ['3. Resilience', 'S', 2], ['4. Primary strength', 'P', 6]] as const) {
      await page.getByRole('tab', { name: phase }).click()
      const panel = page.getByRole('tabpanel', { name: phase })
      await expect(panel.getByRole('button', { name: /Coaching notes for/ })).toHaveCount(count)
      expect(await panel.getByRole('button', { name: /Coaching notes for/ }).evaluateAll((buttons) => buttons.map((button) => button.getAttribute('aria-label')?.replace('Coaching notes for ', '')))).toEqual(session.exercises.filter(({ id }) => id.startsWith(prefix)).map(({ name }) => name))
      if (prefix !== 'S') {
        for (const track of ['Sprinting & Acceleration', 'Agility: Mobility', 'Agility: Reactive']) {
          await expect(panel.getByText(`${track} · Source class ${Math.ceil(session.n / 3)}`, { exact: true })).toHaveCount(2)
        }
      }
    }
  }
  await expect(page.getByRole('button', { name: 'Next class', exact: true })).toBeDisabled()
  await page.getByRole('tab', { name: '2. Explosiveness' }).click()
  const exercise = sessions[35].exercises[5]
  await page.getByRole('button', { name: `Coaching notes for ${exercise.name}`, exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(exercise.dose)
  await expect(page.getByRole('dialog')).toContainText(exercise.instruction)
  await expect(page.getByRole('dialog')).toContainText('Agility: Reactive, Class 12')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Plan overview', exact: true }).click()
  const overview = page.getByRole('dialog')
  await expect(overview).toContainText('Every class combines two explosive drills from Sprinting & Acceleration, two from Agility: Mobility and two from Agility: Reactive.')
  await expect(overview.getByRole('button', { name: /Stage \d+[ABC]/ })).toHaveCount(36)
  await page.keyboard.press('Tab')
  await expect(overview.getByRole('button', { name: /Stage 1A/ })).toBeFocused()
  await page.keyboard.press('Enter')
  await expect(overview).toHaveCount(0)
  await expect(page.getByRole('heading', { name: sessions[0].title, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Class 36:', exact: false }).click()
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Sprinting & Acceleration 12 Classes', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Class 1 workout', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Class \d+:/ })).toHaveCount(12)
  expect(errors).toEqual([])
})

test('Speed & Agility overview and mixed workouts fit on mobile', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openAccelerator(page)
  await page.getByRole('button', { name: 'Speed & Agility 36 Classes', exact: true }).click()
  await page.getByRole('button', { name: 'Class 36:', exact: false }).click()
  await expect(page.getByRole('heading', { name: sessions[35].title, exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: testInfo.outputPath('speed-agility-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Plan overview', exact: true }).click()
  const overview = page.getByRole('dialog')
  const bounds = await overview.boundingBox()
  expect(bounds!.width).toBeLessThanOrEqual(390)
  await overview.getByRole('button', { name: /Stage 6C/ }).click()
  await expect(page.getByRole('region', { name: 'Class 18 workout', exact: true })).toBeVisible()
})
