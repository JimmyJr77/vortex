import { expect, test, type Page, type Route } from '@playwright/test'

const member = { id: 10, fullName: 'Jordan Rivera', firstName: 'Jordan', lastName: 'Rivera', availablePortals: ['member'] }
const required = { id: 2, name: 'Updated liability waiver', body: 'Current liability terms.', version: '2', is_required: true, acceptance_id: null as number | null }
const optional = { id: 3, name: 'Optional media release', body: 'Optional media terms.', version: '1', is_required: false, acceptance_id: null as number | null }

async function setup(page: Page, {
  current = false, restored = false, staff = false, readFailure = false, saveFailure = false,
  completionFailure = false, existingSigned = false, paymentPolicy = false,
} = {}, returningPage?: Page) {
  const account = staff ? { ...member, availablePortals: ['admin'] } : member
  let waivers = [
    ...(existingSigned ? [{ ...required, id: 1, name: 'Previously signed waiver', acceptance_id: 10 }] : []),
    { ...required, acceptance_id: current ? 20 : null, waiver_type: paymentPolicy ? 'PAYMENT_POLICY' : 'RELEASE_OF_LIABILITY' },
    optional,
  ]
  const state = {
    reads: 0, readsAfterSigning: 0, completions: 0,
    readFailure, saveFailure, completionFailure,
    writes: [] as Record<string, unknown>[],
  }
  if (restored) await page.addInitScript(account => {
    localStorage.setItem('vortex_member_token', 'waiver-test-token')
    localStorage.setItem('vortex_member', JSON.stringify({ ...account, requiresInitialWaiverCheck: true }))
  }, account)
  const handleApi = async (route: Route) => {
    const path = new URL(route.request().url()).pathname
    const respond = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/api/members/login') return respond({
      success: true,
      token: 'waiver-test-token',
      member: { ...account, requiresInitialWaiverCheck: !staff && state.completions === 0 },
    })
    if (path === '/api/members/waivers') {
      state.reads++
      if (waivers.some(waiver => waiver.acceptance_id === 42)) state.readsAfterSigning++
      expect(route.request().headers().authorization).toBe('Bearer waiver-test-token')
      if (state.readFailure) return respond({ success: false, message: 'Unavailable' }, 503)
      return respond({ success: true, data: waivers })
    }
    if (path === '/api/members/waivers/accept-all') {
      const payload = route.request().postDataJSON()
      state.writes.push(payload)
      if (state.saveFailure) return respond({ success: false, message: 'Unable to save. Please try again.' }, 503)
      waivers = waivers.map(waiver => payload.acceptedTemplateIds.includes(waiver.id) ? { ...waiver, acceptance_id: 42 } : waiver)
      return respond({ success: true, data: { acceptances: [] } })
    }
    if (path === '/api/members/waivers/initial-check/complete') {
      expect(route.request().method()).toBe('POST')
      expect(route.request().headers().authorization).toBe('Bearer waiver-test-token')
      if (state.completionFailure) return respond({ success: false }, 503)
      state.completions++
      return respond({ success: true })
    }
    let data: unknown = []
    if (path === '/api/members/me') data = { ...member, familyMembers: [], enrollments: [], isActive: true }
    if (path.endsWith('/portal-config')) data = { hiddenTabs: [], tabOrder: ['home', 'waivers'] }
    if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 }
    if (path === '/api/admin/access/me') data = { user: member, permissions: [], roles: ['ADMIN'], isMasterAdmin: true }
    return respond({ success: true, data })
  }
  await page.route('**/api/**', handleApi)
  await returningPage?.route('**/api/**', handleApi)
  return state
}

async function login(page: Page, path = '/') {
  await page.goto(path)
  if (path.includes('?sport=soccer')) {
    await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    await page.getByRole('button', { name: 'Account Login', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'Necessary only', exact: true }).click()
    if (path !== '/store' && (page.viewportSize()?.width ?? 1280) < 861) {
      await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    }
    await page.getByRole('button', { name: path === '/store' ? 'Account login' : 'Member login', exact: true }).click()
  }
  await page.getByLabel('Email, username, or phone number', { exact: true }).fill('jordan')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
}

async function enterRestoredPortal(page: Page) {
  const consent = page.getByRole('button', { name: 'Necessary only', exact: true })
  if (await consent.isVisible()) await consent.click()
  if ((page.viewportSize()?.width ?? 1280) < 861) await page.getByRole('button', { name: 'Open menu', exact: true }).click()
  await page.getByRole('button', { name: 'My portal', exact: true }).click()
}

async function signRequired(page: Page) {
  await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toBeVisible()
  const agreement = page.getByRole('checkbox', { name: /agree to Updated liability waiver/ })
  if (!await agreement.isVisible()) await page.getByRole('heading', { name: 'Updated liability waiver', exact: true }).click()
  await agreement.check()
  await page.getByRole('checkbox', { name: 'I AGREE TO THE SELECTED WAIVERS ABOVE', exact: true }).check()
  await page.getByLabel('Full Name (signature)', { exact: true }).fill('Jordan Rivera')
  await page.getByRole('button', { name: 'Sign waivers and continue' }).click()
}

