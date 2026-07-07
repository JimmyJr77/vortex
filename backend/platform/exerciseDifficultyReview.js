/**
 * Youth athletics difficulty review — two-axis model (product rules in docs/EXERCISE_DIFFICULTY_METHODOLOGY.md).
 *
 * - **Load** (1–10): inherent resistance — external implement floor OR relative BW / stability.
 * - **Technical** (1–10): movement pattern complexity only (not medium, regressions, or assists).
 * - **Overall**: max(load, technical).
 */
import { computeOverallDifficulty } from './ageDifficultyPolicy.js'
import { classifyProgrammingKind, isSkillDrill } from './exerciseProgrammingKind.js'

function clamp(n, min = 1, max = 10) {
  return Math.min(max, Math.max(min, Math.round(n)))
}

const SKILL_LEVEL_TECHNICAL = {
  EARLY_STAGE: 3,
  BEGINNER: 4,
  INTERMEDIATE: 6,
  ADVANCED: 8,
}

/** Ordered — first match wins for primary movement family. */
const PATTERN_FAMILIES = [
  { pattern: /muscle-up|muscle up/i, technical: 8, load: 8 },
  { pattern: /hang.?clean|power.?clean|full.?clean\b/i, technical: 7, load: 5 },
  { pattern: /snatch|clean.?and.?jerk|split.?jerk|push.?jerk/i, technical: 7, load: 5 },
  { pattern: /nordic|reverse.?nordic/i, technical: 3, load: 8 },
  { pattern: /handstand push|hspu|wall-handstand-push|wall-handstand-negative/i, technical: 5, load: 6 },
  { pattern: /pike push|pike-handstand|box-pike-handstand|box pike/i, technical: 5, load: 4 },
  { pattern: /pistol/i, technical: 4, load: 7 },
  { pattern: /pull-up|pull up|chin-up|chin up|pullup|chinup/i, technical: 4, load: 6 },
  { pattern: /parallel.?bar.?dip|ring.?dip|straight.?bar.?dip|\bdip\b/i, technical: 4, load: 5 },
  { pattern: /push-up|push up|pushup/i, technical: 4, load: 3 },
  { pattern: /back-squat|front-squat|overhead-squat|barbell.?squat/i, technical: 5, load: 5 },
  { pattern: /deadlift|romanian deadlift|\brdl\b/i, technical: 5, load: 5 },
  { pattern: /bench.?press|floor.?press/i, technical: 5, load: 5 },
  { pattern: /overhead.?press|shoulder.?press|military.?press/i, technical: 5, load: 4 },
  { pattern: /squat|lunge|step-up|glute bridge/i, technical: 4, load: 2 },
  { pattern: /plank|isometric hold|flexed.?arm.?hang|dead bug|bird dog/i, technical: 2, load: 2 },
  { pattern: /deceleration|cut\b|cod\b|reactive|180|360|agility|change of direction/i, technical: 5, load: 1 },
  { pattern: /sprint|acceleration|start|shuffle|skip|hop|jump|bear crawl|animal|locomotion|run\b|backpedal|high knee|butt kick|broad.?jump|vertical|box.?jump|plyo/i, technical: 4, load: 1 },
  { pattern: /mobil|breathing|cars\b|9090|foam|stretch|activate|integrate|prep\b|warm/i, technical: 2, load: 1 },
]

const LOAD_FROM_EQUIPMENT = [
  { pattern: /barbell|back-squat|front-squat|overhead-squat|deadlift|clean|snatch|jerk|bench-press|overhead-press|hang-clean|power-clean|squat.*bar|trap-bar|hex-bar|landmine.*press|landmine.*squat|anderson-squat|cluster/i, load: 5 },
  { pattern: /atlas|stone|d-ball|sandbag|heavy.*carry|yoke|farmer|suitcase carry|bear-hug carry/i, load: 5 },
  { pattern: /kettlebell|kb swing|kb goblet|kb clean|kb snatch|kb press|kb squat/i, load: 4 },
  { pattern: /dumbbell|db press|db row|db squat|db lunge|db curl|db snatch/i, load: 4 },
  { pattern: /medicine ball|med ball|slam ball|wall ball|wall-ball/i, load: 4 },
  { pattern: /band resisted|heavy band|resistance band.*press|resistance band.*row|cable.*stack|lat pulldown|leg press|smith machine/i, load: 3 },
  { pattern: /light band|mini band|pvc|dowel/i, load: 2 },
]

