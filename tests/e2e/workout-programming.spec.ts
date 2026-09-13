import { expect, test, type Page } from '@playwright/test'

// This suite uses the real routes, workflow and UI with explicitly synthetic source/model rows.
// Start tests/support/workoutProgrammingPreviewServer.mjs and opt in; never target a live facility.
test.skip(process.env.VORTEX_PROGRAMMING_SYNTHETIC_PREVIEW !== '1', 'Requires the isolated programming preview server')
test.describe.configure({ mode: 'serial' })
const endpoint = '/api/coach/workout-programming'
const session = (page: Page) => page.getByRole('region', { name: 'Generated programming session' })

test.beforeEach(async ({ page, request }) => {
  const reset = await request.post('/__preview/reset')
  expect(reset.ok()).toBeTruthy()
  await page.goto('/tests/fixtures/workout-programming.html')
  await expect(page.getByText('Local verification · synthetic athletes, library and model responses')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Generate & review session' })).toBeEnabled()
})

async function configureGroup(page: Page) {
  for (const [label, value] of [['Athletes', '15'], ['Youngest age', '12'], ['Oldest age', '14'], ['Coaches', '2'],
    ['Floor area (sq ft)', '2000'], ['Lane length (ft)', '100']]) await page.getByRole('spinbutton', { name: label, exact: true }).fill(value)
  await page.getByLabel('Training experience').selectOption('intermediate')
}

async function generate(page: Page) {
  const response = page.waitForResponse((response) => response.url().endsWith(endpoint) && response.request().method() === 'POST')
  await page.getByRole('button', { name: 'Generate & review session' }).click()
  const completed = await response
  expect(completed.status()).toBe(200)
  return (await completed.json()).data
}

test('canonical choices, granular controls, generation, saved history and fresh evidence remain coherent', async ({ page, request }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await configureGroup(page)
  await page.getByLabel('Coaching intent', { exact: true }).fill('Preserve movement quality and full explosive recovery.')
  await page.getByRole('checkbox', { name: 'Dumbbell', exact: true }).check()
  await page.getByRole('spinbutton', { name: 'Dumbbell quantity', exact: true }).fill('6')
  await page.getByLabel('Dumbbell preference').selectOption('preferred')
  await page.getByRole('button', { name: 'Add overall priority' }).click()
  await page.getByLabel('Weight', { exact: true }).fill('80')
  await page.getByRole('button', { name: 'Find canonical choices' }).click()
  await expect(page.getByRole('status')).toContainText('10 canonical profile choices loaded')
  const strength = page.locator('details').filter({ has: page.locator('summary', { hasText: /^Strength$/ }) })
  await strength.locator('summary').click()
  await strength.getByLabel('Locked exercises', { exact: false }).selectOption({ index: 0 })
  await strength.getByLabel('Locked methods', { exact: false }).selectOption({ index: 0 })
  const saved = await generate(page)
  await expect(session(page).getByRole('heading', { name: 'Session checks passed' })).toBeVisible()
  await expect(session(page).getByRole('heading', { level: 4 })).toHaveText(['Prepare & Access', 'Explosiveness', 'Strength', 'Capacity / Competition'])
  await expect(session(page).getByText('55:00–60:00', { exact: true })).toBeVisible()
  const state = await (await request.get('/__preview/state')).json()
  expect(state.savedCount).toBe(1)
  expect(state.lastRequest.components).toHaveLength(4)
  expect(state.lastRequest.athletes[0].athleteCount).toBe(15)
  expect(state.lastRequest.equipment.quantities.dumbbell).toBe(6)
  expect(state.lastRequest.equipment.preferred).toEqual(['dumbbell'])
  expect(state.lastRequest.priorities[0].weight).toBe(80)
  expect(state.lastRequest.components.find((component: { key: string }) => component.key === 'strength').lockedExercises).toHaveLength(1)
  const sourceHash = saved.workout.contentHash
  await session(page).getByRole('button', { name: 'Check current evidence' }).click()
  await expect(session(page).getByRole('heading', { name: 'Session checks passed' })).toBeVisible()

  await page.locator('summary').filter({ hasText: /^Saved programming sessions/ }).click()
  await page.getByRole('button', { name: 'Refresh saved sessions' }).click()
  await page.getByRole('button', { name: /Passed when saved/ }).click()
  await expect(session(page).getByRole('heading', { name: 'Saved session · check current evidence' })).toBeVisible()
  await session(page).getByRole('button', { name: 'Use controls for a new session' }).click()
  await expect(page.getByRole('checkbox', { name: 'Bodyweight', exact: true })).toBeChecked()
  await expect(page.getByRole('spinbutton', { name: 'Dumbbell quantity', exact: true })).toHaveValue('6')
  await page.getByRole('button', { name: 'Existing canonical generator', exact: true }).click()
  await page.getByRole('button', { name: 'AI session programming', exact: true }).click()
  await expect(page.getByRole('textbox', { name: 'Coaching intent', exact: true })).toHaveValue('Preserve movement quality and full explosive recovery.')
  await request.post('/__preview/change-source')
  await session(page).getByRole('button', { name: 'Check current evidence' }).click()
  await expect(session(page).getByRole('heading', { name: 'Coach review needed' })).toBeVisible()
  const reopened = (await (await request.get(`${endpoint}/${saved.persistedWorkoutId}`)).json()).data
  expect(reopened.workout.contentHash).toBe(sourceHash)
  expect(reopened.workout).toEqual(saved.workout)
  expect(errors).toEqual([])
})

test('roster observation selection submits a member-bound source hash through the real reader', async ({ page, request }) => {
  await configureGroup(page)
  await page.locator('summary').filter({ hasText: /^Roster & existing observations/ }).click()
  await page.getByLabel('Group 1 roster', { exact: false }).selectOption(Array.from({ length: 15 }, (_, index) => String(101 + index)))
  await page.getByLabel('Athlete for evidence').selectOption('101')
  await page.getByRole('button', { name: 'Find observations' }).click()
  await page.getByRole('checkbox', { name: /Landing quality · 4 \/ 5/ }).check()
  await expect(page.getByText('1 source observations attached.', { exact: false })).toBeVisible()
  await generate(page)
  await expect(session(page).getByRole('heading', { name: 'Session checks passed' })).toBeVisible()
  await session(page).locator('summary').filter({ hasText: /^Station plan and start times$/ }).first().click()
  await expect(session(page).getByRole('region', { name: 'Station start times' })).toContainText('Fixture athlete 1')
  const state = await (await request.get('/__preview/state')).json()
  const attached = state.lastRequest.athletes[0].evidenceReferences
  expect(attached).toHaveLength(1)
  expect(attached[0]).toMatchObject({ memberId: '101', id: '71', kind: 'skill_progress' })
  const choices = (await (await request.get(`${endpoint}/evidence/101?kind=skill_progress&asOfDate=2026-09-13`)).json()).data
  expect(attached[0].expectedSourceHash).toBe(choices[0].sourceHash)
  expect(attached[0].expectedSourceHash).toMatch(/^[a-f0-9]{64}$/)
})

test('zero-tumbling defaults and cancellation cannot silently create a saved session', async ({ page, request }) => {
  await page.getByRole('button', { name: 'Find canonical choices' }).click()
  await expect(page.getByRole('status')).toContainText('canonical profile choices loaded')
  await configureGroup(page)
  await request.post('/__preview/delay', { data: { milliseconds: 1500 } })
  await page.getByRole('button', { name: 'Generate & review session' }).click()
  await expect(page.getByRole('button', { name: 'Generate & review session' })).toBeDisabled()
  await expect.poll(async () => (await (await request.get('/__preview/state')).json()).inFlight).toBe(1)
  await page.getByRole('button', { name: 'Cancel', exact: true }).click()
  await expect(page.getByRole('alert')).toContainText('Cancellation requested. Refresh saved sessions')
  await expect.poll(async () => (await (await request.get('/__preview/state')).json()).inFlight).toBe(0)
  expect((await (await request.get('/__preview/state')).json()).savedCount).toBe(0)
  await expect(page.getByRole('button', { name: 'Generate & review session' })).toBeEnabled()
  await request.post('/__preview/delay', { data: { milliseconds: 0 } })
  await generate(page)
  await expect(session(page).getByRole('heading', { name: 'Session checks passed' })).toBeVisible()
})

test('mobile controls and session content fit without horizontal scrolling', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await configureGroup(page)
  await page.getByRole('button', { name: 'Add overall priority' }).click()
  await page.getByRole('button', { name: 'Find canonical choices' }).click()
  await expect(page.getByRole('status')).toContainText('canonical profile choices loaded')
  await page.locator('summary').filter({ hasText: /^Strength$/ }).click()
  await page.getByRole('button', { name: 'Add strength priority' }).click()
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await generate(page)
  await expect(session(page).getByRole('heading', { name: 'Session checks passed' })).toBeVisible()
  await session(page).locator('summary').filter({ hasText: /^Station plan and start times$/ }).first().click()
  await expect(session(page).getByRole('region', { name: 'Station start times' })).toContainText('Group 1, athlete 1')
  await expect.poll(() => page.evaluate(() => document.documentElement.scrollWidth)).toBe(390)
  await session(page).getByRole('heading', { name: 'Session checks passed' }).scrollIntoViewIfNeeded()
  await page.screenshot({ path: '/private/tmp/vortex-programming-mobile-session.png' })
})

test('adding Body Control keeps it last and requires readiness evidence before coaching', async ({ page, request }) => {
  await configureGroup(page)
  await page.getByRole('spinbutton', { name: 'Athletic minutes', exact: true }).fill('90')
  await page.getByRole('spinbutton', { name: 'Tumbling minutes', exact: true }).fill('30')
  await expect(page.getByRole('spinbutton', { name: 'Total booked minutes', exact: true })).toHaveValue('120')
  const saved = await generate(page)
  await expect(session(page).getByRole('heading', { name: 'Coach review needed' })).toBeVisible()
  expect(saved.workout.validatedWorkout).toBe(false)
  await expect(session(page).getByRole('status')).toContainText('Attach reviewed observations or choose eligible alternatives')
  const state = await (await request.get('/__preview/state')).json()
  expect(state.lastRequest.components.map((component: { key: string }) => component.key)).toEqual([
    'prepare_and_access', 'explosiveness', 'strength', 'capacity_competition', 'body_control',
  ])
  await expect(session(page).getByRole('heading', { level: 4 }).last()).toHaveText('Body Control / Tumbling')
})
