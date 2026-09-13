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
  await expect(page.getByRole('button', { name: /12wk$/ })).toHaveCount(9)
  await page.getByRole('button', { name: 'Rotational Force: Upper Body 12wk', exact: true }).click()
  await expect(page.getByRole('tablist', { name: 'Accelerator programs' }).getByRole('tab')).toHaveCount(9)
  await expect(page.getByRole('heading', { name: 'Rotational Force: Upper Body 12wk' })).toBeVisible()
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
    await page.getByRole('tab', { name: `${title} 12wk`, exact: true }).click()
    await expect(page.getByRole('heading', { name: `${title} 12wk`, exact: true })).toBeVisible()
    await expect(page.getByRole('tabpanel', { name: '2. Explosiveness' }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(6)
  }
  await expect(page.getByRole('tab', { name: /Object control/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'All programs', exact: true }).click()
  await expect(page.getByRole('button', { name: /12wk$/ })).toHaveCount(9)
  expect(errors).toEqual([])
})

test('mobile layout fits and keyboard navigation keeps dialogs accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openAccelerator(page)
  await page.getByRole('button', { name: 'Rotational Force: Upper Body 12wk', exact: true }).click()
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
