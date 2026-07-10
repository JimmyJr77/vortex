/** Age-band difficulty caps and soft-penalty scoring for prescription / validation. */

export const AGE_BAND_POLICIES = [
  { ageMin: 4, ageMax: 5, maxOverall: 3, maxTechnical: 3, maxLoad: 2, maxComplexity: 3, impliedSkillLevel: 'EARLY_STAGE', scalingCohort: 'youth_beginner' },
  { ageMin: 6, ageMax: 8, maxOverall: 5, maxTechnical: 5, maxLoad: 4, maxComplexity: 5, impliedSkillLevel: 'BEGINNER', scalingCohort: 'youth_intermediate' },
  { ageMin: 9, ageMax: 12, maxOverall: 6, maxTechnical: 6, maxLoad: 5, maxComplexity: 6, impliedSkillLevel: 'BEGINNER', scalingCohort: 'youth_intermediate' },
  { ageMin: 13, ageMax: 17, maxOverall: 7, maxTechnical: 7, maxLoad: 6, maxComplexity: 7, impliedSkillLevel: 'INTERMEDIATE', scalingCohort: 'teen' },
  { ageMin: 18, ageMax: 120, maxOverall: 10, maxTechnical: 10, maxLoad: 10, maxComplexity: 10, impliedSkillLevel: null, scalingCohort: 'adult_beginner' },
]

const STRENGTH_KEYWORDS = /\b(strength|stronger|force|lifting|calisthenics|muscle)\b/i

function clamp(n, min, max) {
  return Math.min(max, Math.max(min, n))
}

function numOrNull(v) {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}

/** Overall = max(technical, load). Optional manual override. */
export function computeOverallDifficulty(technical, load, overallOverride = null) {
  const t = clamp(Number(technical) || 1, 1, 10)
  const l = clamp(Number(load) || 1, 1, 10)
  if (overallOverride != null && Number.isFinite(Number(overallOverride))) {
    return clamp(Number(overallOverride), 1, 10)
  }
  return Math.max(t, l)
}

export function resolveAgeBand(ageMin, ageMax) {
  const min = numOrNull(ageMin)
  const max = numOrNull(ageMax)
  if (min == null && max == null) return AGE_BAND_POLICIES[AGE_BAND_POLICIES.length - 1]
  const mid = min != null && max != null ? (min + max) / 2 : (min ?? max)
  for (const band of AGE_BAND_POLICIES) {
    if (mid >= band.ageMin && mid <= band.ageMax) return band
  }
  if (mid < 4) return AGE_BAND_POLICIES[0]
  return AGE_BAND_POLICIES[AGE_BAND_POLICIES.length - 1]
}

/** True when engine hard-excludes over-cap pool candidates at pick time (split/caps overrides). */
export function resolveHardDifficultyExclude(input = {}) {
  const capsOverride = input.capsOverride ?? input.caps_override
  const audienceSplits = input.audienceSplits ?? input.audience_splits ?? []
  if (capsOverride != null) return true
  return audienceSplits.some((s) => {
    const override = s.capsOverride ?? s.caps_override ?? s.difficultyOverride ?? s.difficulty_override
    return override != null
  })
}

export function detectStrengthIntent({ sessionObjective, targets = [], prompt = '' } = {}) {
  if (sessionObjective === 'strength_priority') return true
  if (STRENGTH_KEYWORDS.test(String(prompt))) return true
  return targets.some((t) => {
    const key = String(t.facetKey ?? t.key ?? '').toLowerCase()
    const name = String(t.facetName ?? t.name ?? '').toLowerCase()
    return key === 'strength' || name.includes('strength')
  })
}

export function parseAgeRangeFromText(text) {
  const s = String(text || '')
  const range = s.match(/ages?\s*(\d{1,2})\s*(?:[-–—to]+|\s+to\s+)\s*(\d{1,2})/i)
    ?? s.match(/(\d{1,2})\s*[-–—]\s*(\d{1,2})\s*(?:year|yr|y\.?o\.?)/i)
  if (range) {
    const a = Number(range[1])
    const b = Number(range[2])
    return { ageMin: Math.min(a, b), ageMax: Math.max(a, b) }
  }
  const single = s.match(/(\d{1,2})\s*year\s*old/i)
  if (single) {
    const age = Number(single[1])
    return { ageMin: age, ageMax: age }
  }
  return { ageMin: null, ageMax: null }
}

