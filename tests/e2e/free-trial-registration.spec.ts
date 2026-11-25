import { expect, test, type Page } from '@playwright/test'

const waivers = [
  { id: 11, name: 'Participation waiver', version: '1', body: 'Test waiver text, with no legal effect.', is_required: true, waiver_type: 'LIABILITY' },
  { id: 12, name: 'Gym policies', version: '1', body: 'Test policies, with no legal effect.', is_required: true, waiver_type: 'PAYMENT_POLICY' },
]
const confirmedBooking = { id: 400, memberId: 102, status: 'confirmed', benefitType: 'free_trial', totalCents: 0, slotGroupId: 200, classDate: '2027-01-12' }

async function mockTrialApi(page: Page, confirmation = true) {
  const submitted: { path: string; body: Record<string, unknown> }[] = []
  await page.route('**/api/**', route => {
    const { pathname } = new URL(route.request().url())
    if (route.request().method() === 'POST') submitted.push({ path: pathname, body: route.request().postDataJSON() })
    let response: unknown = { success: true, data: [] }
    if (pathname.startsWith('/api/consent/sync')) response = { success: true, consent: null }
    if (pathname === '/api/public/free-trials') response = {
      success: true,
      data: {
        program: 'fit-flip', age: 10, ageBand: { min: 8, max: 11 }, classes: [],
        sessions: [{
          classId: 104, slotGroupId: 200, className: 'Cyclones', date: '2027-01-12',
          startTime: '16:00:00', endTime: '17:00:00', enrolledCount: 3, spotsRemaining: 4, isFull: false,
        }],
      },
    }
    if (pathname === '/api/signup/waivers') response = { success: true, data: waivers }
    if (pathname === '/api/signup/family') response = { success: true, data: { completedDropIn: confirmation ? confirmedBooking : { ...confirmedBooking, status: 'payment_pending' } } }
    if (pathname === '/api/members/login') response = { success: true, token: 'test-parent-token', member: { id: 101, firstName: 'Test', lastName: 'Parent' } }
    if (pathname === '/api/members/family') response = {
      success: true, householdAccess: { canAddFamilyMembers: true }, familyMembers: [
        { id: '101', first_name: 'Test', last_name: 'Parent', ageGroup: 'adult', date_of_birth: '1985-01-01', canSignWaiver: true },
        { id: '102', first_name: 'Test', last_name: 'Child', ageGroup: 'youth', date_of_birth: '2016-01-01', canSignWaiver: true },
        { id: '103', first_name: 'Other', last_name: 'Child', ageGroup: 'youth', date_of_birth: '2016-01-01', canSignWaiver: false },
      ],
    }
    if (pathname === '/api/members/free-trials/register') response = { success: true, data: confirmation ? confirmedBooking : { ...confirmedBooking, status: 'payment_pending' } }
    return route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify(response) })
  })
  return submitted
}

async function completeGuardianAndChild(page: Page, mommyMe = false) {
  await page.getByPlaceholder('First name *', { exact: true }).fill('Test')
  await page.getByPlaceholder('Last name *', { exact: true }).fill('Parent')
  await page.getByPlaceholder('Email *', { exact: true }).fill('trial-test@example.invalid')
  await page.getByRole('textbox', { name: 'Phone number' }).fill('4105550101')
  await page.getByPlaceholder('Street address *', { exact: true }).fill('123 Test Lane')
  await page.getByPlaceholder('City *', { exact: true }).fill('Test City')
  await page.locator('select[autocomplete="address-level1"]').selectOption('MD')
  await page.getByPlaceholder('ZIP *', { exact: true }).fill('21001')
  await page.getByLabel('Date of Birth', { exact: false }).fill('01/01/1985')
  await page.getByRole('combobox', { name: 'Gender' }).selectOption('prefer-not-to-say')
  await page.getByPlaceholder('Username *', { exact: true }).fill('trialtestparent')
  await page.getByPlaceholder('Password *', { exact: true }).fill('FixturePassword123')
  await page.getByPlaceholder('Confirm password *', { exact: true }).fill('FixturePassword123')
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText('Step 2 of 3')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Add member' })).toHaveCount(0)
  await page.getByPlaceholder('First name *', { exact: true }).fill('Test')
  await page.getByPlaceholder('Last name *', { exact: true }).fill('Child')
  await page.getByLabel('Date of Birth', { exact: false }).fill(mommyMe ? '01/01/2024' : '01/01/2016')
  await page.getByRole('combobox', { name: 'Gender' }).selectOption('prefer-not-to-say')
  if (mommyMe) {
    const confirmation = page.getByRole('checkbox', { name: /confirm that my child is potty trained/ })
    await expect(confirmation).not.toBeChecked()
    await page.getByRole('button', { name: 'Continue', exact: true }).click()
    await expect(page.getByRole('alert')).toContainText('confirm that their child is potty trained')
    await confirmation.check()
  }
  await page.getByRole('button', { name: 'Continue', exact: true }).click()
  await expect(page.getByText('Step 3 of 3')).toBeVisible()
}

