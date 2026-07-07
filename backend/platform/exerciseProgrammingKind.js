/**
 * Classify library items as workouts (exercise) vs skill-acquisition drills (skill_drill).
 *
 * Exercises are age-gated by load/technical difficulty in programming.
 * Skill drills gate on athlete/class skill level — not session audience age.
 *
 * Rules: docs/EXERCISE_DIFFICULTY_METHODOLOGY.md §2, §7
 */

const SKILL_DRILL_SUBROLES = new Set(['skill_tumbling_shape', 'gymnastics_shape_form'])

/** Workout calisthenics that must stay exercise even when slug mentions wall-handstand or skill prefix. */
const EXERCISE_KIND_OVERRIDES = /wall-handstand-push-up|wall-handstand-negative|box-pike-handstand-push-up|pike-handstand-push-up|^muscle-up$/i

/**
 * Integrated workouts: skill + locomotor / landing / lunge / stick / conditioning.
 * A skill component alone does not make these skill_drills (e.g. cartwheel finish lunge,
 * round-off rebound to stick, skipping rhythm drill).
 */
const EXERCISE_INTEGRATED_WORKOUT_SLUG = /^(skipping-rhythm-drill|cartwheel-finish-lunge|round-off-rebound-snap-down-to-stick|hurdle-step-lunge)$/

const EXERCISE_INTEGRATED_WORKOUT_TEXT = /(?:cartwheel|round-off|hurdle).*(?:lunge|finish)|(?:rebound|snap-down).*(?:stick|landing)|skipping.*(?:rhythm|drill)|(?:lunge|stick).*(?:cartwheel|round-off)/i

const SKILL_DRILL_SLUG = /hand-placement|line-drill|shape-drill|entry-drill|finish-drill|spotting-drill|progression-drill|drill-for-|pullover|glide-|cast-handstand|tap-swing|beam-mount|bars-mount|hollow-drill|arch-drill|lever-drill|support-hold-on|handstand-line|handstand-hold|handstand-kick|wall-handstand-hold|wall-handstand-line|wall-handstand-shoulder|chest-to-wall-handstand|wall-facing-handstand-hold|wall-walk.*handstand|round-off-drill|back-handspring-drill|front-handspring-drill|muscle-up-drill|aerial-drill|layout-drill|tuck-drill|walkover-drill/i

const SKILL_NAME_PREFIX = /^(cartwheel|round-off|back-handspring|front-handspring|handstand|aerial|layout|muscle-up|front-tuck|back-tuck|walkover|pullover|glide|cast-handstand|kip-drill|giant-swing)/i

const EXERCISE_LOCOMOTOR = /sprint|acceleration|deceleration|bear-crawl|bear crawl|broad-jump|vertical-jump|box-jump|shuffle|agility|reactive|cone-|hurdle|plyo|pogo|snap-down|skater-hop|ladder-run|conditioning|locomotion|backpedal|jump rope|skipping|animal walk|bear crawl|crab walk|duck walk|high knee|butt kick|a-skip|b-skip|c-skip|wall-ball|medicine-ball|sandbag|kettlebell|barbell|deadlift|back-squat|front-squat|hang-clean|power-clean|snatch|bench-press|overhead-press|nordic|pull-up|push-up|squat|lunge|hinge|carry|mobilize|activate|9090|breathing|foam|stretch|cars\b|handstand push|hspu|pike push|to-stick|rebound/i

const SKILL_DRILL_IN_NAME = /drill|hand placement|line drill|shape drill|entry drill|finish drill|progression|spotting|wall handstand hold|chest-to-wall|prep for/i

export function isIntegratedWorkoutExercise(slug, text) {
  if (EXERCISE_KIND_OVERRIDES.test(slug)) return true
  if (EXERCISE_INTEGRATED_WORKOUT_SLUG.test(slug)) return true
  if (EXERCISE_INTEGRATED_WORKOUT_TEXT.test(text)) return true
  if (SKILL_NAME_PREFIX.test(slug) && EXERCISE_LOCOMOTOR.test(text)) return true
  return false
}

export function classifyProgrammingKind(exercise) {
  const subrole = exercise.phase_subrole ?? exercise.phaseSubrole ?? null
  const phase = exercise.primary_phase_key ?? exercise.primaryPhaseKey ?? null
  const slug = String(exercise.slug ?? '').toLowerCase()
  const name = String(exercise.name ?? '').toLowerCase()
  const text = `${slug} ${name}`

  if (isIntegratedWorkoutExercise(slug, text)) return 'exercise'

  if (exercise.programming_kind === 'skill_drill' || exercise.programmingKind === 'skill_drill') {
    return 'skill_drill'
  }
  if (exercise.programming_kind === 'exercise' || exercise.programmingKind === 'exercise') {
    // still allow promotion to skill_drill via heuristics below when unset in DB
  }

  if (subrole && SKILL_DRILL_SUBROLES.has(subrole)) return 'skill_drill'
  if (SKILL_DRILL_SLUG.test(slug)) return 'skill_drill'
  if (SKILL_NAME_PREFIX.test(slug) && !EXERCISE_LOCOMOTOR.test(text)) return 'skill_drill'

  if (phase === 'movement_intelligence' && SKILL_DRILL_IN_NAME.test(text) && !EXERCISE_LOCOMOTOR.test(text)) {
    return 'skill_drill'
  }

  return 'exercise'
}

export function isSkillDrill(exercise) {
  return classifyProgrammingKind(exercise) === 'skill_drill'
}

export function isExerciseWorkout(exercise) {
  return classifyProgrammingKind(exercise) === 'exercise'
}
