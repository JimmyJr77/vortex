import { expect, test } from '@playwright/test'

const acquisitionCounts = { inquiries: 0, freeTrials: 0, paidDropIns: 0, paidClassCheckouts: 0, storePurchases: 0, revenueCents: null }
const inquiryDefaults = {
  created_at: '2026-11-01T12:00:00Z', contacted: false, visitor_id: null, phone: null,
  landing_page: '/contact', lead_status: 'new', utm_source: 'google', utm_medium: 'cpc', utm_campaign: 'Fit & Flip',
}

test('analytics admins can filter reports and check Google search visibility', async ({ page }) => {
  const reportRequests: URL[] = []
  let topicRequests = 0
  let programPageRequests = 0
  await page.addInitScript(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'analytics-test-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Analytics Admin' }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.route('**/api/**', route => {
    const url = new URL(route.request().url())
    if (url.pathname.startsWith('/api/admin/analytics/')) reportRequests.push(url)
    let data: unknown = []
    switch (url.pathname) {
      case '/api/admin/access/me':
        data = { permissions: ['analytics.view'], user: { id: 1 } }
        break
      case '/api/admin/notifications':
        data = { notifications: [], unreadCount: 0 }
        break
      case '/api/admin/analytics/overview':
        data = {
          inquiries: { total: 3, contacted: 2, contactedRate: 66.7, trend: [] },
          sessions: 5, newsletterSignups: 1, uncontactedOver48h: 0, capacityAlerts: [],
          outcomes: { free_trials: 2, other_drop_ins: 1, enrollments: 1, store_orders: 1, store_order_value_cents: 2500 },
        }
        break
      case '/api/admin/analytics/traffic':
        data = {
          totals: { sessions: 5, page_views: 7, visitors: 4, returning_visitors: 1,
            engaged_sessions: 3, converting_sessions: 2, timed_sessions: 2, avg_active_seconds: 17.5 },
          pageViewsByDay: [], topPages: [], paths: [], devices: [],
          channels: [{ channel: 'Email', sessions: 5, conversions: 2 }],
          sources: [{ channel: 'Email', source: 'newsletter', medium: 'email', campaign: 'Fall classes', sessions: 5, conversions: 2 }],
        }
        break
      case '/api/admin/analytics/acquisition':
        data = {
          canViewRevenue: false,
          totals: { ...acquisitionCounts, inquiries: 6, freeTrials: 2 },
          attributed: { ...acquisitionCounts, inquiries: 5, freeTrials: 2 },
          rows: [
            { ...acquisitionCounts, source: 'Google Ads', channel: 'Paid search', medium: 'cpc', campaign: 'Fit & Flip', inquiries: 2, freeTrials: 1 },
            { ...acquisitionCounts, source: 'Google Ads', channel: 'Paid search', medium: 'cpc', campaign: 'Youth Classes', inquiries: 2 },
            { ...acquisitionCounts, source: 'Instagram', channel: 'Organic social', medium: null, campaign: null, inquiries: 1, freeTrials: 1 },
            { ...acquisitionCounts, source: 'Unknown', channel: 'Unknown', medium: null, campaign: null, inquiries: 1 },
          ],
        }
        break
      case '/api/admin/analytics/inquiries':
        data = [
          { ...inquiryDefaults, id: 1, first_name: 'Jordan', last_name: 'Rivera', email: 'jordan@example.test',
            acquisition: { source: 'Google Ads', channel: 'Paid search', medium: 'cpc', campaign: 'Fit & Flip' } },
          { ...inquiryDefaults, id: 2, first_name: 'Casey', last_name: 'Rivera', email: 'casey@example.test',
            utm_source: null, utm_medium: null, utm_campaign: null,
            acquisition: { source: 'Instagram', channel: 'Organic social', medium: null, campaign: null } },
        ]
        break
      case '/api/admin/analytics/engagement':
        data = {
          pageViews: 7, timedViews: 2, actions: [], topActions: [], scroll: [], pages: [],
          vitals: [{ metric: 'LCP', device: 'mobile', p75: 2300, samples: 5 }], vitalPages: [],
        }
        break
      case '/api/admin/analytics/seo':
        return route.fulfill({ status: 502, json: { success: false, message: 'Cached SEO reports unavailable' } })
      case '/api/admin/analytics/seo/topics': {
        topicRequests += 1
        const startDate = '2026-10-17'
        const endDate = '2026-11-13'
        const timeZone = 'America/Los_Angeles'
        if (topicRequests === 1) {
          data = { status: 'unconfigured', reason: 'missing_credentials', startDate, endDate, timeZone, topics: [] }
        } else if (topicRequests === 6) {
          data = { status: 'ok', scope: 'without_vortex', view: 'pages', startDate, endDate, timeZone, topics: [
            { id: 'youth-athletics', label: 'Youth Athletics', status: 'reported', metrics: null, pages: [
              { page: 'https://vortexathletics.com/fit-and-flip', metrics: { clicks: 3, impressions: 12, ctr: 0.25, position: 8 } },
              { page: null, metrics: { clicks: 0, impressions: 5, ctr: 0, position: 15 } },
            ] },
          ] }
        } else {
          const filtered = topicRequests >= 4
          data = {
            status: 'partial', startDate, endDate, timeZone,
            ...(filtered ? { scope: 'without_vortex' } : {}),
            topics: [
              { id: 'youth-athletics', label: 'Youth Athletics', status: 'reported', metrics: {
                clicks: filtered ? 1 : 2, impressions: filtered ? 10 : 25, ctr: filtered ? 0.1 : 0.08, position: 7.2,
              } },
              { id: 'youth-gymnastics', label: 'Youth Gymnastics', status: 'no_data', metrics: null },
              { id: 'adult-gymnastics', label: 'Adult Gymnastics', status: 'error', reason: 'provider_error', metrics: null },
            ],
          }
        }
        break
      }
      case '/api/admin/analytics/seo/program-pages': {
        programPageRequests += 1
        const failed = programPageRequests === 2
        data = {
          status: failed ? 'partial' : 'ok',
          timeZone: 'America/Los_Angeles',
          current: failed
            ? { startDate: '2026-10-17', endDate: '2026-11-13', status: 'error', reason: 'access_denied' }
            : { startDate: '2026-10-17', endDate: '2026-11-13', status: 'ok' },
          previous: { startDate: '2026-09-19', endDate: '2026-10-16', status: 'ok' },
          propertyTotals: {
            current: { status: 'ok', impressions: failed ? null : 174 },
            previous: { status: 'ok', impressions: 119 },
          },
          pages: [
            { page: 'https://vortexathletics.com/', label: 'Vortex homepage', currentImpressions: failed ? null : 80, previousImpressions: 63 },
            { page: 'https://vortexathletics.com/vortex-athletics', label: 'Former youth sports performance page', currentImpressions: null, previousImpressions: 17 },
            { page: 'https://vortexathletics.com/gymnastics', label: 'Youth Gymnastics', currentImpressions: failed ? null : 31, previousImpressions: 12 },
            { page: 'https://vortexathletics.com/adult-gymnastics', label: 'Adult Gymnastics', currentImpressions: failed ? null : 0, previousImpressions: null },
          ],
        }
        break
      }
      case '/api/admin/analytics/funnel':
        data = { journeys: [{ name: 'Free trial', steps: [
          { name: 'Trial opened', count: 3, conversionFromPrevious: null },
          { name: 'Trial confirmed', count: 1, conversionFromPrevious: 33.3 },
        ] }] }
        break
    }
    return route.fulfill({ json: { success: true, data } })
  })

  await page.goto('/')
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Database & Analysis' }).click()
  await expect(page.getByRole('heading', { name: 'Analytics & Engagement', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Business outcomes' })).toBeVisible()
  await page.getByRole('button', { name: 'Traffic & Acquisition' }).click()
  await expect(page.getByRole('heading', { name: 'Acquisition channels' })).toBeVisible()
  await expect(page.getByRole('cell', { name: 'Fall classes' })).toBeVisible()
  await expect(page.getByText('3 new · 1 returning')).toBeVisible()
  await page.getByRole('button', { name: 'Custom', exact: true }).click()
  await page.getByLabel('From', { exact: true }).fill('2026-11-01')
  await page.getByLabel('To', { exact: true }).fill('2026-11-01')
  await page.getByLabel('Website', { exact: true }).selectOption('vortexathletics.com')
  await page.getByRole('button', { name: 'Apply', exact: true }).click()
  await expect.poll(() => reportRequests.at(-1)?.searchParams.get('from')).toBe('2026-11-01')
  expect(reportRequests.at(-1)?.searchParams.get('hostname')).toBe('vortexathletics.com')
  await page.getByRole('button', { name: 'View leads and purchases by source' }).click()
  const leadSources = page.getByRole('table', { name: 'Lead sources', exact: true })
  const sourceDetails = page.getByRole('table', { name: 'Outcomes by source and campaign' })
  const googleAds = leadSources.getByRole('button', { name: 'Google Ads' })
  await expect(leadSources.getByRole('row', { name: 'Google Ads 4 1' }).getByRole('cell')).toHaveText(['4', '1'])
  await expect(leadSources.getByRole('row', { name: 'Unknown 1 0' })).toBeVisible()
  await googleAds.click()
  await expect(googleAds).toHaveAttribute('aria-pressed', 'true')
  await expect(sourceDetails.getByRole('cell', { name: /Fit & Flip/ })).toBeVisible()
  await expect(sourceDetails.getByRole('rowheader', { name: /Instagram/ })).toHaveCount(0)
  await page.getByLabel('Source', { exact: true }).selectOption('Instagram')
  await expect(sourceDetails.getByRole('rowheader', { name: /Instagram.*Organic social/ })).toBeVisible()
  await expect(sourceDetails.getByRole('rowheader', { name: /Google Ads/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'View inquiries', exact: true }).click()
  const inquiries = page.getByRole('table', { name: 'Inquiries by lead source' })
  const leadSource = page.getByLabel('Lead source', { exact: true })
  await expect(leadSource).toHaveValue('Instagram')
  await expect(inquiries.getByRole('row', { name: /Casey Rivera.*Instagram.*Organic social/ })).toBeVisible()
  await expect(inquiries.getByRole('row', { name: /Jordan Rivera/ })).toHaveCount(0)
  await leadSource.selectOption('Google Ads')
  await expect(inquiries.getByRole('row', { name: /Jordan Rivera.*Google Ads.*Paid search.*Fit & Flip.*cpc/ })).toBeVisible()
  await expect(inquiries.getByRole('row', { name: /Casey Rivera/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Engagement & Speed' }).click()
  await expect(page.getByRole('heading', { name: 'Web Vitals by device' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '2,300 ms' })).toBeVisible()
  await page.getByRole('button', { name: 'Website Funnels' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'Trial confirmed' })).toContainText('33.3%')
  await page.getByRole('button', { name: 'Marketing & SEO' }).click()
  const checkVisibility = page.getByRole('button', { name: 'Check search visibility' })
  await expect(page.getByText('Cached SEO reports unavailable')).toBeVisible()
  await expect(checkVisibility).toBeVisible()
  expect(topicRequests).toBe(0)
  await checkVisibility.click()
  await expect(page.getByRole('alert').filter({ hasText: 'Connect an identity' })).toBeVisible()
  await checkVisibility.click()
  const table = page.getByRole('table', { name: 'Search visibility by topic' })
  await expect(table.getByRole('row').filter({ hasText: 'Youth Athletics' })).toContainText('8%')
  await expect(table.getByRole('row').filter({ hasText: 'Youth Gymnastics' })).toContainText('No data reported')
  await expect(table.getByRole('row').filter({ hasText: 'Adult Gymnastics' })).toContainText('Query unavailable')
  expect(topicRequests).toBe(2)

  await page.getByLabel('Search queries').selectOption('without_vortex')
  await expect(table).toHaveCount(0)
  await checkVisibility.click()
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load the Search Console topic report.' })).toBeVisible()
  await expect(table).toHaveCount(0)
  await checkVisibility.click()
  await expect(table.getByRole('row').filter({ hasText: 'Youth Athletics' })).toContainText('10%')
  await expect(page.getByText(/Searches for program names such as Fit & Flip can still appear/)).toBeVisible()
  expect(reportRequests.filter(url => url.pathname.endsWith('/seo/topics')).map(url => url.searchParams.get('scope')))
    .toEqual([null, null, 'without_vortex', 'without_vortex'])

  await page.getByLabel('Report type').selectOption('pages')
  await expect(table).toHaveCount(0)
  const pageTable = page.getByRole('table', { name: 'Top reported pages by topic' })
  await checkVisibility.click()
  await expect(page.getByRole('alert').filter({ hasText: 'Could not load the Search Console topic report.' })).toBeVisible()
  await expect(pageTable).toHaveCount(0)
  await checkVisibility.click()
  await expect(pageTable.getByRole('row').filter({ hasText: 'https://vortexathletics.com/fit-and-flip' })).toContainText('25%')
  await expect(pageTable.getByRole('cell', { name: 'Unlisted page' })).toBeVisible()
  const pageRequests = reportRequests.filter(url => url.searchParams.get('view') === 'pages')
  expect(pageRequests.map(url => url.searchParams.get('scope'))).toEqual(['without_vortex', 'without_vortex'])

  await page.getByLabel('Report type').selectOption('program-pages')
  await expect(page.getByRole('heading', { name: 'Google search visibility by landing page' })).toBeVisible()
  await expect(page.getByLabel('Search queries')).toHaveCount(0)
  await expect(pageTable).toHaveCount(0)
  expect(programPageRequests).toBe(0)
  await checkVisibility.click()
  const programTable = page.getByRole('table', { name: 'Google impressions by landing page' })
  await expect(programTable.getByRole('columnheader', { name: /Latest 28 days.*Oct 17, 2026 to Nov 13, 2026/ })).toBeVisible()
  await expect(programTable.getByRole('columnheader', { name: /Previous 28 days.*Sep 19, 2026 to Oct 16, 2026/ })).toBeVisible()
  const youth = programTable.getByRole('row', { name: /Youth Gymnastics/ })
  const adult = programTable.getByRole('row', { name: /Adult Gymnastics/ })
  const property = programTable.getByRole('row', { name: /Property total/ })
  await expect(property.getByRole('cell')).toHaveText(['174', '119', '+55'])
  await expect(programTable.getByRole('row', { name: /Vortex homepage/ }).getByRole('cell')).toHaveText(['80', '63', '+17'])
  await expect(programTable.getByRole('row', { name: /Former youth sports performance page/ }).getByRole('cell')).toHaveText(['No data reported', '17', '—'])
  await expect(youth.getByRole('cell')).toHaveText(['31', '12', '+19'])
  await expect(adult.getByRole('cell')).toHaveText(['0', 'No data reported', '—'])
  await checkVisibility.click()
  await expect(page.getByRole('status').filter({ hasText: 'One date range could not be loaded.' })).toBeVisible()
  await expect(property.getByRole('cell')).toHaveText(['No data reported', '119', '—'])
  await expect(youth.getByRole('cell')).toHaveText(['Property access denied', '12', '—'])
  expect(reportRequests.filter(url => url.pathname.endsWith('/seo/program-pages')).map(url => url.search)).toEqual(['', ''])
  expect(topicRequests).toBe(6)
})
