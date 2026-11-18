import { expect, test } from '@playwright/test'
import { JOB_DISCIPLINES } from '../../src/config/jobApplication'

test('a coaching application can be retried, reviewed in Admin, and moved into review', async ({ page }) => {
  const submissions: Record<string, unknown>[] = []
  let application: Record<string, unknown> | null = null
  await page.setViewportSize({ width: 1280, height: 900 })
  await page.route('**/api/**', async route => {
    const request = route.request()
    const { pathname } = new URL(request.url())
    let data: unknown = []
    if (pathname === '/api/public/job-applications' && request.method() === 'POST') {
      const payload = request.postDataJSON() as Record<string, unknown>
      submissions.push(payload)
      if (!application) {
        application = { ...payload, id: 22, createdAt: '2026-11-17T14:00:00Z', status: 'new' }
        return route.fulfill({ status: 503, json: { success: false, message: 'Please try again.' } })
      }
      return route.fulfill({ status: 201, json: { success: true, data: { id: 22 } } })
    }
    if (pathname === '/api/admin/access/me') {
      data = { isMasterAdmin: false, permissions: ['admin_access.manage'], roles: ['ADMIN'], user: { id: 1 } }
    }
    if (pathname === '/api/admin/new-admin/job-applications') {
      data = { rows: application ? [application] : [], page: 1, pageSize: 25, total: application ? 1 : 0, totalPages: application ? 1 : 0 }
    }
    if (pathname === '/api/admin/new-admin/job-applications/22') {
      if (request.method() === 'PATCH') {
        expect(request.postDataJSON()).toEqual({ status: 'in_review' })
        application = { ...application, status: 'in_review' }
      }
      data = application
    }
    return route.fulfill({ json: { success: true, data } })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Necessary only', exact: true }).click()
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Jobs', exact: true }).click()
  await expect(page).toHaveURL('/jobs')
  await expect(page.getByRole('heading', { name: 'Coaching jobs at Vortex Athletics' })).toBeVisible()
  await page.setViewportSize({ width: 390, height: 844 })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)

  await page.getByLabel('First name', { exact: true }).fill('Jordan')
  await page.getByLabel('Last name', { exact: true }).fill('Rivera')
  await page.getByLabel('Email', { exact: true }).fill('jordan@example.test')
  await page.getByLabel('Phone number', { exact: true }).fill('2025550100')
  await page.getByLabel('Which coaching role are you looking for?').selectOption('both')
  await page.getByLabel('What days and times can you work?').fill('Weekdays after 4 p.m. and Saturday mornings')
  await page.getByRole('group', { name: 'Have you coached or trained children?' }).getByRole('radio', { name: 'Yes' }).check()
  await page.getByRole('checkbox', { name: '8–11', exact: true }).check()
  await page.getByLabel('What types of training did you lead with children?').fill('Beginner tumbling and youth strength sessions')
  await expect(page.getByRole('group', { name: /artistic gymnastics/i })).toHaveCount(0)
  for (const { value, label } of JOB_DISCIPLINES) {
    const score = value === 'tumbling' ? '5, expert level' : value === 'dance' ? '1, no experience' : '3'
    await page.getByRole('group', { name: label, exact: true }).getByRole('radio', { name: score, exact: true }).check()
  }
  await page.getByRole('checkbox', { name: 'CPR/AED', exact: true }).check()
  await page.getByRole('checkbox', { name: 'Certified Personal Trainer (CPT)', exact: true }).check()
  await page.getByLabel('Other certifications').fill('Youth coaching certificate from my recreation league')

  const submit = page.getByRole('button', { name: 'Submit application', exact: true })
  await submit.click()
  await expect(page.getByRole('alert')).toHaveText('Please try again.')
  await submit.click()
  await expect(page.getByRole('heading', { name: 'Application received', exact: true })).toBeVisible()
  expect(submissions).toHaveLength(2)
  expect(submissions[0]).toMatchObject({
    firstName: 'Jordan', lastName: 'Rivera', role: 'both', coachedChildren: true, ageGroups: ['8_11'],
    youthCoachingDetails: 'Beginner tumbling and youth strength sessions',
    certificationKeys: ['cpr_aed', 'personal_trainer'], certifications: 'Youth coaching certificate from my recreation league',
    ratings: { tumbling: 5, dance: 1, beam: 3, parallelBars: 3, unevenBars: 3, pommelHorse: 3, parkour: 3, ninja: 3 },
  })
  expect(Object.keys(submissions[0].ratings as object)).toHaveLength(18)
  expect(submissions[1]).toEqual(submissions[0])

  await page.setViewportSize({ width: 1280, height: 900 })
  await page.evaluate(() => {
    localStorage.setItem('vortex_admin', 'true')
    localStorage.setItem('adminToken', 'job-review-test-token')
    localStorage.setItem('vortex-admin-info', JSON.stringify({ id: 1, name: 'Hiring reviewer', isMaster: false }))
    localStorage.setItem('vortex_admin_portal', 'new-admin')
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('navigation', { name: 'Admin sections' }).getByRole('button', { name: 'Job applications', exact: true }).click()
  await page.getByRole('button', { name: 'Review Jordan Rivera', exact: true }).click()
  const review = page.getByRole('dialog', { name: 'Jordan Rivera' })
  await expect(review.getByText('Beginner tumbling and youth strength sessions')).toBeVisible()
  await expect(review.getByText('CPR/AED', { exact: true })).toBeVisible()
  await expect(review.getByText('Youth coaching certificate from my recreation league')).toBeVisible()
  await expect(review.getByText('5 / 5', { exact: true })).toBeVisible()
  await expect(review.getByText('Pommel Horse', { exact: true })).toBeVisible()
  await expect(review.getByText('Ninja', { exact: true })).toBeVisible()
  await review.getByRole('combobox', { name: 'Review status', exact: true }).selectOption('in_review')
  await review.getByRole('button', { name: 'Save review status', exact: true }).click()
  await expect(review.getByRole('status')).toHaveText('Review status saved.')
  await review.getByRole('button', { name: 'Close Jordan Rivera', exact: true }).click()
  await expect(page.getByRole('list', { name: 'Applicants' })).toContainText('In review')
})
