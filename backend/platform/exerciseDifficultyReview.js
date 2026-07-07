/**
 * Youth athletics difficulty review — two-axis model:
 *
 * - **Load** (1–10): inherent external resistance / minimum implement weight.
 * - **Technical** (1–10): movement or skill mastery required.
 * - **Overall**: max(load, technical).
 *
 * **Exercises** (workouts): age-gated via recommended_age_min derived primarily from load.
 * **Skill drills**: not age-gated; technical reflects target skill level for class/athlete matching.
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

const LOAD_FROM_EQUIPMENT = [
  { pattern: /barbell|back-squat|front-squat|overhead-squat|deadlift|clean|snatch|jerk|bench-press|overhead-press|hang-clean|power-clean|squat.*bar|trap-bar|hex-bar|landmine.*press|landmine.*squat|anderson-squat|cluster/i, load: 5 },
  { pattern: /atlas|stone|d-ball|sandbag|heavy.*carry|yoke|farmer|suitcase carry|bear-hug carry/i, load: 5 },
  { pattern: /kettlebell|kb swing|kb goblet|kb clean|kb snatch|kb press|kb squat/i, load: 4 },
  { pattern: /dumbbell|db press|db row|db squat|db lunge|db curl|db snatch/i, load: 4 },
  { pattern: /medicine ball|med ball|slam ball|wall ball|wall-ball/i, load: 4 },
  { pattern: /band resisted|heavy band|resistance band.*press|resistance band.*row|cable.*stack|lat pulldown|leg press|smith machine/i, load: 3 },
  { pattern: /light band|mini band|pvc|dowel|assist band|band-assisted/i, load: 2 },
]

const HIGH_LOAD_KEYWORDS = /heavy|max\b|1rm|supramax|cluster set|near-max|working weight/i

function scoreExternalLoad(exercise) {
  const text = `${exercise.slug ?? ''} ${exercise.name ?? ''} ${exercise.movement_family ?? ''} ${exercise.load_note ?? ''}`.toLowerCase()

  if (/bodyweight|tempo|isometric|hold\b|plank|breathing|cars\b|mobil|9090|foam|stretch|sprint|acceleration|deceleration|bear.crawl|broad.jump|vertical|hop|pogo|snap-down|skater|shuffle|agility|reactive|cone|ladder|locomotion|backpedal|jump rope|skipping|animal walk|crab walk|duck walk|high knee|butt kick|a-skip|b-skip|c-skip|snap down|landing|stick\b|prep\b|activate\b|integrate\b/i.test(text)) {
    if (!/weighted|loaded|barbell|dumbbell|kettlebell|medicine|sandbag|atlas|stone|wall ball|band resisted|cable/i.test(text)) {
      return 1
    }
  }

  let load = 1
  for (const { pattern, load: score } of LOAD_FROM_EQUIPMENT) {
    if (pattern.test(text)) load = Math.max(load, score)
  }

  if (HIGH_LOAD_KEYWORDS.test(text)) load = clamp(load + 2)

  if (exercise.participant_structure === 'pairs' || exercise.participant_structure === 'group') {
    load = Math.min(load, 2)
  }

  return clamp(load)
}

function scoreExerciseTechnical(exercise) {
  const text = `${exercise.slug ?? ''} ${exercise.name ?? ''}`.toLowerCase()
  let technical = 3

  if (/mobil|breathing|cars\b|9090|foam|stretch|activate|integrate|prep\b|warm/i.test(text)) technical = 2
  else if (/sprint|acceleration|start|shuffle|skip|hop|jump|bear crawl|animal|locomotion|run\b|backpedal|high knee|butt kick/i.test(text)) technical = 4
  else if (/deceleration|cut\b|cod\b|reactive|180|360|agility|change of direction/i.test(text)) technical = 5
  else if (/squat|lunge|hinge|press|row|pull-up|push-up|carry|step-up|glute bridge|dead bug|bird dog/i.test(text)) technical = 5
  else if (/clean|snatch|muscle-up|archer|pistol|nordic|kipping|handstand push|single-leg rdl|turkish get/i.test(text)) technical = 7
  else if (/assisted|regression|intro|beginner|scaled|supported|box assist/i.test(text)) technical -= 1

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
  if (/full|complete|unassisted|without spot|competition/i.test(text)) {
    technical += 1
  }

  return clamp(technical, 2, 10)
}

function recommendedAgeForExercise(load, technical) {
  if (load <= 1) return 6
  if (load <= 2) return 7
  if (load <= 3) return 9
  if (load <= 4) return 10
  if (load <= 5) return technical >= 7 ? 13 : 12
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
      recommended_age_min: skillDrill ? null : (override.recommended_age_min ?? recommendedAgeForExercise(load, technical)),
      recommended_age_max: override.recommended_age_max ?? null,
      attention_demand: override.attention_demand ?? attentionDemand(technical, load),
      notes: override.notes ?? 'Expert-reviewed override',
      source: 'reviewed',
      programming_kind: programmingKind,
    }
  }

  const load = skillDrill ? 1 : scoreExternalLoad(exercise)
  const technical = skillDrill ? scoreSkillDrillTechnical(exercise) : scoreExerciseTechnical(exercise)
  const overall = computeOverallDifficulty(technical, load)

  return {
    technical,
    load,
    overall,
    recommended_age_min: skillDrill ? null : recommendedAgeForExercise(load, technical),
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
  'back-squat': { technical: 5, load: 5, overall: 5, recommended_age_min: 12 },
  'box-jump': { technical: 4, load: 1, overall: 4, recommended_age_min: 8 },
  'cartwheel': { technical: 3, load: 1, overall: 3, recommended_age_min: null },
  'deadlift': { technical: 5, load: 5, overall: 5, recommended_age_min: 12 },
  'hang-clean': { technical: 8, load: 5, overall: 8, recommended_age_min: 13 },
  'kettlebell-swing': { technical: 5, load: 4, overall: 5, recommended_age_min: 11 },
  'plank-hold': { technical: 2, load: 1, overall: 2, recommended_age_min: 6 },
  'nordic-hamstring-curl': { technical: 6, load: 1, overall: 6, recommended_age_min: 13 },
  'tempo-bodyweight-squat': { technical: 4, load: 1, overall: 4, recommended_age_min: 7 },
}
