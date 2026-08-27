import { expect, test, type Page } from '@playwright/test'

function addIsoDays(isoDate: string, days: number) {
  const date = new Date(`${isoDate}T00:00:00.000Z`)
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().slice(0, 10)
}

function formatShortDate(isoDate: string) {
  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(new Date(`${isoDate}T00:00:00.000Z`))
}

const coachTabs = [
  'home', 'sessions', 'needs', 'library', 'framework', 'workout', 'programs',
  'training-blocks', 'regimens', 'flip-fit', 'challenges', 'gymnastics-evaluations',
  'skills', 'assign', 'messages', 'faqs', 'reviews', 'insights', 'roster', 'preferences',
]

async function openMockedCoachPortal(
  page: Page,
  savedBodies: Array<Record<string, unknown>> = [],
  reconciledBodies: Array<Record<string, unknown>> = [],
) {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_member_token', 'e2e-coach-token')
    localStorage.setItem('vortex_member', JSON.stringify({
      id: 42,
      fullName: 'Coach Test',
      email: 'coach@example.com',
      roles: ['COACH'],
      isCoach: true,
      availablePortals: ['coach'],
    }))
  })

  await page.route('**/api/**', async (route) => {
    const request = route.request()
    const url = new URL(request.url())
    if (url.pathname === '/api/coach/portal-config') {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            hiddenTabs: [],
            tabOrder: coachTabs,
            navLayout: coachTabs.map((key) => ({ type: 'tab', key })),
          },
        }),
      })
      return
    }
    if (url.pathname === '/api/coach/flip-fit-card-references') {
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
      return
    }
    if (url.pathname === '/api/coach/flip-fit-card-references/reconcile') {
      const body = request.postDataJSON() as Record<string, unknown>
      reconciledBodies.push(body)
      const firstCard = Array.isArray(body.cards) ? body.cards[0] as Record<string, unknown> : null
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            cards: firstCard ? [{
              programCardKey: firstCard.id,
              canonicalDefinitionId: '00000000-0000-4000-8000-000000000001',
              canonicalDisplayName: firstCard.name,
              canonicalStatus: 'draft',
              matchStatus: 'new',
              matchReason: 'Mock reconciliation.',
              matchScore: 0,
              payloadHash: 'mock-payload-hash',
              updatedAt: '2026-08-17T12:00:00.000Z',
            }] : [],
            counts: { reused: 0, alias: 0, new: firstCard ? 1 : 0, review: 0 },
          },
        }),
      })
      return
    }
    if (url.pathname === '/api/coach/flip-fit-schedule') {
      if (request.method() === 'PUT') {
        const body = request.postDataJSON() as Record<string, unknown>
        savedBodies.push(body)
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify({
            success: true,
            data: {
              startDate: body.startDate,
              endDate: addIsoDays(String(body.startDate), 81),
              settings: body.settings,
              sessionOverrides: body.sessionOverrides,
              updatedAt: '2026-08-17T12:00:00.000Z',
            },
          }),
        })
        return
      }
      await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: null }) })
      return
    }
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data: [] }) })
  })

  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Member Portal', exact: true }).click()
}

