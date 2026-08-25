import assert from 'node:assert/strict'
import test from 'node:test'

import { validateCanonicalCardDraft } from '../canonicalCardAuthoring.js'
import {
  flipFitCardToCanonicalDraft,
  normalizeFlipFitProgramCard,
  reconcileFlipFitCards,
} from '../flipFitCardRepository.js'
import { registerFlipFitCardRoutes } from '../flipFitCardRoutes.js'

const TAXONOMY_ROWS = [
  { kind: 'movementPatterns', key: 'push', name: 'Push' },
  { kind: 'movementPatterns', key: 'pull', name: 'Pull' },
  { kind: 'movementPatterns', key: 'squat', name: 'Squat' },
  { kind: 'bodyRegions', key: 'shoulder', name: 'Shoulder' },
  { kind: 'bodyRegions', key: 'rib_cage', name: 'Rib Cage' },
  { kind: 'bodyRegions', key: 'core', name: 'Core' },
  { kind: 'equipment', key: 'none', name: 'None / Bodyweight' },
  { kind: 'equipment', key: 'bench', name: 'Bench' },
  { kind: 'methodologies', key: 'strength_training', name: 'Strength Training' },
  { kind: 'tenets', key: 'strength', name: 'Strength' },
  { kind: 'tenets', key: 'body_control', name: 'Body Control' },
]

function sampleCard(overrides = {}) {
  const prescription = (ageBand, role, variation) => ({
    ageBand,
    role,
    variation,
    dosage: '3 sets · 5 reps',
    work: '20 sec',
    rest: '60 sec',
    intensity: 'RPE 5',
    intent: 'Repeat technically sound work.',
    equipment: ['Bodyweight'],
    scalingGuidance: 'Scale one variable at a time.',
    readinessGate: 'Pain-free repeatable technique.',
  })
  return {
    id: 'capacity-push-up',
    name: 'Push-up',
    aliases: ['Push up'],
    description: 'A horizontal pushing exercise.',
    instructions: ['Set a stable plank.', 'Lower and press.'],
    coachingCues: ['Stay long through the crown and heels.'],
    commonErrors: ['Hips sag'],
    movementPattern: 'Push',
    movementFunction: 'Balance and Body Control',
    phase: 'capacity',
    methodology: 'Tempo-Controlled',
    tenets: ['Strength', 'Body Control'],
    bodyRegions: ['Shoulder', 'Chest', 'Trunk'],
    equipment: ['Bodyweight'],
    impactLevel: 'low',
    freshnessRequirement: 'moderate',
    safetyNotes: ['Stop for pain.'],
    supervision: 'Active coach supervision.',
    prerequisites: ['Stable front support'],
    matchStatus: 'reused',
    ageScaling: {
      '9-11': prescription('9-11', 'regression', 'Hands-elevated push-up'),
      '12-14': prescription('12-14', 'foundation', 'Push-up'),
      '15-18': prescription('15-18', 'progression', 'Loaded push-up'),
    },
    ...overrides,
  }
}

function semanticProfile(overrides = {}) {
  return {
    phaseKey: 'capacity',
    equipment: ['none'],
    programming: {
      movementPatternKeys: ['push'],
      methodologyKeys: ['strength_training'],
      tenetKeys: ['strength', 'body_control'],
      movementFunctions: ['Balance and Body Control'],
      bodyRegionKeys: ['shoulder', 'rib_cage', 'core'],
    },
    objectiveRelevance: {
      movementFunctions: ['Balance and Body Control'],
      tenetKeys: ['strength', 'body_control'],
    },
    ...overrides,
  }
}

function canonicalDefinition(overrides = {}) {
  return {
    id: '11111111-1111-4111-8111-111111111111',
    slug: 'push-up',
    canonical_name: 'Push-up',
    display_name: 'Push-up',
    aliases: ['Push up'],
    family_key: 'horizontal-push',
    status: 'published',
    movement_patterns: ['push'],
    body_regions: ['shoulder', 'rib_cage', 'core'],
    required_equipment: ['none'],
    optional_equipment: [],
    semantic_profiles: [semanticProfile()],
    ...overrides,
  }
}

function uuidFor(prefix, number) {
  return `${prefix}0000-0000-4000-8000-${String(number).padStart(12, '0')}`
}

