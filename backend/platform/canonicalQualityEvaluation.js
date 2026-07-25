const CATEGORY_NAMES = Object.freeze([
  'session_structure',
  'duration_accuracy',
  'phase_intent',
  'exercise_phase_fit',
  'objective_fidelity',
  'athlete_age_fit',
  'difficulty_utilization',
  'technical_complexity',
  'load_appropriateness',
  'youth_safety',
  'progression_validity',
  'progression_lane_integrity',
  'cohort_scaling',
  'equipment_use',
  'equipment_avoids',
  'movement_exercise_avoids',
  'space_feasibility',
  'coach_station_feasibility',
  'group_throughput',
  'movement_pattern_coverage',
  'muscle_joint_stabilizer_coverage',
  'planes_laterality_coverage',
  'session_diversity',
  'redundancy_control',
  'fatigue_arc',
  'high_intent_freshness',
  'hiit_containment',
  'restore_quality',
  'transition_realism',
  'dose_appropriateness',
  'instruction_completeness',
  'video_completeness',
  'explanation_fidelity',
  'ai_interpretation_fidelity',
  'determinism_reproducibility',
  'constraint_report_quality',
  'repair_loop_performance',
  'coach_acceptance_telemetry',
])

function clampScore(value) {
  if (value == null || !Number.isFinite(Number(value))) return null
  return Math.max(1, Math.min(100, Math.round(Number(value))))
}

function average(values) {
  const scored = values.filter((value) => value != null && Number.isFinite(Number(value)))
  if (!scored.length) return null
  return scored.reduce((sum, value) => sum + Number(value), 0) / scored.length
}

function allItems(output) {
  return output.phases.flatMap((phase) => phase.prescriptions)
}

function booleanScore(value) {
  return value ? 100 : 1
}

