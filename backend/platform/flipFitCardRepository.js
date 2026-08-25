import crypto from 'crypto'

import {
  buildCanonicalDuplicateIndex,
  findPotentialCanonicalDuplicatesFromIndex,
} from './canonicalCardAuthoring.js'
import {
  saveCanonicalCardDraftInTransaction,
  withCanonicalCardTransaction,
} from './canonicalCardRepository.js'

const MATCH_STATUSES = new Set(['reused', 'alias', 'new', 'review'])
const AGE_BANDS = ['9-11', '12-14', '15-18']
const AGE_BAND_ROLES = Object.freeze({
  '9-11': 'regression',
  '12-14': 'foundation',
  '15-18': 'progression',
})
const PHASES = new Set([
  'prepare_and_access',
  'movement_intelligence',
  'output',
  'capacity',
  'sustained_capacity',
  'resilience',
  'restore',
  'tumbling',
])
const IMPACT_LEVELS = new Set(['low', 'moderate', 'high'])
const FRESHNESS_LEVELS = new Set(['low', 'moderate', 'high'])
const MAX_CARDS = 500

const TAXONOMY_KINDS = Object.freeze([
  'movementPatterns',
  'bodyRegions',
  'equipment',
  'methodologies',
  'tenets',
])

const TAXONOMY_KEY_HINTS = Object.freeze({
  movementPatterns: {
    'movement skill': ['locomote'],
    'explosive locomotion': ['locomote'],
    strength: [],
    'tissue capacity': [],
    'tumbling skill': ['invert'],
    'lunge or split stance': ['squat'],
    'foot and ankle': ['land'],
    'horizontal force': ['locomote'],
    'simple locomotion': ['locomote'],
    acceleration: ['locomote'],
    'sprint mechanics': ['locomote'],
    sprint: ['locomote'],
    deceleration: ['land', 'locomote'],
    'reactive movement': ['locomote'],
    'reactive agility': ['locomote'],
    rotation: ['rotate'],
  },
  bodyRegions: {
    back: ['spine'],
    chest: ['rib_cage'],
    trunk: ['core'],
    grip: ['hand', 'forearm'],
    shin: ['lower_leg'],
    quadriceps: ['thigh'],
    hamstring: ['hamstring'],
    hamstrings: ['hamstrings'],
  },
  equipment: {
    bodyweight: ['none'],
    floor: ['none'],
    'resistance band': ['bands'],
    'youth barbell or technique bar': ['barbell'],
    'light dumbbell': ['dumbbell'],
    'light plate': ['plates'],
    'low plate': ['plates'],
    'weight vest': ['weighted_vest'],
    'floor line': ['line_tape'],
    'low box': ['box'],
    'low block': ['low_step'],
    'spotting block': ['panel_mat'],
    'vault block': ['panel_mat'],
    blocks: ['platform'],
    'high bar': ['bar'],
    'low bar': ['bar'],
    'colored cones': ['cones'],
    balls: ['ball'],
    'soft ball': ['ball'],
    'jump target': ['overhead_target'],
    target: ['floor_markers'],
    targets: ['floor_markers'],
    'target mat': ['landing_mat'],
    'low obstacles': ['low_hurdles'],
    'nordic anchor': ['nordic_bench'],
    'program stations': ['floor_markers'],
    'sprint assistance': ['harness'],
    support: ['stable_support'],
    'tape measure': ['measuring_tape'],
    'wedge mat': ['wedge'],
    'battle rope': ['rope'],
  },
  methodologies: {
    plyometric: ['plyometrics'],
    ballistic: ['power_strength'],
    overspeed: ['speed_agility'],
    'skill acquisition': ['neural'],
    'skill progression': ['neural'],
    'tempo controlled': ['strength_training'],
    paused: ['strength_training'],
    'concentric focused': ['strength_training'],
    'resisted strength application': ['strength_training'],
    'variable resistance strength application': ['strength_training'],
    'accommodating resistance strength application': ['strength_training'],
    'assisted or scaled strength application': ['strength_training'],
    'eccentric focused strength application': ['eccentric_negative'],
    'isometric strength application': ['isometrics'],
    'resisted speed power application': ['power_strength'],
    'assisted speed power application': ['power_strength'],
    'variable resistance speed power application': ['power_strength'],
    'accommodating resistance speed power application': ['power_strength'],
    'simple interval': ['hiit'],
    'carry circuit': ['hiit'],
    'tempo locomotion': ['hiit'],
  },
  tenets: {
    'body control': ['body_control'],
    'flexibility and mobility': ['flexibility'],
  },
})

export class FlipFitCardReconciliationError extends Error {
  constructor(message, status = 400, code = 'invalid_flip_fit_card_inventory') {
    super(message)
    this.name = 'FlipFitCardReconciliationError'
    this.status = status
    this.code = code
  }
}

function text(value, max = 1000) {
  return typeof value === 'string' ? value.trim().slice(0, max) : ''
}

function list(value, maxItems = 100) {
  return Array.isArray(value)
    ? [...new Set(value.map((item) => text(item, 500)).filter(Boolean))].slice(0, maxItems)
    : []
}

