import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
import type { AcceleratorSession } from '../../src/coach/athleticismAccelerator'

const sessions = JSON.parse(readFileSync(new URL('../../src/coach/data/acceleratorPrograms.json', import.meta.url), 'utf8'))['rotation-full-body'] as AcceleratorSession[]

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

test('all 36 rotational classes integrate both regions, with 12 added application days', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await openAccelerator(page)
  const card = page.getByRole('button', { name: 'Rotational Force: Full Body 36 Classes', exact: true })
  await expect(card).toContainText('Upper and lower body rotational force generation')
  await card.screenshot({ path: testInfo.outputPath('rotational-force-card.png') })
  await card.click()
  await expect(page.getByText('36 weeks · 1 class per week · Ages 12–14 · Coach-led', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Class \d+:/ })).toHaveCount(36)
  await expect(page.getByRole('heading', { name: 'Full body · Pivot and project', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Next class' }).click()
  await expect(page.getByRole('heading', { name: 'Full body · Load, redirect and brake', exact: true })).toBeVisible()
  for (let n = 1; n <= 36; n++) {
    await page.getByRole('button', { name: `Class ${n}:`, exact: false }).click()
    await expect(page.getByRole('region', { name: `Class ${n} workout`, exact: true })).toBeVisible()
    for (const [phase, count] of [['2. Explosiveness', 6], ['3. Resilience', 2], ['4. Primary strength', 6]] as const) {
      await page.getByRole('tab', { name: phase }).click()
      await expect(page.getByRole('tabpanel', { name: phase }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(count)
      if (phase === '2. Explosiveness') {
        const panel = page.getByRole('tabpanel', { name: phase })
        await expect(panel.getByRole('note', { name: /Connection/ })).toHaveCount(3)
        await expect(panel.getByRole('note', { name: 'Connection E1 and E2', exact: true })).toContainText(sessions[n - 1].connections![0].cue)
        for (const exercise of sessions[n - 1].exercises.slice(0, 2)) await expect(panel.getByRole('button', { name: exercise.name, exact: true })).toBeVisible()
        if (n === 1) await page.getByRole('region', { name: 'Class 1 workout', exact: true }).screenshot({ path: testInfo.outputPath('rotation-class-1.png') })
      }
    }
  }
  await expect(page.getByRole('heading', { name: 'Full body · Review the full-body foundations', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next class' })).toBeDisabled()
  await page.getByRole('button', { name: 'Plan overview' }).click()
  await expect(page.getByRole('dialog')).toContainText('24 integrated classes plus 12 application days')
  await page.getByRole('dialog').getByRole('button', { name: 'Class 18: Full body · Consolidate with less volume', exact: true }).click()
  await page.getByRole('tab', { name: '2. Explosiveness' }).click()
  await page.getByRole('button', { name: 'Quality, scaling & readiness' }).click()
  await expect(page.getByRole('dialog')).toContainText('24 explosive attempts, four ball releases and no planned landings')
  await page.keyboard.press('Escape')
  await page.getByRole('tab', { name: '4. Primary strength' }).click()
  await page.getByRole('tabpanel', { name: '4. Primary strength' }).getByRole('button', { name: /Coaching notes for/ }).first().click()
  await expect(page.getByRole('dialog')).toContainText('One easy set of')
  await page.keyboard.press('Escape')
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Class 36:', exact: false }).click()
  await page.getByRole('tab', { name: '2. Explosiveness' }).click()
  const mobileExplosive = page.getByRole('tabpanel', { name: '2. Explosiveness' })
  await expect(mobileExplosive.getByRole('note', { name: /Connection/ })).toHaveCount(3)
  const firstConnection = mobileExplosive.getByRole('note', { name: 'Connection E1 and E2', exact: true })
  await firstConnection.scrollIntoViewIfNeeded()
  await expect(firstConnection).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('rotation-mobile.png') })
  const lastExercise = mobileExplosive.getByRole('button', { name: sessions[35].exercises[5].name, exact: true })
  await lastExercise.scrollIntoViewIfNeeded()
  await expect(lastExercise).toBeVisible()
  await page.screenshot({ path: testInfo.outputPath('rotation-mobile-last-pair.png') })
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Rotational Force: Lower Body 12 Classes', exact: true }).click()
  await expect(page.getByRole('region', { name: 'Class 1 workout', exact: true })).toBeVisible()
  expect(errors).toEqual([])
})