const HIGH_LOAD_KEYWORDS = /heavy|max\b|1rm|supramax|cluster set|near-max|working weight|\b2x\b|\b3x\b|\b4x\b|bodyweight.*deadlift|bodyweight.*squat.*bar/i

const ASSIST_APPLICABLE = /pull.?up|chin.?up|dip|push.?up|muscle.?up|nordic|pistol|bench|handstand push|hspu|squat.*bar|overhead.?press/i

const PURE_BW_FAMILY = /push-up|push up|pull-up|pull up|chin-up|dip|nordic|pistol|muscle-up|handstand push|hspu|plank|squat|lunge|sprint|hop|jump|bear crawl|mobil|breathing/i

function exerciseText(exercise) {
  return `${exercise.slug ?? ''} ${exercise.name ?? ''} ${exercise.movement_family ?? ''} ${exercise.load_note ?? ''}`.toLowerCase()
}

function detectPatternFamily(text) {
  if (/sprint|start.*10m|push-up start|prone start/i.test(text) && !/negative|eccentric|tempo push/i.test(text)) {
    return { technical: 4, load: 1 }
  }
  for (const { pattern, technical, load } of PATTERN_FAMILIES) {
    if (pattern.test(text)) return { technical, load }
  }
  return { technical: 4, load: 2 }
}

function scoreExternalLoadFloor(text) {
  let load = 1
  for (const { pattern, load: score } of LOAD_FROM_EQUIPMENT) {
    if (pattern.test(text)) load = Math.max(load, score)
  }
  if (HIGH_LOAD_KEYWORDS.test(text)) load = clamp(load + 2)
  return load
}

function isAssistApplicable(text) {
  return ASSIST_APPLICABLE.test(text)
}

function isUnilateralModifier(text) {
  if (/pistol/i.test(text)) return false
  return /single-leg|single.?leg|single-arm|single.?arm|one-arm|one arm|archer|unilateral/i.test(text)
}

function isEccentricOnly(text) {
  return /negative|eccentric|tempo.?eccentric/i.test(text)
      && !/tempo push-up|tempo squat|tempo lunge/i.test(text)
}

function isRegression(text) {
  return /knee push|incline push|wall push|box push|assisted pistol|partial.?range|lean isometric/i.test(text)
}

function isRingMedium(text) {
  return /\bring[-\s](dip|push|pull|row|muscle)|ring (dip|push|pull|row|muscle)|on rings|gymnastic rings|from rings/i.test(text)
}

function applyLoadModifiers(text, baseLoad) {
  let load = baseLoad

  if (/dip support|ring support|support hold/i.test(text)) {
    return clamp(Math.min(load, 3))
  }

  if (isUnilateralModifier(text)) load += 2

  if (isRingMedium(text) && !/ring.?support|support.?hold/i.test(text)) load += 1

  if (isEccentricOnly(text)) load -= 2

  if (isRegression(text)) load -= 1

  if (isAssistApplicable(text) && /assist|band.?assist|partner|spotter|spotted|with spot|box assist|support hold — assisted/i.test(text)) {
    load -= 3
  }

  if (/weighted|weight vest|weight.?ed|\+\s*\d+\s*(lb|kg|pound|kilos)/i.test(text)) load += 2

  if (/feet.?elevated|deficit|depth/i.test(text) && /push.?up|dip|squat/i.test(text)) load += 1

  return clamp(load)
}

