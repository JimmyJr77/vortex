import { convertLegacyScore } from './canonicalWorkoutContract.js'

const PHASE_ALIASES = Object.freeze({
  prepare_access: 'prepare_and_access',
  skill_movement_intelligence: 'movement_intelligence',
  control_resilience: 'resilience',
  fitness_repeatability: 'sustained_capacity',
})

function phaseKey(value) {
  const key = String(value ?? '')
  return PHASE_ALIASES[key] ?? key
}

function legacyScore(value, scale, zeroMeaning = 'missing') {
  return convertLegacyScore(value, scale, zeroMeaning).value
}

function textList(value) {
  if (Array.isArray(value)) return value.map(String).filter(Boolean)
  return []
}

/**
 * Explicit compatibility adapter for existing exercise rows and related records.
 * It never marks migrated content as coach-approved and retains raw provenance.
 */
export function legacyExerciseBundleToCanonical(bundle) {
  const exercise = bundle?.exercise
  if (!exercise?.id || !exercise?.slug || !exercise?.name) {
    throw new TypeError('legacy bundle requires exercise id, slug, and name')
  }
  const difficulty = bundle.difficulty ?? {}
  const safety = bundle.safety ?? bundle.safety_profile ?? {}
  const profiles = bundle.phaseProfiles ?? bundle.phase_profiles ?? []
  const dosageProfiles = bundle.dosageProfiles ?? bundle.dosage_profiles ?? []
  const mediaUrl = exercise.video_url ?? exercise.media_library?.approved_video_url ?? null

  return {
    id: String(exercise.id),
    slug: exercise.slug,
    canonicalName: exercise.name,
    displayName: exercise.display_name ?? exercise.name,
    aliases: textList(exercise.aliases),
    description: exercise.description ?? null,
    cardVersion: Number(exercise.card_version ?? 1),
    schemaVersion: '1.0.0',
    status: exercise.status === 'published' && mediaUrl ? 'review' : (exercise.status ?? 'draft'),
    familyId: exercise.movement_family || exercise.slug,
    variantId: String(exercise.id),
    approvedBy: null,
    contentConfidence: 40,
    scoringConfidence: 40,
    mediaConfidence: mediaUrl ? 40 : 20,
    movementPatterns: textList(bundle.movementPatterns ?? exercise.movement_patterns),
    bodyRegions: textList(bundle.bodyRegions ?? exercise.body_regions),
    equipment: {
      required: textList(bundle.requiredEquipment ?? exercise.required_equipment),
      optional: textList(bundle.optionalEquipment ?? exercise.optional_equipment),
      quantityPerStation: exercise.movement_requirements?.equipment_quantity_per_station ?? {},
    },
    environment: {
      environment: textList(exercise.movement_requirements?.environments),
      stationCapacity: exercise.movement_requirements?.station_capacity ?? null,
      floorAreaSquareFeet: exercise.movement_requirements?.minimum_floor_footprint ?? null,
      laneLengthFeet: exercise.movement_requirements?.minimum_lane_length ?? null,
    },
    population: {
      ageMin: difficulty.recommended_age_min ?? null,
      ageMax: difficulty.recommended_age_max ?? null,
      trainingAgeMonthsMin: null,
      athleteCompatibility: 40,
    },
    difficulty: {
      technicalComplexity: legacyScore(difficulty.technical, 10),
      absoluteLoadDemand: legacyScore(difficulty.load, 10),
      coordinationDemand: legacyScore(difficulty.complexity, 10),
      impact: legacyScore(exercise.movement_requirements?.impact_level, 5, 'negligible'),
      supervisionDemand: safety.supervision_level === 'high' ? 80 : safety.supervision_level === 'moderate' ? 50 : 20,
      failureConsequence: safety.spotter_required ? 80 : 30,
      workCapacityDemand: null,
      baseOverallDifficulty: legacyScore(difficulty.overall, 10),
    },
    media: {
      approvedVideoUrl: mediaUrl,
      verificationStatus: mediaUrl ? 'legacy_unverified' : 'missing',
    },
    deliveryProfiles: profiles.filter((profile) => profile.role !== 'avoid').map((profile) => {
      const dosage = dosageProfiles.find((row) => (
        String(row.phase_id ?? row.phaseKey ?? '') === String(profile.phase_id ?? profile.phaseKey ?? '')
      )) ?? dosageProfiles[0] ?? {}
      return {
        id: `legacy-${exercise.id}-${phaseKey(profile.phase_key ?? profile.phaseKey)}`,
        phaseKey: phaseKey(profile.phase_key ?? profile.phaseKey),
        role: profile.role ?? 'conditional',
        phaseSuitability: legacyScore(profile.fit_weight ?? profile.fitWeight, 10),
        objectiveRelevance: { default: 50 },
        methodologyAlignment: 50,
        purpose: profile.notes ?? exercise.card_summary ?? exercise.description ?? 'Coach-reviewed purpose required.',
        qualityGate: exercise.coaching_execution?.quality_gate ?? 'Stop before movement quality declines.',
        stopRules: textList(exercise.coaching_execution?.stop_rules ?? safety.stop_rules),
        coachInstructions: exercise.coaching_execution?.coach_instructions ?? exercise.coach_language ?? null,
        athleteInstructions: exercise.coaching_execution?.athlete_instructions ?? exercise.athlete_language ?? null,
        expectedAdaptation: null,
        dosage: {
          sets: dosage.default_sets ?? exercise.default_sets ?? 2,
          reps: dosage.default_reps ?? exercise.default_reps ?? null,
          workSeconds: dosage.default_work_seconds ?? exercise.default_work_seconds ?? 30,
          restSeconds: dosage.default_rest_seconds ?? exercise.default_rest_seconds ?? 30,
          rpe: dosage.default_rpe_max ?? null,
          tempo: dosage.default_tempo ?? null,
        },
      }
    }),
    provenance: {
      sourceType: 'legacy_adapter',
      sourceTable: 'coaching.exercise',
      sourceId: String(exercise.id),
      legacyDifficulty: difficulty,
      migrationConfidence: 40,
      humanReviewRequired: true,
    },
  }
}
