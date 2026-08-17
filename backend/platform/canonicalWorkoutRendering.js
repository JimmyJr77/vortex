function prescriptions(output) {
  return (output?.phases ?? []).flatMap((phase) => (
    (phase.prescriptions ?? []).map((item) => ({ phase, item }))
  ))
}

export function renderCanonicalWorkoutForCoach(output) {
  return {
    workoutId: output.workoutId,
    durationMinutes: output.intent.durationMinutes,
    validationStatus: output.validation.status,
    impactBudget: output.validation.impactBudget,
    fatigueBudget: output.validation.fatigueBudget,
    phases: (output.phases ?? []).map((phase) => ({
      phaseKey: phase.phaseKey,
      targetMinutes: phase.targetMinutes,
      estimatedMinutes: phase.estimatedMinutes,
      stationArrangement: phase.stationArrangement,
      prescriptions: (phase.prescriptions ?? []).map((item) => ({
        exerciseId: item.exerciseId,
        variantId: item.variantId,
        exerciseName: item.exerciseName,
        purpose: item.purpose,
        dose: item.dose,
        logistics: item.logistics,
        equipment: item.equipment,
        qualityGate: item.qualityGate,
        stopRules: item.stopRules,
        coachInstructions: item.coachInstructions,
        coachSupport: item.coachSupport,
        measurement: item.measurement,
        supportPrompts: item.supportPrompts,
        programming: item.programming,
        doseScaling: item.doseScaling,
        substitutions: item.substitutions,
        videoUrl: item.videoUrl,
      })),
    })),
  }
}

export function renderCanonicalWorkoutForAthlete(output) {
  return {
    workoutId: output.workoutId,
    durationMinutes: output.intent.durationMinutes,
    exercises: prescriptions(output).map(({ phase, item }) => ({
      phaseKey: phase.phaseKey,
      exerciseName: item.exerciseName,
      purpose: item.purpose,
      dose: item.dose,
      instructions: item.athleteInstructions,
      support: item.athleteSupport,
      qualityGate: item.qualityGate,
      measurement: item.measurement?.athleteVisible === false ? null : item.measurement,
      stopRules: item.stopRules,
      videoUrl: item.videoUrl,
    })),
  }
}

export function attachCanonicalWorkoutViews(output) {
  return {
    ...output,
    views: {
      coach: renderCanonicalWorkoutForCoach(output),
      athlete: renderCanonicalWorkoutForAthlete(output),
    },
  }
}
