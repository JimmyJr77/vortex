import { expect, test } from '@playwright/test'

test('trial invitations save information and waivers before offering child-specific free trial dates', async ({ page }) => {
  let completion: Record<string, unknown> | null = null
  const bookingRequests: Record<string, unknown>[] = []
  const availabilityRequests: string[] = []
  let completed = false
  const children = [
    { memberIndex: 1, memberId: 10, firstName: 'Casey', lastName: 'Rivera', dateOfBirth: '2016-01-01' },
    { memberIndex: 2, memberId: 11, firstName: 'Alex', lastName: 'Rivera', dateOfBirth: '2018-01-01' },
  ]
  const result = { purpose: 'trial', trialRegistration: true, facilityId: 1, payerMemberId: 9, memberIds: [9, 10, 11], pendingEnrollments: [], trialChildren: children, trialBookings: [] as Record<string, unknown>[] }
  await page.clock.setFixedTime(new Date('2026-11-23T15:00:00Z'))
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let data: unknown = []
    if (path.endsWith('/lead/8/session')) data = {
      purpose: 'trial', facilityId: 1, session: 'proof', username: 'jordanr',
      guardian: { firstName: 'Jordan', lastName: 'Rivera', email: 'parent@example.test', phone: '2025550101' },
      children: children.map(({ firstName, lastName, dateOfBirth }) => ({ firstName, lastName, dateOfBirth, gender: 'female' })),
      selections: [], waivers: [{ id: 1, name: 'Test waiver', body: 'Fixture waiver', version: '1', is_required: true }],
      completed, result: completed ? result : undefined, instructions: '', expiresAt: '2027-01-01',
    }
    if (path.endsWith('/lead/8/complete')) {
      completion = request.postDataJSON()
      completed = true
      data = result
    }
    if (path === '/api/members/login') return route.fulfill({ json: { success: true, token: 'member-token', member: { id: 9, firstName: 'Jordan', lastName: 'Rivera', availablePortals: ['member'] } } })
    if (path === '/api/public/free-trials') {
      availabilityRequests.push(request.url())
      expect(completed).toBe(true)
      const program = new URL(request.url()).searchParams.get('program')
      data = { program, sessions: [
        { classId: 20, className: program === 'fit-flip' ? 'Cyclones 8–11' : 'Tornadoes', slotGroupId: 30, date: '2026-12-01', startTime: '16:00', endTime: '17:00', isFull: false, facilityId: 1, timeZone: 'America/New_York' },
        { classId: 21, className: 'Other facility class', slotGroupId: 31, date: '2026-12-02', startTime: '16:00', endTime: '17:00', isFull: false, facilityId: 2 },
        { classId: 22, className: 'Full class', slotGroupId: 32, date: '2026-12-03', startTime: '16:00', endTime: '17:00', isFull: true, facilityId: 1 },
      ] }
    }
    if (path.endsWith('/lead/8/trial')) {
      const body = request.postDataJSON()
      bookingRequests.push(body)
      const child = children.find(child => child.memberIndex === body.freeTrial.memberIndex)!
      const booking = { id: child.memberId + 100, memberId: child.memberId, status: 'confirmed', benefitType: 'free_trial', totalCents: 0, classDate: body.freeTrial.classDate, className: 'Tornadoes', startTime: '16:00', endTime: '17:00' }
      result.trialBookings.push(booking)
      data = booking
    }
    await route.fulfill({ json: { success: true, data } })
  })
  await page.goto('/signup/lead?invite=8&token=fixture-token')
  await page.getByLabel('Username', { exact: true }).fill('jordanr')
  await page.getByLabel('Password', { exact: true }).fill('Temporary123')
  await page.getByRole('button', { name: 'Sign in to finish registration' }).click()
  await expect(page.getByRole('heading', { name: 'Register for your free trial' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Find trial dates' })).toHaveCount(0)
  await page.getByPlaceholder('Street address *').fill('100 Test Street')
  await page.getByPlaceholder('City *').fill('Albany')
  await page.locator('select').filter({ has: page.locator('option[value="NY"]') }).selectOption('NY')
  await page.getByPlaceholder('ZIP *').fill('12207')
  await page.getByRole('textbox', { name: 'Date of Birth', exact: true }).fill('01/01/1988')
  await page.getByRole('combobox', { name: 'Gender', exact: true }).selectOption('female')
  await page.getByPlaceholder('Username *', { exact: true }).fill('jordan')
  await page.getByPlaceholder('Password *', { exact: true }).fill('NewPassword123!')
  await page.getByPlaceholder('Confirm password *', { exact: true }).fill('NewPassword123!')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Program enrollment' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Find trial dates' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Save information & choose trial dates' }).click()
  await expect(page.getByRole('alert')).toContainText('Please agree')
  expect(completion).toBeNull()
  expect(availabilityRequests).toHaveLength(0)
  await page.getByRole('checkbox').first().check()
  await page.getByRole('checkbox', { name: 'I AGREE TO THE SELECTED WAIVERS ABOVE' }).check()
  await page.getByPlaceholder('Legal name').fill('Jordan Rivera')
  await page.getByRole('button', { name: 'Save information & choose trial dates' }).click()
  await expect(page.getByRole('heading', { name: 'Choose your free trial dates' })).toBeVisible()
  expect(completion).toMatchObject({ token: 'fixture-token', session: 'proof', enrollments: [], waivers: { acceptedTemplateIds: [1], signatureName: 'Jordan Rivera' } })
  const casey = page.getByRole('region', { name: 'Casey Rivera' })
  await casey.getByLabel('Gymnastics experience').selectOption('none')
  await casey.getByRole('button', { name: 'Find trial dates' }).click()
  await expect(casey.getByLabel('Free trial class and date for Casey').locator('option')).toHaveCount(3)
  await expect(casey.getByLabel('Free trial class and date for Casey').locator('option').filter({ hasText: 'Other facility' })).toHaveCount(0)
  await expect(casey.getByLabel('Free trial class and date for Casey').locator('option[value="32:2026-12-03"]')).toHaveAttribute('disabled', '')
  await casey.getByLabel('Free trial class and date for Casey').selectOption('30:2026-12-01')
  await casey.getByRole('button', { name: 'Confirm free trial · $0' }).click()
  await expect(casey.getByRole('status')).toContainText('Free trial confirmed')
  expect(bookingRequests[0]).toMatchObject({ token: 'fixture-token', session: 'proof', freeTrial: { memberIndex: 1, program: 'gymnastics', slotGroupId: 30, classDate: '2026-12-01', gymnasticsTrack: 'beginner', experience: 'none' } })
  const alex = page.getByRole('region', { name: 'Alex Rivera' })
  await alex.getByLabel('Program for Alex').selectOption('fit-flip')
  await alex.getByRole('button', { name: 'Find trial dates' }).click()
  await alex.getByLabel('Free trial class and date for Alex').selectOption('30:2026-12-01')
  await alex.getByRole('button', { name: 'Confirm free trial · $0' }).click()
  await expect(alex.getByRole('status')).toContainText('Free trial confirmed')
  expect(bookingRequests[1]).toMatchObject({ freeTrial: { memberIndex: 2, program: 'fit-flip' } })
  await expect(page).toHaveURL('/signup/lead?invite=8&token=fixture-token')
  await page.reload()
  await page.getByLabel('Username', { exact: true }).fill('jordan')
  await page.getByLabel('Password', { exact: true }).fill('NewPassword123!')
  await page.getByRole('button', { name: 'Sign in to finish registration' }).click()
  await expect(page.getByText('Free trial confirmed · $0', { exact: true })).toHaveCount(2)
  await expect(page.getByRole('button', { name: 'Confirm free trial · $0' })).toHaveCount(0)
})

test('trial invitees with gymnastics experience choose a private evaluation and retain its confirmation', async ({ page }) => {
  const requests: Record<string, unknown>[] = []
  const queries: URLSearchParams[] = []
  const bookings: Record<string, unknown>[] = []
  await page.clock.setFixedTime(new Date('2026-11-23T15:00:00Z'))
  await page.route('**/api/**', async route => {
    const request = route.request()
    const path = new URL(request.url()).pathname
    let data: unknown = []
    if (path.endsWith('/lead/8/session')) data = {
      purpose: 'trial', facilityId: 1, session: 'proof', username: 'jordan', completed: true,
      guardian: { firstName: 'Jordan', lastName: 'Rivera', email: 'parent@example.test', phone: '2025550101' },
      children: [], selections: [], waivers: [], instructions: '', expiresAt: '2027-01-01',
      result: { purpose: 'trial', trialRegistration: true, facilityId: 1, payerMemberId: 9, pendingEnrollments: [],
        trialChildren: [{ memberIndex: 1, memberId: 10, firstName: 'Casey', lastName: 'Rivera', dateOfBirth: '2021-01-01' }], trialBookings: bookings },
    }
    if (path === '/api/members/login') return route.fulfill({ json: { success: true, token: 'member-token', member: { id: 9, firstName: 'Jordan', lastName: 'Rivera', availablePortals: ['member'] } } })
    if (path === '/api/public/free-trials') {
      const query = new URL(request.url()).searchParams
      queries.push(query)
      data = { program: 'gymnastics', sessions: [
        { classId: 20, className: 'Trial Assessment', slotGroupId: 30, date: '2026-12-03', startTime: '16:00', endTime: '16:30', isFull: false, isTrialAssessment: true, maxParticipants: 1, facilityId: 1, timeZone: 'America/New_York' },
      ] }
    }
    if (path.endsWith('/lead/8/trial')) {
      const body = request.postDataJSON()
      requests.push(body)
      data = { id: 110, memberId: 10, status: 'confirmed', benefitType: 'free_trial', totalCents: 0,
        classDate: body.freeTrial.classDate, className: 'Trial Assessment', startTime: '16:00', endTime: '16:30', isTrialAssessment: true }
      bookings.push(data as Record<string, unknown>)
    }
    await route.fulfill({ json: { success: true, data } })
  })
  const signIn = async () => {
    await page.getByLabel('Username', { exact: true }).fill('jordan')
    await page.getByLabel('Password', { exact: true }).fill('CurrentPassword123!')
    await page.getByRole('button', { name: 'Sign in to finish registration' }).click()
  }
  await page.goto('/signup/lead?invite=8&token=fixture-token')
  await signIn()
  const child = page.getByRole('region', { name: 'Casey Rivera' })
  await expect(child.getByRole('button', { name: 'Find trial dates' })).toBeDisabled()
  expect(queries).toEqual([])
  await child.getByLabel('Gymnastics experience').selectOption('experienced')
  await expect(child.getByText(/free private 30-minute evaluation, 1:1 with a coach/)).toBeVisible()
  await child.getByRole('button', { name: 'Find evaluation times' }).click()
  expect(queries.map(query => [query.get('gymnasticsTrack'), query.get('experience')])).toEqual([['experienced', 'experienced']])
  await child.getByLabel('Private evaluation time for Casey').selectOption('30:2026-12-03')
  await child.getByRole('button', { name: 'Confirm free evaluation · $0' }).click()
  await expect(child.getByRole('status')).toContainText('Private evaluation confirmed · $0')
  expect(requests).toEqual([{ token: 'fixture-token', session: 'proof', freeTrial: {
    memberIndex: 1, program: 'gymnastics', slotGroupId: 30, classDate: '2026-12-03', gymnasticsTrack: 'experienced', experience: 'experienced',
  } }])
  await page.reload()
  await signIn()
  await expect(child.getByRole('status')).toContainText('Private evaluation confirmed · $0')
  await expect(child.getByRole('status')).toContainText('30 minutes · 1:1 with a coach')
})
