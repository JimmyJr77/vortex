const TRUTHY = new Set(['1', 'true', 'yes'])

export const CANONICAL_ROLLOUT_FLAGS = Object.freeze([
  'canonical_contract_read',
  'canonical_score_shadow',
  'canonical_generator_shadow',
  'canonical_generator_coach_opt_in',
  'canonical_ai_intent',
  'canonical_generator_default',
])

export function canonicalEnvironmentEnabled(environment = process.env) {
  return TRUTHY.has(String(environment.CANONICAL_WORKOUT_GENERATOR_ENABLED || '').toLowerCase())
}

export async function loadCanonicalFacilityRollout(pool, facilityId) {
  const result = await pool.query(
    `SELECT facility_id, rollout_stage, canonical_contract_read,
            canonical_score_shadow, canonical_generator_shadow,
            canonical_generator_coach_opt_in, canonical_ai_intent,
            canonical_generator_default, updated_at
       FROM coaching.canonical_generator_facility_rollout_v1
      WHERE facility_id=$1`,
    [facilityId],
  )
  const row = result.rows[0]
  if (!row) return null
  return {
    facilityId: Number(row.facility_id),
    rolloutStage: row.rollout_stage,
    canonicalContractRead: Boolean(row.canonical_contract_read),
    canonicalScoreShadow: Boolean(row.canonical_score_shadow),
    canonicalGeneratorShadow: Boolean(row.canonical_generator_shadow),
    canonicalGeneratorCoachOptIn: Boolean(row.canonical_generator_coach_opt_in),
    canonicalAiIntent: Boolean(row.canonical_ai_intent),
    canonicalGeneratorDefault: Boolean(row.canonical_generator_default),
    updatedAt: row.updated_at ?? null,
  }
}

export async function canonicalFacilityFeatureAccess(pool, facilityId, feature, environment = process.env) {
  if (!CANONICAL_ROLLOUT_FLAGS.includes(feature)) {
    throw new RangeError(`Unknown canonical rollout flag: ${feature}.`)
  }
  if (!canonicalEnvironmentEnabled(environment)) {
    return { enabled: false, reason: 'environment_disabled', rollout: null }
  }
  let rollout
  try {
    rollout = await loadCanonicalFacilityRollout(pool, facilityId)
  } catch (error) {
    if (error?.code === '42P01') {
      return { enabled: false, reason: 'rollout_schema_unavailable', rollout: null }
    }
    throw error
  }
  if (!rollout) return { enabled: false, reason: 'facility_not_enrolled', rollout: null }
  const enabled = {
    canonical_contract_read: rollout.canonicalContractRead,
    canonical_score_shadow: rollout.canonicalScoreShadow,
    canonical_generator_shadow: rollout.canonicalGeneratorShadow,
    canonical_generator_coach_opt_in: rollout.canonicalGeneratorCoachOptIn,
    canonical_ai_intent: rollout.canonicalAiIntent,
    canonical_generator_default: rollout.canonicalGeneratorDefault,
  }[feature]
  return { enabled, reason: enabled ? null : 'facility_flag_disabled', rollout }
}

export function assessCanonicalFacilityRollout(rollout, { requireCoachOptIn = false } = {}) {
  if (!rollout) {
    return {
      status: requireCoachOptIn ? 'blocked' : 'not_enrolled',
      issues: requireCoachOptIn ? [{
        code: 'FACILITY_ROLLOUT_NOT_ENROLLED',
        message: 'No explicit facility rollout enrollment exists.',
      }] : [],
    }
  }
  const enabled = {
    canonicalContractRead: rollout.canonicalContractRead,
    canonicalScoreShadow: rollout.canonicalScoreShadow,
    canonicalGeneratorShadow: rollout.canonicalGeneratorShadow,
    canonicalGeneratorCoachOptIn: rollout.canonicalGeneratorCoachOptIn,
    canonicalAiIntent: rollout.canonicalAiIntent,
    canonicalGeneratorDefault: rollout.canonicalGeneratorDefault,
  }
  const requirements = {
    disabled: [],
    shadow: ['canonicalContractRead', 'canonicalScoreShadow', 'canonicalGeneratorShadow'],
    coach: ['canonicalContractRead', 'canonicalScoreShadow', 'canonicalGeneratorShadow', 'canonicalGeneratorCoachOptIn'],
    member: ['canonicalContractRead', 'canonicalScoreShadow', 'canonicalGeneratorShadow', 'canonicalGeneratorCoachOptIn', 'canonicalGeneratorDefault'],
  }[rollout.rolloutStage] ?? []
  const issues = []
  for (const key of requirements) {
    if (!enabled[key]) issues.push({
      code: 'FACILITY_ROLLOUT_STAGE_MISMATCH',
      message: `${rollout.rolloutStage} rollout requires ${key}.`,
    })
  }
  if (rollout.rolloutStage === 'disabled' && Object.values(enabled).some(Boolean)) {
    issues.push({
      code: 'FACILITY_ROLLOUT_STAGE_MISMATCH',
      message: 'Disabled rollout cannot have an enabled canonical feature flag.',
    })
  }
  if (requireCoachOptIn && !rollout.canonicalGeneratorCoachOptIn) {
    issues.push({
      code: 'FACILITY_COACH_OPT_IN_REQUIRED',
      message: 'Coach generation requires canonical_generator_coach_opt_in.',
    })
  }
  return { status: issues.length ? 'blocked' : 'valid', issues }
}
