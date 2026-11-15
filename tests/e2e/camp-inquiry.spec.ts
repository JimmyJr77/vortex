import { expect, test } from '@playwright/test'

test('camp inquiry requires every added camper birthday and gender while names stay optional', async ({ page }) => {
  const submissions: Record<string, unknown>[] = []
  const alerts: string[] = []
  page.on('dialog', async dialog => { alerts.push(dialog.message()); await dialog.accept() })
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/health') return route.fulfill({ json: { apiFeatures: { registrationInquiryOverhaul: true } } })
    if (path === '/api/registrations') submissions.push(route.request().postDataJSON())
    return route.fulfill({ json: { success: true, data: [] } })
  })
  await page.goto('/camp_interest?sport=gymnastics')
  await page.getByPlaceholder('First Name', { exact: true }).fill('Jordan')
  await page.getByPlaceholder('Last Name', { exact: true }).fill('Rivera')
  await page.getByPlaceholder('Email Address', { exact: true }).fill('parent@example.test')
  await page.getByPlaceholder('###-###-####', { exact: true }).fill('2025550101')
  await page.getByRole('button', { name: 'Add camper', exact: true }).click()
  const submit = page.getByRole('button', { name: 'Submit', exact: true })
  await submit.click()
  expect(submissions).toHaveLength(0)
  await page.getByLabel('Camper 1 date of birth', { exact: true }).fill('2018-03-04')
  await submit.click()
  expect(submissions).toHaveLength(0)
  await page.getByLabel('Camper 1 gender', { exact: true }).selectOption('male')
  await expect(page.getByLabel('Camper 1 first name', { exact: true })).not.toHaveAttribute('required')
  await expect(page.getByLabel('Camper 1 last name', { exact: true })).not.toHaveAttribute('required')
  await page.getByRole('button', { name: 'Add camper', exact: true }).click()
  // Bypass native validation to verify the handler cannot silently drop a blank camper.
  await page.locator('form').evaluate(form => form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true })))
  await expect.poll(() => alerts.at(-1)).toBe('Enter a date of birth and gender for camper 2.')
  expect(submissions).toHaveLength(0)
  await page.getByLabel('Camper 2 first name', { exact: true }).fill('Taylor')
  await page.getByLabel('Camper 2 last name', { exact: true }).fill('Rivera')
  await page.getByLabel('Camper 2 date of birth', { exact: true }).fill('2020-06-07')
  await page.getByLabel('Camper 2 gender', { exact: true }).selectOption('female')
  await submit.click()
  await expect.poll(() => submissions.length).toBe(1)
  expect(submissions[0]).toMatchObject({ phone: '202-555-0101', campers: [{ dateOfBirth: '2018-03-04', gender: 'male' }, { firstName: 'Taylor', lastName: 'Rivera', dateOfBirth: '2020-06-07', gender: 'female' }] })
})