function object(value) {
  return value && typeof value === 'object' && !Array.isArray(value) ? value : {}
}

function normalizeIdentity(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, ' ')
    .trim()
}

function slugify(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-|-$)/g, '')
    .slice(0, 90)
}

function normalizePrescription(value, ageBand) {
  const raw = object(value)
  const prescription = {
    ageBand,
    role: text(raw.role, 40),
    variation: text(raw.variation, 300),
    dosage: text(raw.dosage, 300),
    work: text(raw.work, 300),
    rest: text(raw.rest, 300),
    intensity: text(raw.intensity, 300),
    intent: text(raw.intent, 1000),
    equipment: list(raw.equipment, 30),
    scalingGuidance: text(raw.scalingGuidance, 1500),
    readinessGate: text(raw.readinessGate, 1500),
  }
  const expectedRole = AGE_BAND_ROLES[ageBand]
  const missingFields = [
    'variation',
    'dosage',
    'work',
    'rest',
    'intensity',
    'intent',
    'scalingGuidance',
    'readinessGate',
  ].filter((field) => !prescription[field])
  if (Object.keys(raw).length === 0) {
    throw new FlipFitCardReconciliationError(`Age band ${ageBand} is missing its prescription.`)
  }
  if (raw.ageBand != null && text(raw.ageBand, 20) !== ageBand) {
    throw new FlipFitCardReconciliationError(`Age band ${ageBand} has a mismatched ageBand value.`)
  }
  if (prescription.role !== expectedRole) {
    throw new FlipFitCardReconciliationError(`Age band ${ageBand} must use the ${expectedRole} role.`)
  }
  if (missingFields.length > 0) {
    throw new FlipFitCardReconciliationError(
      `Age band ${ageBand} is missing required prescription fields: ${missingFields.join(', ')}.`,
    )
  }
  if (prescription.equipment.length === 0) {
    throw new FlipFitCardReconciliationError(`Age band ${ageBand} must declare equipment.`)
  }
  return prescription
}

export function normalizeFlipFitProgramCard(raw) {
  const source = object(raw)
  const id = text(source.id, 180)
  const name = text(source.name, 220)
  if (!id || !name) {
    throw new FlipFitCardReconciliationError('Every Flip & Fit card needs a stable id and name.')
  }
  if (!slugify(id)) {
    throw new FlipFitCardReconciliationError('Every Flip & Fit card id must contain a letter or number.')
  }
  const ageScaling = object(source.ageScaling)
  const card = {
    id,
    name,
    aliases: list(source.aliases, 30),
    description: text(source.description, 4000),
    instructions: list(source.instructions, 30),
    coachingCues: list(source.coachingCues, 30),
    commonErrors: list(source.commonErrors, 30),
    movementPattern: text(source.movementPattern, 220),
    movementFunctions: list(
      Array.isArray(source.movementFunctions)
        ? source.movementFunctions
        : [source.movementFunction],
      20,
    ),
    phase: text(source.phase, 80),
    methodology: text(source.methodology, 220),
    tenets: list(source.tenets, 20),
    bodyRegions: list(source.bodyRegions, 30),
    equipment: list(source.equipment, 30),
    impactLevel: text(source.impactLevel, 30),
    freshnessRequirement: text(source.freshnessRequirement, 30),
    safetyNotes: list(source.safetyNotes, 30),
    supervision: text(source.supervision, 2000),
    prerequisites: list(source.prerequisites, 30),
    matchStatus: MATCH_STATUSES.has(source.matchStatus) ? source.matchStatus : 'review',
    ageScaling: Object.fromEntries(AGE_BANDS.map((band) => [
      band,
      normalizePrescription(ageScaling[band], band),
    ])),
    under9EquipmentNote: text(source.under9EquipmentNote, 2000) || null,
  }
  const missingFields = [
    'description',
    'movementPattern',
    'phase',
    'methodology',
    'impactLevel',
    'freshnessRequirement',
    'supervision',
  ].filter((field) => !card[field])
  const missingLists = [
    'instructions',
    'coachingCues',
    'commonErrors',
    'tenets',
    'bodyRegions',
    'equipment',
    'safetyNotes',
    'prerequisites',
  ].filter((field) => card[field].length === 0)
  if (missingFields.length > 0 || missingLists.length > 0) {
    throw new FlipFitCardReconciliationError(
      `${name} is missing required card fields: ${[...missingFields, ...missingLists].join(', ')}.`,
    )
  }
  if (!PHASES.has(card.phase)) {
    throw new FlipFitCardReconciliationError(`${name} has an invalid phase.`)
  }
  if (!IMPACT_LEVELS.has(card.impactLevel)) {
    throw new FlipFitCardReconciliationError(`${name} has an invalid impact level.`)
  }
  if (!FRESHNESS_LEVELS.has(card.freshnessRequirement)) {
    throw new FlipFitCardReconciliationError(`${name} has an invalid freshness requirement.`)
  }
  if (!MATCH_STATUSES.has(source.matchStatus)) {
    throw new FlipFitCardReconciliationError(`${name} has an invalid card-matching status.`)
  }
  return card
}

