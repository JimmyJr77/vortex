import { expect, type Page } from '@playwright/test'

export async function openCoachPortalFromHomepage(page: Page) {
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  const portal = page.getByRole('button', { name: 'My portal', exact: true })
  const menu = page.getByRole('button', { name: 'Open menu', exact: true })
  await expect(portal.or(menu)).toBeVisible()
  if (await menu.isVisible()) await menu.click()
  await portal.click()
  await expect(page.getByRole('heading', { name: 'Coach portal', exact: true })).toBeVisible()
}
