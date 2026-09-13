import { ProgrammingPrescriptionError, prescriptionInteger } from './programmingPrescriptionContract.js'
import { immutableProgrammingValue } from './workoutProgrammingRequest.js'

export const PROGRAMMING_CLOCK_VERSION = '1.0.0'
const EXPERIENCES = ['beginner', 'intermediate', 'advanced', 'elite']
const INTERVAL_TYPES = new Set(['work_rest_interval', 'interval', 'hiit_interval', 'tabata', 'coach_interval', 'machine_interval'])
const MINUTE_TYPES = new Set(['emom', 'strength_endurance_emom', 'conditioning_emom'])
const fail = (code, message) => { throw new ProgrammingPrescriptionError(code, message) }
const number = (value, field, minimum = 0, maximum = 14400) => value == null ? null : prescriptionInteger(
  typeof value === 'string' && /^\d+(?:\.\d+)?$/.test(value) ? Number(value) : value, field, minimum, maximum)

function audience(profile) {
  const named = typeof profile.profile_name === 'string' && EXPERIENCES.includes(profile.profile_name.trim().toLowerCase()) ? profile.profile_name.trim().toLowerCase() : null
  const explicit = profile.training_experience
  if (explicit != null && explicit !== 'all' && !EXPERIENCES.includes(explicit)) fail('invalid_method_audience', 'Method training experience is not a supported source value')
  if (explicit && explicit !== 'all' && named && named !== explicit) fail('method_audience_conflict', 'Method profile name conflicts with its explicit training experience')
  return { experience: explicit === 'all' ? null : explicit ?? named, source: explicit != null ? 'training_experience' : named ? 'profile_name' : 'unrestricted' }
}

/** Exact named audience values in the existing seed are metadata, not inferred skill levels. */
export function selectProgrammingMethodPrescription(method, request) {
  const youngest = Math.min(...request.athletes.map((cohort) => cohort.ageMin))
  const oldest = Math.max(...request.athletes.map((cohort) => cohort.ageMax))
  const experience = EXPERIENCES.find((level) => request.athletes.some((cohort) => cohort.trainingExperience === level))
  const candidates = (method.prescriptions ?? []).map((profile) => ({ profile, audience: audience(profile) })).filter(({ profile, audience: target }) =>
    (profile.age_min == null || number(profile.age_min, 'method age minimum', 5, 99) <= youngest)
    && (profile.age_max == null || number(profile.age_max, 'method age maximum', 5, 99) >= oldest)
    && (target.experience == null || target.experience === experience))
    .sort((a, b) => Number(b.audience.experience === experience) - Number(a.audience.experience === experience)
      || String(a.profile.id).localeCompare(String(b.profile.id), 'en', { numeric: true }))
  const selected = candidates[0]
  if (!selected?.profile.id) fail('method_prescription_missing', 'No canonical method prescription covers this group')
  return immutableProgrammingValue(structuredClone({ ...selected, groupExperience: experience }))
}

function sourceValue(profileValue, namedValue, field, minimum = 0, maximum = 14400) {
  const prescribed = number(profileValue, field, minimum, maximum)
  const named = number(namedValue, `named ${field}`, minimum, maximum)
  if (prescribed != null && named != null && prescribed !== named) fail('method_clock_source_conflict', `${field} differs between canonical prescription records for this audience`)
  return prescribed ?? named
}

function rpeRange(profile, named) {
  let fromProfile = null
  let fromNamed = null
  if (profile.default_rpe_min != null || profile.default_rpe_max != null) {
    if (profile.default_rpe_min == null || profile.default_rpe_max == null) fail('method_intensity_metadata', 'Method RPE requires both reviewed bounds')
    fromProfile = [number(profile.default_rpe_min, 'minimum RPE', 1, 10), number(profile.default_rpe_max, 'maximum RPE', 1, 10)]
  }
  if (named.rpe != null) {
    const value = String(named.rpe)
    if (!/^\d+(?:-\d+)?$/.test(value)) fail('method_intensity_metadata', 'Named RPE must be a number or an explicit numeric range')
    fromNamed = value.split('-').map((entry) => number(entry, 'named RPE', 1, 10))
    if (fromNamed.length === 1) fromNamed.push(fromNamed[0])
  }
  if ([fromProfile, fromNamed].some((value) => value && value[0] > value[1])) fail('method_intensity_conflict', 'Method RPE bounds are reversed')
  if (fromProfile && fromNamed && (fromProfile[0] !== fromNamed[0] || fromProfile[1] !== fromNamed[1])) fail('method_intensity_source_conflict', 'Canonical audience records disagree about RPE bounds')
  return fromProfile ?? fromNamed
}