function cardHash(card) {
  return crypto.createHash('sha256').update(JSON.stringify(card)).digest('hex')
}

function canonicalPhase(phase) {
  return phase === 'tumbling' ? 'movement_intelligence' : phase
}

function singularIdentity(value) {
  return normalizeIdentity(value)
    .replace(/\b([a-z]{3,})ies\b/g, '$1y')
    .replace(/\b([a-z]{3,}[^s])s\b/g, '$1')
}

function taxonomyAliasValues(key, name) {
  const values = new Set([normalizeIdentity(key), normalizeIdentity(name)])
  for (const part of String(name ?? '').split(/\s*(?:\/|\bor\b|,|\(|\))\s*/i)) {
    if (normalizeIdentity(part)) values.add(normalizeIdentity(part))
  }
  for (const value of [...values]) values.add(singularIdentity(value))
  return [...values].filter(Boolean)
}

function buildTaxonomyRegistry(rows) {
  const registry = Object.fromEntries(TAXONOMY_KINDS.map((kind) => [kind, {
    aliases: new Map(),
    keys: new Set(),
  }]))
  for (const row of rows) {
    const group = registry[row.kind]
    if (!group || !row.key) continue
    const key = String(row.key)
    group.keys.add(key)
    for (const alias of taxonomyAliasValues(key, row.name)) {
      const current = group.aliases.get(alias)
      if (current == null) group.aliases.set(alias, key)
      else if (current !== key) group.aliases.set(alias, false)
    }
  }
  return registry
}

async function loadTaxonomyRegistry(client) {
  const result = await client.query(
    `SELECT 'movementPatterns'::text AS kind, key, name FROM coaching.movement_pattern
     UNION ALL
     SELECT 'bodyRegions'::text AS kind, key, name FROM coaching.body_region
     UNION ALL
     SELECT 'equipment'::text AS kind, key, name FROM coaching.equipment
     UNION ALL
     SELECT 'methodologies'::text AS kind, key, name FROM coaching.methodology
     UNION ALL
     SELECT 'tenets'::text AS kind, key, name FROM coaching.tenet`,
  )
  return buildTaxonomyRegistry(result.rows)
}

function resolveTaxonomyLabel(value, kind, registry) {
  const group = registry[kind]
  if (!group) return []
  const identities = [normalizeIdentity(value), singularIdentity(value)].filter(Boolean)
  for (const identity of identities) {
    const direct = group.aliases.get(identity)
    if (direct) return [direct]
  }
  const hinted = identities.flatMap((identity) => TAXONOMY_KEY_HINTS[kind]?.[identity] ?? [])
  return [...new Set(hinted.filter((key) => group.keys.has(key)))]
}

function inferredMovementPatternKeys(card, registry) {
  const matches = []
  const identity = normalizeIdentity(`${card.movementPattern} ${card.name}`)
  const add = (...keys) => matches.push(...keys.filter((key) => registry.movementPatterns.keys.has(key)))
  if (/squat|lunge|step up|step down/.test(identity)) add('squat')
  if (/deadlift|romanian|\brdl\b|hinge|swing|good morning|bridge/.test(identity)) add('hinge')
  if (/push up|\bpress\b|\bdip\b/.test(identity)) add('push')
  if (/pull|\brow\b|chin up|hang/.test(identity)) add('pull')
  if (/hang|support/.test(identity)) add('hang')
  if (/jump|hop|bound|pogo|rebound|takeoff/.test(identity)) add('jump')
  if (/land|stick|snap down|deceler|brak/.test(identity)) add('land')
  if (/sprint|run|march|skip|shuffle|backpedal|locomot|acceleration|agility/.test(identity)) add('locomote')
  if (/carry/.test(identity)) add('carry')
  if (/crawl/.test(identity)) add('crawl')
  if (/throw|toss|slam/.test(identity)) add('throw')
  if (/rotat|chop|cartwheel|\broll\b/.test(identity)) add('rotate')
  if (/handstand|invert/.test(identity)) add('invert')
  if (/brace|plank|dead bug|hollow|arch|pallof|body hold/.test(identity)) add('brace')
  if (/reach/.test(identity)) add('reach')
  return [...new Set(matches)]
}

function resolveTaxonomyList(values, kind, registry) {
  const keys = []
  const unresolved = []
  for (const value of values) {
    const resolved = resolveTaxonomyLabel(value, kind, registry)
    if (resolved.length === 0) unresolved.push(value)
    else keys.push(...resolved)
  }
  return { keys: [...new Set(keys)], unresolved }
}

