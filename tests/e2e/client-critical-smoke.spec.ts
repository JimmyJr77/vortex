import { expect, test } from '@playwright/test'

test.describe('Client-critical smoke flows', () => {
  test('public homepage renders core CTAs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('button', { name: 'Inquire' }).first()).toBeVisible()
    await expect(page.getByRole('button', { name: 'Classes & Events' }).first()).toBeVisible()
  })

  test('member login modal opens from public flow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.getByRole('button', { name: /Member Portal Login|Member Login/i }).first().click()
    await expect(page.getByRole('heading', { name: 'Login' })).toBeVisible()
    await expect(page.getByText('Forgot password?')).toBeVisible()
  })

  test('admin login modal opens from public flow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await page.evaluate(() => window.scrollTo(0, document.body.scrollHeight))
    await page.getByRole('button', { name: /^Admin$/ }).first().click()
    await expect(page.getByRole('heading', { name: 'Admin Login' })).toBeVisible()
    await expect(page.getByText('Forgot password?')).toBeVisible()
  })
})
