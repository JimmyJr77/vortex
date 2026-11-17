import { expect, test } from '@playwright/test'

test('analytics admins can filter traffic and inspect Web Vitals and ordered funnels', async ({ page }) => {
  const reportRequests: URL[] = []
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
      case '/api/admin/analytics/engagement':
        data = {
          pageViews: 7, timedViews: 2, actions: [], topActions: [], scroll: [], pages: [],
          vitals: [{ metric: 'LCP', device: 'mobile', p75: 2300, samples: 5 }], vitalPages: [],
        }
        break
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
  await page.getByRole('button', { name: 'Engagement & Speed' }).click()
  await expect(page.getByRole('heading', { name: 'Web Vitals by device' })).toBeVisible()
  await expect(page.getByRole('cell', { name: '2,300 ms' })).toBeVisible()
  await page.getByRole('button', { name: 'Website Funnels' }).click()
  await expect(page.getByRole('row').filter({ hasText: 'Trial confirmed' })).toContainText('33.3%')
})