function transactionalHarness({
  definitions = [],
  references = [],
  taxonomyRows = TAXONOMY_ROWS,
  failUpsertCardKey = null,
} = {}) {
  const queries = []
  const state = {
    definitions: structuredClone(definitions),
    references: new Map(references.map((row) => [row.program_card_key, structuredClone(row)])),
    revisions: [],
    variants: new Map(),
  }
  let snapshot = null
  let connectCount = 0
  let definitionSequence = 1
  let variantSequence = 1
  let profileSequence = 1

  const definitionFor = (id) => state.definitions.find((row) => String(row.id) === String(id))
  const joinedReference = (row) => {
    const definition = definitionFor(row.canonical_definition_id)
    return {
      ...row,
      canonical_display_name: definition?.display_name ?? null,
      canonical_status: definition?.status ?? null,
    }
  }

  const client = {
    released: false,
    async query(sql, params = []) {
      queries.push({ sql, params })
      if (sql === 'BEGIN') {
        snapshot = {
          definitions: structuredClone(state.definitions),
          references: structuredClone([...state.references.entries()]),
          revisions: structuredClone(state.revisions),
          variants: structuredClone([...state.variants.entries()]),
        }
        return { rows: [] }
      }
      if (sql === 'COMMIT') {
        snapshot = null
        return { rows: [] }
      }
      if (sql === 'ROLLBACK') {
        if (snapshot) {
          state.definitions = snapshot.definitions
          state.references = new Map(snapshot.references)
          state.revisions = snapshot.revisions
          state.variants = new Map(snapshot.variants)
        }
        snapshot = null
        return { rows: [] }
      }
      if (sql.includes('pg_advisory_xact_lock')) return { rows: [{}] }
      if (sql.includes("SELECT 'movementPatterns'::text AS kind")) return { rows: taxonomyRows }
      if (sql.trim() === 'SELECT key FROM coaching.movement_pattern') {
        return { rows: taxonomyRows.filter((row) => row.kind === 'movementPatterns').map(({ key }) => ({ key })) }
      }
      if (sql.trim() === 'SELECT key FROM coaching.body_region') {
        return { rows: taxonomyRows.filter((row) => row.kind === 'bodyRegions').map(({ key }) => ({ key })) }
      }
      if (sql.trim() === 'SELECT key FROM coaching.equipment') {
        return { rows: taxonomyRows.filter((row) => row.kind === 'equipment').map(({ key }) => ({ key })) }
      }
      if (sql.includes('AS semantic_profiles')) return { rows: structuredClone(state.definitions) }
      if (sql.includes('FROM coaching.flip_fit_card_reference reference')) {
        return { rows: [...state.references.values()].map(joinedReference) }
      }
      if (sql.includes('candidate_resolution')) {
        return {
          rows: state.definitions
            .filter((row) => row.status !== 'archived')
            .map((row) => ({
              ...row,
              identity_resolution_id: null,
              identity_resolution_decision: null,
              identity_resolution_source: null,
            })),
        }
      }
      if (sql.includes('INSERT INTO coaching.exercise_definition_v1')) {
        const definition = {
          id: uuidFor('2222', definitionSequence++),
          slug: params[1],
          canonical_name: params[2],
          display_name: params[3],
          aliases: params[4],
          description: params[5],
          family_key: params[6],
          status: 'draft',
          movement_patterns: params[10],
          body_regions: params[11],
          required_equipment: params[12],
          optional_equipment: params[13],
          semantic_profiles: [],
        }
        state.definitions.push(definition)
        return { rows: [{ id: definition.id }] }
      }
      if (sql.includes('INSERT INTO coaching.exercise_variant_v1')) {
        const id = uuidFor('3333', variantSequence++)
        state.variants.set(id, {
          definitionId: params[0],
          programming: JSON.parse(params[8]),
        })
        return { rows: [{ id }] }
      }
      if (sql.includes('INSERT INTO coaching.exercise_delivery_profile_v1')) {
        const variant = state.variants.get(params[0])
        const definition = definitionFor(variant?.definitionId)
        definition?.semantic_profiles.push({
          phaseKey: params[2],
          equipment: params[14],
          programming: variant.programming,
          objectiveRelevance: JSON.parse(params[7]),
        })
        return { rows: [{ id: uuidFor('4444', profileSequence++) }] }
      }
      if (sql.includes('UPDATE coaching.exercise_delivery_profile_v1')) return { rows: [] }
      if (sql.includes('UPDATE coaching.exercise_variant_v1')) return { rows: [] }
      if (sql.includes('INSERT INTO coaching.exercise_card_revision_v1')) {
        state.revisions.push({ definitionId: params[0], action: params[2] })
        return { rows: [] }
      }
      if (sql.includes('WITH upserted AS (') && sql.includes('coaching.flip_fit_card_reference')) {
        if (params[1] === failUpsertCardKey) throw new Error(`Injected upsert failure for ${params[1]}`)
        const row = {
          facility_id: params[0],
          program_card_key: params[1],
          canonical_definition_id: params[2],
          match_status: params[3],
          match_reason: params[4],
          match_score: params[5],
          payload_hash: params[6],
          payload_json: JSON.parse(params[7]),
          reconciled_by: params[8],
          updated_at: '2026-08-17T00:00:00.000Z',
        }
        state.references.set(row.program_card_key, row)
        return { rows: [joinedReference(row)] }
      }
      throw new Error(`Unexpected query: ${sql}`)
    },
    release() {
      this.released = true
    },
  }
  const pool = {
    async connect() {
      connectCount += 1
      client.released = false
      return client
    },
    async query(sql) {
      throw new Error(`Query escaped the transaction client: ${sql}`)
    },
  }
  return {
    pool,
    client,
    queries,
    state,
    get connectCount() {
      return connectCount
    },
  }
}