async function signTestWaivers(page: Page) {
  await page.getByRole('checkbox', { name: "I've read the above and agree to Participation waiver" }).check()
  await page.getByRole('checkbox', { name: "I've read the above and agree to Gym policies" }).check()
  await page.getByRole('checkbox', { name: 'I AGREE TO THE SELECTED WAIVERS ABOVE', exact: true }).check()
  await page.getByLabel('Full Name (signature)', { exact: true }).fill('Test Parent')
}

test('a trial fragment opens the selected program and preserves the campaign URL', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const requests: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/public/free-trials') requests.push(request.url())
  })
  const chooser = page.getByRole('dialog', { name: 'How old is your athlete?' })
  for (const { path, info, link, program } of [
    { path: '/gymnastics', info: 'first-visit', link: 'Find a free gymnastics trial', program: 'Gymnastics' },
    { path: '/fit-and-flip', info: 'training-fit', link: 'Find a free Fit & Flip trial', program: 'Fit & Flip' },
  ]) {
    const url = `${path}?utm_source=trial-link`
    await page.goto(`${url}#${info}`)
    const action = page.locator('.np-program-hero').getByRole('link', { name: link })
    await expect(action).toHaveAttribute('href', '#open-free-trial')
    await expect(chooser).toHaveCount(0)

    await page.goto(`${url}#open-free-trial`)
    await expect(chooser.getByText(program, { exact: true })).toBeVisible()
    await expect(page).toHaveURL(`${url}#open-free-trial`)
    await chooser.getByRole('button', { name: 'Close dialog' }).click()
    await expect(chooser).toHaveCount(0)
    await expect(page.locator('#open-free-trial')).toBeFocused()

    await action.press('Enter')
    await expect(chooser.getByText(program, { exact: true })).toBeVisible()
    await chooser.getByRole('button', { name: 'Close dialog' }).click()
    await expect(action).toBeFocused()
  }
  expect(requests).toEqual([])
})

test('the tumbling guide opens the gymnastics trial finder for both placement paths', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const chooser = page.getByRole('dialog', { name: 'How old is your athlete?' })
  for (const [label, anchor] of [
    ['Find a beginner gymnastics trial', 'open-free-trial'],
    ['Find a Trial Assessment', 'open-free-trial-class-placement'],
  ]) {
    await page.goto('/blog/gymnastics-vs-tumbling')
    await page.getByRole('link', { name: label, exact: true }).click()
    await expect(page).toHaveURL(`/gymnastics#${anchor}`)
    await expect(chooser.getByText('Gymnastics', { exact: true })).toBeVisible()
  }
})

test('the Fit & Flip trial finder gives younger and older youth a gymnastics path after an empty result', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const requests: string[] = []
  await page.route('**/api/public/free-trials?*', route => {
    const query = new URL(route.request().url()).searchParams
    requests.push(query.toString())
    return route.fulfill({ json: {
      success: true,
      data: { program: 'fit-flip', age: Number(query.get('age')), ageBand: null, classes: [], sessions: [] },
    } })
  })

  for (const age of [5, 6, 7, 8, 15, 16, 17]) {
    await page.goto('/fit-and-flip')
    await page.locator('.np-program-hero').getByRole('link', { name: 'Find a free Fit & Flip trial' }).click()
    const dialog = page.getByRole('dialog')
    await dialog.getByLabel('Your child’s age').fill(String(age))
    await dialog.getByRole('button', { name: 'Find available classes' }).click()
    const availability = page.getByRole('dialog', { name: 'Pick a day to try it.' })
    await expect(availability.getByRole('heading', { name: 'No trial dates available right now.' })).toBeVisible()
    const gymnastics = availability.getByRole('link', { name: 'Find a gymnastics starting class' })
    if ([6, 7, 16, 17].includes(age)) {
      await gymnastics.click()
      await expect(page).toHaveURL('/gymnastics#choose-a-class')
      await expect(availability).toHaveCount(0)
    } else {
      await expect(gymnastics).toHaveCount(0)
    }
  }
  expect(requests).toEqual([5, 6, 7, 8, 15, 16, 17].map(age => `program=fit-flip&age=${age}`))
})