export function evaluateCanonicalWorkoutQuality(output) {
  const items = allItems(output)
  const intent = output.intent
  const phaseKeys = output.phases.map((phase) => phase.phaseKey)
  const families = items.map((item) => item.familyId).filter(Boolean)
  const uniqueFamilies = new Set(families)
  const patterns = new Set(items.flatMap((item) => item.movementPatterns ?? []))
  const bodyRegions = new Set(items.flatMap((item) => item.bodyRegions ?? []))
  const muscles = new Set(items.flatMap((item) => [
    ...(item.anatomy?.primaryMuscles ?? []),
    ...(item.anatomy?.secondaryMuscles ?? []),
    ...(item.anatomy?.stabilizers ?? []),
  ]))
  const joints = new Set(items.flatMap((item) => item.anatomy?.joints ?? []))
  const planes = new Set(items.flatMap((item) => item.anatomy?.planes ?? []))
  const lateralities = new Set(items.map((item) => item.anatomy?.laterality).filter(Boolean))
  const prescribedEquipment = new Set(items.flatMap((item) => item.equipment ?? []))
  const phaseFit = average(items.map((item) => item.selectionScore?.components?.phaseSuitability))
  const objectiveFit = average(items.map((item) => item.selectionScore?.components?.objectiveRelevance))
  const challengeAverage = average(items.map((item) => item.predictedChallengeScore)) ?? 1
  const utilizationRatio = challengeAverage / Math.max(1, intent.maxDifficulty)
  const utilizationScore = utilizationRatio >= 0.45 && utilizationRatio <= 0.9
    ? 100
    : 100 - Math.min(99, Math.abs(utilizationRatio - 0.675) * 150)
  const maxRisk = Math.max(...items.map((item) => Number(item.technicalRiskScore ?? 1)), 1)
  const equipmentAvoidLeak = items.some((item) => item.equipment.some((key) => intent.equipmentAvoid.includes(key)))
  const exerciseAvoidLeak = items.some((item) => (
    intent.exerciseAvoid.includes(String(item.exerciseId))
  ))
  const movementAvoidLeak = items.some((item) => (
    item.movementPatterns?.some((pattern) => intent.movementAvoid.includes(pattern))
  ))
  const restore = output.phases.find((phase) => phase.phaseKey === 'restore')
  const sustainedIndex = phaseKeys.indexOf('sustained_capacity')
  const outputIndex = phaseKeys.indexOf('output')
  const requiredEquipmentUsed = intent.equipmentRequired.every((key) => prescribedEquipment.has(key))
  const cohortComplete = intent.athleteCohorts.every((cohort) => items.every((item) => (
    item.cohortScaling?.[cohort.key] && item.predictedChallengeByCohort?.[cohort.key] != null
  )))
  const categories = {
    session_structure: booleanScore(output.validation.passedHardConstraints && output.phases.every((phase) => phase.prescriptions.length)),
    duration_accuracy: clampScore(100 - (
      Math.abs(output.validation.durationReconciliation.estimatedMinutes - intent.durationMinutes)
      / Math.max(1, output.validation.durationReconciliation.toleranceMinutes)
    ) * 10),
    phase_intent: clampScore(average(output.phases.map((phase) => phase.phaseQualityScore))),
    exercise_phase_fit: clampScore(phaseFit),
    objective_fidelity: clampScore(objectiveFit),
    athlete_age_fit: booleanScore(items.every((item) => item.predictedChallengeScore <= intent.maxDifficulty)),
    difficulty_utilization: clampScore(utilizationScore),
    technical_complexity: clampScore(100 - Math.max(0, maxRisk - intent.maxTechnicalRisk) * 5),
    load_appropriateness: booleanScore(items.every((item) => (
      Number(item.difficulty?.absoluteLoadDemand ?? 1) <= intent.maxDifficulty
    ))),
    youth_safety: booleanScore(output.validation.errors.length === 0),
    progression_validity: null,
    progression_lane_integrity: null,
    cohort_scaling: booleanScore(cohortComplete),
    equipment_use: booleanScore(requiredEquipmentUsed),
    equipment_avoids: booleanScore(!equipmentAvoidLeak),
    movement_exercise_avoids: booleanScore(!exerciseAvoidLeak && !movementAvoidLeak),
    space_feasibility: booleanScore(items.every((item) => item.logistics.spaceFeasible !== false)),
    coach_station_feasibility: booleanScore(items.every((item) => (
      item.logistics.equipmentFeasible && item.logistics.supervisionFeasible !== false
    ))),
    group_throughput: booleanScore(items.every((item) => item.logistics.queueRisk <= 20)),
    movement_pattern_coverage: clampScore(Math.min(100, Math.max(1, patterns.size * 20))),
    muscle_joint_stabilizer_coverage: muscles.size || joints.size
      ? clampScore(Math.min(100, muscles.size * 10 + joints.size * 15))
      : (bodyRegions.size ? clampScore(Math.min(100, bodyRegions.size * 25)) : null),
    planes_laterality_coverage: planes.size
      ? clampScore(Math.min(100, planes.size * 25 + Math.max(0, lateralities.size - 1) * 10))
      : null,
    session_diversity: clampScore(families.length ? (uniqueFamilies.size / families.length) * 100 : 1),
    redundancy_control: booleanScore(families.length === uniqueFamilies.size),
    fatigue_arc: clampScore(average(output.phases.map((phase, phaseIndex) => {
      const technicalSensitivity = average(phase.prescriptions.map((item) => item.fatigueProfile?.technicalFatigueSensitivity))
      if (technicalSensitivity == null) return phaseIndex === 0 ? 100 : 90
      const normalizedPosition = phaseIndex / Math.max(1, output.phases.length - 1)
      return 100 - (technicalSensitivity * normalizedPosition * 0.75)
    }))),
    high_intent_freshness: booleanScore(sustainedIndex < 0 || outputIndex < 0 || outputIndex < sustainedIndex),
    hiit_containment: booleanScore(items.every((item) => (
      item.methodologyKey !== 'hiit' || item.phaseKey === 'sustained_capacity'
    ))),
    restore_quality: booleanScore(Boolean(restore && phaseKeys.at(-1) === 'restore' && restore.prescriptions.length)),
    transition_realism: booleanScore(output.phases.every((phase) => (
      phase.prescriptions.every((item) => item.logistics.transitionSeconds >= 0)
      && Boolean(phase.stationSynchronizationPlan)
    ))),
    dose_appropriateness: booleanScore(items.every((item) => (
      item.dose.sets >= 1 && item.dose.workSeconds >= 10 && item.dose.restSeconds >= 0
    ))),
    instruction_completeness: booleanScore(items.every((item) => (
      item.coachInstructions && item.athleteInstructions && item.qualityGate && item.stopRules.length
    ))),
    video_completeness: booleanScore(items.every((item) => Boolean(item.videoUrl))),
    explanation_fidelity: booleanScore(items.every((item) => (
      item.purpose && item.selectionScore?.components
    ))),
    ai_interpretation_fidelity: output.mode === 'ai_assisted'
      ? booleanScore(Boolean(output.aiInterpretation && !output.aiUnavailable))
      : null,
    determinism_reproducibility: booleanScore(Boolean(output.randomSeed && output.generatorVersion && output.libraryVersion)),
    constraint_report_quality: booleanScore(Boolean(
      output.diagnostics?.rejectionCounts && output.diagnostics?.candidatePoolDepthByPhase
    )),
    repair_loop_performance: output.diagnostics?.repairs?.length ? 100 : null,
    coach_acceptance_telemetry: output.coachReviewSummary?.reviewCount ? clampScore(
      output.coachReviewSummary.keepOrMinorEditPercent,
    ) : null,
  }
  for (const name of CATEGORY_NAMES) {
    if (!(name in categories)) throw new Error(`missing quality category: ${name}`)
    categories[name] = clampScore(categories[name])
  }
  const scoredValues = Object.values(categories).filter((value) => value != null)
  return {
    schemaVersion: '1.0.0',
    categories,
    overallScore: clampScore(average(scoredValues)),
    safetyScore: categories.youth_safety,
    logisticsFeasibilityScore: clampScore(average([
      categories.equipment_use,
      categories.equipment_avoids,
      categories.space_feasibility,
      categories.coach_station_feasibility,
      categories.group_throughput,
    ])),
    hardViolationCount: output.validation.errors.length,
  }
}

export { CATEGORY_NAMES as CANONICAL_QUALITY_CATEGORY_NAMES }
