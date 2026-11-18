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
    } else if (pathname === '/api/public/free-trials') {
      const age = Number(searchParams.get('age'))
      data = {
        program: 'fit-flip', age, ageBand: age >= 12 ? { min: 12, max: 15 } : { min: 8, max: 11 }, classes: [],
        sessions: [{
          classId: 104, slotGroupId: 200, className: age >= 12 ? 'Cyclones (12–15)' : 'Cyclones', date: '2027-01-12',
          startTime: '16:00:00', endTime: '17:00:00', enrolledCount: 3, spotsRemaining: 4, isFull: false,
        }],
      }
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

test('moves cross-domain consent out of requested URLs and restores the original section', async ({ page, context, baseURL }) => {
  await mockSite(page)
  const consentId = 'c_test_fragment_handoff'
  await context.addCookies([{ name: '_vortex_cid', value: consentId, url: baseURL! }])
  await page.goto('/support')

  const footer = page.getByRole('contentinfo')
  await expect(footer.getByRole('link', { name: 'Classes & Events' }))
    .toHaveAttribute('href', `https://vortexathletics.com/read-board#vcid=${consentId}`)
  await expect(footer.getByRole('link', { name: 'Drop-In Classes' }))
    .toHaveAttribute('href', `https://vortexathletics.com/drop-in#vcid=${consentId}`)
  const triadLink = footer.getByRole('link', { name: 'The Triad of Athleticism' })
  await expect(triadLink).toHaveAttribute('href', `https://vortexathletics.com/#vcid=${consentId}&anchor=triad`)
  const destination = new URL((await triadLink.getAttribute('href'))!)

  await context.clearCookies()
  const synced = page.waitForRequest(request => new URL(request.url()).pathname === `/api/consent/sync/${consentId}`)
  await page.goto('/?utm_campaign=training%20guide' + destination.hash)
  await synced
  await expect(page).toHaveURL('/?utm_campaign=training%20guide#triad')
  await expect(page.locator('#triad h2').first()).toBeInViewport()
  expect((await context.cookies()).find(cookie => cookie.name === '_vortex_cid')?.value).toBe(consentId)
})

test('still accepts legacy consent links while retaining filters, campaigns, and anchors', async ({ page, context }) => {
  await mockSite(page)
  const consentId = 'c_test_legacy_handoff'
  const synced = page.waitForRequest(request => new URL(request.url()).pathname === `/api/consent/sync/${consentId}`)
  await page.goto(`/read-board?program=Fit+%26+Flip&vcid=${consentId}&utm_source=club#schedule`)
  await synced
  await expect(page).toHaveURL('/read-board?program=Fit+%26+Flip&utm_source=club#schedule')
  const tabs = page.getByRole('navigation', { name: 'Browse classes and updates' })
  await expect(tabs.getByRole('link', { name: 'Schedule', exact: true })).toHaveAttribute('aria-current', 'location')
  expect((await context.cookies()).find(cookie => cookie.name === '_vortex_cid')?.value).toBe(consentId)
})

test('keeps mobile booking and consent choices reachable without opting in', async ({ page, context }) => {
  const events = await mockSite(page)
  await page.setViewportSize({ width: 360, height: 740 })
  const consent = page.getByRole('dialog', { name: 'Cookie consent' })

  for (const { path, name, role } of [
    { path: '/gymnastics', name: 'Find a free gymnastics trial', role: 'link' },
    { path: '/fit-and-flip', name: 'Browse Fit & Flip classes', role: 'link' },
    { path: '/adult-gymnastics', name: 'See Typhoons drop-in dates', role: 'link' },
  ] as const) {
    await page.goto(path)
    await expect(consent).toBeVisible()
    await page.evaluate(async () => { await document.fonts.ready })
    const target = page.getByRole(role, { name, exact: true }).first()
    await expect(target).toBeInViewport({ ratio: 1 })
    expect(await target.evaluate(element => {
      const { x, y, width, height } = element.getBoundingClientRect()
      return element.contains(document.elementFromPoint(x + width / 2, y + height / 2))
    })).toBe(true)
  }

  await page.setViewportSize({ width: 320, height: 568 })
  await page.goto('/gymnastics')
  await expect(consent).toBeVisible()
  await page.evaluate(async () => { await document.fonts.ready })
  expect((await consent.boundingBox())?.height).toBeLessThanOrEqual(140)
  await expect(consent.getByRole('link', { name: 'Privacy Policy' })).toBeInViewport({ ratio: 1 })

  const shortScreenTrial = page.locator('.np-program-hero').getByRole('link', { name: 'Find a free gymnastics trial', exact: true })
  await page.mouse.move(160, 300)
  await page.mouse.wheel(0, 240)
  await expect.poll(() => shortScreenTrial.evaluate(element => {
    const { x, y, width, height } = element.getBoundingClientRect()
    return element.contains(document.elementFromPoint(x + width / 2, y + height / 2))
  })).toBe(true)
  await expect(consent).toBeVisible()
  expect(await page.evaluate(() => localStorage.getItem('vortex_consent'))).toBeNull()

  const choices = ['Settings', 'Necessary only', 'Accept all']
    .map(name => consent.getByRole('button', { name, exact: true }))
  const boxes = await Promise.all(choices.map(choice => choice.boundingBox()))
  for (const box of boxes) {
    expect(box?.height).toBeGreaterThanOrEqual(44)
    expect(box?.width).toBeGreaterThanOrEqual(44)
    expect(box?.y).toBe(boxes[0]?.y)
  }
  await page.setViewportSize({ width: 320, height: 200 })
  await choices[0].click()
  await expect(consent.getByRole('checkbox', { name: /^Analytics/ })).not.toBeChecked()
  await expect(consent.getByRole('checkbox', { name: /^Marketing/ })).not.toBeChecked()
  const save = consent.getByRole('button', { name: 'Save preferences' })
  await save.scrollIntoViewIfNeeded()
  await expect(save).toBeInViewport({ ratio: 1 })
  await save.click()
  await expect(consent).toBeHidden()
  expect(events).toEqual([])
  expect((await context.cookies()).some(cookie => /^_vortex_(vid|sid)$/.test(cookie.name))).toBe(false)
})

test('uses explicit analytics consent, preserves campaign labels and records one view per route', async ({ page, context }) => {
  const events = await mockSite(page)
  const query = '?utm_source=school_newsletter&utm_medium=email&utm_campaign=fall_trials&utm_term=visitor%40example.invalid&session_id=private-token'
  await page.goto('/' + query, { referer: 'https://search.example.invalid/path?email=visitor%40example.invalid' })
  await expect(page.getByRole('heading', { level: 1, name: 'Gymnastics & youth athletic training in Bowie, MD' })).toBeVisible()
  await page.getByRole('button', { name: 'Necessary only' }).click()
  await page.getByRole('link', { name: 'Explore programs', exact: true }).click()
  await expect(page).toHaveURL('/' + query + '#starting-classes')
  await expect(page.getByRole('heading', { name: 'Find a class by age and experience' })).toBeInViewport()
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

  await page.getByRole('link', { name: 'Book a free trial' }).click()
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

test('homepage trial links keep the original source when opened by fragment', async ({ page }) => {
  const events = await mockSite(page)
  const base = '/?utm_source=homepage-trial'
  await page.goto(`${base}#free-trial`)
  const chooser = page.getByRole('dialog', { name: 'Find their first class.' })
  await expect(chooser).toHaveCount(0)
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await grantAnalyticsOnly(page)

  const expectedSections: string[] = []
  for (const [name, hash, section] of [
    ['Try a free class', '#open-free-trial-from-navigation', 'navigation'],
    ['Book a free trial', '#open-free-trial', 'free_trial'],
  ]) {
    await expect(page.getByRole('link', { name, exact: true })).toHaveAttribute('href', hash)
    await page.goto(base + hash)
    await expect(chooser.getByRole('button', { name: /Choose Gymnastics/ })).toBeVisible()
    await expect(chooser.getByRole('button', { name: /Choose Fit & Flip/ })).toBeVisible()
    await expect(page).toHaveURL(base + hash)
    expectedSections.push(section)
    await expect.poll(() => events.filter(event => event.eventName === 'trial_start')
      .map(event => [event.pagePath, event.properties.section])).toEqual(expectedSections.map(source => ['/', source]))
    await chooser.getByRole('button', { name: 'Close dialog' }).click()
    await expect(page.locator('#np-free-trial-heading')).toBeFocused()
  }
})

test('offers adult trials from the youth chooser without requesting youth availability', async ({ page }) => {
  await mockSite(page)
  await page.setViewportSize({ width: 390, height: 844 })
  const youthRequests: string[] = []
  page.on('request', request => {
    if (new URL(request.url()).pathname === '/api/public/free-trials') youthRequests.push(request.url())
  })

  await page.goto('/')
  const chooseTrial = page.getByRole('link', { name: 'Book a free trial' })
  await chooseTrial.click()
  const chooser = page.getByRole('dialog', { name: 'Find their first class.' })
  const adultTrials = 'See Typhoons adult gymnastics trials'
  await expect(chooser.getByRole('link', { name: adultTrials })).toHaveAttribute('href', '/adult-gymnastics#adult-availability')
  await chooser.getByRole('button', { name: /Choose Gymnastics/ }).click()
  const ageStep = page.getByRole('dialog', { name: 'How old is your athlete?' })
  await expect(ageStep.getByLabel('Your child’s age')).toHaveAttribute('max', '17')
  await ageStep.getByRole('link', { name: adultTrials }).click()
  await expect(ageStep).toHaveCount(0)
  await expect(page).toHaveURL('/adult-gymnastics#adult-availability')
  await expect(page.getByRole('heading', { name: 'Plan your first adult gymnastics class' })).toBeInViewport()
  await expect(page.getByRole('link', { name: 'Check Typhoons dates and prices' }))
    .toHaveAttribute('href', '/drop-in?program=Adult%20Fitness%20%26%20Acrobatics')

  await page.goto('/gymnastics#teen')
  await expect(page.locator('#teen').getByRole('link', { name: adultTrials })).toHaveAttribute('href', '/adult-gymnastics#adult-availability')
  expect(youthRequests).toEqual([])
  expect(await page.evaluate(() => localStorage.getItem('vortex_consent'))).toBeNull()
})

test('attributes consented training film views to the canonical page', async ({ page }) => {
  const events = await mockSite(page)
  await page.goto('/watch/training-at-vortex?session_id=private-film-session#change-of-direction', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Necessary only' }).click()
  await expect(page.getByRole('heading', { level: 1, name: 'Gymnastics and athletic training at Vortex' })).toBeVisible()
  expect(events).toEqual([])

  await page.getByRole('button', { name: 'Open cookie settings' }).click()
  await grantAnalyticsOnly(page)
  const pageViews = () => events.filter(event => event.eventName === 'page_view')
  await expect.poll(() => pageViews().map(event => event.pagePath)).toEqual(['/watch/training-at-vortex'])
  expect(pageViews()[0]).toMatchObject({ consentAnalytics: true, consentMarketing: false })

  await page.evaluate(() => { window.location.hash = 'strength-and-handstand' })
  await expect(page).toHaveURL(/#strength-and-handstand$/)
  await page.getByRole('link', { name: 'Explore Fit & Flip youth training' }).click()
  await expect.poll(() => pageViews().map(event => event.pagePath)).toEqual(['/watch/training-at-vortex', '/fit-and-flip'])
  expect(JSON.stringify(events)).not.toMatch(/private-film-session|session_id|change-of-direction|strength-and-handstand/)
})

test('opens a preselected trial from the program page and credits the signup to that page', async ({ page }) => {
  const events = await mockSite(page)
  await page.goto('/blog/athletic-development-young-athletes')
  await page.getByRole('button', { name: 'Settings', exact: true }).click()
  await grantAnalyticsOnly(page)
  await expect(page.getByRole('link', { name: 'See Fit & Flip drop-in dates' })).toHaveAttribute('href', '/drop-in?program=Fit%20%26%20Flip')
  await page.getByRole('link', { name: 'Find a free Fit & Flip trial' }).click()
  await expect(page).toHaveURL('/fit-and-flip#training-fit')

  const beginnerOptions = page.locator('#training-fit')
  await expect(beginnerOptions.getByText(/An 11-year-old who will have turned 12/)).toBeVisible()
  const fitTrial = beginnerOptions.getByRole('button', { name: 'Find a free Fit & Flip trial' })
  await fitTrial.click()
  const dialog = page.getByRole('dialog')
  await expect(dialog.getByRole('heading', { name: 'How old is your athlete?' })).toBeVisible()
  await expect(dialog.getByText('Cyclones classes are grouped into ages 8–11 and 12–15.', { exact: false })).toBeVisible()
  await expect(dialog.getByText('Enter the age your child will be on the day they attend.', { exact: false })).toBeVisible()
  await dialog.getByLabel('Your child’s age').fill('12')
  const availability = page.waitForRequest(request => new URL(request.url()).pathname === '/api/public/free-trials')
  await dialog.getByRole('button', { name: 'Find available classes' }).click()
  const trialParams = new URL((await availability).url()).searchParams
  expect(trialParams.get('program')).toBe('fit-flip')
  expect(trialParams.get('age')).toBe('12')
  await dialog.getByRole('button', { name: /Cyclones \(12–15\).*spot/ }).click()
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
  await expect(dialog.getByText('Enter the age your child will be on the day they attend.', { exact: false })).toBeVisible()
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
  await expect(placement.getByRole('heading', { level: 3, name: 'Advanced Vortex A4 Elite' })).toBeVisible()
  await expect(placement.getByRole('link', { name: 'Compare advanced classes and team placement' }))
    .toHaveAttribute('href', '/gymnastics#competitive-gymnastics-team')
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
