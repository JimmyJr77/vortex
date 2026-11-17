import { expect, test } from '@playwright/test'

test.describe('Client-critical smoke flows', () => {
  test('public homepage renders core CTAs', async ({ page }) => {
    await page.goto('/', { waitUntil: 'domcontentloaded' })
    await expect(page.getByRole('heading', { level: 1, name: 'Built for more.' })).toBeVisible()
    await expect(page.getByRole('button', { name: 'Book a free trial', exact: true })).toBeVisible()
    await expect(page.getByRole('link', { name: 'Schedule', exact: true })).toHaveAttribute('href', '/read-board#schedule')
  })

  test('class schedule links preserve the selected view across history and reload', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    const scheduleUrl = '/read-board?utm_source=schedule-qa#schedule'
    const eventsUrl = '/read-board?utm_source=schedule-qa#events'
    await page.goto(scheduleUrl, { waitUntil: 'domcontentloaded' })

    const tabs = page.getByRole('navigation', { name: 'Browse classes and updates' })
    const scheduleTab = tabs.getByRole('link', { name: 'Schedule', exact: true })
    const eventsTab = tabs.getByRole('link', { name: 'Events', exact: true })
    const calendar = page.locator('section#schedule').getByRole('button', { name: 'By class', exact: true })
    await expect(scheduleTab).toHaveAttribute('aria-current', 'location')
    await expect(calendar).toBeVisible()

    await eventsTab.click()
    await expect(page).toHaveURL(eventsUrl)
    await expect(eventsTab).toHaveAttribute('aria-current', 'location')
    await expect(page.getByRole('heading', { name: 'Upcoming Events', exact: true })).toBeVisible()

    await page.goBack()
    await expect(page).toHaveURL(scheduleUrl)
    await expect(scheduleTab).toHaveAttribute('aria-current', 'location')
    await expect(calendar).toBeVisible()

    await page.reload({ waitUntil: 'domcontentloaded' })
    await expect(page).toHaveURL(scheduleUrl)
    await expect(scheduleTab).toHaveAttribute('aria-current', 'location')
    await expect(calendar).toBeVisible()
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