test('outdated waivers appear before the portal and only explicitly selected waivers are signed', async ({ page }) => {
  const state = await setup(page)
  await login(page)
  await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign waivers and continue' }).click()
  await expect(page.getByRole('alert')).toHaveText('Please agree to Updated liability waiver.')
  expect(state.writes).toEqual([])
  await signRequired(page)
  await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toBeVisible()
  expect(state.readsAfterSigning).toBeGreaterThanOrEqual(1)
  expect(state.completions).toBe(1)
  expect(state.writes).toEqual([{ signatureName: 'Jordan Rivera', comments: '', acceptedTemplateIds: [2], paymentPolicyAcknowledged: false }])
})

test('current required waivers bypass the prompt even with an unsigned optional waiver', async ({ page }) => {
  const state = await setup(page, { current: true })
  await login(page)
  await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toHaveCount(0)
  expect(state.reads).toBeGreaterThanOrEqual(1)
  expect(state.completions).toBe(1)
  expect(state.writes).toEqual([])
})

test('restoring a session with a pending first sign-in check makes no automatic waiver request', async ({ page }) => {
  const state = await setup(page, { restored: true })
  await page.goto('/')
  await enterRestoredPortal(page)
  await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toBeVisible()
  expect(state.reads).toBe(0)
  expect(state.completions).toBe(0)
})

test('skipping the first sign-in prompt on mobile prevents checks after reload and on a new browser session', async ({ page, browser, baseURL }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const returningPage = await browser.newPage({ baseURL })
  try {
    const state = await setup(page, {}, returningPage)
    await login(page)
    await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toBeVisible()
    expect(await page.getByRole('main').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true)
    await page.getByRole('button', { name: 'Continue without signing' }).click()
    await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toBeVisible()
    expect(state.completions).toBe(1)
    const firstSignInReads = state.reads
    expect(firstSignInReads).toBeGreaterThanOrEqual(1)

    await page.reload()
    await enterRestoredPortal(page)
    await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toBeVisible()
    expect(state.reads).toBe(firstSignInReads)

    await login(returningPage)
    await expect(returningPage.getByRole('heading', { name: 'Member portal', exact: true })).toBeVisible()
    expect(state.reads).toBe(firstSignInReads)
    expect(state.completions).toBe(1)
    expect(state.writes).toEqual([])
  } finally {
    await returningPage.close()
  }
})

test('failed status checks offer retry instead of reporting waivers current', async ({ page }) => {
  const state = await setup(page, { readFailure: true })
  await login(page)
  await expect(page.getByRole('alert')).toContainText('Unable to check your waivers')
  await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Continue without signing' })).toHaveCount(0)
  expect(state.completions).toBe(0)
  state.readFailure = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toBeVisible()
})

test('failed signing keeps entered consent and does not continue until a successful retry', async ({ page }) => {
  const state = await setup(page, { saveFailure: true })
  await login(page)
  await signRequired(page)
  await expect(page.getByRole('alert')).toHaveText('Unable to save. Please try again.')
  await expect(page.getByLabel('Full Name (signature)', { exact: true })).toHaveValue('Jordan Rivera')
  state.saveFailure = false
  await page.getByRole('button', { name: 'Sign waivers and continue' }).click()
  await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toBeVisible()
})

test('retrying a failed completion does not check waivers again', async ({ page }) => {
  const state = await setup(page, { current: true, completionFailure: true })
  await login(page)
  await expect(page.getByRole('alert')).toHaveText('Unable to finish waiver setup. Please try again.')
  expect(state.completions).toBe(0)
  const reads = state.reads
  expect(reads).toBeGreaterThanOrEqual(1)

  state.completionFailure = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toBeVisible()
  expect(state.reads).toBe(reads)
  expect(state.completions).toBe(1)
  expect(state.writes).toEqual([])
})

test('staff without member access are not asked for athlete waivers', async ({ page }) => {
  const state = await setup(page, { staff: true })
  await login(page)
  await expect(page.getByRole('button', { name: 'Switch portal account' })).toBeVisible()
  expect(state.reads).toBe(0)
})

test('storefront login returns to the store after the waiver prompt', async ({ page }) => {
  await setup(page)
  await login(page, '/store')
  await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toBeVisible()
  await signRequired(page)
  await expect(page.getByRole('button', { name: 'Member Portal', exact: true })).toBeVisible()
  await expect(page).toHaveURL(/\/store$/)
  await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toHaveCount(0)
})

test('renewals leave existing signatures alone and acknowledge a selected payment policy', async ({ page }) => {
  const state = await setup(page, { existingSigned: true, paymentPolicy: true })
  await login(page)
  await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toBeVisible()
  await signRequired(page)
  await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toBeVisible()
  expect(state.writes[0]).toMatchObject({ acceptedTemplateIds: [2], paymentPolicyAcknowledged: true })
})

for (const sport of ['gymnastics', 'soccer']) {
  test(`${sport} login also prompts before showing the member portal`, async ({ page }) => {
    await setup(page)
    await login(page, `/?sport=${sport}`)
    await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toHaveCount(0)
    await signRequired(page)
    await expect(page.getByRole('heading', { name: 'Member portal', exact: true })).toBeVisible()
  })
}
