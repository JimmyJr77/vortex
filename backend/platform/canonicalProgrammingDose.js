import { immutableProgrammingValue } from './workoutProgrammingRequest.js'
import { normalizePhaseKey } from './sessionPhaseKeys.js'
import { ProgrammingPrescriptionError, prescriptionInteger } from './programmingPrescriptionContract.js'
import { selectProgrammingMethodPrescription, resolveProgrammingMethodClock } from './programmingMethodClock.js'

export { ProgrammingPrescriptionError, prescriptionInteger } from './programmingPrescriptionContract.js'
function range(dose, field, fallback, min, max) {
  const preferred = dose[field] ?? fallback
  if (preferred == null) throw new ProgrammingPrescriptionError('missing_prescription_metadata', `Reviewed ${field} is required`)
  const target = prescriptionInteger(preferred, field, min, max)
  const lower = prescriptionInteger(dose[`${field}Min`] ?? target, `${field}Min`, min, max)
  const upper = prescriptionInteger(dose[`${field}Max`] ?? target, `${field}Max`, min, max)
  if (lower > target || target > upper) throw new ProgrammingPrescriptionError('invalid_prescription_metadata', `${field} default is outside reviewed bounds`)
  return { target, min: lower, max: upper }
}
function chooseRange(bounds, value, field) {
  const chosen = value ?? bounds.target
  prescriptionInteger(chosen, field, bounds.min, bounds.max)
  return chosen
}

/** Missing/null contacts are unknown, never a manufactured zero. */
export function canonicalContactExposure(card, profile, sets, reps) {
  const dose = profile.dosage ?? {}
  const sources = [
    ['profile_contacts_per_set', dose.contactsPerSet],
    ['profile_contact_estimate', dose.contactEstimate?.planningDefaultContactsPerSet],
    ['variant_contact_estimate', card.loadProfile?.contactExposureModel?.planningDefaultContactsPerSet],
  ]
  for (const [source, value] of sources) if (value != null) {
    prescriptionInteger(value, source, 0, 10000)
    return { contacts: sets * value, contactsPerSet: value, source }
  }
  if (card.loadProfile?.landingContactsPerRep != null && reps != null) {
    const perRep = prescriptionInteger(card.loadProfile.landingContactsPerRep, 'landingContactsPerRep', 0, 100)
    return { contacts: sets * reps * perRep, contactsPerSet: reps * perRep, source: 'variant_contacts_per_rep' }
  }
  return { contacts: null, contactsPerSet: null, source: 'unknown' }
}

