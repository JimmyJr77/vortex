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
      expect(route.request().postDataJSON()).toMatchObject({ email: 'returning@example.com', phone: '443-555-0104', interests: ['Tumbling & Trampoline'], classTypes: ['Youth Classes'] })
      if (attempts === 1) return route.abort('failed')
      if (attempts === 2) return route.fulfill({ status: 409, json: { success: false, message: 'Email already registered' } })
      return route.fulfill({ json: { success: true, id: 42 } })
    }
    return route.fulfill({ json: { success: true, data: [] } })
  })

  await page.goto('/contact')
  await page.getByRole('button', { name: 'Send an Inquiry', exact: true }).click()
  const interests = page.getByRole('group', { name: 'Interests', exact: true })
  await expect(interests.getByRole('checkbox')).toHaveCount(4)
  for (const name of ['Strength & Explosiveness', 'Tumbling & Trampoline', 'Gymnastics', 'Mutli-Sport Athleticism Training']) {
    await expect(interests.getByRole('checkbox', { name, exact: true })).toBeVisible()
  }
  await interests.getByRole('checkbox', { name: 'Tumbling & Trampoline', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Youth Classes', exact: true }).check()
  await expect(page.getByText('Class Type Interests', { exact: true })).toBeVisible()
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

test('adding an athlete requires phone, birthday and gender but athlete names are optional', async ({ page }) => {
  const submissions: Record<string, unknown>[] = []
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    if (path === '/api/health') return route.fulfill({ json: { apiFeatures: { registrationInquiryOverhaul: true } } })
    if (path === '/api/registrations') {
      submissions.push(route.request().postDataJSON())
      return route.fulfill({ json: { success: true, id: 43 } })
    }
    return route.fulfill({ json: { success: true, data: [] } })
  })
  await page.goto('/contact')
  await page.getByRole('button', { name: 'Send an Inquiry', exact: true }).click()
  await page.getByRole('radio', { name: 'Parent/Guardian' }).check()
  await page.getByPlaceholder('First Name', { exact: true }).fill('Test')
  await page.getByPlaceholder('Last Name', { exact: true }).fill('Parent')
  await page.getByPlaceholder('Email Address').fill('parent@example.test')
  const phone = page.getByPlaceholder('###-###-####')
  await expect(phone).not.toHaveAttribute('required')
  await page.getByRole('button', { name: 'Add athlete', exact: true }).click()
  await expect(phone).toHaveAttribute('required')
  const birthday = page.getByLabel('Athlete 1 date of birth')
  const gender = page.getByLabel('Athlete 1 gender')
  await expect(birthday).toHaveAttribute('required')
  await expect(gender).toHaveAttribute('required')
  await expect(page.getByLabel('Athlete 1 first name')).not.toHaveAttribute('required')
  await expect(page.getByLabel('Athlete 1 last name')).not.toHaveAttribute('required')
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  expect(submissions).toHaveLength(0)
  await phone.fill('2025550101')
  await birthday.fill('2020-02-20')
  await gender.selectOption('female')
  await page.getByRole('button', { name: 'Submit', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Thank You!' })).toBeVisible()
  expect(submissions).toHaveLength(1)
  expect(submissions[0]).toMatchObject({ phone: '202-555-0101', campers: [{ dateOfBirth: '2020-02-20', gender: 'female' }] })
})
