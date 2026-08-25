import assert from 'node:assert/strict'
import test from 'node:test'
import { build } from 'esbuild'

const result = await build({
  entryPoints: ['src/coach/flipFitProgram.ts'],
  bundle: true,
  write: false,
  platform: 'node',
  format: 'esm',
  target: 'node20',
})

const source = result.outputFiles[0].text
const moduleUrl = `data:text/javascript;base64,${Buffer.from(source).toString('base64')}`
const flipFit = await import(moduleUrl)

const program = flipFit.generateFlipFitProgram('2026-08-24')
const validation = flipFit.validateFlipFitProgram(program)

test('generates exactly 12 Monday-Friday weeks and 60 stable sessions', () => {
  assert.equal(program.startDate, '2026-08-24')
  assert.equal(program.endDate, '2026-11-13')
  assert.equal(program.weeks.length, 12)
  assert.equal(program.sessions.length, 60)
  assert.equal(new Set(program.sessions.map((session) => session.id)).size, 60)
  assert.equal(new Set(program.sessions.map((session) => session.date)).size, 60)
  assert.ok(program.weeks.every((week) => week.days.length === 5))
  assert.ok(program.sessions.every((session) => [1, 2, 3, 4, 5].includes(new Date(`${session.date}T00:00:00Z`).getUTCDay())))
})

test('uses the exact 10/20/20/25/10/5 phase framework plus 30-minute tumbling', () => {
  const expectedDurations = [10, 20, 20, 25, 10, 5]
  for (const session of program.sessions) {
    assert.deepEqual(session.phases.map((phase) => phase.durationMinutes), expectedDurations)
    assert.equal(session.phases.reduce((sum, phase) => sum + phase.durationMinutes, 0), 90)
    assert.equal(session.tumbling.durationMinutes, 30)
    assert.equal(session.totalMinutes, 120)
    assert.ok(session.phases.every((phase) => phase.exercises.reduce((sum, exercise) => sum + exercise.allocationMinutes, 0) === phase.durationMinutes))
    assert.equal(session.tumbling.exercises.reduce((sum, exercise) => sum + exercise.allocationMinutes, 0), 30)
  }
})

test('preserves phase order and the exact odd/even Capacity rotation', () => {
  for (const session of program.sessions) {
    const expectedCapacity = session.weekNumber % 2 === 1
      ? (session.dayNumber <= 2 ? 'capacity' : 'sustained_capacity')
      : (session.dayNumber >= 3 ? 'capacity' : 'sustained_capacity')
    assert.deepEqual(session.phases.map((phase) => phase.key), [
      'prepare_and_access',
      'movement_intelligence',
      'output',
      expectedCapacity,
      'resilience',
      'restore',
    ])
  }
})

test('makes ages 12-14 the base and gives every card a lower and upper avenue', () => {
  assert.ok(program.exerciseCards.length > 100)
  for (const card of program.exerciseCards) {
    assert.equal(card.ageScaling['9-11'].role, 'regression')
    assert.equal(card.ageScaling['12-14'].role, 'foundation')
    assert.equal(card.ageScaling['15-18'].role, 'progression')
    assert.ok(card.ageScaling['9-11'].variation)
    assert.ok(card.ageScaling['12-14'].variation)
    assert.ok(card.ageScaling['15-18'].variation)
    assert.match(card.ageScaling['12-14'].scalingGuidance, /foundation/i)
  }
})

test('keeps full foundation equipment and makes scaled equipment match each variation', () => {
  const barbellCards = program.exerciseCards.filter((card) => card.equipment.includes('Barbell'))
  assert.ok(barbellCards.length > 10)
  assert.ok(barbellCards.every((card) => card.ageScaling['12-14'].equipment.includes('Barbell')))
  assert.ok(barbellCards.every((card) => /younger than 9/i.test(card.under9EquipmentNote ?? '')))

  const romanianDeadlift = program.exerciseCards.find((card) => card.name === 'Barbell Romanian deadlift')
  assert.deepEqual(romanianDeadlift.ageScaling['9-11'].equipment, ['Kettlebell'])
  assert.deepEqual(romanianDeadlift.ageScaling['12-14'].equipment, ['Barbell', 'Kettlebell'])
  assert.deepEqual(romanianDeadlift.ageScaling['15-18'].equipment, ['Barbell'])

  const clockReach = program.exerciseCards.find((card) => card.name === 'Single-leg clock reach')
  assert.deepEqual(clockReach.ageScaling['9-11'].equipment, ['Floor markers'])
  assert.deepEqual(clockReach.ageScaling['15-18'].equipment, ['Floor markers', 'Low beam'])

  const backSquat = program.exerciseCards.find((card) => card.name === 'Barbell back squat')
  assert.deepEqual(backSquat.ageScaling['9-11'].equipment, ['Box', 'Rack', 'Youth barbell or technique bar'])
  assert.ok(program.exerciseCards.every((card) => flipFit.FLIP_FIT_AGE_BANDS.every((band) => card.ageScaling[band].equipment.length > 0)))
})