test('strictly normalizes the complete three-band program-card contract', () => {
  const normalized = normalizeFlipFitProgramCard(sampleCard())
  assert.equal(normalized.id, 'capacity-push-up')
  assert.deepEqual(normalized.movementFunctions, ['Balance and Body Control'])
  assert.equal(normalized.ageScaling['12-14'].role, 'foundation')

  const missingBand = sampleCard({ ageScaling: {} })
  assert.throws(() => normalizeFlipFitProgramCard(missingBand), /Age band 9-11 is missing its prescription/)

  const wrongRole = sampleCard()
  wrongRole.ageScaling['12-14'].role = 'progression'
  assert.throws(() => normalizeFlipFitProgramCard(wrongRole), /must use the foundation role/)

  const missingDose = sampleCard()
  missingDose.ageScaling['9-11'].dosage = ''
  assert.throws(() => normalizeFlipFitProgramCard(missingDose), /missing required prescription fields: dosage/)

  const currentProgramContract = normalizeFlipFitProgramCard(sampleCard({ movementFunction: '' }))
  assert.deepEqual(currentProgramContract.movementFunctions, [])
  assert.throws(
    () => normalizeFlipFitProgramCard(sampleCard({ matchStatus: 'guessed' })),
    /invalid card-matching status/,
  )
})

test('maps a Flip & Fit card into a valid canonical draft with three variants', () => {
  const draft = flipFitCardToCanonicalDraft(normalizeFlipFitProgramCard(sampleCard()))
  const validation = validateCanonicalCardDraft(draft)
  assert.equal(validation.valid, true, validation.errors.join('\n'))
  assert.deepEqual(validation.normalized.variants.map((variant) => variant.variantKey), [
    'ages-9-11', 'ages-12-14', 'ages-15-18',
  ])
  assert.equal(validation.normalized.variants[1].profiles[0].phaseKey, 'capacity')
})

test('reuses an exact identity only when semantic facets agree and returns joined metadata', async () => {
  const harness = transactionalHarness({ definitions: [canonicalDefinition()] })
  const result = await reconcileFlipFitCards(harness.pool, 7, 11, [sampleCard()])

  assert.equal(result.cards[0].canonicalDefinitionId, '11111111-1111-4111-8111-111111111111')
  assert.equal(result.cards[0].canonicalDisplayName, 'Push-up')
  assert.equal(result.cards[0].canonicalStatus, 'published')
  assert.equal(result.cards[0].matchStatus, 'reused')
  assert.deepEqual(result.counts, { reused: 1, alias: 0, new: 0, review: 0 })
  assert.equal(harness.connectCount, 1)
  assert.equal(harness.client.released, true)
  assert.equal(harness.queries.at(0).sql, 'BEGIN')
  assert.equal(harness.queries.at(-1).sql, 'COMMIT')
})

