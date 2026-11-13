import { expect, test } from '@playwright/test'

test('the public inquiry form confirms success only after the server saves the inquiry', async ({ page }) => {
  let attempts = 0
  const errors: string[] = []
  page.on('dialog', async dialog => { errors.push(dialog.message()); await dialog.accept() })
  await page.route('**/api/**', async route => {
    const pathname = new URL(route.request().url()).pathname
    if (pathname === '/api/health') {
      return route.fulfill({ json: { apiFeatures: { registrationInquiryOverhaul: true } } })
    }
    if (pathname === '/api/registrations') {
      attempts += 1
      expect(route.request().postDataJSON()).toMatchObject({ email: 'returning@example.com', phone: '443-555-0104' })
      if (attempts === 1) return route.abort('failed')
      if (attempts === 2) return route.fulfill({ status: 409, json: { success: false, message: 'Email already registered' } })
      return route.fulfill({ json: { success: true, id: 42 } })
    }
    return route.fulfill({ json: { success: true, data: [] } })
  })

  await page.goto('/contact')
  await page.getByRole('button', { name: 'Send an Inquiry', exact: true }).click()
  await page.getByRole('radio', { name: 'Other' }).check()
  await page.getByPlaceholder('First Name').fill('Returning')
  await page.getByPlaceholder('Last Name').fill('Contact')
  await page.getByPlaceholder('Email Address').fill('returning@example.com')
  const phone = page.getByPlaceholder('###-###-####')
  await phone.fill('(443) 555.0104')
  await expect(phone).toHaveValue('443-555-0104')
  const submit = page.getByRole('button', { name: 'Submit', exact: true })
  const confirmation = page.getByRole('heading', { name: 'Thank You!' })

  await submit.click()
  await expect.poll(() => errors).toEqual(['Unable to confirm your submission. Please check your connection and try again.'])
  await expect(confirmation).toHaveCount(0)
  await expect(page.getByPlaceholder('Email Address')).toHaveValue('returning@example.com')

  await submit.click()
  await expect.poll(() => errors.at(-1)).toBe('Registration failed: Email already registered')
  await expect(confirmation).toHaveCount(0)

  await submit.click()
  await expect(confirmation).toBeVisible()
  expect(attempts).toBe(3)
})
