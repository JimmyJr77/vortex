import { expect, test } from '@playwright/test'

test('coach portal uses the canonical planning navigation and separated collections', async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_member_token', 'e2e-coach-token')
    localStorage.setItem('vortex_member', JSON.stringify({
      id: 42,
      fullName: 'Coach Test',
      email: 'coach@example.com',
      roles: ['COACH'],
      isCoach: true,
      availablePortals: ['coach'],
    }))
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const data = url.pathname === '/api/coach/portal-config'
      ? { hiddenTabs: [], tabOrder: [], navLayout: [] }
      : []
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ success: true, data }),
    })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Member Portal', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'VORTEX COACH' })).toBeVisible()

  const nav = page.locator('nav').first()
  await expect(nav.getByRole('heading', { level: 2 })).toHaveText([
    'Session Design',
    'Training Plans',
    'Athlete Development',
    'Administrative',
  ])
  await expect(nav.getByRole('button')).toHaveText([
    'Home',
    'Messages',
    'Today',
    'Roster',
    'Philosophy',
    'Library',
    'Program Generator',
    'Program Planner',
    'Prepare & Access',
    'Custom Programs',
    'ABC Progressions',
    'Fit & Flip',
    'Challenges',
    'Evaluation Form',
    'Skill Tree',
    'Assign',
    'Form Review',
    'Insights',
    'FAQ library',
    'Preferences',
  ])

  await nav.getByRole('button', { name: 'Prepare & Access', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Prepare & Access', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Access & Prepare Standard 15min', exact: true })).toBeVisible()

  await nav.getByRole('button', { name: 'Custom Programs', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Custom Programs', exact: true })).toBeVisible()
  await expect(page.getByLabel('Custom Programs collection').getByRole('button')).toHaveCount(15)
  await expect(page.getByRole('button', { name: 'Access & Prepare Standard 15min', exact: true })).toHaveCount(0)

  await nav.getByRole('button', { name: 'Program Planner', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Program Planner', exact: true })).toBeVisible()
  await expect(page.getByRole('tablist', { name: 'Program Planner modes' }).getByRole('tab')).toHaveText([
    /Workout design/,
    /Training blocks/,
    /Regimens/,
  ])
})
