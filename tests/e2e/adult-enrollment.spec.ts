import { expect, test, type Page } from '@playwright/test'

const adultName = 'Typhoons (Adult)'
const adultFormId = 405
const adultProgram = 'Adult Fitness & Acrobatics'
const adultBookingPath = `/enroll?program=${encodeURIComponent(adultProgram)}`
const slot = {
  id: 501,
  formId: adultFormId,
  slotGroupId: 601,
  scheduleMode: 'day',
  dayOfWeek: 1,
  dayName: 'Monday',
  startTime: '19:00',
  endTime: '20:30',
  maxParticipants: 10,
  spotsRemaining: 8,
  isActive: true,
}

async function mockClasses(page: Page, {
  enrollVisible = true,
  multipleAdultClasses = false,
}: { enrollVisible?: boolean; multipleAdultClasses?: boolean } = {}) {
  const adultClasses = [{
    id: 20, displayName: adultName, ageMin: 18, formId: adultFormId, enrollVisible,
    signupUrl: enrollVisible ? `/enroll?form=${adultFormId}` : null,
  }]
  if (multipleAdultClasses) {
    adultClasses.push({
      id: 21, displayName: 'Second adult class', ageMin: 18, formId: 406,
      enrollVisible: true, signupUrl: '/enroll?form=406',
    })
  }
  const formRequests: string[] = []
  await page.route('**/api/**', async (route) => {
    const path = new URL(route.request().url()).pathname
    const json = (data: unknown) => route.fulfill({ json: { success: true, data } })
    switch (path) {
      case '/api/public/classes-offered':
        return json({ programs: [
          { id: 1, displayName: 'Fit & Flip', classes: [{ id: 10, displayName: 'Cyclones', formId: 100 }] },
          { id: 2, displayName: adultProgram, classes: adultClasses },
        ] })
      case `/api/scheduling/forms/${adultFormId}`:
        formRequests.push(path)
        return json({ id: adultFormId, title: adultName, isActive: true, mandateWaiver: false,
          slotGroups: [{ id: slot.slotGroupId, formId: adultFormId, offeringId: 701, scheduleMode: 'day',
            maxParticipants: 10, spotsRemaining: 8, isActive: true, occurrences: [slot] }], timeSlots: [slot] })
      case `/api/scheduling/forms/${adultFormId}/offerings`:
        return json([{ id: 701, formId: adultFormId, startDate: '2026-01-01', evergreen: true, isSelected: true }])
      case `/api/scheduling/forms/${adultFormId}/program-options`:
        return json({ options: [] })
      case '/api/signup/catalog/classes/10/offerings':
        return json({ formId: 100, offerings: [], scheduleOptions: [] })
      default:
        return json({})
    }
  })
  return formRequests
}

test('adult gymnastics, general enrollment, and published form links open the current Typhoons schedule', async ({ page }) => {
  await mockClasses(page)
  await page.goto('/adult-gymnastics')
  const booking = page.getByRole('link', { name: 'See adult class times' })
  await expect(booking).toHaveAttribute('href', adultBookingPath)
  await booking.click()
  await expect(page.getByRole('heading', { name: 'Adult gymnastics classes' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ask about adult gymnastics classes' })).toHaveAttribute('href', '/contact')
  await expect(page.getByRole('link', { name: 'Try a free class', exact: true })).toHaveCount(0)
  await expect(page.getByRole('link', { name: 'Back to adult gymnastics' })).toHaveAttribute('href', '/adult-gymnastics')
  await expect(page.getByRole('heading', { name: adultName })).toBeVisible()
  await expect(page.getByRole('button', { name: /Monday.*7:00 PM/ })).toBeVisible()

  await page.goto(`/enroll?form=${adultFormId}`)
  await expect(page.getByRole('heading', { name: adultName })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ask about adult gymnastics classes' })).toHaveAttribute('href', '/contact')

  await page.goto(`/enroll?form=${adultFormId}&offeringId=701&slotGroupId=${slot.slotGroupId}&timeSlotId=${slot.id}`)
  await expect(page.getByRole('heading', { name: 'Adult gymnastics classes' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ask about adult gymnastics classes' })).toHaveAttribute('href', '/contact')
  await expect(page.getByRole('link', { name: 'Try a free class', exact: true })).toHaveCount(0)

  await page.goto('/enroll')
  await expect(page.getByRole('link', { name: 'Try a free class', exact: true })).toHaveAttribute('href', '/#free-trial')
  await expect(page.getByRole('heading', { name: 'Cyclones' })).toBeVisible()
  await expect(page.getByRole('heading', { name: adultName })).toHaveCount(0)
  await page.getByRole('link', { name: 'see adult gymnastics class times' }).click()
  await expect(page).toHaveURL(adultBookingPath)
  await expect(page.getByRole('heading', { name: adultName })).toBeVisible()
  await expect(page.getByRole('button', { name: /Monday.*7:00 PM/ })).toBeVisible()
})

test('choosing from multiple adult classes retains the adult contact and return links', async ({ page }) => {
  await mockClasses(page, { multipleAdultClasses: true })
  await page.goto(adultBookingPath)
  const list = page.getByRole('list', { name: 'Available adult classes' })
  const booking = list.getByRole('link', { name: adultName })
  await expect(booking).toHaveAttribute('href', `${adultBookingPath}&form=${adultFormId}`)
  await booking.click()
  await expect(page.getByRole('heading', { name: adultName })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Ask about adult gymnastics classes' })).toHaveAttribute('href', '/contact')
  await expect(page.getByRole('link', { name: 'Back to classes' })).toHaveAttribute('href', adultBookingPath)
})

test('unpublished adult classes lead to contact without opening their signup forms', async ({ page }) => {
  const formRequests = await mockClasses(page, { enrollVisible: false })
  await page.goto('/enroll')
  await page.getByRole('link', { name: 'see adult gymnastics class times' }).click()
  await expect(page.getByText('There are no adult classes open for online enrollment right now.')).toBeVisible()
  await expect(page.getByRole('link', { name: 'Contact us about adult classes' })).toHaveAttribute('href', '/contact')
  await page.goto(`/enroll?form=${adultFormId}`)
  await expect(page.getByRole('heading', { name: 'Cyclones' })).toBeVisible()
  await expect(page.getByRole('link', { name: 'Try a free class', exact: true })).toHaveAttribute('href', '/#free-trial')
  expect(formRequests).toEqual([])
})