/** Hydrated canonical method/profile selection. Default dose never grows to fill a clock. */
export function resolveCanonicalProgrammingDose({ card, profile, method, request, componentKey, proposal = {} }) {
  if (!proposal || typeof proposal !== 'object' || Array.isArray(proposal)
    || Object.keys(proposal).some((key) => !['sets', 'reps', 'workSeconds', 'restSeconds'].includes(key))) {
    throw new ProgrammingPrescriptionError('invalid_dose_proposal', 'Dose proposals may contain only sets, reps, workSeconds and restSeconds')
  }
  if (!card.deliveryProfiles?.some((entry) => entry.id === profile.id)) throw new ProgrammingPrescriptionError('foreign_delivery_profile', 'Dose profile is not part of this card')
  const phaseKey = profile.phaseKey
  const phase = method.phase_profiles?.find((entry) => normalizePhaseKey(entry.phaseKey) === phaseKey)
  if (phase?.role === 'avoid' || method.incompatible_phases?.some((key) => normalizePhaseKey(key) === phaseKey)
    || (!phase && normalizePhaseKey(method.best_session_phase) !== phaseKey
      && !method.compatible_session_phases?.some((key) => normalizePhaseKey(key) === phaseKey))) {
    throw new ProgrammingPrescriptionError('method_phase_mismatch', 'Canonical method does not support this delivery phase')
  }
  const selectedPrescription = selectProgrammingMethodPrescription(method, request)
  const prescription = selectedPrescription.profile
  const clock = resolveProgrammingMethodClock(method, selectedPrescription)
  if (componentKey === 'capacity_competition' && request.logistics.tumblingMinutes > 0 && method.fatigue_profile?.fatigue_level === 'high') {
    throw new ProgrammingPrescriptionError('fatigue_before_tumbling', 'High-fatigue conditioning cannot precede booked tumbling')
  }
  if (method.fatigue_profile?.fatigue_level === 'high' && method.fatigue_profile?.technical_risk_under_fatigue === 'high') {
    throw new ProgrammingPrescriptionError('high_fatigue_high_technical', 'Method combines high fatigue with high technical risk')
  }
  const reviewed = profile.dosage ?? {}
  const setsBounds = range(reviewed, 'sets', null, 1, 100)
  const workBounds = range(reviewed, 'workSeconds', null, 1, 3600)
  const restBounds = range(reviewed, 'restSeconds', null, 0, 3600)
  const repsBounds = reviewed.reps == null ? null : range(reviewed, 'reps', null, 1, 1000)
  const methodRounds = prescription.default_rounds == null ? null : Number(prescription.default_rounds)
  const sets = chooseRange(setsBounds, proposal.sets ?? clock.targetSets ?? methodRounds, 'sets')
  if (clock.targetSets != null && sets !== clock.targetSets) throw new ProgrammingPrescriptionError('method_clock_set_mismatch', 'A fixed clock cannot be shortened by reducing its reviewed cycle count')
  const workSeconds = chooseRange(workBounds, proposal.workSeconds ?? clock.workSeconds, 'workSeconds')
  const restSeconds = chooseRange(restBounds, proposal.restSeconds ?? clock.restSeconds, 'restSeconds')
  const reps = repsBounds ? chooseRange(repsBounds, proposal.reps, 'reps') : null
  if (!repsBounds && proposal.reps != null) throw new ProgrammingPrescriptionError('invalid_dose_proposal', 'A timed profile has no reviewed repetition prescription')
  // A proposal cannot turn a named clock into a different work/rest format.
  for (const [field, methodValue] of [['workSeconds', clock.workSeconds], ['restSeconds', clock.restSeconds]]) {
    if (proposal[field] != null && methodValue != null && proposal[field] !== Number(methodValue)) {
      throw new ProgrammingPrescriptionError('method_clock_mismatch', `Proposed ${field} differs from the canonical method prescription`)
    }
  }
  const restBetweenRoundsSeconds = prescription.default_rest_between_rounds_seconds == null ? 0
    : prescriptionInteger(Number(prescription.default_rest_between_rounds_seconds), 'method rest between rounds', 0, 3600)
  const contactExposure = canonicalContactExposure(card, profile, sets, reps)
  const impactScore = Number(card.stressProfile?.impactStress ?? card.taskDemands?.impactToleranceDemand)
  if (!Number.isFinite(impactScore)) throw new ProgrammingPrescriptionError('missing_impact_metadata', 'Reviewed impact score is required')
  if (impactScore > 40 && contactExposure.contacts == null) throw new ProgrammingPrescriptionError('unknown_high_impact_contacts', 'High-impact work requires a reviewed contact count or estimate')
  return immutableProgrammingValue(structuredClone({
    schemaVersion: '1.0.0', programmingMethodId: String(method.id), methodPrescriptionId: String(prescription.id), clock,
    sets, reps, workSeconds, restSeconds, restBetweenRoundsSeconds,
    activeSecondsPerAthlete: sets * workSeconds, contacts: contactExposure.contacts, contactExposure,
    highImpactContacts: impactScore > 40 ? contactExposure.contacts : 0,
    tempo: reviewed.tempo ?? null, rpe: reviewed.rpe ?? clock.rpeRange, loadMethod: reviewed.loadMethod ?? card.loadProfile?.externalLoadMethod ?? null,
    loadTarget: reviewed.loadTarget ?? null, bounds: { sets: setsBounds, reps: repsBounds, workSeconds: workBounds, restSeconds: restBounds },
    qualityGate: profile.qualityGate, stopRules: [...new Set([...(profile.stopRules ?? []), ...(method.stop_rules ?? []).map((entry) => entry.stopRule)])],
  }))
}
