import { expect, test, type Page } from '@playwright/test'

type SiteEvent = {
  eventId: string
  eventName: string
  pagePath: string
  visitorId: string
  sessionId: string
  referrer?: string
  consentAnalytics: boolean
  consentMarketing: boolean
  properties: Record<string, unknown>
  utm?: Record<string, string>
}

async function mockSite(page: Page) {
  const events: SiteEvent[] = []
  await page.route('**/api/**', async route => {
    const request = route.request()
    const { pathname, searchParams } = new URL(request.url())
    let data: unknown = []
    if (pathname === '/api/analytics/event' && request.method() === 'POST') {
      events.push(...(request.postDataJSON() as { events: SiteEvent[] }).events)
    }
    if (pathname.startsWith('/api/consent/sync')) {
      await route.fulfill({ json: { success: true, consent: null } })
      return
    }
    if (pathname === '/api/public/free-trials' && searchParams.get('program') === 'gymnastics') {
      const experienced = searchParams.get('gymnasticsTrack') === 'experienced'
      data = {
        program: 'gymnastics', age: 10, ageBand: { min: 6, max: 17 }, classes: [],
        gymnasticsRouting: { track: 'school-age' },
        sessions: experienced ? [{
          classId: 103, slotGroupId: 201, className: 'Trial Assessment', date: '2027-01-12',
          startTime: '16:00:00', endTime: '17:00:00', enrolledCount: 1, spotsRemaining: 2, isFull: false,
        }] : [],
      }
    } else if (pathname === '/api/public/free-trials') data = {
      program: 'fit-flip', age: 10, ageBand: { min: 8, max: 11 }, classes: [],
      sessions: [{
        classId: 104, slotGroupId: 200, className: 'Cyclones', date: '2027-01-12',
        startTime: '16:00:00', endTime: '17:00:00', enrolledCount: 3, spotsRemaining: 4, isFull: false,
      }],
    }
    await route.fulfill({ json: { success: true, data } })
  })
  return events
}

async function grantAnalyticsOnly(page: Page) {
  await page.getByRole('checkbox', { name: /^Analytics/ }).check()
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await expect(page.getByRole('button', { name: 'Open cookie settings' })).toBeVisible()
}

