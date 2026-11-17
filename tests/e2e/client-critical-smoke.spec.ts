import { expect, test } from '@playwright/test'

test.describe('Client-critical smoke flows', () => {
  test('public homepage renders core CTAs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: 'Built for more.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Book a free trial', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Schedule', exact: true })).toHaveAttribute('href', '/read-board#schedule')
  })

  test('account login modal opens from public flow', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    const memberLogin = page.getByRole('button', { name: 'Member login', exact: true })
    await memberLogin.click()
    await expect(page.getByRole('heading', { name: 'Account Login' })).toBeVisible()
    await expect(page.getByText('Forgot password?')).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(memberLogin).toBeFocused()
  })
})