test('a full gymnastics trial day offers open dates or an inquiry when every date is full', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  let allDatesFull = false
  await page.route('**/api/public/free-trials?*', route => {
    const params = new URL(route.request().url()).searchParams
    const session = { classId: 1, slotGroupId: 20, className: 'Dirt Devils', startTime: '16:00:00', endTime: '17:00:00', enrolledCount: 6 }
    return route.fulfill({ json: {
      success: true,
      data: {
        program: 'gymnastics', age: 2, ageBand: { min: 2, max: 3 }, classes: [],
        gymnasticsRouting: { track: 'mommy-me' },
        sessions: params.has('gymnasticsTrack') ? [
          { ...session, date: '2027-01-15', spotsRemaining: 0, isFull: true },
          { ...session, date: '2027-01-19', spotsRemaining: allDatesFull ? 0 : 2, isFull: allDatesFull },
        ] : [],
      },
    } })
  })

  await page.goto('/gymnastics#open-free-trial')
  const dialog = page.locator('dialog.np-dialog-trial[open]')
  await dialog.getByLabel('Your child’s age').fill('2')
  await dialog.getByRole('button', { name: 'Find available classes' }).click()
  await dialog.getByRole('button', { name: /^New to gymnastics/ }).click()
  await dialog.getByRole('button', { name: /^Yes, potty trained/ }).click()
  const openTrial = dialog.getByRole('button', { name: /Dirt Devils.*2 spots available/ })
  await expect(openTrial).toBeEnabled()

  await dialog.getByRole('button', { name: 'Friday', exact: true }).click()
  await expect(openTrial).toHaveCount(0)
  await expect(dialog.getByRole('button', { name: /Dirt Devils.*Class full/ })).toBeDisabled()
  await expect(dialog.getByRole('status')).toContainText('Other dates have openings.')
  await dialog.getByRole('button', { name: 'Show all trial dates' }).press('Enter')
  await expect(dialog.getByRole('button', { name: 'All days', exact: true })).toBeFocused()
  await expect(openTrial).toBeEnabled()

  allDatesFull = true
  await dialog.getByRole('button', { name: 'Refresh class availability' }).click()
  await expect(dialog.getByRole('status')).toContainText('All published trial dates are full.')
  await dialog.getByRole('link', { name: 'Ask about another trial date' }).click()
  await expect(page).toHaveURL('/contact#inquiry')
  await expect(dialog).toHaveCount(0)
  await expect(page.getByRole('heading', { name: 'What to include in your inquiry' })).toBeVisible()
})

test('mobile new-family trial requires waivers and registers the child without checkout', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const submitted = await mockTrialApi(page)
  await page.goto('/fit-and-flip?utm_source=google&utm_medium=cpc&utm_campaign=fit_flip&gclid=private-test-token')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await page.getByRole('checkbox', { name: /^Analytics/ }).check()
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await page.locator('.np-program-hero').getByRole('link', { name: 'Find a free Fit & Flip trial' }).click()
  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Your child’s age').fill('10')
  await dialog.getByRole('button', { name: 'Find available classes' }).click()
  await dialog.getByRole('button', { name: /Cyclones.*spot/ }).click()
  await dialog.getByRole('button', { name: 'Yes, use our free trial' }).click()
  await completeGuardianAndChild(page)
  await page.getByRole('button', { name: 'Confirm free trial · $0', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Please agree to Participation waiver.')
  expect(submitted.filter(item => item.path === '/api/signup/family')).toHaveLength(0)
  await signTestWaivers(page)
  await page.getByRole('button', { name: 'Confirm free trial · $0', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'You’re in. Let’s get moving.' })).toBeVisible()
  await expect(page.getByText('Tuesday, January 12, 2027', { exact: true })).toBeVisible()
  const signup = submitted.find(item => item.path === '/api/signup/family')!
  expect(signup.body.acquisition).toEqual({ source: 'google', medium: 'cpc', campaign: 'fit_flip', landingPath: '/fit-and-flip' })
  expect(signup.body.freeTrial).toEqual({ program: 'fit-flip', age: 10, slotGroupId: 200, classDate: '2027-01-12', memberIndex: 1 })
  expect(signup.body.enrollments).toEqual([])
  expect(signup.body.additionalMembers).toHaveLength(1)
  expect(signup.body.waivers).toMatchObject({ acceptedTemplateIds: [11, 12], signatureName: 'Test Parent', paymentPolicyAcknowledged: true })
  expect(submitted.filter(item => /billing|checkout|stripe/.test(item.path))).toEqual([])
  await expect.poll(() => submitted.filter(item => item.path === '/api/analytics/event')
    .flatMap(item => item.body.events as { eventName: string; pagePath: string }[])
    .filter(event => /^trial_confirm/.test(event.eventName))
    .map(event => [event.eventName, event.pagePath])).toEqual([
    ['trial_confirm_submit', '/fit-and-flip'], ['trial_confirmed', '/fit-and-flip'],
  ])
  expect(await page.locator('body').evaluate(body => body.scrollWidth <= window.innerWidth)).toBe(true)
})