function scoreExerciseLoad(exercise, text) {
  const family = detectPatternFamily(text)
  let load = applyLoadModifiers(text, family.load)

  const externalFloor = scoreExternalLoadFloor(text)
  const bwPrimary = PURE_BW_FAMILY.test(text)
    && !/barbell|dumbbell|kettlebell|medicine|sandbag|atlas|stone|wall ball|band resisted|cable|smith|leg press|lat pulldown/i.test(text)

  if (!bwPrimary || externalFloor > load) {
    load = Math.max(load, externalFloor)
  }

  return clamp(load)
}

function scoreExerciseTechnical(exercise, text) {
  const family = detectPatternFamily(text)
  let technical = family.technical

  const cap = { EARLY_STAGE: 4, BEGINNER: 6, INTERMEDIATE: 8, ADVANCED: 10 }[exercise.skill_level] ?? 10
  technical = clamp(Math.min(technical, cap))
  return clamp(technical)
}

function scoreSkillDrillTechnical(exercise) {
  const text = `${exercise.slug ?? ''} ${exercise.name ?? ''}`.toLowerCase()
  let technical = SKILL_LEVEL_TECHNICAL[exercise.skill_level] ?? 5

  if (/hand-placement|line drill|prep|intro|progression|regression|spotted|assisted|wall|panel|mat line|shape hold|hollow|arch hold|support hold/i.test(text)) {
    technical -= 2
  }
  if (/full|complete|unassisted|without spot|competition|freestanding/i.test(text)) {
    technical += 1
  }

  return clamp(technical, 2, 10)
}

/** Age min from overall difficulty (max of T and L), not load alone. */
function recommendedAgeForExercise(overall) {
  const o = clamp(overall)
  if (o <= 2) return 6
  if (o <= 3) return 6
  if (o <= 4) return 7
  if (o <= 5) return 9
  if (o <= 6) return 10
  if (o <= 7) return 12
  return 13
}

function attentionDemand(technical, load) {
  const peak = Math.max(technical, load)
  if (peak >= 8) return 'high'
  if (peak >= 5) return 'moderate'
  return 'low'
}

export function reviewExerciseDifficulty(exercise, override = null) {
  const programmingKind = classifyProgrammingKind(exercise)
  const skillDrill = programmingKind === 'skill_drill'

  if (override) {
    const technical = clamp(override.technical)
    const load = clamp(override.load)
    const overall = clamp(override.overall ?? computeOverallDifficulty(technical, load))
    return {
      technical,
      load,
      overall,
      recommended_age_min: skillDrill ? null : (override.recommended_age_min ?? recommendedAgeForExercise(overall)),
      recommended_age_max: override.recommended_age_max ?? null,
      attention_demand: override.attention_demand ?? attentionDemand(technical, load),
      notes: override.notes ?? 'Expert-reviewed override',
      source: 'reviewed',
      programming_kind: programmingKind,
    }
  }

  const text = exerciseText(exercise)
  const load = skillDrill ? 1 : scoreExerciseLoad(exercise, text)
  const technical = skillDrill ? scoreSkillDrillTechnical(exercise) : scoreExerciseTechnical(exercise, text)
  const overall = computeOverallDifficulty(technical, load)

  return {
    technical,
    load,
    overall,
    recommended_age_min: skillDrill ? null : recommendedAgeForExercise(overall),
    recommended_age_max: exercise.age_max ?? null,
    attention_demand: attentionDemand(technical, load),
    notes: skillDrill
      ? `Skill drill — gates on class/athlete level (${exercise.skill_level ?? 'skill level'})`
      : `Workout exercise — load ${load}/10, technical ${technical}/10`,
    source: 'reviewed',
    programming_kind: programmingKind,
  }
}

export { classifyProgrammingKind, isSkillDrill }

export const EXERCISE_DIFFICULTY_OVERRIDES = {
  '10-yard-sprint-start': { technical: 4, load: 1, overall: 4, recommended_age_min: 7 },
  'cartwheel': { technical: 3, load: 1, overall: 3, recommended_age_min: null },
}
