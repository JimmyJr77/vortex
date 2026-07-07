/**
 * Classify library items as workouts (exercise) vs skill-acquisition drills (skill_drill).
 *
 * Exercises are age-gated by load/technical difficulty in programming.
 * Skill drills gate on athlete/class skill level — not session audience age.
 */

const SKILL_DRILL_SUBROLES = new Set(['skill_tumbling_shape', 'gymnastics_shape_form'])

const SKILL_DRILL_SLUG = /hand-placement|line-drill|shape-drill|entry-drill|finish-drill|wall-handstand|spotting-drill|progression-drill|drill-for-|pullover|glide-|cast-handstand|tap-swing|beam-mount|bars-mount|hollow-drill|arch-drill|lever-drill|support-hold-on|handstand-line|handstand-hold|round-off-drill|back-handspring-drill|front-handspring-drill|muscle-up-drill|aerial-drill|layout-drill|tuck-drill|walkover-drill/i

const SKILL_NAME_PREFIX = /^(cartwheel|round-off|back-handspring|front-handspring|handstand|aerial|layout|muscle-up|front-tuck|back-tuck|walkover|pullover|glide|cast-handstand|kip-drill|giant-swing)/i

const EXERCISE_LOCOMOTOR = /sprint|acceleration|deceleration|bear-crawl|bear crawl|broad-jump|vertical-jump|box-jump|shuffle|agility|reactive|cone-|hurdle|plyo|pogo|snap-down|skater-hop|ladder-run|conditioning|locomotion|backpedal|jump rope|skipping|animal walk|bear crawl|crab walk|duck walk|high knee|butt kick|a-skip|b-skip|c-skip|wall-ball|medicine-ball|sandbag|kettlebell|barbell|deadlift|back-squat|front-squat|hang-clean|power-clean|snatch|bench-press|overhead-press|nordic|pull-up|push-up|squat|lunge|hinge|carry|mobilize|activate|9090|breathing|foam|stretch|cars\b/i

const SKILL_DRILL_IN_NAME = /drill|hand placement|line drill|shape drill|entry drill|finish drill|progression|spotting|wall handstand|prep for/i

export function classifyProgrammingKind(exercise) {
  const subrole = exercise.phase_subrole ?? exercise.phaseSubrole ?? null
  const phase = exercise.primary_phase_key ?? exercise.primaryPhaseKey ?? null
  const slug = String(exercise.slug ?? '').toLowerCase()
  const name = String(exercise.name ?? '').toLowerCase()
  const text = `${slug} ${name}`

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