test('existing guardian signs for an authorized child and receives the zero-dollar confirmation', async ({ page }) => {
  const submitted = await mockTrialApi(page)
  await page.goto('/tests/fixtures/free-trial.html')
  await page.getByRole('button', { name: 'Already a member' }).click()
  await page.getByLabel('Email or username').fill('trialtestparent')
  await page.getByLabel('Password', { exact: true }).fill('FixturePassword123')
  await page.getByRole('button', { name: 'Sign in and continue' }).click()
  await expect(page.getByRole('radio')).toHaveCount(1)
  await page.getByRole('radio', { name: /Test Child/ }).check()
  await page.getByRole('button', { name: 'Confirm free trial · $0' }).click()
  await expect(page.getByRole('alert')).toContainText('Please agree to Participation waiver.')
  expect(submitted.filter(item => item.path === '/api/members/free-trials/register')).toHaveLength(0)
  await signTestWaivers(page)
  await page.getByRole('button', { name: 'Confirm free trial · $0' }).click()
  await expect(page.getByRole('heading', { name: 'You’re in. Let’s get moving.' })).toBeVisible()
  expect(submitted.find(item => item.path === '/api/members/free-trials/register')?.body).toMatchObject({
    memberId: 102, program: 'fit-flip', slotGroupId: 200, classDate: '2027-01-12',
    waivers: { acceptedTemplateIds: [11, 12], signatureName: 'Test Parent', paymentPolicyAcknowledged: true },
  })
  expect(submitted.find(item => item.path === '/api/members/free-trials/register')?.body).not.toHaveProperty('acquisition')
  expect(submitted.filter(item => /billing|checkout|stripe/.test(item.path))).toEqual([])
})

test('an unconfirmed booking never produces a trial success or a checkout redirect', async ({ page }) => {
  const submitted = await mockTrialApi(page, false)
  await page.addInitScript(() => localStorage.setItem('vortex_member_token', 'test-parent-token'))
  await page.goto('/tests/fixtures/free-trial.html')
  await page.getByRole('radio', { name: /Test Child/ }).check()
  await signTestWaivers(page)
  await page.getByRole('button', { name: 'Confirm free trial · $0' }).click()
  await expect(page.getByRole('alert')).toContainText('We could not verify this free trial.')
  await expect(page.getByRole('heading', { name: 'You’re in. Let’s get moving.' })).toHaveCount(0)
  expect(submitted.filter(item => /billing|checkout|stripe/.test(item.path))).toEqual([])
  await expect(page).toHaveURL(/\/tests\/fixtures\/free-trial.html$/)
})

test('Mommy & Me requires a fresh guardian potty-training confirmation during new-family registration', async ({ page }) => {
  const submitted = await mockTrialApi(page)
  await page.goto('/tests/fixtures/free-trial.html?track=mommy-me')
  await completeGuardianAndChild(page, true)
  await signTestWaivers(page)
  await page.getByRole('button', { name: 'Confirm free trial · $0' }).click()
  await expect(page.getByRole('heading', { name: 'You’re in. Let’s get moving.' })).toBeVisible()
  expect(submitted.find(item => item.path === '/api/signup/family')?.body.freeTrial).toMatchObject({
    program: 'gymnastics', gymnasticsTrack: 'mommy-me', pottyTrained: true, memberIndex: 1,
  })
})

