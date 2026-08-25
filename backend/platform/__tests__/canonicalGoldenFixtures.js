import { SESSION_PHASE_ORDER } from '../canonicalWorkoutContract.js'

const PHASE_PURPOSES = {
  prepare_and_access: 'Raise temperature and access required positions',
  movement_intelligence: 'Learn movement with low fatigue',
  output: 'Express speed and power while fresh',
  capacity: 'Build force and tissue capacity',
  resilience: 'Own positions and braking control',
  sustained_capacity: 'Develop repeatability under managed fatigue',
  restore: 'Downregulate and restore comfortable range',
}

export function goldenCard(phaseKey, index = 1, overrides = {}) {
  const slug = `${phaseKey.replaceAll('_', '-')}-${index}`
  const defaultScaling = {
    younger: { dose: 'shorter range and fewer repetitions', cue: 'Move smoothly.' },
    older: { dose: 'full reviewed dose', cue: 'Own every position.' },
  }
  const profile = {
    id: `${slug}-profile`,
    phaseKey,
    role: 'primary',
    phaseSuitability: 92 - index,
    objectiveRelevance: {
      default: 82,
      general_athletic_development: 90,
      speed_priority: phaseKey === 'output' ? 98 : 75,
      explosiveness_power_priority: phaseKey === 'output' ? 98 : 75,
      strength_priority: phaseKey === 'capacity' ? 98 : 75,
      agility_priority: ['movement_intelligence', 'output'].includes(phaseKey) ? 96 : 75,
      skill_tumbling_priority: phaseKey === 'movement_intelligence' ? 98 : 72,
      mobility_control_priority: ['prepare_and_access', 'resilience', 'restore'].includes(phaseKey) ? 95 : 70,
      fitness_priority: phaseKey === 'sustained_capacity' ? 98 : 70,
      recovery_low_intensity: phaseKey === 'restore' ? 98 : 65,
    },
    methodologyAlignment: 90,
    methodologyKey: phaseKey === 'sustained_capacity' ? 'hiit' : 'controlled_training',
    purpose: PHASE_PURPOSES[phaseKey],
    phasePurpose: PHASE_PURPOSES[phaseKey],
    qualityGate: 'Stop before movement quality declines.',
    stopRules: ['Stop on pain.', 'Stop and tell the coach when technique changes.'],
    coachInstructions: 'Demonstrate, observe every station, and regress before quality drops.',
    athleteInstructions: 'Move with control. Stop and tell your coach if anything hurts.',
    expectedAdaptation: PHASE_PURPOSES[phaseKey],
    dosage: {
      sets: 2,
      reps: 6,
      workSeconds: 30,
      restSeconds: 30,
      contactsPerSet: phaseKey === 'output' && index === 1 ? 6 : null,
    },
    transitionSeconds: 20,
    demonstrationSeconds: 30,
    modifierKeys: ['make_explosive', 'make_isometric', 'make_eccentric', 'reduce_impact', 'remove_equipment'],
    scalingByCohort: defaultScaling,
  }
  return {
    id: slug,
    variantId: slug,
    slug,
    canonicalName: `${phaseKey.replaceAll('_', ' ')} drill ${index}`,
    displayName: `${phaseKey.replaceAll('_', ' ')} drill ${index}`,
    cardVersion: 1,
    schemaVersion: '1.0.0',
    status: 'published',
    familyId: `${phaseKey}-family-${index}`,
    approvedBy: 'coach-reviewer',
    contentConfidence: 95,
    scoringConfidence: 95,
    mediaConfidence: 100,
    movementPatterns: phaseKey === 'output' && index === 1 ? ['jump', 'land'] : ['locomote'],
    bodyRegions: ['full_body'],
    equipment: { required: [], optional: [], quantityPerStation: {} },
    environment: {
      environment: ['indoor', 'outdoor'],
      stationCapacity: 4,
      floorAreaSquareFeet: 40,
      laneLengthFeet: phaseKey === 'output' ? 20 : 5,
    },
    population: {
      ageMin: 5,
      ageMax: 18,
      trainingAgeMonthsMin: 0,
      athleteCompatibility: 92,
    },
    difficulty: {
      technicalComplexity: phaseKey === 'movement_intelligence' ? 40 : 30,
      absoluteLoadDemand: 38,
      baseOverallDifficulty: phaseKey === 'movement_intelligence' ? 40 : 38,
    },
    movementGeometry: {
      planes: ['sagittal'], projections: phaseKey === 'output' ? ['vertical'] : [],
      directions: ['forward'], supports: ['bilateral'], stances: ['square'],
      limbRelationships: ['symmetrical'],
    },
    anatomyProfile: { assignments: [{ key: 'full_body', kind: 'body_region', role: 'primary_target' }] },
    equipmentRoles: [{ key: 'none', role: 'required', quantityPerStation: 0, conditions: {} }],
    taskDemands: {
      strengthDemand: phaseKey === 'capacity' ? 45 : 20,
      powerDemand: phaseKey === 'output' ? 55 : 20,
      mobilityDemand: 25, balanceDemand: 25, coordinationDemand: 35,
      conditioningDemand: phaseKey === 'sustained_capacity' ? 55 : 30,
      impactToleranceDemand: phaseKey === 'output' && index === 1 ? 55 : 20,
      eccentricControlDemand: 25, bodyControlDemand: 30, perceptualDemand: 20,
      attentionDemand: 25, supervisionDemand: 25, failureConsequence: 20,
    },
    stressProfile: {
      jointStress: 20, tissueStress: 25, neuralDemand: phaseKey === 'output' ? 55 : 20,
      impactStress: phaseKey === 'output' && index === 1 ? 55 : 20,
      localMuscularFatigue: 35, systemicFatigue: phaseKey === 'sustained_capacity' ? 55 : 30,
      gripFatigue: 10, conditioningFatigue: phaseKey === 'sustained_capacity' ? 55 : 30,
      recoveryCost: 25, bodyRegionStress: ['full_body'], jointStressTargets: [], tissueStressTargets: [],
    },
    scalingHandles: [{ dimension: 'volume', boundary: 'prescription', easier: 'reduce repetitions', harder: 'add repetitions within profile limits', limits: {} }],
    compositionProfile: { preparesFor: [], preferredAfter: [], avoidAfter: [], avoidSameSession: [], pairsWith: [], acceptablePairs: [], interferenceRules: [] },
    structuredProfileReview: { reviewStatus: 'approved', reviewedBy: 'fixture-reviewer', reviewedAt: '2026-08-01T00:00:00.000Z' },
    media: { approvedVideoUrl: `https://media.example/${slug}` },
    deliveryProfiles: [profile],
    ...overrides,
  }
}

