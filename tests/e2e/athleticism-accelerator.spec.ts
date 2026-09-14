import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
const programs = JSON.parse(readFileSync(new URL('../../src/coach/data/acceleratorPrograms.json', import.meta.url), 'utf8')) as Record<string, unknown[]>
const programCount = Object.keys(programs).length

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

test('coach can browse the collection, inspect daily plans, and open supplemental notes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await openAccelerator(page)
  const nav = await page.locator('nav button').allTextContents()
  expect(nav[nav.findIndex((label) => label.trim() === 'Library') + 1].trim()).toBe('Athleticism Accelerator')
  await expect(page.getByRole('button', { name: /Classes$/ })).toHaveCount(programCount)
  await expect(page.getByRole('button', { name: 'Jumps: Max Air 36 Classes', exact: true })).toContainText('Vertical and horizontal jumps with force absorption and elastic rebound.')
  await page.getByRole('button', { name: 'Rotational Force: Upper Body 12 Classes', exact: true }).click()
  await expect(page.getByRole('tablist', { name: 'Accelerator programs' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Rotational Force: Upper Body 12 Classes', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Rotational Force: Upper Body 12 Classes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous class' })).toBeDisabled()
  await expect(page.getByRole('tabpanel', { name: '2. Explosiveness' }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(6)

  const notes = page.getByRole('tabpanel', { name: '2. Explosiveness' }).getByRole('button', { name: /Coaching notes for/ }).first()
  await notes.click()
  await expect(page.getByRole('dialog')).toContainText('Execution & scaling')
  await expect(page.getByRole('button', { name: 'Close details' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(notes).toBeFocused()

  for (let n = 2; n <= 12; n++) {
    await page.getByRole('button', { name: `Class ${n}:`, exact: false }).click()
    await expect(page.getByRole('region', { name: `Class ${n} workout`, exact: true })).toBeVisible()
    await expect(page.getByRole('tabpanel', { name: '2. Explosiveness' }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(6)
  }
  await expect(page.getByRole('button', { name: 'Next class' })).toBeDisabled()
  await page.getByRole('tab', { name: '4. Primary strength' }).click()
  await expect(page.getByRole('tabpanel', { name: '4. Primary strength' }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(6)
  await page.getByRole('tab', { name: '3. Resilience' }).click()
  await expect(page.getByRole('tabpanel', { name: '3. Resilience' }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(2)
  await page.getByRole('tab', { name: '1. Prepare' }).click()
  await expect(page.getByRole('tabpanel', { name: '1. Prepare' })).toContainText('do not recreate it')

  await page.getByRole('button', { name: 'Class 2:', exact: false }).click()
  await expect(page.getByRole('complementary', { name: 'Equipment for the day' })).toBeVisible()
  await page.getByRole('tab', { name: '3. Resilience' }).click()
  await expect(page.getByRole('tabpanel', { name: '3. Resilience' })).toContainText('15 s')
  await page.getByRole('button', { name: 'Plan overview' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /07 Class 7/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('tab', { name: '2. Explosiveness' }).click()
  for (const title of ['Distance Running', 'Sprinting & Acceleration', 'Jumps: Horizontal', 'Jumps: Vertical', 'Jumps: Absorption & Rebound', 'Agility: Mobility', 'Agility: Reactive', 'Rotational Force: Lower Body']) {
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: `${title} 12 Classes`, exact: true }).click()
    await expect(page.getByRole('heading', { name: `${title} 12 Classes`, exact: true })).toBeVisible()
    await expect(page.getByRole('tabpanel', { name: '2. Explosiveness' }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(6)
  }
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Jumps: Max Air 36 Classes', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Jumps: Max Air 36 Classes', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Class \d+:/ })).toHaveCount(36)
  await expect(page.getByRole('heading', { name: 'Control & project · Stage 1A', exact: true })).toBeVisible()
  const maxAirExplosive = page.getByRole('tabpanel', { name: '2. Explosiveness' })
  await expect(maxAirExplosive.getByText(/Force absorption & elastic rebound · Source class 1/)).toHaveCount(2)
  await expect(maxAirExplosive.getByText(/Vertical jumps · Source class 1/)).toHaveCount(2)
  await expect(maxAirExplosive.getByText(/Horizontal jumps · Source class 1/)).toHaveCount(2)
  await page.getByRole('button', { name: 'Class 2:', exact: false }).click()
  await expect(page.getByRole('heading', { name: 'Rebound & redirect · Stage 1B', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Class 36:', exact: false }).click()
  await expect(page.getByRole('heading', { name: 'Consolidate every direction · Stage 12C', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next class' })).toBeDisabled()
  await expect(page.getByRole('tab', { name: /Object control/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('button', { name: /Classes$/ })).toHaveCount(programCount)
  expect(errors).toEqual([])
})

test('collection search and program type work together and survive returning from a program', async ({ page }) => {
  await openAccelerator(page)
  const search = page.getByRole('combobox', { name: 'Search programs', exact: true })
  const programType = page.getByRole('combobox', { name: 'Program type', exact: true })
  const cards = page.getByRole('button', { name: /Classes$/ })
  await expect(programType.locator('option')).toHaveText([
    'All programs',
    'Individual athletic focal points',
    'Grouped athletic focal points',
  ])
  await expect(programType).toHaveValue('all')
  await expect(cards).toHaveCount(programCount)

  await programType.selectOption('individual')
  await expect(cards).toHaveCount(Object.values(programs).filter((sessions) => sessions.length === 12).length)
  await expect(page.getByRole('button', { name: /36 Classes$/ })).toHaveCount(0)
  await programType.selectOption('grouped')
  await expect(cards).toHaveCount(Object.values(programs).filter((sessions) => sessions.length === 36).length)
  await expect(page.getByRole('button', { name: /12 Classes$/ })).toHaveCount(0)

  await programType.selectOption('all')
  await search.fill('  KEEP MOVING  ')
  await expect(cards).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Distance Running 12 Classes', exact: true })).toBeVisible()
  await search.fill('jumps')
  await expect(cards).toHaveCount(4)
  await programType.selectOption('grouped')
  await expect(cards).toHaveCount(1)
  await expect(page.locator('datalist option[value="Jumps: Max Air"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Jumps: Max Air 36 Classes', exact: true }).click()
  await expect(search).toHaveCount(0)
  await expect(page.getByRole('tablist', { name: 'Accelerator programs' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Class \d+:/ })).toHaveCount(36)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(search).toHaveValue('jumps')
  await expect(programType).toHaveValue('grouped')
  await expect(cards).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Jumps: Max Air 36 Classes', exact: true })).toBeVisible()

  await programType.selectOption('individual')
  await expect(cards).toHaveCount(3)
  await search.fill('no matching athletic program')
  await expect(cards).toHaveCount(0)
  await search.fill('')
  await programType.selectOption('all')
  await expect(cards).toHaveCount(programCount)
})

test('mobile layout fits and keyboard navigation keeps dialogs accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openAccelerator(page)
  await expect(page.getByRole('combobox', { name: 'Search programs', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Program type', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Rotational Force: Upper Body 12 Classes', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const explosive = page.getByRole('tab', { name: '2. Explosiveness' })
  await explosive.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: '3. Resilience' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Setup & substitutions' }).click()
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds!.width).toBeLessThanOrEqual(390)
  await page.keyboard.press('Shift+Tab')
  expect(await page.evaluate(() => document.querySelector('dialog')?.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})