test('Mommy & Me also requires the existing guardian to reconfirm potty training', async ({ page }) => {
  const submitted = await mockTrialApi(page)
  await page.addInitScript(() => localStorage.setItem('vortex_member_token', 'test-parent-token'))
  await page.goto('/tests/fixtures/free-trial.html?track=mommy-me')
  await page.getByRole('radio', { name: /Test Child/ }).check()
  const confirmation = page.getByRole('checkbox', { name: /confirm that my child is potty trained/ })
  await expect(confirmation).not.toBeChecked()
  await signTestWaivers(page)
  await page.getByRole('button', { name: 'Confirm free trial · $0' }).click()
  await expect(page.getByRole('alert')).toContainText('confirm that their child is potty trained')
  expect(submitted.filter(item => item.path === '/api/members/free-trials/register')).toHaveLength(0)
  await confirmation.check()
  await page.getByRole('button', { name: 'Confirm free trial · $0' }).click()
  await expect(page.getByRole('heading', { name: 'You’re in. Let’s get moving.' })).toBeVisible()
  expect(submitted.find(item => item.path === '/api/members/free-trials/register')?.body).toMatchObject({
    memberId: 102, program: 'gymnastics', gymnasticsTrack: 'mommy-me', pottyTrained: true,
  })
})

async function mockGymnasticsPlacement(page: Page) {
  const queries: URLSearchParams[] = []
  const evaluationTimes = [
    ['2027-01-14', '16:00:00', '16:30:00'], ['2027-01-14', '16:30:00', '17:00:00'], ['2027-01-14', '17:00:00', '17:30:00'],
    ['2027-01-12', '19:30:00', '20:00:00'], ['2027-01-13', '19:30:00', '20:00:00'], ['2027-01-14', '19:30:00', '20:00:00'], ['2027-01-15', '19:30:00', '20:00:00'],
  ]
  await page.route('**/api/public/free-trials?*', async route => {
    const query = new URL(route.request().url()).searchParams
    queries.push(query)
    const age = Number(query.get('age'))
    const track = query.get('gymnasticsTrack')
    const sessions = track === 'experienced' ? evaluationTimes.map(([date, startTime, endTime], index) => ({
      classId: 104, className: 'Trial Assessment', slotGroupId: 200 + index, date, startTime, endTime,
      isTrialAssessment: true, maxParticipants: 1, enrolledCount: index === 0 ? 1 : 0,
      spotsRemaining: index === 0 ? 0 : 1, isFull: index === 0, facilityId: 1, timeZone: 'America/New_York',
    })) : track ? [{
      classId: 105, className: age <= 3 ? 'Mommy & Me' : age <= 5 ? 'Preschool' : 'Tornadoes',
      slotGroupId: 300, date: '2027-01-14', startTime: '16:00:00', endTime: '17:00:00',
      enrolledCount: 3, spotsRemaining: 5, isFull: false, facilityId: 1,
    }] : []
    await route.fulfill({ json: { success: true, data: {
      program: 'gymnastics', age, ageBand: null, classes: [], sessions,
      gymnasticsRouting: { track: age <= 3 ? 'mommy-me' : age <= 5 ? 'preschool' : 'school-age' },
    } } })
  })
  return queries
}

async function choosePrivateEvaluation(page: Page) {
  await page.goto('/gymnastics#open-free-trial')
  const dialog = page.locator('dialog.np-dialog-trial[open]')
  await dialog.getByLabel('Your child’s age').fill('10')
  await dialog.getByRole('button', { name: 'Find available classes' }).click()
  await expect(dialog.getByRole('heading', { name: 'Have they tried gymnastics?' })).toBeVisible()
  await dialog.getByRole('button', { name: /^Has gymnastics experience/ }).click()
  await expect(dialog.getByRole('heading', { name: 'Choose your private evaluation.' })).toBeVisible()
  await expect(dialog.getByText(/free private 30-minute evaluation, 1:1 with a coach/)).toBeVisible()
  await expect(dialog.locator('.np-trial-session')).toHaveCount(7)
  await expect(dialog.locator('.np-trial-session').filter({ hasText: '4:00 PM–4:30 PM' })).toBeDisabled()
  await dialog.getByRole('button', { name: 'Thursday', exact: true }).click()
  await dialog.locator('.np-trial-session').filter({ hasText: '4:30 PM–5:00 PM' }).click()
  await expect(dialog.getByText('1 athlete · 1:1 with a coach', { exact: true })).toBeVisible()
  await dialog.getByRole('button', { name: 'Book our free evaluation' }).click()
  return dialog
}