function resolveCardTaxonomy(card, registry) {
  const movementPatterns = resolveTaxonomyList([card.movementPattern], 'movementPatterns', registry)
  if (movementPatterns.keys.length === 0) {
    movementPatterns.keys.push(...inferredMovementPatternKeys(card, registry))
  }
  if (movementPatterns.keys.length > 0) movementPatterns.unresolved = []
  const bodyRegions = resolveTaxonomyList(card.bodyRegions, 'bodyRegions', registry)
  const equipment = resolveTaxonomyList(card.equipment, 'equipment', registry)
  const equipmentByAge = Object.fromEntries(AGE_BANDS.map((band) => [
    band,
    resolveTaxonomyList(card.ageScaling[band].equipment, 'equipment', registry),
  ]))
  const methodologies = resolveTaxonomyList([card.methodology], 'methodologies', registry)
  const tenets = resolveTaxonomyList(card.tenets, 'tenets', registry)
  const unresolved = [
    ...movementPatterns.unresolved.map((value) => `movement pattern:${value}`),
    ...bodyRegions.unresolved.map((value) => `body region:${value}`),
    ...equipment.unresolved.map((value) => `equipment:${value}`),
    ...Object.entries(equipmentByAge).flatMap(([band, values]) => (
      values.unresolved.map((value) => `equipment ${band}:${value}`)
    )),
    ...methodologies.unresolved.map((value) => `methodology:${value}`),
    ...tenets.unresolved.map((value) => `tenet:${value}`),
  ]
  return {
    movementPatterns: movementPatterns.keys,
    bodyRegions: bodyRegions.keys,
    equipment: equipment.keys,
    equipmentByAge: Object.fromEntries(Object.entries(equipmentByAge).map(([band, values]) => [band, values.keys])),
    methodologies: methodologies.keys,
    tenets: tenets.keys,
    unresolved: [...new Set(unresolved)],
  }
}

function intersection(values) {
  if (values.length === 0) return []
  return values[0].filter((value) => values.every((items) => items.includes(value)))
}

function difficultyFor(card, ageBand) {
  const impact = card.impactLevel === 'high' ? 75 : card.impactLevel === 'moderate' ? 55 : 25
  const technical = card.phase === 'tumbling' ? 65 : card.phase === 'output' ? 55 : 40
  const load = ageBand === '15-18' ? 55 : ageBand === '12-14' ? 40 : 25
  return {
    technicalComplexity: technical,
    absoluteLoadDemand: load,
    supervisionDemand: card.phase === 'tumbling' ? 80 : 55,
    failureConsequence: card.phase === 'tumbling' ? 70 : impact,
    impact,
    workCapacityDemand: card.phase === 'sustained_capacity' ? 65 : 40,
  }
}

