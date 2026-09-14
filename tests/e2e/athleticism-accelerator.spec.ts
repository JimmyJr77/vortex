import { expect, test, type Page } from '@playwright/test'
import { readFileSync } from 'node:fs'
const programs = JSON.parse(readFileSync(new URL('../../src/coach/data/acceleratorPrograms.json', import.meta.url), 'utf8')) as Record<string, unknown[]>
const libraryManifest = JSON.parse(readFileSync(new URL('../../scripts/data/athleticism-accelerator-library-manifest.json', import.meta.url), 'utf8')) as {
  associations: Array<{ exerciseName: string; librarySlug: string; youtubeReferences: string[] }>
}
const programCount = Object.keys(programs).length
const associationBySlug = new Map(libraryManifest.associations.map((association) => [association.librarySlug, association]))

function mockExerciseCard(slug: string) {
  const association = associationBySlug.get(slug)
  if (!association) throw new Error(`Missing mocked exercise-card association for ${slug}`)
  return {
    id: 9001,
    name: association.exerciseName,
    slug,
    description: `Exact Athleticism Accelerator card for ${association.exerciseName}.`,
    est_seconds_per_set: 45,
    is_published: true,
    visibility: 'facility',
    card_summary: `Coach ${association.exerciseName} with the prescribed setup, dose, recovery, and stop signs.`,
    primary_phase_key: 'output',
    participant_structure: 'individual',
    movement_requirements: { primary_joint_actions: ['coordinated movement'], primary_tissues: ['full_body'] },
    coaching_execution: { setup: ['Prepare the exact listed station.'], execution_steps: ['Follow the written Accelerator prescription.'], athlete_cues: ['Fast and clean.'], quality_gate: ['Preserve control.'] },
    pairing_logic: {},
    media_library: { clinical_or_sport_science_references: association.youtubeReferences },
    tags: [],
    media: [],
    cues: [],
    prerequisites: [],
    phase_profiles: [],
    dosage_profiles: [],
    scaling_profiles: [],
  }
}