test('experienced gymnasts can book a free private 30-minute evaluation after new-family waivers', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const submitted = await mockTrialApi(page)
  const queries = await mockGymnasticsPlacement(page)
  await choosePrivateEvaluation(page)
  await expect(page.getByRole('heading', { name: 'Register for your free private evaluation' })).toBeVisible()
  await completeGuardianAndChild(page)
  await signTestWaivers(page)
  await page.getByRole('button', { name: 'Confirm free evaluation · $0' }).click()
  await expect(page.getByRole('heading', { name: 'Their private evaluation is booked.' })).toBeVisible()
  expect(queries.map(query => query.get('gymnasticsTrack'))).toEqual([null, 'experienced'])
  expect(submitted.find(item => item.path === '/api/signup/family')?.body.freeTrial).toEqual({
    program: 'gymnastics', age: 10, slotGroupId: 201, classDate: '2027-01-14', memberIndex: 1,
    gymnasticsTrack: 'experienced', experience: 'experienced',
  })
  expect(submitted.filter(item => /billing|checkout|stripe/.test(item.path))).toEqual([])
  expect(await page.locator('body').evaluate(body => body.scrollWidth <= window.innerWidth)).toBe(true)
})

test('existing guardians book the same evaluation with their child and current waivers', async ({ page }) => {
  const submitted = await mockTrialApi(page)
  await mockGymnasticsPlacement(page)
  await page.addInitScript(() => localStorage.setItem('vortex_member_token', 'test-parent-token'))
  await choosePrivateEvaluation(page)
  await page.getByRole('radio', { name: /Test Child/ }).check()
  await signTestWaivers(page)
  await page.getByRole('button', { name: 'Confirm free evaluation · $0' }).click()
  await expect(page.getByRole('heading', { name: 'Their private evaluation is booked.' })).toBeVisible()
  expect(submitted.find(item => item.path === '/api/members/free-trials/register')?.body).toMatchObject({
    memberId: 102, program: 'gymnastics', slotGroupId: 201, classDate: '2027-01-14',
    gymnasticsTrack: 'experienced', experience: 'experienced',
  })
  expect(submitted.filter(item => /billing|checkout|stripe/.test(item.path))).toEqual([])
})

for (const age of [3, 5]) {
  test(`gymnasts age ${age} answer the experience question before choosing a trial or evaluation`, async ({ page }) => {
    await mockTrialApi(page)
    const queries = await mockGymnasticsPlacement(page)
    await page.goto('/gymnastics#open-free-trial')
    const dialog = page.locator('dialog.np-dialog-trial[open]')
    await dialog.getByLabel('Your child’s age').fill(String(age))
    await dialog.getByRole('button', { name: 'Find available classes' }).click()
    await expect(dialog.getByRole('heading', { name: 'Have they tried gymnastics?' })).toBeVisible()
    const start = queries.length
    await dialog.getByRole('button', { name: /^New to gymnastics/ }).click()
    if (age === 3) await dialog.getByRole('button', { name: /^Yes, potty trained/ }).click()
    await expect(dialog.getByRole('heading', { name: 'Pick a day to try it.' })).toBeVisible()
    await expect(dialog.locator('.np-trial-session').filter({ hasText: age === 3 ? 'Mommy & Me' : 'Preschool' })).toBeEnabled()
    expect(queries.slice(start).map(query => [query.get('gymnasticsTrack'), query.get('experience')])).toEqual([[age === 3 ? 'mommy-me' : 'preschool', 'none']])
    await dialog.getByRole('button', { name: /Change your answers/ }).click()
    await dialog.getByRole('button', { name: /^Has gymnastics experience/ }).click()
    await expect(dialog.getByRole('heading', { name: 'Choose your private evaluation.' })).toBeVisible()
    await expect(dialog.locator('.np-trial-session')).toHaveCount(7)
    expect(queries.at(-1)?.get('experience')).toBe('experienced')
  })
}