test('keeps Output and Capacity methodologies distinct', () => {
  const outputAllowed = new Set([
    'Plyometric', 'Ballistic', 'Overspeed', 'Resisted — Speed/Power Application',
    'Assisted — Speed/Power Application', 'Variable Resistance — Speed/Power Application',
    'Accommodating Resistance — Speed/Power Application',
  ])
  const capacityAllowed = new Set([
    'Resisted — Strength Application', 'Isometric — Strength Application', 'Concentric-Focused',
    'Tempo-Controlled', 'Paused', 'Variable Resistance — Strength Application',
    'Accommodating Resistance — Strength Application', 'Assisted or Scaled — Strength Application',
    'Eccentric-Focused — Strength Application',
  ])
  for (const session of program.sessions) {
    assert.ok(session.phases.find((phase) => phase.key === 'output').exercises.every((exercise) => outputAllowed.has(exercise.card.methodology)))
    const capacity = session.phases.find((phase) => phase.key === 'capacity')
    if (capacity) assert.ok(capacity.exercises.every((exercise) => capacityAllowed.has(exercise.card.methodology)))
  }
})

test('maintains stable preparation and restore cores', () => {
  const prepareIds = new Set(program.sessions.map((session) => session.phases[0].exercises[0].cardId))
  const restoreIds = new Set(program.sessions.map((session) => session.phases[5].exercises[0].cardId))
  assert.deepEqual([...prepareIds], ['prepare_and_access-vortex-locomotor-ramp-sequence'])
  assert.deepEqual([...restoreIds], ['restore-crocodile-breathing-and-mobility-reset'])
})

test('covers every tenet in every rolling two-week window', () => {
  for (let index = 0; index < program.weeks.length - 1; index += 1) {
    const rollingTenets = new Set(program.weeks.slice(index, index + 2).flatMap((week) => week.days.flatMap((day) => day.tenets)))
    for (const tenet of flipFit.FLIP_FIT_TENETS) assert.ok(rollingTenets.has(tenet), `${tenet} missing in weeks ${index + 1}-${index + 2}`)
  }
})

test('tracks card reuse/new/alias/review without duplicate canonical identities', () => {
  const inventory = flipFit.flipFitCardInventory(program)
  assert.deepEqual(inventory.map((group) => group.status), ['reused', 'alias', 'new', 'review'])
  assert.ok(inventory.every((group) => group.cards.length > 0))
  assert.equal(new Set(program.exerciseCards.map((card) => card.id)).size, program.exerciseCards.length)
})

test('maps every card ID to one deeply immutable payload and keeps schedule context outside it', () => {
  const canonicalById = new Map(program.exerciseCards.map((card) => [card.id, card]))
  const payloadsById = new Map()

  for (const session of program.sessions) {
    const exercises = [...session.phases.flatMap((phase) => phase.exercises), ...session.tumbling.exercises]
    for (const exercise of exercises) {
      assert.strictEqual(exercise.card, canonicalById.get(exercise.cardId))
      assert.equal(exercise.movementFunction, session.movementFunction)
      assert.equal(Object.isFrozen(exercise.card), true)
      assert.equal(Object.isFrozen(exercise.card.ageScaling), true)
      assert.equal(Object.isFrozen(exercise.card.ageScaling['9-11'].equipment), true)
      const payloads = payloadsById.get(exercise.cardId) ?? new Set()
      payloads.add(JSON.stringify(exercise.card))
      payloadsById.set(exercise.cardId, payloads)
    }
  }

  for (const [cardId, payloads] of payloadsById) {
    assert.equal(payloads.size, 1, `${cardId} resolved to ${payloads.size} payloads`)
  }
})

test('validator rejects a scheduled card payload that diverges from its inventory identity', () => {
  const corrupted = structuredClone(program)
  const exercise = corrupted.sessions[0].phases[0].exercises[0]
  exercise.card = { ...exercise.card, description: `${exercise.card.description} Corrupted.` }
  const result = flipFit.validateFlipFitProgram(corrupted)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((issue) => issue.code === 'cards.immutable_payload'))
})