export function flipFitCardToCanonicalDraft(card, taxonomy = null) {
  const familyKey = slugify(card.movementPattern || card.name) || 'flip-fit-movement'
  const resolved = taxonomy ?? {
    movementPatterns: [],
    bodyRegions: [],
    equipment: [],
    equipmentByAge: Object.fromEntries(AGE_BANDS.map((band) => [band, []])),
    methodologies: [],
    tenets: [],
  }
  const ageEquipment = AGE_BANDS.map((band) => resolved.equipmentByAge[band] ?? [])
  const requiredEquipment = intersection(ageEquipment)
  const optionalEquipment = [...new Set([...resolved.equipment, ...ageEquipment.flat()])]
    .filter((key) => !requiredEquipment.includes(key))
  return {
    slug: `flip-fit-${slugify(card.id)}`,
    canonicalName: card.name,
    displayName: card.name,
    aliases: card.aliases,
    description: card.description,
    familyKey,
    movementPatterns: resolved.movementPatterns,
    bodyRegions: resolved.bodyRegions,
    requiredEquipment,
    optionalEquipment,
    environment: {
      source: 'flip_fit',
      listedEquipment: card.equipment,
      resolvedEquipmentKeys: resolved.equipment,
    },
    population: {
      source: 'flip_fit',
      supportedAgeBands: AGE_BANDS,
      foundationAgeBand: '12-14',
      under9EquipmentNote: card.under9EquipmentNote,
    },
    athleteSupport: {
      whyItMatters: card.description,
      primaryCue: card.coachingCues[0] ?? 'Move with repeatable quality.',
      expectedSensations: ['Controlled effort in the listed body regions.'],
      unexpectedSensations: ['Pain, instability, or loss of normal coordination.'],
      painGuidance: 'Stop and tell the coach if pain or instability appears.',
      selfChecks: card.coachingCues,
      accessibility: card.ageScaling['9-11'].scalingGuidance,
      mediaAlternatives: ['Coach demonstration and verbal/tactile cueing as appropriate.'],
    },
    coachSupport: {
      observationChecklist: card.coachingCues,
      faultCorrections: card.commonErrors.map((fault) => ({ fault, correction: 'Regress range, load, speed, or complexity and re-cue the start position.' })),
      demonstrationPlan: card.instructions,
      groupManagement: ['Use a clear station boundary and one active athlete per landing or tumbling zone.'],
      modificationDecisionTree: AGE_BANDS.map((band) => ({ ageBand: band, variation: card.ageScaling[band].variation })),
      doNotUseWhen: card.safetyNotes,
    },
    supportOperations: {
      issueCategories: ['programming', 'safety', 'exercise_identity'],
      supportEscalation: 'Escalate uncertain identity, pain, or prerequisite questions to the program lead.',
      retentionPolicy: 'Retain while referenced by the active Flip & Fit program version.',
      changeImpactPolicy: 'Review all 60 sessions before changing canonical identity or age scaling.',
    },
    contentConfidence: 80,
    scoringConfidence: 70,
    mediaConfidence: 1,
    variants: AGE_BANDS.map((band) => {
      const prescription = card.ageScaling[band]
      return {
        variantKey: `ages-${band}`,
        displayName: prescription.variation,
        modifierKeys: [prescription.role],
        difficulty: difficultyFor(card, band),
        requirements: {
          ageBand: band,
          readinessGate: prescription.readinessGate,
          prerequisites: card.prerequisites,
          supervision: card.supervision,
        },
        programming: {
          movementFunctions: card.movementFunctions,
          movementPattern: card.movementPattern,
          movementPatternKeys: resolved.movementPatterns,
          methodology: card.methodology,
          methodologyKeys: resolved.methodologies,
          tenets: card.tenets,
          tenetKeys: resolved.tenets,
          bodyRegions: card.bodyRegions,
          bodyRegionKeys: resolved.bodyRegions,
        },
        loadProfile: {
          gripDemand: 0,
          spinalLoading: 1,
          eccentricStress: /eccentric/i.test(card.methodology) ? 65 : 25,
          landingContactsPerRep: /jump|hop|bound|landing|rebound|sprint/i.test(card.name) ? 1 : 0,
          externalLoadMethod: card.equipment.some((item) => /barbell|dumbbell|kettlebell|sled|cable|landmine|trap bar/i.test(item))
            ? 'coach_selected'
            : 'bodyweight',
        },
        fatigueProfile: {
          localMuscleFatigue: card.phase === 'capacity' || card.phase === 'sustained_capacity' ? 60 : 30,
          gripFatigue: /grip|hang|carry|row|pull/i.test(card.name) ? 55 : null,
          technicalFatigueSensitivity: card.freshnessRequirement === 'high' ? 75 : 45,
          impactAccumulation: card.impactLevel === 'high' ? 75 : card.impactLevel === 'moderate' ? 50 : 15,
          recoveryHours: card.impactLevel === 'high' ? 48 : 24,
        },
        profiles: [{
          profileKey: `flip-fit-${card.phase}-ages-${band}`,
          phaseKey: canonicalPhase(card.phase),
          role: 'primary',
          purpose: `${card.description} ${prescription.intent}`.trim(),
          phaseSuitability: 90,
          methodologyAlignment: 90,
          objectiveRelevance: {
            movementFunctions: card.movementFunctions,
            tenets: card.tenets,
            tenetKeys: resolved.tenets,
          },
          dosage: {
            prescription: prescription.dosage,
            work: prescription.work,
            rest: prescription.rest,
            intensity: prescription.intensity,
          },
          qualityGate: prescription.readinessGate,
          stopRules: card.safetyNotes,
          coachInstructions: [...card.instructions, ...card.coachingCues].join(' '),
          athleteInstructions: prescription.scalingGuidance,
          expectedAdaptation: prescription.intent,
          equipmentRequired: resolved.equipmentByAge[band] ?? [],
          logistics: { program: 'Flip & Fit', sourcePhase: card.phase },
          timeModel: {},
          doseScaling: card.ageScaling,
          measurement: {},
          supportPrompts: {},
        }],
      }
    }),
  }
}

function values(value) {
  return Array.isArray(value) ? value.filter((item) => typeof item === 'string' && item.trim()) : []
}

function resolvedExistingKeys(rawValues, kind, registry) {
  const group = registry[kind]
  const result = []
  for (const raw of rawValues) {
    if (group?.keys.has(raw)) result.push(raw)
    else result.push(...resolveTaxonomyLabel(raw, kind, registry))
  }
  return [...new Set(result)]
}

function semanticProfileRows(definition) {
  if (Array.isArray(definition?.semantic_profiles)) return definition.semantic_profiles
  if (typeof definition?.semantic_profiles === 'string') {
    try {
      const parsed = JSON.parse(definition.semantic_profiles)
      return Array.isArray(parsed) ? parsed : []
    } catch {
      return []
    }
  }
  return []
}

function canonicalDefinitionSemantics(definition, registry) {
  const profiles = semanticProfileRows(definition)
  const programming = profiles.map((profile) => object(profile.programming))
  const objectives = profiles.map((profile) => object(profile.objectiveRelevance))
  return {
    movementPatterns: resolvedExistingKeys([
      ...values(definition.movement_patterns),
      ...programming.flatMap((item) => [
        ...values(item.movementPatternKeys),
        ...values(item.movementPatterns),
        item.movementPattern,
      ].filter(Boolean)),
    ], 'movementPatterns', registry),
    bodyRegions: resolvedExistingKeys([
      ...values(definition.body_regions),
      ...programming.flatMap((item) => [
        ...values(item.bodyRegionKeys),
        ...values(item.bodyRegions),
      ]),
    ], 'bodyRegions', registry),
    equipment: resolvedExistingKeys([
      ...values(definition.required_equipment),
      ...values(definition.optional_equipment),
      ...profiles.flatMap((profile) => values(profile.equipment)),
    ], 'equipment', registry),
    phases: [...new Set(profiles.map((profile) => text(profile.phaseKey, 80)).filter(Boolean))],
    methodologies: resolvedExistingKeys(programming.flatMap((item) => [
      ...values(item.methodologyKeys),
      ...values(item.methodologies),
      item.methodology,
    ].filter(Boolean)), 'methodologies', registry),
    tenets: resolvedExistingKeys([
      ...programming.flatMap((item) => [...values(item.tenetKeys), ...values(item.tenets)]),
      ...objectives.flatMap((item) => [...values(item.tenetKeys), ...values(item.tenets)]),
    ], 'tenets', registry),
    movementFunctions: [...new Set([
      ...programming.flatMap((item) => [...values(item.movementFunctions), item.movementFunction].filter(Boolean)),
      ...objectives.flatMap((item) => [...values(item.movementFunctions), item.movementFunction].filter(Boolean)),
    ].map(normalizeIdentity).filter(Boolean))],
  }
}

