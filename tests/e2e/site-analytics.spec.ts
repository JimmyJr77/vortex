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
    const { pathname } = new URL(request.url())
    let data: unknown = []
    if (pathname === '/api/analytics/event' && request.method() === 'POST') {
      events.push(...(request.postDataJSON() as { events: SiteEvent[] }).events)
    }
    if (pathname.startsWith('/api/consent/sync')) {
      await route.fulfill({ json: { success: true, consent: null } })
      return
    }
    if (pathname === '/api/public/free-trials') data = {
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
  await expect(page.getByRole('heading', { name: 'Built for more.' })).toBeVisible()
  await page.getByRole('button', { name: 'Necessary only' }).click()
  await page.getByRole('link', { name: 'Explore programs', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Two programs. One higher standard.' })).toBeInViewport()
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

  const programs = page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Our programs' })
  await programs.click()
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
