import {
  FLIP_FIT_AGE_BANDS,
  type FlipFitAgeBand,
  type FlipFitProgram,
  type FlipFitScheduledExercise,
} from './flipFitProgram'

export { FLIP_FIT_AGE_BANDS, generateFlipFitProgram } from './flipFitProgram'

export type FlipFitDoseMode = 'continuous' | 'distance' | 'duration' | 'attempts' | 'repetitions'

export interface FlipFitScheduledPrescription {
  mode: FlipFitDoseMode
  sets: number
  reps?: number
  attempts?: number
  distanceMeters?: number
  durationSeconds?: number
  workSecondsPerSet: number
  restSeconds: number
  estimatedSeconds: number
  allocationSeconds: number
  display: string
  workDisplay: string
  restDisplay: string
  fitsAllocation: boolean
}

const DISTANCE_PATTERN = /sprint|run|shuffle|crawl|carry|march|skip|bound|chase|acceleration|deceleration|cut|locomotion|sled push/i
const DURATION_PATTERN = /hold|isometric|hang|plank|breathing|mobility|stretch|reset|support|balance|wall sit/i
const ATTEMPT_PATTERN = /jump|hop|throw|slam|toss|kick|roll|cartwheel|handstand|vault|lache|rebound|takeoff|landing|tumbling/i

function ageIndex(ageBand: FlipFitAgeBand) {
  return FLIP_FIT_AGE_BANDS.indexOf(ageBand)
}

function formatRest(seconds: number) {
  if (seconds === 0) return 'No separate rest'
  if (seconds < 60) return `${seconds} sec between sets`
  const minutes = seconds / 60
  return `${Number.isInteger(minutes) ? minutes : minutes.toFixed(1)} min between sets`
}

function formatMinutes(seconds: number) {
  const minutes = seconds / 60
  return Number.isInteger(minutes) ? String(minutes) : minutes.toFixed(1)
}

function finalize(
  exercise: FlipFitScheduledExercise,
  values: Omit<FlipFitScheduledPrescription, 'allocationSeconds' | 'estimatedSeconds' | 'fitsAllocation' | 'display' | 'workDisplay' | 'restDisplay'>,
  detail: string,
): FlipFitScheduledPrescription {
  const allocationSeconds = exercise.allocationMinutes * 60
  const estimatedSeconds = values.sets * values.workSecondsPerSet + Math.max(0, values.sets - 1) * values.restSeconds
  return {
    ...values,
    allocationSeconds,
    estimatedSeconds,
    fitsAllocation: estimatedSeconds <= allocationSeconds,
    display: `${values.sets} ${values.sets === 1 ? 'set' : 'sets'} · ${detail}`,
    workDisplay: `${values.workSecondsPerSet} sec per set`,
    restDisplay: formatRest(values.restSeconds),
  }
}

