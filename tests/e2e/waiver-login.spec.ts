import { expect, test, type Page } from '@playwright/test'

const member = { id: 10, fullName: 'Jordan Rivera', firstName: 'Jordan', lastName: 'Rivera', availablePortals: ['member'] }
const required = { id: 2, name: 'Updated liability waiver', body: 'Current liability terms.', version: '2', is_required: true, acceptance_id: null as number | null }
const optional = { id: 3, name: 'Optional media release', body: 'Optional media terms.', version: '1', is_required: false, acceptance_id: null as number | null }

async function setup(page: Page, {
  current = false, restored = false, staff = false, readFailure = false, saveFailure = false,
  existingSigned = false, paymentPolicy = false,
} = {}) {
  const account = staff ? { ...member, availablePortals: ['admin'] } : member
  let waivers = [
    ...(existingSigned ? [{ ...required, id: 1, name: 'Previously signed waiver', acceptance_id: 10 }] : []),
    { ...required, acceptance_id: current ? 20 : null, waiver_type: paymentPolicy ? 'PAYMENT_POLICY' : 'RELEASE_OF_LIABILITY' },
    optional,
  ]
  const state = { reads: 0, readFailure, saveFailure, writes: [] as Record<string, unknown>[] }
  if (restored) await page.addInitScript(account => {
    localStorage.setItem('vortex_member_token', 'waiver-test-token')
    localStorage.setItem('vortex_member', JSON.stringify(account))
  }, account)
  await page.route('**/api/**', async route => {
    const path = new URL(route.request().url()).pathname
    const respond = (body: unknown, status = 200) => route.fulfill({ status, contentType: 'application/json', body: JSON.stringify(body) })
    if (path === '/api/members/login') return respond({ success: true, token: 'waiver-test-token', member: account })
    if (path === '/api/members/waivers') {
      state.reads++
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
    let data: unknown = []
    if (path === '/api/members/me') data = { ...member, familyMembers: [], enrollments: [], isActive: true }
    if (path.endsWith('/portal-config')) data = { hiddenTabs: [], tabOrder: ['home', 'waivers'] }
    if (path.endsWith('/notifications')) data = { notifications: [], unreadCount: 0 }
    if (path === '/api/admin/access/me') data = { user: member, permissions: [], roles: ['ADMIN'], isMasterAdmin: true }
    return respond({ success: true, data })
  })
  return state
}

async function login(page: Page, path = '/') {
  await page.goto(path)
  if (!path.includes('?sport=')) await page.getByRole('button', { name: 'Necessary only', exact: true }).click()
  if (path.includes('?sport=soccer')) {
    await page.getByRole('button', { name: 'Open menu', exact: true }).click()
    await page.getByRole('button', { name: 'Account Login', exact: true }).click()
  } else {
    await page.getByRole('button', { name: 'Account login', exact: true }).click()
  }
  await page.getByLabel('Email, username, or phone number', { exact: true }).fill('jordan')
  await page.getByLabel('Password', { exact: true }).fill('test-password')
  await page.getByRole('button', { name: 'Login', exact: true }).click()
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
  await expect(page.getByRole('heading', { name: 'VORTEX MEMBER PORTAL' })).toHaveCount(0)
  await page.getByRole('button', { name: 'Sign waivers and continue' }).click()
  await expect(page.getByRole('alert')).toHaveText('Please agree to Updated liability waiver.')
  expect(state.writes).toEqual([])
  await signRequired(page)
  await expect(page.getByRole('heading', { name: 'VORTEX MEMBER PORTAL' })).toBeVisible()
  expect(state.reads).toBe(2)
  expect(state.writes).toEqual([{ signatureName: 'Jordan Rivera', comments: '', acceptedTemplateIds: [2], paymentPolicyAcknowledged: false }])
})

test('current required waivers bypass the prompt even with an unsigned optional waiver', async ({ page }) => {
  const state = await setup(page, { current: true })
  await login(page)
  await expect(page.getByRole('heading', { name: 'VORTEX MEMBER PORTAL' })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toHaveCount(0)
  expect(state.reads).toBeGreaterThanOrEqual(1)
  expect(state.writes).toEqual([])
})

test('restored sessions prompt on mobile and can defer without signing', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  const state = await setup(page, { restored: true })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toBeVisible()
  expect(await page.getByRole('main').evaluate(element => element.scrollWidth <= window.innerWidth)).toBe(true)
  await page.screenshot({ path: 'test-results/member-waivers-mobile.png' })
  await page.getByRole('button', { name: 'Remind me next time' }).click()
  await expect(page.getByRole('button', { name: 'Member Portal', exact: true })).toBeVisible()
  await page.reload()
  await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toBeVisible()
  expect(state.writes).toEqual([])
})

test('failed status checks offer retry instead of reporting waivers current', async ({ page }) => {
  const state = await setup(page, { restored: true, readFailure: true })
  await page.goto('/')
  await expect(page.getByRole('alert')).toContainText('Unable to check your waivers')
  await expect(page.getByRole('button', { name: 'Member Portal', exact: true })).toHaveCount(0)
  state.readFailure = false
  await page.getByRole('button', { name: 'Try again' }).click()
  await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toBeVisible()
})

test('failed signing keeps entered consent and does not continue until a successful retry', async ({ page }) => {
  const state = await setup(page, { restored: true, saveFailure: true })
  await page.goto('/')
  await signRequired(page)
  await expect(page.getByRole('alert')).toHaveText('Unable to save. Please try again.')
  await expect(page.getByLabel('Full Name (signature)', { exact: true })).toHaveValue('Jordan Rivera')
  state.saveFailure = false
  await page.getByRole('button', { name: 'Sign waivers and continue' }).click()
  await expect(page.getByRole('button', { name: 'Member Portal', exact: true })).toBeVisible()
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
  await expect(page.getByRole('heading', { name: 'VORTEX MEMBER PORTAL' })).toHaveCount(0)
})

test('renewals leave existing signatures alone and acknowledge a selected payment policy', async ({ page }) => {
  const state = await setup(page, { restored: true, existingSigned: true, paymentPolicy: true })
  await page.goto('/')
  await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toBeVisible()
  await signRequired(page)
  await expect(page.getByRole('button', { name: 'Member Portal', exact: true })).toBeVisible()
  expect(state.writes[0]).toMatchObject({ acceptedTemplateIds: [2], paymentPolicyAcknowledged: true })
})

for (const sport of ['gymnastics', 'soccer']) {
  test(`${sport} login also prompts before showing the member portal`, async ({ page }) => {
    await setup(page)
    await login(page, `/?sport=${sport}`)
    await expect(page.getByRole('heading', { name: 'Please complete your waivers' })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'VORTEX MEMBER PORTAL' })).toHaveCount(0)
    await signRequired(page)
    await expect(page.getByRole('heading', { name: 'VORTEX MEMBER PORTAL' })).toBeVisible()
  })
}