test('routes an exact-name semantic collision to coach review instead of auto-reuse', async () => {
  const conflicting = canonicalDefinition({
    movement_patterns: ['pull'],
    semantic_profiles: [semanticProfile({
      programming: {
        movementPatternKeys: ['pull'],
        methodologyKeys: ['strength_training'],
        tenetKeys: ['strength'],
        movementFunctions: ['Traversal and Upper-Body Locomotion'],
      },
    })],
  })
  const harness = transactionalHarness({ definitions: [conflicting] })
  const result = await reconcileFlipFitCards(harness.pool, 7, 11, [sampleCard()])

  assert.equal(result.cards[0].matchStatus, 'review')
  assert.match(result.cards[0].matchReason, /semantic review/)
  assert.match(result.cards[0].matchReason, /movement pattern conflicts/)
  assert.equal(harness.state.definitions.length, 1)
})

test('creates a canonical draft with controlled taxonomy on the shared request transaction', async () => {
  const harness = transactionalHarness()
  const result = await reconcileFlipFitCards(harness.pool, 7, 11, [sampleCard()])

  assert.equal(result.cards[0].matchStatus, 'new')
  assert.equal(result.cards[0].canonicalDisplayName, 'Push-up')
  assert.equal(result.cards[0].canonicalStatus, 'draft')
  assert.equal(harness.state.definitions.length, 1)
  assert.deepEqual(harness.state.definitions[0].movement_patterns, ['push'])
  assert.deepEqual(harness.state.definitions[0].body_regions, ['shoulder', 'rib_cage', 'core'])
  assert.deepEqual(harness.state.definitions[0].required_equipment, ['none'])
  assert.equal(harness.state.revisions.length, 1)
  assert.equal(harness.connectCount, 1)
  assert.equal(harness.queries.filter(({ sql }) => sql === 'BEGIN').length, 1)
  assert.equal(harness.queries.filter(({ sql }) => sql === 'COMMIT').length, 1)
  assert.equal(harness.queries.filter(({ sql }) => sql.includes('pg_advisory_xact_lock')).length, 1)

  const profileWrites = harness.queries.filter(({ sql }) => (
    sql.includes('INSERT INTO coaching.exercise_delivery_profile_v1')
  ))
  assert.equal(profileWrites.length, 3)
  assert.ok(profileWrites.every(({ params }) => params[14].includes('none')))
})

test('rerunning the same inventory reuses its reference without another canonical write', async () => {
  const harness = transactionalHarness()
  const first = await reconcileFlipFitCards(harness.pool, 7, 11, [sampleCard()])
  const second = await reconcileFlipFitCards(harness.pool, 7, 11, [sampleCard()])

  assert.equal(second.cards[0].canonicalDefinitionId, first.cards[0].canonicalDefinitionId)
  assert.equal(second.cards[0].matchStatus, 'new')
  assert.equal(harness.state.definitions.length, 1)
  assert.equal(harness.state.revisions.length, 1)
  assert.equal(harness.queries.filter(({ sql }) => sql.includes('INSERT INTO coaching.exercise_definition_v1')).length, 1)
})

test('revalidates an unchanged linked card when canonical semantics drift', async () => {
  const harness = transactionalHarness({ definitions: [canonicalDefinition()] })
  const first = await reconcileFlipFitCards(harness.pool, 7, 11, [sampleCard()])
  assert.equal(first.cards[0].matchStatus, 'reused')

  harness.state.definitions[0].movement_patterns = ['pull']
  harness.state.definitions[0].semantic_profiles = [semanticProfile({
    programming: {
      movementPatternKeys: ['pull'],
      methodologyKeys: ['strength_training'],
      tenetKeys: ['strength', 'body_control'],
      movementFunctions: ['Balance and Body Control'],
      bodyRegionKeys: ['shoulder', 'rib_cage', 'core'],
    },
  })]
  const second = await reconcileFlipFitCards(harness.pool, 7, 11, [sampleCard()])

  assert.equal(second.cards[0].canonicalDefinitionId, canonicalDefinition().id)
  assert.equal(second.cards[0].matchStatus, 'review')
  assert.match(second.cards[0].matchReason, /Existing canonical link needs review after library change/)
  assert.match(second.cards[0].matchReason, /movement pattern conflicts/)
  assert.equal(harness.state.definitions.length, 1)
})