function sharesValue(left, right) {
  const rightSet = new Set(right)
  return left.some((value) => rightSet.has(value))
}

function semanticMatchIssues(card, taxonomy, definition, registry) {
  const incoming = {
    movementPatterns: taxonomy.movementPatterns,
    bodyRegions: taxonomy.bodyRegions,
    equipment: [...new Set([
      ...taxonomy.equipment,
      ...Object.values(taxonomy.equipmentByAge).flat(),
    ])],
    phases: [canonicalPhase(card.phase)],
    methodologies: taxonomy.methodologies,
    tenets: taxonomy.tenets,
    movementFunctions: card.movementFunctions.map(normalizeIdentity),
  }
  const existing = canonicalDefinitionSemantics(definition, registry)
  const labels = {
    movementPatterns: 'movement pattern',
    bodyRegions: 'body region',
    equipment: 'equipment',
    phases: 'phase',
    methodologies: 'methodology',
    tenets: 'tenet/tag',
    movementFunctions: 'movement function',
  }
  const issues = []
  for (const key of Object.keys(labels)) {
    // Movement function belongs to the scheduled occurrence in the current
    // Flip & Fit program contract, rather than the deduplicated card. Honor it
    // when callers provide it, but do not turn its absence into a false review.
    if (key === 'movementFunctions' && incoming[key].length === 0) continue
    if (incoming[key].length === 0) {
      issues.push(`${labels[key]} is unresolved in the Flip & Fit card`)
    } else if (existing[key].length === 0) {
      issues.push(`canonical ${labels[key]} evidence is missing`)
    } else if (!sharesValue(incoming[key], existing[key])) {
      issues.push(`${labels[key]} conflicts with the canonical card`)
    }
  }
  return issues
}

function mapReferenceRow(row) {
  return {
    programCardKey: row.program_card_key,
    canonicalDefinitionId: row.canonical_definition_id == null ? null : String(row.canonical_definition_id),
    canonicalDisplayName: row.canonical_display_name ?? null,
    canonicalStatus: row.canonical_status ?? null,
    matchStatus: row.match_status,
    matchReason: row.match_reason,
    matchScore: row.match_score == null ? null : Number(row.match_score),
    payloadHash: row.payload_hash,
    updatedAt: row.updated_at ?? null,
  }
}

export async function loadFlipFitCardReferences(pool, facilityId) {
  const result = await pool.query(
    `SELECT reference.*, definition.display_name AS canonical_display_name,
            definition.status AS canonical_status
     FROM coaching.flip_fit_card_reference reference
     LEFT JOIN coaching.exercise_definition_v1 definition
       ON definition.id = reference.canonical_definition_id
      AND definition.facility_id = reference.facility_id
     WHERE reference.facility_id = $1
     ORDER BY reference.program_card_key`,
    [facilityId],
  )
  return result.rows.map(mapReferenceRow)
}

async function upsertReference(client, facilityId, actorUserId, card, match) {
  const result = await client.query(
    `WITH upserted AS (
       INSERT INTO coaching.flip_fit_card_reference (
         facility_id, program_card_key, canonical_definition_id, match_status,
         match_reason, match_score, payload_hash, payload_json, reconciled_by
       ) VALUES ($1,$2,$3::uuid,$4,$5,$6,$7,$8::jsonb,$9)
       ON CONFLICT (facility_id, program_card_key) DO UPDATE SET
         canonical_definition_id = EXCLUDED.canonical_definition_id,
         match_status = EXCLUDED.match_status,
         match_reason = EXCLUDED.match_reason,
         match_score = EXCLUDED.match_score,
         payload_hash = EXCLUDED.payload_hash,
         payload_json = EXCLUDED.payload_json,
         reconciled_by = EXCLUDED.reconciled_by,
         updated_at = now()
       RETURNING *
     )
     SELECT upserted.*, definition.display_name AS canonical_display_name,
            definition.status AS canonical_status
     FROM upserted
     LEFT JOIN coaching.exercise_definition_v1 definition
       ON definition.id = upserted.canonical_definition_id
      AND definition.facility_id = upserted.facility_id`,
    [
      facilityId,
      card.id,
      match.canonicalDefinitionId,
      match.matchStatus,
      match.matchReason,
      match.matchScore,
      cardHash(card),
      JSON.stringify(card),
      actorUserId,
    ],
  )
  return mapReferenceRow(result.rows[0])
}