/** A method clock describes the prescribed work domain for each athlete; group overhead is scheduled separately. */
export function resolveProgrammingMethodClock(method, selection) {
  const type = method.programming_type ?? null
  const kind = type === 'straight_sets' ? 'recovery_sets' : MINUTE_TYPES.has(type) ? 'minute_clock' : INTERVAL_TYPES.has(type) ? 'fixed_interval' : 'unsupported'
  const { profile, audience: target, groupExperience } = selection
  const named = method.work_rest_structure?.default_prescription?.[target.experience ?? groupExperience] ?? {}
  const fixed = ['minute_clock', 'fixed_interval'].includes(kind)
  const intensity = rpeRange(profile, fixed ? named : {})
  const workSeconds = fixed ? sourceValue(profile.default_work_seconds, named.work_target_seconds, 'work seconds', 1, 3600)
    : number(profile.default_work_seconds, 'work seconds', 1, 3600)
  const restSeconds = fixed ? sourceValue(profile.default_rest_seconds, named.rest_target_seconds, 'rest seconds', 0, 3600)
    : number(profile.default_rest_seconds, 'rest seconds', 0, 3600)
  const rounds = fixed ? sourceValue(profile.default_rounds, named.rounds, 'rounds', 1, 100)
    : number(profile.default_rounds, 'rounds', 1, 100)
  let targetSets = null
  let intervalSeconds = null
  let domainSeconds = null
  if (fixed) {
    if (workSeconds == null || restSeconds == null) fail('method_clock_metadata_missing', 'A fixed method clock requires reviewed work and rest seconds')
    intervalSeconds = workSeconds + restSeconds
    if (kind === 'minute_clock' && intervalSeconds !== 60) fail('method_minute_clock_conflict', 'EMOM work and rest must describe an exact sixty-second cycle')
    const minutes = sourceValue(profile.default_total_minutes, named.minutes, 'duration minutes', 1, 240)
    domainSeconds = minutes == null ? null : minutes * 60
    if (domainSeconds == null && rounds == null) fail('method_clock_metadata_missing', 'A fixed method clock requires a reviewed duration or cycle count')
    if (domainSeconds != null && domainSeconds % intervalSeconds !== 0) fail('method_clock_domain_conflict', 'The reviewed duration does not contain a whole number of the reviewed work/rest cycles')
    targetSets = domainSeconds == null ? rounds : domainSeconds / intervalSeconds
    prescriptionInteger(targetSets, 'fixed clock cycles', 1, 100)
    if (rounds != null && rounds !== targetSets) fail('method_clock_domain_conflict', 'The reviewed cycle count and duration disagree')
    domainSeconds ??= targetSets * intervalSeconds
    const additionalRest = number(profile.default_rest_between_rounds_seconds, 'rest between rounds', 0, 3600) ?? 0
    if (additionalRest > restSeconds) fail('method_clock_recovery_conflict', 'Additional round recovery cannot fit this fixed cadence')
  }
  return immutableProgrammingValue({ schemaVersion: PROGRAMMING_CLOCK_VERSION, kind, methodType: type, prescriptionId: String(profile.id),
    audience: target.experience, audienceSource: target.source, targetSets, recommendedSets: rounds, intervalSeconds, domainSeconds,
    workSeconds, restSeconds, rpeRange: intensity, allowsSetReduction: !fixed, staggerWaves: kind === 'fixed_interval' })
}