export function goldenLibrary() {
  const cards = SESSION_PHASE_ORDER.flatMap((phaseKey) => [1, 2, 3, 4].map((index) => goldenCard(phaseKey, index)))

  cards.push(goldenCard('capacity', 10, {
    id: 'assisted-pull-up',
    variantId: 'assisted-pull-up',
    slug: 'assisted-pull-up',
    canonicalName: 'Band-Assisted Pull-Up',
    displayName: 'Band-Assisted Pull-Up',
    familyId: 'pull-up',
    movementPatterns: ['pull'],
    deliveryProfiles: [{
      ...goldenCard('capacity').deliveryProfiles[0],
      id: 'assisted-pull-up-strength',
      purpose: 'Build the pull-up pattern below strict pull-up strength requirements.',
      scalingByCohort: {
        younger: { assistance: 'more assistance' },
        older: { assistance: 'coach-selected assistance' },
      },
    }],
  }))

  cards.push(goldenCard('capacity', 11, {
    id: 'olympic-lift-technique',
    variantId: 'olympic-lift-technique',
    slug: 'olympic-lift-technique',
    canonicalName: 'Hang Power Clean Technique',
    displayName: 'Hang Power Clean Technique',
    familyId: 'olympic-lift',
    equipment: { required: ['barbell'], quantityPerStation: { barbell: 1 } },
    equipmentRoles: [{ key: 'barbell', role: 'required', quantityPerStation: 1, conditions: {} }],
    population: { ageMin: 14, ageMax: 18, trainingAgeMonthsMin: 12, athleteCompatibility: 80 },
    difficulty: {
      ...goldenCard('capacity').difficulty,
      technicalComplexity: 85,
      baseOverallDifficulty: 85,
    },
    taskDemands: {
      ...goldenCard('capacity').taskDemands,
      supervisionDemand: 85,
      failureConsequence: 75,
    },
    deliveryProfiles: [{
      ...goldenCard('capacity').deliveryProfiles[0],
      id: 'olympic-lift-technique-capacity',
      phaseSuitability: 98,
      objectiveRelevance: { default: 95, strength_priority: 100 },
      purpose: 'Practice Olympic-lift positions with full recovery and no fatigue chasing.',
      dosage: { sets: 4, reps: 3, workSeconds: 20, restSeconds: 120, rpe: 5 },
      qualityGate: 'Every repetition must match the demonstrated receiving position.',
      stopRules: ['Stop when bar path or receiving position changes.'],
    }],
  }))

  cards.push(goldenCard('sustained_capacity', 12, {
    id: 'hiit-olympic-lift',
    variantId: 'hiit-olympic-lift',
    slug: 'hiit-olympic-lift',
    canonicalName: 'Barbell Clean HIIT',
    displayName: 'Barbell Clean HIIT',
    familyId: 'olympic-lift',
    equipment: { required: ['barbell'], quantityPerStation: { barbell: 1 } },
    equipmentRoles: [{ key: 'barbell', role: 'required', quantityPerStation: 1, conditions: {} }],
    difficulty: {
      ...goldenCard('sustained_capacity').difficulty,
      technicalComplexity: 90,
      baseOverallDifficulty: 90,
    },
    taskDemands: {
      ...goldenCard('sustained_capacity').taskDemands,
      supervisionDemand: 90,
      failureConsequence: 85,
    },
    deliveryProfiles: [{
      ...goldenCard('sustained_capacity').deliveryProfiles[0],
      id: 'barbell-clean-hiit',
      phaseSuitability: 100,
      objectiveRelevance: { fitness_priority: 100, default: 90 },
    }],
  }))

  const contextual = goldenCard('capacity', 20, {
    id: 'contextual-push-up',
    variantId: 'contextual-push-up',
    slug: 'contextual-push-up',
    canonicalName: 'Push-Up',
    displayName: 'Push-Up',
    familyId: 'push-up',
  })
  contextual.deliveryProfiles = ['prepare_and_access', 'output', 'capacity', 'sustained_capacity'].map((phaseKey) => ({
    ...goldenCard(phaseKey).deliveryProfiles[0],
    id: `push-up-${phaseKey}`,
    purpose: `Push-Up delivered for ${phaseKey}`,
    phaseSuitability: 99,
  }))
  cards.push(contextual)

  return cards
}

export const BASE_GOLDEN_INTENT = Object.freeze({
  durationMinutes: 60,
  athleteCount: 12,
  coachCount: 1,
  ageMin: 8,
  ageMax: 10,
  trainingAgeMonths: 0,
  trainingExperience: 'beginner',
  randomSeed: 'golden-base',
  objective: 'general_athletic_development',
  equipmentAvailable: ['bodyweight'],
  space: { environment: 'indoor', floorAreaSquareFeet: 2000, laneLengthFeet: 30 },
  maxDifficulty: 60,
  maxTechnicalRisk: 60,
})