export async function reconcileFlipFitCards(pool, facilityId, actorUserId, rawCards) {
  if (!Array.isArray(rawCards) || rawCards.length === 0 || rawCards.length > MAX_CARDS) {
    throw new FlipFitCardReconciliationError(`cards must contain 1 to ${MAX_CARDS} exercise cards.`)
  }
  const cards = rawCards.map(normalizeFlipFitProgramCard)
  if (new Set(cards.map((card) => card.id)).size !== cards.length) {
    throw new FlipFitCardReconciliationError('Flip & Fit card ids must be unique.')
  }
  const generatedSlugs = cards.map((card) => `flip-fit-${slugify(card.id)}`)
  if (new Set(generatedSlugs).size !== generatedSlugs.length) {
    throw new FlipFitCardReconciliationError('Flip & Fit card ids must produce unique canonical slugs.')
  }

  return withCanonicalCardTransaction(pool, facilityId, async (client) => {
    const taxonomyRegistry = await loadTaxonomyRegistry(client)
    const definitionsResult = await client.query(
      `SELECT definition.id, definition.slug, definition.canonical_name,
              definition.display_name, definition.aliases, definition.family_key,
              definition.status, definition.movement_patterns, definition.body_regions,
              definition.required_equipment, definition.optional_equipment,
              COALESCE((
                SELECT jsonb_agg(
                  jsonb_build_object(
                    'phaseKey', profile.phase_key,
                    'equipment', COALESCE(profile.equipment_required, '{}'),
                    'programming', COALESCE(variant.programming_profile_json, '{}'),
                    'objectiveRelevance', COALESCE(profile.objective_relevance_json, '{}')
                  ) ORDER BY variant.variant_key, profile.profile_key
                )
                FROM coaching.exercise_variant_v1 variant
                LEFT JOIN coaching.exercise_delivery_profile_v1 profile
                  ON profile.variant_id = variant.id AND profile.status != 'archived'
                WHERE variant.definition_id = definition.id
                  AND variant.status != 'archived'
              ), '[]'::jsonb) AS semantic_profiles
       FROM coaching.exercise_definition_v1 definition
       WHERE definition.facility_id = $1
       ORDER BY definition.id`,
      [facilityId],
    )
    const existingReferences = await client.query(
      `SELECT reference.*, definition.display_name AS canonical_display_name,
              definition.status AS canonical_status
       FROM coaching.flip_fit_card_reference reference
       LEFT JOIN coaching.exercise_definition_v1 definition
         ON definition.id = reference.canonical_definition_id
        AND definition.facility_id = reference.facility_id
       WHERE reference.facility_id = $1`,
      [facilityId],
    )
    const referencesByKey = new Map(existingReferences.rows.map((row) => [row.program_card_key, row]))
    const activeDefinitions = definitionsResult.rows.filter((row) => row.status !== 'archived')
    let duplicateIndex = buildCanonicalDuplicateIndex(activeDefinitions)
    const definitionById = new Map(definitionsResult.rows.map((row) => [String(row.id), row]))
    const definitionBySlug = new Map(definitionsResult.rows.map((row) => [row.slug, row]))
    const results = []

    for (const card of cards) {
      const taxonomy = resolveCardTaxonomy(card, taxonomyRegistry)
      const hash = cardHash(card)
      const existingReference = referencesByKey.get(card.id)
      const referencedDefinition = existingReference?.canonical_definition_id
        ? definitionById.get(String(existingReference.canonical_definition_id))
        : null
      const unchangedActiveReference = existingReference
        && existingReference.payload_hash === hash
        && referencedDefinition
        && referencedDefinition.status !== 'archived'
      if (unchangedActiveReference) {
        const linkedIdentity = findPotentialCanonicalDuplicatesFromIndex({
          canonicalName: card.name,
          displayName: card.name,
          aliases: card.aliases,
        }, buildCanonicalDuplicateIndex([referencedDefinition]))
          .find((candidate) => candidate.exactCollision)
        const currentLinkIssues = [
          ...(linkedIdentity ? [] : ['canonical identity is no longer an exact name or alias match']),
          ...taxonomy.unresolved.map((value) => `unresolved ${value}`),
          ...semanticMatchIssues(card, taxonomy, referencedDefinition, taxonomyRegistry),
        ]
        if (currentLinkIssues.length > 0) {
          results.push(await upsertReference(client, facilityId, actorUserId, card, {
            canonicalDefinitionId: referencedDefinition.id,
            matchStatus: 'review',
            matchReason: `Existing canonical link needs review after library change: ${currentLinkIssues.slice(0, 4).join('; ')}.`,
            matchScore: linkedIdentity?.score ?? null,
          }))
          continue
        }
        // Preserve a prior creation decision without producing another card or
        // revision. A system-generated review may still fall through and
        // recover, while an author-requested review remains intentional.
        if (existingReference.match_status !== 'review' || card.matchStatus === 'review') {
          results.push(mapReferenceRow(existingReference))
          continue
        }
      }

      const deterministicSlug = `flip-fit-${slugify(card.id)}`
      const archivedDefinition = existingReference?.canonical_status === 'archived'
        ? definitionById.get(String(existingReference.canonical_definition_id))
        : definitionBySlug.get(deterministicSlug)?.status === 'archived'
          ? definitionBySlug.get(deterministicSlug)
          : null
      if (archivedDefinition) {
        results.push(await upsertReference(client, facilityId, actorUserId, card, {
          canonicalDefinitionId: archivedDefinition.id,
          matchStatus: 'review',
          matchReason: 'The deterministic canonical card is archived; replacement or reactivation requires coach review.',
          matchScore: null,
        }))
        continue
      }
      if (existingReference?.canonical_definition_id && !existingReference.canonical_status) {
        results.push(await upsertReference(client, facilityId, actorUserId, card, {
          canonicalDefinitionId: null,
          matchStatus: 'review',
          matchReason: 'The previous canonical reference is unavailable in this facility and requires coach review.',
          matchScore: null,
        }))
        continue
      }

      const matches = findPotentialCanonicalDuplicatesFromIndex({
        canonicalName: card.name,
        displayName: card.name,
        aliases: card.aliases,
      }, duplicateIndex)
      const exactMatches = matches.filter((candidate) => candidate.exactCollision)
      let match

      if (card.matchStatus === 'review') {
        const candidate = exactMatches[0] ?? matches[0] ?? null
        match = {
          canonicalDefinitionId: candidate?.id ?? null,
          matchStatus: 'review',
          matchReason: 'Program author flagged this card for coach review before canonical creation.',
          matchScore: candidate?.score ?? null,
        }
      } else if (exactMatches.length === 1) {
        const candidate = exactMatches[0]
        const definition = definitionById.get(String(candidate.id))
        const semanticIssues = [
          ...taxonomy.unresolved.map((value) => `unresolved ${value}`),
          ...semanticMatchIssues(card, taxonomy, definition, taxonomyRegistry),
        ]
        if (semanticIssues.length > 0) {
          match = {
            canonicalDefinitionId: candidate.id,
            matchStatus: 'review',
            matchReason: `Exact identity needs semantic review: ${semanticIssues.slice(0, 4).join('; ')}.`,
            matchScore: 100,
          }
        } else {
          const directNameMatch = normalizeIdentity(definition?.display_name) === normalizeIdentity(card.name)
            || normalizeIdentity(definition?.canonical_name) === normalizeIdentity(card.name)
          match = {
            canonicalDefinitionId: candidate.id,
            matchStatus: directNameMatch ? 'reused' : 'alias',
            matchReason: directNameMatch
              ? 'Exact canonical name and semantic-facet match.'
              : 'Exact canonical alias and semantic-facet match.',
            matchScore: 100,
          }
        }
      } else if (exactMatches.length > 1 || matches.length > 0) {
        const candidate = exactMatches[0] ?? matches[0]
        match = {
          canonicalDefinitionId: candidate.id,
          matchStatus: 'review',
          matchReason: exactMatches.length > 1
            ? 'Multiple exact canonical identities require coach review.'
            : `Potential canonical match (${candidate.score}/100) requires coach review.`,
          matchScore: candidate.score,
        }
      } else if (taxonomy.unresolved.length > 0) {
        match = {
          canonicalDefinitionId: null,
          matchStatus: 'review',
          matchReason: `Unresolved controlled taxonomy requires coach review: ${taxonomy.unresolved.slice(0, 4).join('; ')}.`,
          matchScore: null,
        }
      } else {
        const draft = flipFitCardToCanonicalDraft(card, taxonomy)
        const created = await saveCanonicalCardDraftInTransaction(
          client,
          facilityId,
          actorUserId,
          draft,
          { changeSummary: `Created idempotently for Flip & Fit program card ${card.id}.` },
        )
        match = {
          canonicalDefinitionId: created.id,
          matchStatus: 'new',
          matchReason: 'No legitimate canonical match existed; created a draft card for review.',
          matchScore: 0,
        }
        const createdIndexRow = {
          id: created.id,
          slug: created.slug,
          canonical_name: created.canonicalName,
          display_name: created.displayName,
          aliases: created.aliases,
          family_key: created.familyKey,
          status: created.status,
          movement_patterns: created.movementPatterns,
          body_regions: created.bodyRegions,
          required_equipment: created.requiredEquipment,
          optional_equipment: created.optionalEquipment,
          semantic_profiles: created.variants.flatMap((variant) => variant.profiles.map((profile) => ({
            phaseKey: profile.phaseKey,
            equipment: profile.equipmentRequired,
            programming: variant.programming,
            objectiveRelevance: profile.objectiveRelevance,
          }))),
        }
        duplicateIndex = [...duplicateIndex, ...buildCanonicalDuplicateIndex([createdIndexRow])]
        definitionById.set(String(created.id), createdIndexRow)
        definitionBySlug.set(created.slug, createdIndexRow)
      }

      results.push(await upsertReference(client, facilityId, actorUserId, card, match))
    }

    return {
      cards: results,
      counts: Object.fromEntries([...MATCH_STATUSES].map((status) => [
        status,
        results.filter((item) => item.matchStatus === status).length,
      ])),
    }
  })
}