test('uses explicit analytics consent, preserves campaign labels and records one view per route', async ({ page, context }) => {
  const events = await mockSite(page)
  const query = '?utm_source=school_newsletter&utm_medium=email&utm_campaign=fall_trials&utm_term=visitor%40example.invalid&session_id=private-token'
  await page.goto('/' + query, { referer: 'https://search.example.invalid/path?email=visitor%40example.invalid' })
  await expect(page.getByRole('heading', { level: 1, name: 'Gymnastics & youth athletic training in Bowie, MD' })).toBeVisible()
  await page.getByRole('button', { name: 'Necessary only' }).click()
  await page.getByRole('link', { name: 'Explore programs', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Choose your program' })).toBeInViewport()
  expect(events).toEqual([])
  expect((await context.cookies()).some(cookie => /^_vortex_(vid|sid)$/.test(cookie.name))).toBe(false)
  expect(await page.evaluate(() => sessionStorage.getItem('vortex_utm'))).toBeNull()

  await page.getByRole('button', { name: 'Open cookie settings' }).click()
  await grantAnalyticsOnly(page)
  await expect.poll(() => events.filter(event => event.eventName === 'page_view')).toHaveLength(1)
  const landing = events.find(event => event.eventName === 'page_view')!
  expect(landing).toMatchObject({
    pagePath: '/', consentAnalytics: true, consentMarketing: false,
    referrer: 'https://search.example.invalid', properties: { device_type: 'desktop' },
    utm: { source: 'school_newsletter', medium: 'email', campaign: 'fall_trials' },
  })
  expect(JSON.stringify(landing)).not.toMatch(/secret|private-token|visitor@|session_id/)

  const navigation = page.getByRole('navigation', { name: 'Main navigation' })
  await navigation.locator('summary', { hasText: 'Our programs' }).click()
  await navigation.getByRole('link', { name: 'All programs', exact: true }).click()
  await page.getByRole('button', { name: 'Explore Gymnastics' }).first().click()
  await expect(page.getByRole('dialog', { name: 'Gymnastics' })).toBeVisible()
  await page.getByRole('button', { name: 'Close dialog' }).click()
  await page.evaluate(() => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' }))
  await expect.poll(() => events.some(event => event.eventName === 'scroll_depth' && event.properties.percent === 75)).toBe(true)
  await page.getByRole('link', { name: 'Privacy', exact: true }).click()
  await expect.poll(() => events.filter(event => event.eventName === 'page_view').map(event => event.pagePath)).toEqual(['/', '/privacy-policy'])
  expect(events.find(event => event.eventName === 'program_interest')?.properties).toMatchObject({ program_slug: 'gymnastics' })
  expect(events.some(event => event.eventName === 'page_engagement' && event.properties.page_view_id === landing.eventId && Number(event.properties.engaged_ms) >= 1000)).toBe(true)
  expect(events.some(event => event.eventName === 'web_vital' && event.properties.name === 'TTFB')).toBe(true)
  expect(events.filter(event => event.eventName === 'web_vital').every(event => event.pagePath === '/' && event.properties.page_view_id === landing.eventId)).toBe(true)
  expect(new Set(events.map(event => event.sessionId)).size).toBe(1)

  await page.getByRole('button', { name: 'Open cookie settings' }).click()
  await page.getByRole('checkbox', { name: /^Analytics/ }).uncheck()
  await page.getByRole('button', { name: 'Save preferences' }).click()
  await expect.poll(async () => (await context.cookies()).some(cookie => /^_vortex_(vid|sid)$/.test(cookie.name))).toBe(false)
  expect(await page.evaluate(() => sessionStorage.getItem('vortex_utm'))).toBeNull()
})

test('records trial decision points without collecting age, class dates, or a false conversion', async ({ page }) => {
  const events = await mockSite(page)
  await page.goto('/')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await grantAnalyticsOnly(page)

  await page.getByRole('button', { name: 'Book a free trial' }).click()
  await page.getByRole('button', { name: /Choose Fit & Flip/ }).click()
  await page.getByLabel('Your child’s age').fill('10')
  await page.getByRole('button', { name: 'Find available classes' }).click()
  await page.getByRole('button', { name: /Cyclones.*spot/ }).click()
  await page.getByRole('button', { name: 'Yes, use our free trial' }).click()
  await expect.poll(() => events.filter(event => /^trial_/.test(event.eventName)).map(event => event.eventName)).toEqual([
    'trial_start', 'trial_availability', 'trial_class_select', 'trial_registration_start',
  ])
  const trial = events.filter(event => event.eventName.startsWith('trial_'))
  expect(trial.find(event => event.eventName === 'trial_availability')?.properties).toEqual({ program_slug: 'fit-flip', outcome: 'available' })
  expect(JSON.stringify(trial.map(event => event.properties))).not.toMatch(/age|2027-01-12|cyclones|potty|slotGroupId|memberId/i)
})

test('opens a preselected trial from the program page and credits the signup to that page', async ({ page }) => {
  const events = await mockSite(page)
  await page.goto('/blog/athletic-development-young-athletes')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await grantAnalyticsOnly(page)
  await expect(page.getByRole('link', { name: 'See Fit & Flip drop-in dates' })).toHaveAttribute('href', '/drop-in?program=Fit%20%26%20Flip')
  await page.getByRole('link', { name: 'Find a free Fit & Flip trial' }).click()
  await expect(page).toHaveURL('/fit-and-flip#training-fit')

  const fitTrial = page.locator('#training-fit').getByRole('button', { name: 'Find a free Fit & Flip trial' })
  await fitTrial.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'How old is your athlete?' })).toBeVisible()
  await expect(dialog.getByText('Cyclones classes are grouped into ages 8–11 and 12–15.', { exact: false })).toBeVisible()
  await dialog.getByLabel('Your child’s age').fill('10')
  const availability = page.waitForRequest(request => new URL(request.url()).pathname === '/api/public/free-trials')
  await dialog.getByRole('button', { name: 'Find available classes' }).click()
  expect(new URL((await availability).url()).searchParams.get('program')).toBe('fit-flip')
  await dialog.getByRole('button', { name: /Cyclones.*spot/ }).click()
  await dialog.getByRole('button', { name: 'Yes, use our free trial' }).click()
  await expect.poll(() => events.filter(event => /^trial_/.test(event.eventName)).map(event => [event.eventName, event.pagePath])).toEqual([
    ['trial_start', '/fit-and-flip'], ['trial_availability', '/fit-and-flip'],
    ['trial_class_select', '/fit-and-flip'], ['trial_registration_start', '/fit-and-flip'],
  ])
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
  await expect(fitTrial).toBeFocused()

  await page.goto('/gymnastics#first-visit')
  const firstVisit = page.locator('#first-visit')
  await expect(firstVisit.getByText(/Plan for about 60 minutes.*Tornadoes trials for ages 6–17 last about 90 minutes/)).toBeVisible()
  await firstVisit.getByRole('button', { name: 'Find a free gymnastics trial' }).click()
  await expect(dialog.getByRole('heading', { name: 'How old is your athlete?' })).toBeVisible()
  await expect(dialog.getByText('We’ll show the gymnastics classes available for their age.', { exact: false })).toBeVisible()
  await dialog.getByRole('button', { name: 'Close dialog' }).click()
  await expect(dialog).toHaveCount(0)
})

test('takes experienced gymnasts from the comparison guide to Trial Assessment dates', async ({ page }) => {
  const events = await mockSite(page)
  await page.goto('/blog/gymnastics-vs-tumbling')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await grantAnalyticsOnly(page)

  await page.getByRole('link', { name: 'how coaches choose a gymnastics level' }).click()
  await expect(page).toHaveURL('/gymnastics#class-placement')
  const placement = page.locator('#class-placement')
  await expect(placement.getByRole('heading', { level: 2 })).toBeInViewport()
  await placement.getByRole('button', { name: 'Find a free Trial Assessment' }).click()

  const dialog = page.getByRole('dialog')
  await dialog.getByLabel('Your child’s age').fill('10')
  await dialog.getByRole('button', { name: 'Find available classes' }).click()
  await dialog.getByRole('button', { name: /^Has gymnastics experience/ }).click()
  await expect(dialog.getByRole('button', { name: /Trial Assessment.*spots available/ })).toBeEnabled()
  await expect.poll(() => events.find(event => event.eventName === 'trial_start')).toMatchObject({
    pagePath: '/gymnastics', properties: { program_slug: 'gymnastics', section: 'class_placement' },
  })
})
