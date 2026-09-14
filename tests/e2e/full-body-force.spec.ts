import { readFileSync } from 'node:fs'
import { expect, test, type Locator, type Page } from '@playwright/test'

type SavedExercise = {
  id: string
  name: string
  dose: string
  preparation: string | null
  sourceTrack: string
  sourceClass: number
}
type SavedSession = {
  n: number
  title: string
  quality: string
  exercises: SavedExercise[]
  connections: { slots: string[]; title: string; cue: string }[]
}

// Read saved curriculum records at execution time, after all 36 classes are
// integrated. This avoids inventing future exercise names or coupling checks
// to the generated portal JSON that the browser itself consumes.
function savedSession(n: number): SavedSession {
  const path = new URL(`../../workout_plan/full_body_force_generation/workload_class_${String(n).padStart(2, '0')}.json`, import.meta.url)
  return JSON.parse(readFileSync(path, 'utf8')).session as SavedSession
}

async function openAccelerator(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_member_token', 'e2e-coach-token')
    localStorage.setItem('vortex_member', JSON.stringify({
      id: 42, fullName: 'Coach Test', email: 'coach@example.com',
      roles: ['COACH'], isCoach: true, availablePortals: ['coach'],
    }))
  })
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    const data = url.pathname === '/api/coach/portal-config' ? {
      hiddenTabs: [],
      // A saved navigation layout from before the Accelerator existed.
      tabOrder: ['home', 'library', 'workout'],
      navLayout: [
        { type: 'tab', key: 'home' },
        { type: 'section', id: 'session-design', label: 'Session Design' },
        { type: 'tab', key: 'library' },
        { type: 'tab', key: 'workout' },
      ],
    } : []
    await route.fulfill({ status: 200, contentType: 'application/json', body: JSON.stringify({ success: true, data }) })
  })
  await page.goto('/', { waitUntil: 'domcontentloaded' })
  await page.getByRole('button', { name: 'Member Portal', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'VORTEX COACH' })).toBeVisible()
  await expect(page.getByRole('button', { name: /Athleticism Accelerator View athletic plans by class/ })).toBeVisible()
  const menu = page.getByRole('button', { name: 'Open navigation menu', exact: true })
  if (await menu.isVisible()) await menu.click()
  await page.locator('nav').getByRole('button', { name: 'Athleticism Accelerator', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Athleticism Accelerator', exact: true })).toBeVisible()
}

const phaseNames = { E: '2. Explosiveness', S: '3. Resilience', P: '4. Primary strength' } as const
const forceComposition = [
  ['Upper Body Force Generation', 2],
  ['Lower Body Force Generation', 2],
  ['Upper-body rotational power', 1],
  ['Lower-body rotational power', 1],
] as const
const escapeRegExp = (text: string) => text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')

async function selectClass(page: Page, session: SavedSession) {
  await page.getByRole('button', { name: `Class ${session.n}: ${session.title}`, exact: true }).click()
  await expect(page.getByRole('region', { name: `Class ${session.n} workout`, exact: true })).toBeVisible()
}

async function phasePanel(page: Page, phase: keyof typeof phaseNames) {
  await page.getByRole('tab', { name: phaseNames[phase] }).click()
  return page.getByRole('tabpanel', { name: phaseNames[phase] })
}

async function checkDisplayedExercise(panel: Locator, exercise: SavedExercise) {
  const notes = panel.getByRole('button', { name: `Coaching notes for ${exercise.name}`, exact: true })
  await expect(notes).toBeVisible()
  // The parent is this exercise's grid, containing its name, source and dose.
  const row = notes.locator('..')
  await expect(row).toContainText(exercise.dose)
  await expect(row).toContainText(`${exercise.sourceTrack} · Source class ${exercise.sourceClass}`)
}

async function expectNoHorizontalOverflow(page: Page) {
  const width = await page.evaluate(() => ({ document: document.documentElement.scrollWidth, viewport: innerWidth }))
  expect(width.document).toBeLessThanOrEqual(width.viewport)
}

async function expectDialogFits(page: Page) {
  const dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  const bounds = await dialog.boundingBox()
  expect(bounds).not.toBeNull()
  expect(bounds!.x).toBeGreaterThanOrEqual(0)
  expect(bounds!.x + bounds!.width).toBeLessThanOrEqual(390)
  expect(await dialog.evaluate(element => element.scrollWidth <= element.clientWidth)).toBe(true)
}

test('Full Body Force Generation retains all 36 mixed classes, source doses, preparation and mobile coaching', async ({ page }, testInfo) => {
  test.setTimeout(180_000)
  page.setDefaultTimeout(10_000)
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const sessions = Array.from({ length: 36 }, (_, index) => savedSession(index + 1))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await openAccelerator(page)
  await page.getByRole('combobox', { name: 'Program type', exact: true }).selectOption('grouped')
  await page.getByRole('combobox', { name: 'Search programs', exact: true }).fill('full body force')
  await page.getByRole('button', { name: 'Full Body Force Generation 36 Classes', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Full Body Force Generation 36 Classes', exact: true })).toBeVisible()
  await expect(page.getByText('36 Classes · 12 development stages · Ages 12–14 · Coach-led', { exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Class \d+:/ })).toHaveCount(36)
  await expect(page.getByRole('button', { name: 'Previous class', exact: true })).toBeDisabled()

  for (const session of sessions) {
    await selectClass(page, session)
    for (const [phase, count] of [['E', 6], ['S', 2], ['P', 6]] as const) {
      const panel = await phasePanel(page, phase)
      const exercises = session.exercises.filter(exercise => exercise.id.startsWith(phase))
      expect(exercises).toHaveLength(count)
      await expect(panel.getByRole('button', { name: /^Coaching notes for / })).toHaveCount(count)
      for (const exercise of exercises) await checkDisplayedExercise(panel, exercise)
      if (phase === 'E' || phase === 'P') {
        for (const [track, expected] of forceComposition) {
          await expect(panel.getByText(new RegExp(`^${escapeRegExp(track)} · Source class \\d+$`))).toHaveCount(expected)
        }
      }
      if (phase === 'E') {
        await expect(panel.getByRole('note', { name: /^Connection E\d and E\d$/ })).toHaveCount(3)
        for (const connection of session.connections) {
          const note = panel.getByRole('note', { name: `Connection ${connection.slots.join(' and ')}`, exact: true })
          await expect(note).toContainText(connection.cue)
          for (const id of connection.slots) await expect(note).toContainText(session.exercises.find(exercise => exercise.id === id)!.name)
        }
      }
      if (phase === 'P') {
        // Open all six notes in every class: preparation must remain attached
        // to the selected lift after the original courses are redistributed.
        for (const exercise of exercises) {
          expect(exercise.preparation).toBeTruthy()
          await panel.getByRole('button', { name: `Coaching notes for ${exercise.name}`, exact: true }).click()
          const dialog = page.getByRole('dialog')
          await expect(dialog.getByRole('heading', { name: 'Load preparation', exact: true })).toBeVisible()
          await expect(dialog).toContainText(exercise.preparation!)
          await expect(dialog).toContainText(exercise.dose)
          await page.keyboard.press('Escape')
          await expect(dialog).not.toBeVisible()
        }
      }
    }
  }
  await expect(page.getByRole('button', { name: 'Next class', exact: true })).toBeDisabled()

  await selectClass(page, sessions[0])
  let explosive = await phasePanel(page, 'E')
  const chestPass = sessions[0].exercises.find(exercise => exercise.id === 'E2')!
  const squatJump = sessions[0].exercises.find(exercise => exercise.id === 'E1')!
  expect(chestPass.name).toBe('Medicine Ball Chest Pass — stationary, paused')
  expect(chestPass.dose).toBe('3 × 3')
  expect(squatJump.name).toBe('Squat Jump — settled quarter-squat start')
  expect(squatJump.dose).toBe('2 × 3')
  await checkDisplayedExercise(explosive, chestPass)
  await checkDisplayedExercise(explosive, squatJump)
  await page.getByRole('tab', { name: '1. Prepare' }).click()
  await expect(page.getByRole('tabpanel', { name: '1. Prepare' })).toContainText('existing predetermined Access & Prepare 1')

  await selectClass(page, sessions[15])
  explosive = await phasePanel(page, 'E')
  const midpointRotation = sessions[15].exercises.filter(exercise => exercise.id.startsWith('E') && /rotational power$/.test(exercise.sourceTrack))
  expect(midpointRotation).toHaveLength(2)
  for (const exercise of midpointRotation) {
    expect(exercise.dose).toBe('1 × 1 per side/direction')
    await checkDisplayedExercise(explosive, exercise)
  }

  for (const session of sessions.slice(33)) {
    await selectClass(page, session)
    await phasePanel(page, 'E')
    expect(session.quality).toContain('matching dose')
    expect(session.quality).toContain('An unmatched or missing baseline is not zero or improvement.')
    await page.getByRole('button', { name: 'Quality, scaling & readiness', exact: true }).click()
    await expect(page.getByRole('dialog')).toContainText(session.quality)
    await page.keyboard.press('Escape')
  }
  await expect(page.getByRole('button', { name: 'Next class', exact: true })).toBeDisabled()
  await page.screenshot({ path: testInfo.outputPath('full-force-desktop.png'), fullPage: true })

  await page.setViewportSize({ width: 390, height: 844 })
  for (const session of sessions) {
    await selectClass(page, session)
    await expectNoHorizontalOverflow(page)
  }
  await page.getByRole('button', { name: 'Quality, scaling & readiness', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(sessions[35].quality)
  await expectDialogFits(page)
  await page.screenshot({ path: testInfo.outputPath('full-force-mobile-quality.png'), fullPage: true })
  await page.keyboard.press('Escape')
  await selectClass(page, sessions[0])
  await phasePanel(page, 'P')
  const lastPrimary = sessions[0].exercises.find(exercise => exercise.id === 'P6')!
  await page.getByRole('button', { name: `Coaching notes for ${lastPrimary.name}`, exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText(lastPrimary.preparation!)
  await expectDialogFits(page)
  await page.screenshot({ path: testInfo.outputPath('full-force-mobile-preparation.png'), fullPage: true })
  await page.keyboard.press('Escape')

  await page.getByRole('button', { name: 'Plan overview', exact: true }).click()
  const overview = page.getByRole('dialog')
  await expect(overview.getByRole('button', { name: /Class \d+ ·/ })).toHaveCount(36)
  await expect(overview).toContainText('36 Classes · 12 development stages')
  await expectDialogFits(page)
  await overview.getByRole('button', { name: new RegExp(`Class 36 · ${escapeRegExp(sessions[35].title)}`) }).click()
  await expect(overview).not.toBeVisible()
  await expect(page.getByRole('button', { name: 'Next class', exact: true })).toBeDisabled()
  await expect(page.getByRole('region', { name: 'Class 36 workout', exact: true })).toBeVisible()
  await expectNoHorizontalOverflow(page)
  expect(errors).toEqual([])
})