async function openAccelerator(page: Page) {
  await page.addInitScript(() => {
    localStorage.setItem('vortex_member_token', 'e2e-coach-token')
    localStorage.setItem('vortex_member', JSON.stringify({
      id: 42, fullName: 'Coach Test', email: 'coach@example.com',
      roles: ['COACH'], isCoach: true, availablePortals: ['coach'],
    }))
  })
  let selectedExerciseCard: ReturnType<typeof mockExerciseCard> | null = null
  await page.route('**/api/**', async (route) => {
    const url = new URL(route.request().url())
    let data: unknown = []
    if (url.pathname.startsWith('/api/coach/exercises/by-slug/')) {
      selectedExerciseCard = mockExerciseCard(decodeURIComponent(url.pathname.split('/').at(-1) ?? ''))
      data = selectedExerciseCard
    } else if (url.pathname === '/api/coach/exercises/9001') {
      data = selectedExerciseCard
    } else if (url.pathname === '/api/coach/taxonomy') {
      data = { tenets: [], methodologies: [], physiology: [], patterns: [], equipment: [], sports: [], intents: [], bodyRegions: [], sessionPhases: [], phaseOrderSlots: [], phaseSubroles: [] }
    } else if (url.pathname === '/api/coach/portal-config') data = {
      hiddenTabs: [],
      // Deliberately use a saved layout from before this feature existed.
      tabOrder: ['home', 'library', 'workout'],
      navLayout: [
        { type: 'tab', key: 'home' },
        { type: 'section', id: 'session-design', label: 'Session Design' },
        { type: 'tab', key: 'library' },
        { type: 'tab', key: 'workout' },
      ],
    }
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

test('Access & Prepare Standard is first and exposes the complete 15-minute routine', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await openAccelerator(page)

  const collection = page.getByLabel('Athleticism Accelerator collection')
  const routineCard = collection.getByRole('button', { name: 'Access & Prepare Standard 15min', exact: true })
  await expect(collection.locator(':scope > button').first()).toHaveAccessibleName('Access & Prepare Standard 15min')
  await expect(page.getByTestId('access-prepare-standard-metric')).toHaveClass(/text-gray-400/)
  const icon = page.getByTestId('access-prepare-standard-icon')
  await expect(icon).toHaveCSS('background-color', 'rgb(0, 0, 0)')
  await expect(icon).toHaveCSS('color', 'rgb(255, 255, 255)')
  await expect(icon.locator('path')).toHaveCount(3)

  await routineCard.click()
  await expect(page.getByRole('heading', { name: 'Access & Prepare Standard 15min', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Access & Prepare Standard routine' })).toBeVisible()

  const expectedSequence = [
    ['Easy jog', '60 seconds'],
    ['Backpedal', '10 m'],
    ['Lateral shuffle', '10 m each direction'],
    ['Carioca / karaoke', '10 m each direction'],
    ['Walking lunge + rotation/reach', '5 m'],
    ['Lateral lunge + reach', '5 m'],
    ['Inchworm → plank → bear crawl → downward dog', '10 m'],
    ['Traveling snap-down → athletic stick', '10 m'],
    ['A-march', '10 m'],
    ['A-skip', '10 m'],
    ['B-skip', '10 m'],
    ['C-skip', '10 m'],
    ['Ankling', '10 m'],
    ['Low two-foot pogos', '10 contacts'],
    ['Bodyweight hip hinge + reach', '5 repetitions'],
    ['Squat-to-stand + overhead reach', '5 repetitions'],
  ] as const
  const sequence = page.getByRole('list', { name: 'Access & Prepare Standard sequence' })
  await expect(sequence.locator(':scope > li')).toHaveCount(expectedSequence.length)
  for (const [index, [name, dose]] of expectedSequence.entries()) {
    const row = sequence.locator(`:scope > li[data-routine-order="${index + 1}"]`)
    await expect(row).toContainText(name)
    await expect(row).toContainText(dose)
    await expect(row.getByRole('button', { name: `Routine details for ${name}`, exact: true })).toBeVisible()
  }

  await expect(page.getByRole('note', { name: 'Final coaching checkpoints' })).toContainText('intentionally finish the fixed sequence')
  const bridgeDrills = page.getByRole('region', { name: 'Two drills specific to today’s Explosiveness work' })
  await expect(bridgeDrills).toBeVisible()
  await expect(bridgeDrills).toContainText('Movement or position rehearsal')
  await expect(bridgeDrills).toContainText('Progressive version of the upcoming task')

  await page.getByRole('button', { name: 'Timing & delivery', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Routine intent')
  await expect(dialog).toContainText('15 minutes for the fixed sequence and the two day-specific bridge drills.')
  await expect(dialog).toContainText('Selection:')
  await expect(dialog).toContainText('Delivery')
  await expect(dialog).toContainText('Quality gates')
  await expect(dialog).toContainText('The athlete preserves the rehearsed position as task demand increases.')
  await page.getByRole('button', { name: 'Close details' }).click()

  await page.getByRole('button', { name: 'Setup, scaling & safety', exact: true }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog).toContainText('Equipment')
  await expect(dialog).toContainText('Space & group flow')
  await expect(dialog).toContainText('Safety & adjustment')
  await expect(dialog).toContainText('One clear, level 10 m travel lane per athlete or supervised wave')
  await page.getByRole('button', { name: 'Close details' }).click()

  await page.getByRole('button', { name: 'Routine details for Carioca / karaoke', exact: true }).click()
  await expect(page.getByRole('dialog')).toContainText('Version note')
  await expect(page.getByRole('dialog')).toContainText('step-behind, side-step, step-in-front, side-step')
  await page.getByRole('button', { name: 'Close details' }).click()

  const hingeDetails = page.getByRole('button', { name: 'Routine details for Bodyweight hip hinge + reach', exact: true })
  await hingeDetails.click()
  for (const section of ['Why this exercise', 'Setup', 'Execution', 'Coach cues', 'Athlete cues', 'Quality gate', 'Scaling', 'Common faults', 'Stop or switch']) {
    await expect(page.getByRole('dialog')).toContainText(section)
  }
  await page.keyboard.press('Escape')
  await expect(hingeDetails).toBeFocused()
  expect(errors).toEqual([])
})

test('coach can browse the collection, inspect daily plans, and open supplemental notes', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', (error) => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await openAccelerator(page)
  const nav = await page.locator('nav button').allTextContents()
  expect(nav[nav.findIndex((label) => label.trim() === 'Library') + 1].trim()).toBe('Athleticism Accelerator')
  await expect(page.getByRole('button', { name: /Classes$/ })).toHaveCount(programCount)
  await expect(page.getByRole('button', { name: 'Jumps: Max Air 36 Classes', exact: true })).toContainText('Vertical and horizontal jumps with force absorption and elastic rebound.')
  await page.getByRole('button', { name: 'Rotational Force: Upper Body 12 Classes', exact: true }).click()
  await expect(page.getByRole('tablist', { name: 'Accelerator programs' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: 'Back', exact: true })).toBeVisible()
  await expect(page.getByRole('region', { name: 'Rotational Force: Upper Body 12 Classes', exact: true })).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Rotational Force: Upper Body 12 Classes' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Previous class' })).toBeDisabled()
  await expect(page.getByRole('tabpanel', { name: '2. Explosiveness' }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(6)
  await expect(page.getByRole('tabpanel', { name: '2. Explosiveness' }).getByRole('button', { name: /Open exercise card for/ })).toHaveCount(6)

  const cardLink = page.getByRole('tabpanel', { name: '2. Explosiveness' }).getByRole('button', { name: /Open exercise card for/ }).first()
  const cardName = (await cardLink.getAttribute('aria-label'))!.replace('Open exercise card for ', '')
  await cardLink.click()
  await expect(page.getByRole('heading', { name: cardName, exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Media & Docs', exact: true }).click()
  await expect(page.getByTitle(cardName)).toHaveCount(3)
  await expect(page.getByRole('link', { name: 'Open on YouTube', exact: true })).toHaveCount(3)
  await page.getByRole('button', { name: 'Close', exact: true }).first().click()
  await expect(page.getByRole('heading', { name: cardName, exact: true })).toHaveCount(0)

  const notes = page.getByRole('tabpanel', { name: '2. Explosiveness' }).getByRole('button', { name: /Coaching notes for/ }).first()
  await notes.click()
  await expect(page.getByRole('dialog')).toContainText('Execution & scaling')
  await expect(page.getByRole('button', { name: 'Close details' })).toBeFocused()
  await page.keyboard.press('Escape')
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await expect(notes).toBeFocused()

  for (let n = 2; n <= 12; n++) {
    await page.getByRole('button', { name: `Class ${n}:`, exact: false }).click()
    await expect(page.getByRole('region', { name: `Class ${n} workout`, exact: true })).toBeVisible()
    await expect(page.getByRole('tabpanel', { name: '2. Explosiveness' }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(6)
  }
  await expect(page.getByRole('button', { name: 'Next class' })).toBeDisabled()
  await page.getByRole('tab', { name: '4. Primary strength' }).click()
  await expect(page.getByRole('tabpanel', { name: '4. Primary strength' }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(6)
  await expect(page.getByRole('tabpanel', { name: '4. Primary strength' }).getByRole('button', { name: /Open exercise card for/ })).toHaveCount(6)
  await page.getByRole('tab', { name: '3. Resilience' }).click()
  await expect(page.getByRole('tabpanel', { name: '3. Resilience' }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(2)
  await expect(page.getByRole('tabpanel', { name: '3. Resilience' }).getByRole('button', { name: /Open exercise card for/ })).toHaveCount(2)
  await page.getByRole('tab', { name: '1. Prepare' }).click()
  await expect(page.getByRole('tabpanel', { name: '1. Prepare' })).toContainText('do not recreate it')

  await page.getByRole('button', { name: 'Class 2:', exact: false }).click()
  await expect(page.getByRole('complementary', { name: 'Equipment for the day' })).toBeVisible()
  await page.getByRole('tab', { name: '3. Resilience' }).click()
  await expect(page.getByRole('tabpanel', { name: '3. Resilience' })).toContainText('15 s')
  await page.getByRole('button', { name: 'Plan overview' }).click()
  await page.getByRole('dialog').getByRole('button', { name: /07 Class 7/ }).click()
  await expect(page.getByRole('dialog')).toHaveCount(0)
  await page.getByRole('tab', { name: '2. Explosiveness' }).click()
  for (const title of ['Distance Running', 'Sprinting & Acceleration', 'Jumps: Horizontal', 'Jumps: Vertical', 'Jumps: Absorption & Rebound', 'Agility: Mobility', 'Agility: Reactive', 'Rotational Force: Lower Body']) {
    await page.getByRole('button', { name: 'Back', exact: true }).click()
    await page.getByRole('button', { name: `${title} 12 Classes`, exact: true }).click()
    await expect(page.getByRole('heading', { name: `${title} 12 Classes`, exact: true })).toBeVisible()
    await expect(page.getByRole('tabpanel', { name: '2. Explosiveness' }).getByRole('button', { name: /Coaching notes for/ })).toHaveCount(6)
  }
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Jumps: Max Air 36 Classes', exact: true }).click()
  await expect(page.getByRole('heading', { name: 'Jumps: Max Air 36 Classes', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: /^Class \d+:/ })).toHaveCount(36)
  await expect(page.getByRole('heading', { name: 'Control & project · Stage 1A', exact: true })).toBeVisible()
  const maxAirExplosive = page.getByRole('tabpanel', { name: '2. Explosiveness' })
  await expect(maxAirExplosive.getByText(/Force absorption & elastic rebound · Source class 1/)).toHaveCount(2)
  await expect(maxAirExplosive.getByText(/Vertical jumps · Source class 1/)).toHaveCount(2)
  await expect(maxAirExplosive.getByText(/Horizontal jumps · Source class 1/)).toHaveCount(2)
  await page.getByRole('button', { name: 'Class 2:', exact: false }).click()
  await expect(page.getByRole('heading', { name: 'Rebound & redirect · Stage 1B', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Class 36:', exact: false }).click()
  await expect(page.getByRole('heading', { name: 'Consolidate every direction · Stage 12C', exact: true })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Next class' })).toBeDisabled()
  await expect(page.getByRole('tab', { name: /Object control/ })).toHaveCount(0)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(page.getByRole('button', { name: /Classes$/ })).toHaveCount(programCount)
  expect(errors).toEqual([])
})

test('collection search and program type work together and survive returning from a program', async ({ page }) => {
  await openAccelerator(page)
  const search = page.getByRole('combobox', { name: 'Search programs', exact: true })
  const programType = page.getByRole('combobox', { name: 'Program type', exact: true })
  const cards = page.getByRole('button', { name: /Classes$/ })
  await expect(programType.locator('option')).toHaveText([
    'All programs',
    'Individual athletic focal points',
    'Grouped athletic focal points',
  ])
  await expect(programType).toHaveValue('all')
  await expect(cards).toHaveCount(programCount)

  await programType.selectOption('individual')
  await expect(cards).toHaveCount(Object.values(programs).filter((sessions) => sessions.length === 12).length)
  await expect(page.getByRole('button', { name: /36 Classes$/ })).toHaveCount(0)
  await programType.selectOption('grouped')
  await expect(cards).toHaveCount(Object.values(programs).filter((sessions) => sessions.length === 36).length)
  await expect(page.getByRole('button', { name: /12 Classes$/ })).toHaveCount(0)

  await programType.selectOption('all')
  await search.fill('  KEEP MOVING  ')
  await expect(cards).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Distance Running 12 Classes', exact: true })).toBeVisible()
  await search.fill('jumps')
  await expect(cards).toHaveCount(4)
  await programType.selectOption('grouped')
  await expect(cards).toHaveCount(1)
  await expect(page.locator('datalist option[value="Jumps: Max Air"]')).toHaveCount(1)
  await page.getByRole('button', { name: 'Jumps: Max Air 36 Classes', exact: true }).click()
  await expect(search).toHaveCount(0)
  await expect(page.getByRole('tablist', { name: 'Accelerator programs' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /^Class \d+:/ })).toHaveCount(36)
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await expect(search).toHaveValue('jumps')
  await expect(programType).toHaveValue('grouped')
  await expect(cards).toHaveCount(1)
  await expect(page.getByRole('button', { name: 'Jumps: Max Air 36 Classes', exact: true })).toBeVisible()

  await programType.selectOption('individual')
  await expect(cards).toHaveCount(3)
  await search.fill('no matching athletic program')
  await expect(cards).toHaveCount(0)
  await search.fill('')
  await programType.selectOption('all')
  await expect(cards).toHaveCount(programCount)
})

test('mobile layout fits and keyboard navigation keeps dialogs accessible', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await openAccelerator(page)
  await expect(page.getByRole('combobox', { name: 'Search programs', exact: true })).toBeVisible()
  await expect(page.getByRole('combobox', { name: 'Program type', exact: true })).toBeVisible()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Access & Prepare Standard 15min', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  await page.getByRole('button', { name: 'Routine details for Easy jog', exact: true }).click()
  let dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  let bounds = await dialog.boundingBox()
  expect(bounds!.width).toBeLessThanOrEqual(390)
  await page.keyboard.press('Escape')
  await page.getByRole('button', { name: 'Back', exact: true }).click()
  await page.getByRole('button', { name: 'Rotational Force: Upper Body 12 Classes', exact: true }).click()
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
  const explosive = page.getByRole('tab', { name: '2. Explosiveness' })
  await explosive.focus()
  await page.keyboard.press('ArrowRight')
  await expect(page.getByRole('tab', { name: '3. Resilience' })).toHaveAttribute('aria-selected', 'true')
  await page.getByRole('button', { name: 'Setup & substitutions' }).click()
  dialog = page.getByRole('dialog')
  await expect(dialog).toBeVisible()
  bounds = await dialog.boundingBox()
  expect(bounds!.width).toBeLessThanOrEqual(390)
  await page.keyboard.press('Shift+Tab')
  expect(await page.evaluate(() => document.querySelector('dialog')?.contains(document.activeElement))).toBe(true)
  await page.keyboard.press('Escape')
  await expect(dialog).toHaveCount(0)
})