test('retries an unchanged unlinked review after controlled taxonomy improves', async () => {
  const taxonomyRows = structuredClone(TAXONOMY_ROWS)
  const harness = transactionalHarness({ taxonomyRows })
  const unresolvedCard = sampleCard({
    equipment: ['Unregistered hover rig'],
    ageScaling: Object.fromEntries(Object.entries(sampleCard().ageScaling).map(([band, prescription]) => [
      band,
      { ...prescription, equipment: ['Unregistered hover rig'] },
    ])),
  })

  const first = await reconcileFlipFitCards(harness.pool, 7, 11, [unresolvedCard])
  assert.equal(first.cards[0].matchStatus, 'review')
  assert.equal(first.cards[0].canonicalDefinitionId, null)

  taxonomyRows.push({ kind: 'equipment', key: 'hover_rig', name: 'Unregistered hover rig' })
  const second = await reconcileFlipFitCards(harness.pool, 7, 11, [unresolvedCard])

  assert.equal(second.cards[0].matchStatus, 'new')
  assert.ok(second.cards[0].canonicalDefinitionId)
  assert.equal(harness.state.definitions.length, 1)
  assert.equal(harness.state.revisions.length, 1)
})

test('keeps an archived deterministic card in review instead of colliding on its slug', async () => {
  const archived = canonicalDefinition({
    slug: 'flip-fit-capacity-push-up',
    status: 'archived',
  })
  const harness = transactionalHarness({ definitions: [archived] })
  const result = await reconcileFlipFitCards(harness.pool, 7, 11, [sampleCard()])

  assert.equal(result.cards[0].matchStatus, 'review')
  assert.equal(result.cards[0].canonicalDefinitionId, archived.id)
  assert.equal(result.cards[0].canonicalStatus, 'archived')
  assert.match(result.cards[0].matchReason, /archived/)
  assert.equal(harness.queries.some(({ sql }) => sql.includes('INSERT INTO coaching.exercise_definition_v1')), false)
})

test('rolls back the whole request when a later reference write fails', async () => {
  const secondCard = sampleCard({
    id: 'capacity-squat',
    name: 'Squat',
    aliases: ['Air squat'],
    movementPattern: 'Squat',
  })
  const harness = transactionalHarness({ failUpsertCardKey: secondCard.id })

  await assert.rejects(
    reconcileFlipFitCards(harness.pool, 7, 11, [sampleCard(), secondCard]),
    /Injected upsert failure/,
  )
  assert.equal(harness.state.definitions.length, 0)
  assert.equal(harness.state.references.size, 0)
  assert.equal(harness.state.revisions.length, 0)
  assert.equal(harness.queries.filter(({ sql }) => sql === 'ROLLBACK').length, 1)
  assert.equal(harness.queries.filter(({ sql }) => sql === 'COMMIT').length, 0)
  assert.equal(harness.client.released, true)
})

test('unresolved controlled taxonomy becomes review instead of a failed canonical insert', async () => {
  const harness = transactionalHarness()
  const result = await reconcileFlipFitCards(harness.pool, 7, 11, [sampleCard({
    equipment: ['Unregistered hover rig'],
    ageScaling: Object.fromEntries(Object.entries(sampleCard().ageScaling).map(([band, prescription]) => [
      band,
      { ...prescription, equipment: ['Unregistered hover rig'] },
    ])),
  })])

  assert.equal(result.cards[0].matchStatus, 'review')
  assert.match(result.cards[0].matchReason, /Unresolved controlled taxonomy/)
  assert.equal(result.cards[0].canonicalDefinitionId, null)
  assert.equal(harness.state.definitions.length, 0)
})

test('card routes require view for loading and manage for reconciliation', () => {
  const permissions = []
  const app = { get() {}, post() {} }
  registerFlipFitCardRoutes(app, {}, {
    can(permission) {
      permissions.push(permission)
      return []
    },
    ok() {},
    bad() {},
  })
  assert.deepEqual(permissions, ['library.view', 'library.manage'])
})