test('derives daily and weekly stress from the scheduled exercise evidence', () => {
  for (const session of program.sessions) {
    const exercises = [...session.phases.flatMap((phase) => phase.exercises), ...session.tumbling.exercises]
    const expectedModerateImpact = exercises
      .filter((exercise) => exercise.card.impactLevel === 'moderate')
      .reduce((sum, exercise) => sum + exercise.allocationMinutes, 0)
    const expectedEccentric = exercises
      .filter((exercise) => /eccentric/i.test(exercise.card.methodology))
      .reduce((sum, exercise) => sum + exercise.allocationMinutes, 0)
    assert.deepEqual(session.stress, flipFit.deriveFlipFitStressProfile(exercises))
    assert.equal(session.stress.evidence.moderateImpactMinutes, expectedModerateImpact)
    assert.equal(session.stress.evidence.eccentricMinutes, expectedEccentric)
    assert.ok(Object.keys(session.stress.regionLoad).length > 0)
  }

  const mondayFingerprints = new Set(program.sessions
    .filter((session) => session.dayNumber === 1)
    .map((session) => JSON.stringify([session.stress.primaryRegion, session.stress.impact, session.stress.eccentricDemand, session.stress.regionLoad])))
  assert.ok(mondayFingerprints.size > 4, 'stress should follow scheduled cards, not a fixed Monday profile')

  for (const week of program.weeks) {
    assert.deepEqual(week.coverage.stress, flipFit.summarizeFlipFitWeeklyStress(week.days))
    assert.ok(week.coverage.stress.bodyRegions.length > 0)
    assert.equal(week.coverage.stress.recovery.restoreMinutes, 25)
    const expectedEquipment = [...new Set(week.days.flatMap((day) => [
      ...day.phases.flatMap((phase) => phase.exercises),
      ...day.tumbling.exercises,
    ]).flatMap((exercise) => exercise.card.equipment))].sort()
    assert.deepEqual(week.coverage.equipment, expectedEquipment)
  }
})

test('validator rejects a stale or fabricated stress snapshot', () => {
  const corrupted = structuredClone(program)
  corrupted.sessions[0].stress.impact = corrupted.sessions[0].stress.impact === 1 ? 3 : 1
  const result = flipFit.validateFlipFitProgram(corrupted)
  assert.equal(result.valid, false)
  assert.ok(result.errors.some((issue) => issue.code === 'stress.derived_profile'))
})

test('validates the realistic program and emits only evidence-based stress warnings', () => {
  assert.equal(validation.valid, true, validation.errors.map((issue) => issue.message).join('\n'))
  assert.deepEqual(validation.errors, [])
  assert.ok(validation.warnings.length > 0)
  assert.ok(validation.warnings.length < 20)
  assert.ok(validation.warnings.every((issue) => issue.severity === 'warning' && issue.code.startsWith('stress.consecutive_')))
  assert.ok(validation.warnings.every((issue) => /weighted load|minutes/i.test(issue.message) && issue.resolution.length > 30))
  assert.ok(validation.warnings.some((issue) => issue.code === 'stress.consecutive_impact'))
  assert.ok(validation.warnings.some((issue) => issue.code === 'stress.consecutive_region'))
  assert.ok(validation.checks > 1_000)
})

test('is deterministic and rejects non-Monday anchors', () => {
  assert.deepEqual(flipFit.generateFlipFitProgram('2026-08-24'), program)
  assert.throws(() => flipFit.generateFlipFitProgram('2026-08-25'), /Monday/)
  assert.equal(flipFit.flipFitEndDate('2028-02-28'), '2028-05-19')
})

test('uses one shared tumbling period without changing either athletic workout', () => {
  assert.equal(flipFit.FLIP_FIT_ATHLETE_SETS[0].blocks[0].label, 'Athletic workout')
  assert.equal(flipFit.FLIP_FIT_ATHLETE_SETS[0].blocks[1].label, 'Shared tumbling')
  assert.equal(flipFit.FLIP_FIT_ATHLETE_SETS[1].blocks[0].label, 'Shared tumbling')
  assert.equal(flipFit.FLIP_FIT_ATHLETE_SETS[1].blocks[1].label, 'Athletic workout')
  assert.ok(flipFit.FLIP_FIT_ATHLETE_SETS.every((set) => set.totalMinutes === 120))
})