test.describe('Flip & Fit Schedule', () => {
  test('opens from coach navigation and exposes the complete coach workflow', async ({ page }) => {
    const consoleErrors: string[] = []
    page.on('console', (message) => {
      if (message.type() === 'error') consoleErrors.push(message.text())
    })

    await openMockedCoachPortal(page)
    await page.getByRole('button', { name: 'Flip & Fit', exact: true }).click()

    await expect(page.getByRole('heading', { name: 'Flip & Fit Schedule' })).toBeVisible()
    await expect(page.getByText('60', { exact: true }).first()).toBeVisible()
    await expect(page.getByText('Ages 12–14 · Foundation')).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Two athlete sets, one shared tumbling period' })).toBeVisible()
    await expect(page.getByText(/checks passed/)).toBeVisible()
    await expect(page.getByText('60 of 60 sessions match')).toBeVisible()
    await expect(page.getByText(/1 set · 2.5-minute continuous pass/).first()).toBeVisible()

    await expect(page.getByRole('combobox', { name: 'Week', exact: true })).toBeVisible()
    await expect(page.getByRole('textbox', { name: 'Date', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Day', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Athlete set', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Session phase', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Movement function', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Methodology', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Athletic tenet', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Body region', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Equipment', exact: true })).toBeVisible()

    await page.getByRole('combobox', { name: 'Athlete set', exact: true }).selectOption({ label: 'Athlete Set 2' })
    await expect(page.getByText('Athlete Set 2 facility order', { exact: true })).toBeVisible()
    await expect(page.getByText('Shared tumbling 30 min → Athletic workout 90 min', { exact: true })).toBeVisible()

    await page.getByRole('combobox', { name: 'Session phase', exact: true }).selectOption('output')
    await expect(page.getByRole('heading', { name: 'Output', exact: true })).toBeVisible()
    await expect(page.getByRole('heading', { name: 'Prepare & Access', exact: true })).toHaveCount(0)
    await page.getByRole('combobox', { name: 'Methodology', exact: true }).selectOption({ label: 'Recovery breathing' })
    await expect(page.getByRole('heading', { name: 'No sessions match these filters' })).toBeVisible()

    await page.getByRole('region', { name: 'Schedule filters' }).getByRole('button', { name: 'Reset filters', exact: true }).click()
    await expect(page.getByText('60 of 60 sessions match')).toBeVisible()
    const firstCard = page.getByRole('button', { name: /^Open exercise card for / }).first()
    await firstCard.click()
    const exerciseDialog = page.getByRole('dialog')
    const closeExerciseDialog = exerciseDialog.getByRole('button', { name: 'Close exercise card', exact: true })
    const lastDialogControl = exerciseDialog.getByRole('button', { name: /Ages 15–18/ })
    await expect(exerciseDialog).toBeVisible()
    await expect(closeExerciseDialog).toBeFocused()
    await page.keyboard.press('Shift+Tab')
    await expect(lastDialogControl).toBeFocused()
    await page.keyboard.press('Tab')
    await expect(closeExerciseDialog).toBeFocused()
    await expect.poll(() => firstCard.evaluate((element) => Boolean(element.closest('[inert]')))).toBe(true)
    await firstCard.evaluate((element) => (element as HTMLElement).focus())
    await expect(closeExerciseDialog).toBeFocused()
    await expect(page.getByText('Three coach-ready avenues')).toBeVisible()
    await expect(exerciseDialog.getByText(/Fits the \d+-minute station/)).toBeVisible()
    await expect(page.getByRole('button', { name: /Ages 9–11/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Ages 12–14/ })).toBeVisible()
    await expect(page.getByRole('button', { name: /Ages 15–18/ })).toBeVisible()
    await page.keyboard.press('Escape')
    await expect(exerciseDialog).toHaveCount(0)
    await expect(firstCard).toBeFocused()

    await page.getByRole('button', { name: /9-11 Regression path/ }).click()
    await expect(page.getByText('Ages 9–11 · Regression path')).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Equipment', exact: true }).getByRole('option', { name: 'Youth barbell or technique bar', exact: true })).toHaveCount(1)
    await expect(page.getByRole('combobox', { name: 'Equipment', exact: true }).getByRole('option', { name: 'Barbell', exact: true })).toHaveCount(0)
    await expect.poll(() => consoleErrors).toEqual([])
  })

  test('persists coach session edits against the stable session id', async ({ page }) => {
    const savedBodies: Array<Record<string, unknown>> = []
    await openMockedCoachPortal(page, savedBodies)
    await page.getByRole('button', { name: 'Flip & Fit', exact: true }).click()

    await page.getByText('Edit this session’s coaching plan', { exact: true }).click()
    await page.getByRole('textbox', { name: 'Session objective', exact: true }).fill('Updated coach objective for the first session.')
    await page.getByRole('textbox', { name: 'Coach notes', exact: true }).fill('Use two lanes and stage the youth technique bars before athletes arrive.')
    await page.getByRole('button', { name: 'Save session edits', exact: true }).click()

    await expect.poll(() => savedBodies.some((body) => {
      const overrides = body.sessionOverrides as Record<string, Record<string, unknown>> | undefined
      return overrides?.['flip-fit-w01-d1']?.objective === 'Updated coach objective for the first session.'
        && overrides['flip-fit-w01-d1'].coachNotes === 'Use two lanes and stage the youth technique bars before athletes arrive.'
    })).toBe(true)
    await expect(page.getByText('Updated coach objective for the first session.', { exact: true }).first()).toBeVisible()
  })

  test('reconciles the complete inventory only after confirmation', async ({ page }) => {
    const reconciledBodies: Array<Record<string, unknown>> = []
    await openMockedCoachPortal(page, [], reconciledBodies)
    await page.getByRole('button', { name: 'Flip & Fit', exact: true }).click()

    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Nothing will be auto-published')
      await dialog.accept()
    })
    await page.getByRole('button', { name: 'Reconcile facility cards', exact: true }).click()

    await expect.poll(() => reconciledBodies.length).toBe(1)
    const cards = reconciledBodies[0].cards as Array<Record<string, unknown>>
    expect(cards).toHaveLength(301)
    expect(cards.every((card) => Array.isArray(card.movementFunctions) && card.movementFunctions.length > 0)).toBe(true)
    await expect(page.getByText(/1 cards reconciled atomically/)).toBeVisible()
  })

  test('requires confirmation before remapping all 60 dates', async ({ page }) => {
    const savedBodies: Array<Record<string, unknown>> = []
    await openMockedCoachPortal(page, savedBodies)
    await page.getByRole('button', { name: 'Flip & Fit', exact: true }).click()

    const startDate = page.getByLabel('Program start · Monday')
    const remappedStartDate = addIsoDays(await startDate.inputValue(), 7)
    const remappedEndDate = addIsoDays(remappedStartDate, 81)
    await startDate.fill(remappedStartDate)
    page.once('dialog', async (dialog) => {
      expect(dialog.message()).toContain('Remap all 60 Flip & Fit dates')
      await dialog.accept()
    })
    await page.getByRole('button', { name: 'Save schedule' }).click()

    await expect.poll(() => savedBodies.some((body) => (
      body.startDate === remappedStartDate
      && body.confirmRemap === true
      && typeof body.sessionOverrides === 'object'
    ))).toBe(true)
    await expect(page.getByText(`Ends ${formatShortDate(remappedEndDate)}`)).toBeVisible()
    await expect(page.getByText(/Saved for the facility/)).toBeVisible()
  })

  test('remains usable in the compact coach portal layout', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 })
    await openMockedCoachPortal(page)
    await page.getByRole('button', { name: 'Open navigation menu', exact: true }).click()
    await page.locator('nav').getByRole('button', { name: 'Flip & Fit', exact: true }).press('Enter')

    await expect(page.getByRole('heading', { name: 'Flip & Fit Schedule' })).toBeVisible()
    await expect(page.getByRole('button', { name: '12-14', exact: true })).toBeVisible()
    await expect(page.getByRole('combobox', { name: 'Week', exact: true })).toBeVisible()
    await expect(page.getByRole('button', { name: /^Open exercise card for / }).first()).toBeVisible()
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - document.documentElement.clientWidth)
    expect(overflow).toBeLessThanOrEqual(1)
  })
})
