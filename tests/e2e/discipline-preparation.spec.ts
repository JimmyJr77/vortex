import { expect, test, type Page } from '@playwright/test'
import { DISCIPLINE_PREPARATION_ROUTINES } from '../../src/coach/preparation/routines'
import { preparationTimeline } from '../../src/coach/preparation/types'

async function openPreparation(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_member_token', 'e2e-coach-token')
    localStorage.setItem('vortex_member', JSON.stringify({ id: 42, fullName: 'Coach Test', email: 'coach@example.com', roles: ['COACH'], isCoach: true, availablePortals: ['coach'] }))
  })
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const data = path === '/api/coach/portal-config' ? { hiddenTabs: [], tabOrder: ['home', 'library', 'workout'] } : []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })
  await page.goto('/')
  await page.getByRole('button', { name: 'Member Portal', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'VORTEX COACH', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Prepare & Access Choose and inspect the preparation routine for a training day.', exact: true })).toBeVisible()
  const menu = page.getByRole('button', { name: 'Open navigation menu', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.locator('nav').getByRole('button', { name: 'Prepare & Access', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Prepare & Access', exact: true })).toBeVisible()
}

test('all seven disciplines have complete 5, 10 and 15 minute prescriptions with protected bridges', () => {
  const expectedDisciplines = ['sprinting', 'running', 'lifting-upper', 'lifting-lower', 'lifting-full', 'throwing', 'jumping']
  expect(DISCIPLINE_PREPARATION_ROUTINES).toHaveLength(21)
  expect(new Set(DISCIPLINE_PREPARATION_ROUTINES.map((routine) => routine.id)).size).toBe(21)
  for (const discipline of expectedDisciplines) {
    expect(DISCIPLINE_PREPARATION_ROUTINES.filter((routine) => routine.discipline === discipline).map((routine) => routine.durationMinutes)).toEqual([15, 10, 5])
  }
  for (const routine of DISCIPLINE_PREPARATION_ROUTINES) {
    const timeline = preparationTimeline(routine)
    expect(timeline.at(-1)?.end, routine.id).toBe(routine.durationMinutes * 60)
    expect(routine.steps.slice(-2).map((step) => step.stage), routine.id).toEqual(['rehearsal', 'progressive'])
    expect(routine.steps.slice(0, -2).every((step) => step.stage === 'base'), routine.id).toBe(true)
    expect(routine.entryCriteria.length).toBeGreaterThan(0)
    expect(routine.exitCriteria.length).toBeGreaterThan(0)
    expect(routine.limitations.length).toBeGreaterThan(0)
    for (const step of routine.steps) {
      expect(step.workSeconds + step.recoverySeconds + step.transitionSeconds, `${routine.id}: ${step.exercise.name}`).toBe(step.seconds)
      expect([step.workSeconds, step.recoverySeconds, step.transitionSeconds].every((value) => Number.isInteger(value) && value >= 0)).toBe(true)
      expect(step.dose.length).toBeGreaterThan(0)
      expect(step.delivery.length).toBeGreaterThan(0)
      for (const field of ['setup', 'executionSteps', 'coachCues', 'athleteCues', 'qualityGates', 'commonFaults', 'scaling', 'stopSigns'] as const) {
        expect(step.exercise[field].length, `${routine.id}: ${step.exercise.name} ${field}`).toBeGreaterThan(0)
      }
    }
  }
})

test('all 21 cards open their own complete routine, with Standard first and grey minutes', async ({ page }, testInfo) => {
  test.setTimeout(90_000)
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await openPreparation(page)
  const collection = page.getByLabel('Prepare & Access collection')
  await expect(collection.locator(':scope > button')).toHaveCount(22)
  await expect(collection.locator(':scope > button').first()).toHaveAccessibleName('Access & Prepare Standard 15min')
  for (const [duration, count] of [[5, 7], [10, 7], [15, 8]]) {
    await page.getByLabel('Search routines', { exact: true }).fill(`${duration}min`)
    await expect(collection.locator(':scope > button')).toHaveCount(count)
  }
  await page.getByLabel('Search routines', { exact: true }).fill('')
  await page.screenshot({ path: testInfo.outputPath('preparation-collection-desktop.png'), fullPage: true })
  for (const routine of DISCIPLINE_PREPARATION_ROUTINES) {
    const label = `${routine.title} ${routine.durationMinutes}min`
    await expect(page.getByTestId(`${routine.id}-metric`)).toHaveClass(/text-gray-400/)
    await expect(page.getByTestId(`${routine.id}-icon`)).toHaveCSS('background-color', 'rgb(0, 0, 0)')
    await expect(page.getByTestId(`${routine.id}-icon`).locator('path')).toHaveCount(3)
    await collection.getByRole('button', { name: label, exact: true }).click()
    await expect(page.getByRole('heading', { name: label, exact: true })).toBeVisible()
    const sequence = page.getByRole('list', { name: `${label} sequence`, exact: true })
    await expect(sequence.locator(':scope > li')).toHaveCount(routine.steps.length)
    await expect(sequence.locator(':scope > li').last()).toContainText(`${routine.durationMinutes}:00`)
    await sequence.getByRole('button', { name: `Routine details for step ${routine.steps.length}: ${routine.steps.at(-1)!.exercise.name}`, exact: true }).click()
    const dialog = page.getByRole('dialog')
    await expect(dialog.getByRole('heading', { name: 'Execution', exact: true })).toBeVisible()
    await expect(dialog).toContainText(routine.steps.at(-1)!.dose)
    await expect(dialog.getByRole('heading', { name: 'Stop signs', exact: true })).toBeAttached()
    await page.keyboard.press('Escape')
    await expect(dialog).not.toBeVisible()
    await page.getByRole('button', { name: 'Back', exact: true }).click()
  }
  expect(errors).toEqual([])
})

test('mobile routines support search, timing and setup dialogs without horizontal overflow', async ({ page }, testInfo) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openPreparation(page)
  await page.getByLabel('Search routines', { exact: true }).fill('Throwing 5min')
  // Search by a full card label must match the title and duration together.
  const collection = page.getByLabel('Prepare & Access collection')
  await expect(collection.locator(':scope > button')).toHaveCount(1)
  await collection.getByRole('button', { name: 'Throwing 5min', exact: true }).click()
  await page.screenshot({ path: testInfo.outputPath('throwing-5min-mobile.png'), fullPage: true })
  await page.getByRole('button', { name: 'Timing & delivery', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('5:00')
  await expect(page.getByRole('dialog')).toContainText('up to three athletes')
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Setup, scaling & safety', exact: true }).click()
  await expect(page.getByRole('dialog').getByRole('heading', { name: 'Three 10 m lanes', exact: true })).toBeAttached()
  await expect(page.getByRole('dialog')).toContainText('no-release')
  await page.keyboard.press('Escape')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1)).toBe(true)
})