export function buildFlipFitScheduledPrescription(
  exercise: FlipFitScheduledExercise,
  ageBand: FlipFitAgeBand,
): FlipFitScheduledPrescription {
  const phase = exercise.card.phase
  const variation = exercise.card.ageScaling[ageBand].variation
  const identity = `${exercise.card.name} ${variation}`
  const level = ageIndex(ageBand)

  if (phase === 'prepare_and_access') {
    const durationSeconds = Math.min(exercise.allocationMinutes * 60, [120, 150, 180][level])
    return finalize(exercise, {
      mode: 'continuous',
      sets: 1,
      durationSeconds,
      workSecondsPerSet: durationSeconds,
      restSeconds: 0,
    }, `${formatMinutes(durationSeconds)}-minute continuous pass`)
  }

  if (phase === 'restore') {
    const durationSeconds = exercise.allocationMinutes * 60
    return finalize(exercise, {
      mode: 'continuous',
      sets: 1,
      durationSeconds,
      workSecondsPerSet: durationSeconds,
      restSeconds: 0,
    }, `${exercise.allocationMinutes}-minute reset`)
  }

  if (phase === 'sustained_capacity') {
    const sets = [3, 4, 4][level]
    const workSecondsPerSet = [30, 40, 45][level]
    const restSeconds = [30, 20, 15][level]
    return finalize(exercise, {
      mode: 'duration',
      sets,
      durationSeconds: workSecondsPerSet,
      workSecondsPerSet,
      restSeconds,
    }, `${workSecondsPerSet}-sec repeatable intervals`)
  }

  if (phase === 'output') {
    const sets = [3, 4, 4][level]
    const reps = [1, 2, 2][level]
    const workSecondsPerSet = [6, 8, 10][level]
    const restSeconds = [75, 90, 105][level]
    const usesDistance = DISTANCE_PATTERN.test(identity)
    const distanceMeters = usesDistance ? [5, 10, 15][level] : undefined
    return finalize(exercise, {
      mode: usesDistance ? 'distance' : 'attempts',
      sets,
      ...(usesDistance ? { distanceMeters } : { attempts: reps }),
      workSecondsPerSet,
      restSeconds,
    }, usesDistance ? `${distanceMeters} m per set` : `${reps} quality ${reps === 1 ? 'attempt' : 'attempts'} per set`)
  }

  if (phase === 'tumbling') {
    const sets = [3, 4, 4][level]
    const workSecondsPerSet = [20, 25, 30][level]
    const restSeconds = [45, 50, 60][level]
    return finalize(exercise, {
      mode: 'attempts',
      sets,
      attempts: 1,
      workSecondsPerSet,
      restSeconds,
    }, '1 coached skill attempt per set')
  }

  if (DURATION_PATTERN.test(identity)) {
    const sets = phase === 'resilience' ? [2, 2, 3][level] : [2, 3, 3][level]
    const durationSeconds = [15, 20, 25][level]
    const restSeconds = phase === 'capacity' ? [60, 75, 90][level] : [30, 40, 45][level]
    return finalize(exercise, {
      mode: 'duration',
      sets,
      durationSeconds,
      workSecondsPerSet: durationSeconds,
      restSeconds,
    }, `${durationSeconds}-sec hold`)
  }

  if (DISTANCE_PATTERN.test(identity)) {
    const sets = phase === 'movement_intelligence' ? [2, 3, 3][level] : [2, 3, 3][level]
    const distanceMeters = /carry|crawl|march|skip/i.test(identity) ? [10, 15, 20][level] : [5, 10, 15][level]
    const workSecondsPerSet = [20, 25, 30][level]
    const restSeconds = [40, 50, 60][level]
    return finalize(exercise, {
      mode: 'distance',
      sets,
      distanceMeters,
      workSecondsPerSet,
      restSeconds,
    }, `${distanceMeters} m per set`)
  }

  if (ATTEMPT_PATTERN.test(identity)) {
    const sets = [2, 3, 3][level]
    const attempts = [2, 3, 3][level]
    const workSecondsPerSet = [15, 20, 25][level]
    const restSeconds = [45, 60, 75][level]
    return finalize(exercise, {
      mode: 'attempts',
      sets,
      attempts,
      workSecondsPerSet,
      restSeconds,
    }, `${attempts} quality attempts per set`)
  }

  const sets = phase === 'capacity' ? [2, 3, 3][level] : phase === 'resilience' ? [2, 2, 3][level] : [2, 3, 3][level]
  const reps = phase === 'capacity' ? [6, 6, 5][level] : [4, 5, 6][level]
  const workSecondsPerSet = phase === 'capacity' ? [30, 35, 40][level] : [20, 25, 30][level]
  const restSeconds = phase === 'capacity' ? [75, 90, 105][level] : [40, 50, 60][level]
  return finalize(exercise, {
    mode: 'repetitions',
    sets,
    reps,
    workSecondsPerSet,
    restSeconds,
  }, `${reps} controlled reps per set`)
}

export function validateFlipFitPrescriptionFit(program: FlipFitProgram) {
  const errors: Array<{ sessionId: string; exerciseId: string; ageBand: FlipFitAgeBand; message: string }> = []
  for (const session of program.sessions) {
    const exercises = [...session.phases.flatMap((phase) => phase.exercises), ...session.tumbling.exercises]
    for (const exercise of exercises) {
      for (const ageBand of FLIP_FIT_AGE_BANDS) {
        const prescription = buildFlipFitScheduledPrescription(exercise, ageBand)
        if (!prescription.fitsAllocation) errors.push({
          sessionId: session.id,
          exerciseId: exercise.id,
          ageBand,
          message: `${prescription.estimatedSeconds} prescribed seconds exceed the ${prescription.allocationSeconds}-second station.`,
        })
      }
    }
  }
  return errors
}