export function parseSessionObjectiveFromText(text) {
  const lower = String(text || '').toLowerCase()
  if (/\b(strength|stronger|lifting|calisthenics|muscle)\b/.test(lower)) return 'strength_priority'
  if (/\b(speed|sprint|fast)\b/.test(lower)) return 'speed_priority'
  if (/\b(power|explosive|plyo)\b/.test(lower)) return 'explosiveness_power_priority'
  if (/\b(agility|cutting|change of direction)\b/.test(lower)) return 'agility_priority'
  if (/\b(tumbling|skill|gymnastics)\b/.test(lower)) return 'skill_tumbling_priority'
  if (/\b(mobility|flexibility|stretch)\b/.test(lower)) return 'mobility_control_priority'
  if (/\b(fitness|conditioning|cardio)\b/.test(lower)) return 'fitness_priority'
  if (/\b(recovery|low intensity|reset)\b/.test(lower)) return 'recovery_low_intensity'
  return null
}

export function resolveAudienceProfile(input = {}) {
  const ageMin = numOrNull(input.ageMin ?? input.age_min)
  const ageMax = numOrNull(input.ageMax ?? input.age_max)
  const band = resolveAgeBand(ageMin, ageMax)
  const strengthIntent = detectStrengthIntent(input)

  let sessionObjective = input.sessionObjective ?? input.session_objective ?? null
  if (strengthIntent && !sessionObjective) sessionObjective = 'strength_priority'

  let skillLevel = input.skillLevel ?? input.skill_level ?? null
  if (!skillLevel && band.impliedSkillLevel) skillLevel = band.impliedSkillLevel

  let targets = Array.isArray(input.targets) ? [...input.targets] : []
  if (strengthIntent && !targets.some((t) => String(t.facetKey ?? t.key ?? '').toLowerCase() === 'strength' || String(t.facetName ?? '').toLowerCase().includes('strength'))) {
    targets = [...targets, { facetType: 'tenet', facetKey: 'strength', weight: 5 }]
  }

  return {
    ageMin,
    ageMax,
    caps: {
      maxOverall: band.maxOverall,
      maxTechnical: band.maxTechnical,
      maxLoad: band.maxLoad,
      maxComplexity: band.maxComplexity,
    },
    scalingCohort: band.scalingCohort,
    impliedSkillLevel: skillLevel,
    sessionObjective,
    targets,
    strengthIntent,
    ageBandLabel: ageMin != null || ageMax != null
      ? `ages ${ageMin ?? '?'}-${ageMax ?? '?'}`
      : 'all ages',
  }
}

function overBy(value, cap) {
  if (value == null || cap == null) return 0
  return Math.max(0, Number(value) - Number(cap))
}

/** Soft penalty multiplier: 1.0 in band, down when load/technical exceed caps. */
export function scoreAgeDifficultyFit(difficulty, caps) {
  if (!difficulty || !caps) return 1
  const overallOver = overBy(difficulty.overall, caps.maxOverall)
  const technicalOver = overBy(difficulty.technical, caps.maxTechnical)
  const loadOver = overBy(difficulty.load, caps.maxLoad)

  const weightedOver = overallOver * 0.4 + technicalOver * 0.25 + loadOver * 0.35

  if (weightedOver <= 0) return 1
  return clamp(1 - weightedOver * 0.18, 0.15, 1)
}

export function classifyAgeFit(difficulty, caps) {
  if (!difficulty || !caps) return 'good'
  const fit = scoreAgeDifficultyFit(difficulty, caps)
  if (fit >= 0.85) return 'good'
  if (fit >= 0.5) return 'stretch'
  return 'over_cap'
}

export function ageFitWarnings(difficulty, caps, exerciseName = 'Exercise') {
  if (!difficulty || !caps) return []
  const warnings = []
  if (overBy(difficulty.overall, caps.maxOverall) > 0) {
    warnings.push(`${exerciseName}: overall difficulty ${difficulty.overall} exceeds cap ${caps.maxOverall}`)
  }
  if (overBy(difficulty.load, caps.maxLoad) > 0) {
    warnings.push(`${exerciseName}: load ${difficulty.load} exceeds cap ${caps.maxLoad} for this age group`)
  }
  if (overBy(difficulty.technical, caps.maxTechnical) > 0) {
    warnings.push(`${exerciseName}: technical ${difficulty.technical} exceeds cap ${caps.maxTechnical} for this age group`)
  }
  return warnings
}

export function mapDifficultyRow(row) {
  if (!row) return null
  return {
    technical: Number(row.technical),
    load: Number(row.load),
    overall: Number(row.overall),
    recommended_age_min: row.recommended_age_min ?? null,
    recommended_age_max: row.recommended_age_max ?? null,
    attention_demand: row.attention_demand ?? null,
    notes: row.notes ?? null,
    source: row.source ?? 'derived',
  }
}
