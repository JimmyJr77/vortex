/**
 * Control / Resilience cluster validation helpers.
 * Imported by workoutValidation.js
 */

export const CONTROL_RESILIENCE_SLUGS = new Set([
  'drop-squat-to-stick', 'snap-down-to-stick-control-version', 'low-box-step-off-to-stick',
  'forward-hop-to-stick-low-amplitude', 'lateral-hop-to-stick-low-amplitude', 'single-leg-hop-to-stick-low-amplitude',
  'deceleration-step-down-stop-step-stick', 'jog-to-stick-linear-deceleration', 'lateral-shuffle-to-stick', 'backpedal-to-stick',
  'single-leg-balance-hold-tripod-foot', 'single-leg-balance-reach-clock-control', 'y-balance-reach-star-reach',
  'single-leg-rdl-reach-bodyweight-control', 'hip-airplane-supported', 'step-down-to-hover', 'lateral-step-down',
  'single-leg-squat-to-box', 'perturbation-single-leg-balance', 'beam-line-balance-freeze',
  'dead-bug-heel-tap-control-progression', 'dead-bug-pullover-band-dead-bug', 'bird-dog-iso-hold',
  'front-plank-long-lever-plank', 'side-plank', 'bear-plank-hold', 'bear-plank-shoulder-tap', 'plank-pull-through',
  'pallof-press-iso-hold', 'half-kneeling-anti-rotation-press-lift-hold',
  'quadruped-scapular-push-up-hold', 'prone-y-t-w-isometric-series', 'tall-plank-shoulder-tap', 'slow-bear-crawl',
  'crab-reverse-tabletop-hold', 'wall-handstand-line-hold', 'wall-handstand-shoulder-shrug',
  'wall-walk-negative-controlled-wall-walk-down', 'ring-support-hold-assisted-control',
  'wrist-lean-isometric-wrist-support-rock-hold',
  'split-squat-eccentric-to-pause', 'isometric-lateral-lunge-hold', 'cossack-bottom-hold-cossack-shift-hold',
  'adductor-squeeze-bridge-hold', 'hamstring-bridge-iso-long-lever-bridge-hold', 'slider-hamstring-eccentric-slow-lower',
  'calf-isometric-hold-straight-knee', 'soleus-isometric-hold-bent-knee', 'tibialis-iso-toe-up-hold',
  'nordic-lean-isometric-partial-range',
])

const CONTROL_LANDING_SLUGS = new Set([
  'drop-squat-to-stick', 'snap-down-to-stick-control-version', 'low-box-step-off-to-stick',
  'forward-hop-to-stick-low-amplitude', 'lateral-hop-to-stick-low-amplitude', 'single-leg-hop-to-stick-low-amplitude',
  'deceleration-step-down-stop-step-stick', 'jog-to-stick-linear-deceleration', 'lateral-shuffle-to-stick', 'backpedal-to-stick',
])
const CONTROL_SINGLE_LEG_SLUGS = new Set([
  'single-leg-balance-hold-tripod-foot', 'single-leg-balance-reach-clock-control', 'y-balance-reach-star-reach',
  'single-leg-rdl-reach-bodyweight-control', 'hip-airplane-supported', 'step-down-to-hover', 'lateral-step-down',
  'single-leg-squat-to-box', 'perturbation-single-leg-balance', 'beam-line-balance-freeze',
])
const CONTROL_BALANCE_FOUNDATION_SLUGS = new Set([
  'single-leg-balance-hold-tripod-foot', 'single-leg-balance-reach-clock-control', 'step-down-to-hover', 'lateral-step-down',
])
const CONTROL_TRUNK_SLUGS = new Set([
  'dead-bug-heel-tap-control-progression', 'dead-bug-pullover-band-dead-bug', 'bird-dog-iso-hold',
  'front-plank-long-lever-plank', 'side-plank', 'bear-plank-hold', 'bear-plank-shoulder-tap', 'plank-pull-through',
  'pallof-press-iso-hold', 'half-kneeling-anti-rotation-press-lift-hold',
])
const DEAD_BUG_SLUG = 'dead-bug-heel-tap-control-progression'
const LOADED_DEAD_BUG_SLUG = 'dead-bug-pullover-band-dead-bug'
const BIRD_DOG_SLUG = 'bird-dog-iso-hold'
const FRONT_PLANK_SLUG = 'front-plank-long-lever-plank'
const SIDE_PLANK_SLUG = 'side-plank'
const BEAR_PLANK_SLUG = 'bear-plank-hold'
const BEAR_TAP_SLUG = 'bear-plank-shoulder-tap'
const PULL_THROUGH_SLUG = 'plank-pull-through'
const PALLOF_SLUG = 'pallof-press-iso-hold'
const HALF_KNEELING_ANTI_ROT_SLUG = 'half-kneeling-anti-rotation-press-lift-hold'
const CONTROL_SCAPULAR_SLUGS = new Set([
  'quadruped-scapular-push-up-hold', 'prone-y-t-w-isometric-series', 'tall-plank-shoulder-tap', 'slow-bear-crawl',
  'crab-reverse-tabletop-hold', 'wall-handstand-line-hold', 'wall-handstand-shoulder-shrug',
  'wall-walk-negative-controlled-wall-walk-down', 'ring-support-hold-assisted-control',
  'wrist-lean-isometric-wrist-support-rock-hold',
])
const CONTROL_HAND_SUPPORT_SLUGS = new Set([
  'bear-plank-shoulder-tap', ...CONTROL_SCAPULAR_SLUGS,
])
const SCAPULAR_PUSHUP_SLUG = 'quadruped-scapular-push-up-hold'
const PRONE_YTW_SLUG = 'prone-y-t-w-isometric-series'
const TALL_PLANK_TAP_SLUG = 'tall-plank-shoulder-tap'
const SLOW_BEAR_CRAWL_SLUG = 'slow-bear-crawl'
const CRAB_SLUG = 'crab-reverse-tabletop-hold'
const WALL_HANDSTAND_SHRUG_SLUG = 'wall-handstand-shoulder-shrug'
const WRIST_LEAN_SLUG = 'wrist-lean-isometric-wrist-support-rock-hold'
const CONTROL_LOWER_LEG_ISO_SLUGS = new Set([
  'calf-isometric-hold-straight-knee', 'soleus-isometric-hold-bent-knee', 'tibialis-iso-toe-up-hold',
])
const CONTROL_SLOW_ECCENTRIC_SLUGS = new Set([
  'split-squat-eccentric-to-pause', 'isometric-lateral-lunge-hold', 'cossack-bottom-hold-cossack-shift-hold',
  'adductor-squeeze-bridge-hold', 'hamstring-bridge-iso-long-lever-bridge-hold', 'slider-hamstring-eccentric-slow-lower',
  'calf-isometric-hold-straight-knee', 'soleus-isometric-hold-bent-knee', 'tibialis-iso-toe-up-hold',
  'nordic-lean-isometric-partial-range',
])
const SPLIT_SQUAT_ECC_SLUG = 'split-squat-eccentric-to-pause'
const LATERAL_LUNGE_ISO_SLUG = 'isometric-lateral-lunge-hold'
const COSSACK_HOLD_SLUG = 'cossack-bottom-hold-cossack-shift-hold'
const ADDUCTOR_SQUEEZE_SLUG = 'adductor-squeeze-bridge-hold'
const HAMSTRING_BRIDGE_ISO_SLUG = 'hamstring-bridge-iso-long-lever-bridge-hold'
const SLIDER_HAMSTRING_ECC_SLUG = 'slider-hamstring-eccentric-slow-lower'
const CALF_ISO_SLUG = 'calf-isometric-hold-straight-knee'
const SOLEUS_ISO_SLUG = 'soleus-isometric-hold-bent-knee'
const TIBIALIS_ISO_SLUG = 'tibialis-iso-toe-up-hold'
const NORDIC_LEAN_SLUG = 'nordic-lean-isometric-partial-range'
const SL_HOP_SLUG = 'single-leg-hop-to-stick-low-amplitude'
const WALL_HANDSTAND_SLUG = 'wall-handstand-line-hold'
const WALL_WALK_NEGATIVE_SLUG = 'wall-walk-negative-controlled-wall-walk-down'
const RING_SUPPORT_SLUG = 'ring-support-hold-assisted-control'
const PERTURBATION_BALANCE_SLUG = 'perturbation-single-leg-balance'

const CONTROL_LANDING_VALGUS_PATTERN = /knee\s*valgus|knees?\s*cave|knees?\s*collapse/i
const CONTROL_LANDING_LOUD_PATTERN = /loud\s*land|foot\s*slap|noisy\s*contact|loud\s*feet/i
const CONTROL_LANDING_EXTRA_STEP_PATTERN = /extra\s*step|cannot\s*stick|did\s*not\s*stick|stumble|stumbling/i
const CONTROL_LANDING_CANNOT_FREEZE_PATTERN = /cannot\s*freeze|cannot\s*hold|wobble|losing\s*balance/i
const CONTROL_LANDING_REBOUND_PATTERN = /rebound|bounced|extra\s*bounce|did\s*not\s*freeze/i
const CONTROL_LANDING_BOX_HEIGHT_PATTERN = /box\s*too\s*high|high\s*box|uncontrolled\s*landing|loud\s*step.?off/i
const CONTROL_LANDING_FORWARD_MOMENTUM_PATTERN = /forward\s*momentum|falling\s*forward|cannot\s*stop|extra\s*steps/i
const CONTROL_LANDING_LATERAL_COLLAPSE_PATTERN = /knee\s*collapse|ankle\s*roll|valgus|groin\s*pain/i
const CONTROL_LANDING_BRAKE_SKID_PATTERN = /foot\s*skid|heel\s*skid|knee\s*collapse|skidding/i
const CONTROL_LANDING_SHUFFLE_CROSS_PATTERN = /feet?\s*cross|foot\s*cross|click\s*together/i
const CONTROL_LANDING_BACKPEDAL_LANE_PATTERN = /no\s*clear\s*lane|unsafe\s*space|collision|backward\s*lane|not\s*clear\s*behind/i
const CONTROL_LANDING_PAIN_PATTERN = /knee\s*pain|ankle\s*pain|hip\s*pain|heel\s*pain|groin\s*pain|sharp\s*pain/i
const CONTROL_BALANCE_FLAIL_PATTERN = /flail|random|cannot\s*hold|losing\s*balance|falling/i
const CONTROL_SL_STATIC_HOLD_FAIL_PATTERN = /cannot\s*hold|can't\s*hold|less\s*than\s*10|under\s*10|<\s*10|loses?\s*balance\s*before\s*10/i
const CONTROL_SL_TRIPOD_COLLAPSE_PATTERN = /tripod\s*collapse|foot\s*tripod\s*collapse|arch\s*collapse|arch\s*falls|foot\s*collapse|toes?\s*claw/i
const CONTROL_SL_REACH_WEIGHT_PATTERN = /weight\s*(on|onto|through)\s*(the\s*)?(reach|reaching|free)\s*foot|reach(?:ing)?\s*foot\s*takes\s*(body)?weight|tap\s*is\s*weighted/i
const CONTROL_SL_YBALANCE_DISTANCE_PATTERN = /chase\s*(reach\s*)?distance|max\s*reach|max\s*distance|maximum\s*distance|distance\s*before\s*control/i
const CONTROL_SL_RDL_PELVIS_OPEN_PATTERN = /pelvis\s*(opens?|rotates?|twists?)|hips?\s*(open|rotate|twist)|twist\s*open/i
const CONTROL_SL_AIRPLANE_LUMBAR_PATTERN = /low.?back\s*(twist|rotation|rotates?)|lumbar\s*(twist|rotation)|twist(?:ing)?\s*through\s*(the\s*)?(low\s*)?back/i
const CONTROL_SL_STEPDOWN_PUSHOFF_PATTERN = /free\s*foot\s*push|push.?off|assists?\s*with\s*(the\s*)?free\s*foot|uses?\s*the\s*free\s*foot/i
const CONTROL_SL_PELVIC_DROP_PATTERN = /pelvis\s*drops?|pelvic\s*drop|hip\s*drops?|free.?leg\s*side\s*drops?/i
const CONTROL_SL_BOX_LOW_PATTERN = /box\s*too\s*low|low\s*box|crash(?:es|ing)?\s*(to|onto)\s*(the\s*)?box|drops?\s*(to|onto)\s*(the\s*)?box|bottom\s*collapse/i
const CONTROL_SL_PERTURBATION_TOO_STRONG_PATTERN = /panic|fear\s*response|steps?\s*every\s*rep|unsafe\s*wobble|perturbation\s*too\s*strong|fall\s*risk|falling/i
const CONTROL_SL_BEAM_SAFETY_PATTERN = /(raised|high)\s*beam|no\s*mat|no\s*safe\s*(landing\s*)?area|no\s*fall\s*clearance|unsafe\s*beam/i
const CONTROL_SL_PAIN_PATTERN = /ankle\s*pain|knee\s*pain|hip\s*pain|back\s*pain|low.?back\s*pain|sharp\s*pain/i
const CONTROL_TRUNK_RIB_FLARE_PATTERN = /rib\s*flare|low\s*back\s*arch|breath.?hold|valsalva|holding\s*breath/i
const CONTROL_TRUNK_LUMBAR_ARCH_PATTERN = /low.?back\s*arch|lumbar\s*arch|back\s*arch|arching\s*(the\s*)?back/i
const CONTROL_TRUNK_PELVIS_ROTATION_PATTERN = /pelvis\s*(rotates?|rotation|twists?)|hips?\s*(rotate|twist)|hip\s*rotation|trunk\s*rotat|hips?\s*twist/i
const CONTROL_TRUNK_HIP_SAG_PATTERN = /hip\s*sag|hips?\s*sag|sagging\s*hips/i
const CONTROL_TRUNK_LONG_LEVER_PATTERN = /long.?lever|long lever/i
const CONTROL_TRUNK_SIDE_SAG_ROTATE_PATTERN = /hip\s*sag|hips?\s*sag|torso\s*rotat/i
const CONTROL_TRUNK_PRESSURE_WRIST_PATTERN = /pressure\s*symptom|wrist\s*pain/i
const CONTROL_TRUNK_UNSAFE_ANCHOR_PATTERN = /unsafe\s*anchor|anchor\s*unsafe|band\s*anchor\s*unsafe|cable\s*anchor/i
const CONTROL_TRUNK_BREATH_HOLD_PATTERN = /breath.?hold|valsalva|holding\s*breath|cannot\s*breathe/i
const CONTROL_TRUNK_SYMPTOM_PATTERN = /low.?back\s*pain|back\s*pain|hip\s*pain|shoulder\s*pain|wrist\s*pain|pressure\s*symptom/i
const CONTROL_TRUNK_PALLOF_ROTATION_PATTERN = /rotat(e|es|ing|ion)\s*(toward|to)\s*(the\s*)?anchor|turn(s|ing)?\s*toward\s*(the\s*)?band|cannot\s*resist\s*rotation/i
const CONTROL_WRIST_PAIN_PATTERN = /wrist\s*pain|hand\s*pain|numbness|tingling|sharp\s*wrist/i
const CONTROL_SHOULDER_WRIST_FATIGUE_PATTERN = /shoulder\s*fatigue|wrist\s*fatigue|grip\s*fatigue\s*before\s*trunk/i
const CONTROL_RING_DRIFT_PATTERN = /rings?\s*drift|drift\s*wide|unstable\s*rings/i
const CONTROL_HS_ELBOW_BEND_PATTERN = /elbow\s*bend|bending\s*(the\s*)?elbows?|elbows?\s*bend/i
const CONTROL_HS_SHRUG_FAULT_PATTERN = /shrug(?:ging)?\s*(?:shoulders?|into\s*ears)|shoulders?\s*(?:shrug|shrugging)\s*(?:up|into)/i
const CONTROL_HS_SHOULDER_PINCH_PATTERN = /shoulder\s*pinch|pinching\s*(?:in\s*)?(?:the\s*)?shoulder|impingement/i
const CONTROL_HS_NO_SAFE_EXIT_PATTERN = /no\s*safe\s*exit|unsafe\s*exit|cannot\s*exit|no\s*exit\s*plan|no\s*spotter/i
const CONTROL_HS_BANANA_BACK_PATTERN = /banana\s*back|rib\s*flare|arching\s*(?:the\s*)?(?:back|spine)|excessive\s*arch/i
const CONTROL_HS_WALL_WALK_COLLAPSE_PATTERN = /collapse|uncontrolled\s*fall|rush(?:ing)?\s*(?:down|descent)|fall(?:ing)?\s*from\s*(?:the\s*)?wall/i
const CONTROL_HS_RING_FAILURE_PATTERN = /failure|collapse|cannot\s*hold|loses?\s*support/i
const CONTROL_HS_BEAR_CRAWL_FAST_PATTERN = /fast\s*crawl|conditioning|circuit|speed\s*crawl|fitness\s*crawl/i
const CONTROL_HS_SYMPTOM_PATTERN = /wrist\s*pain|shoulder\s*pain|elbow\s*pain|neck\s*pain|pressure\s*symptom|numbness|tingling|sharp\s*pain/i
const CONTROL_HS_WRIST_SHARP_PATTERN = /sharp\s*wrist|thumb.?side|numbness|tingling/i
const CONTROL_GROIN_PAIN_PATTERN = /groin\s*pain|adductor\s*pain|sharp\s*groin/i
const CONTROL_HAMSTRING_PAIN_PATTERN = /hamstring\s*pain|sharp\s*hamstring|posterior\s*thigh\s*pain/i
const CONTROL_KNEE_VALGUS_PATTERN = /knee\s*valgus|knees?\s*cave|knees?\s*collapse/i
const CONTROL_SLOW_ECC_COSSACK_FORCED_DEPTH_PATTERN = /forced\s*depth|chase\s*depth|push(?:ing)?\s*(?:into\s*)?(?:the\s*)?bottom|max\s*depth/i
const CONTROL_SLOW_ECC_IMpingEMENT_PATTERN = /groin|hip\s*imping|ankle\s*imping|pinch(?:ing)?\s*(?:in\s*)?(?:the\s*)?(?:hip|groin|ankle)/i
const CONTROL_SLOW_ECC_BRIDGE_CRAMP_PATTERN = /cramp|cramping|immediate\s*cramp/i
const CONTROL_SLOW_ECC_SLIDER_HIP_DROP_PATTERN = /hip\s*drop|pelvis\s*drop|pelvic\s*drop/i
const CONTROL_SLOW_ECC_ACHILLES_PATTERN = /achilles\s*pain|achilles\s*(?:gets\s*)?worse|worsening\s*achilles/i
const CONTROL_SLOW_ECC_SHIN_ANKLE_PATTERN = /sharp\s*shin|anterior\s*ankle|shin\s*pain|front\s*of\s*(?:the\s*)?shin/i
const CONTROL_SLOW_ECC_NORDIC_UNSAFE_ANCHOR_PATTERN = /unsafe\s*anchor|poor\s*anchor|feet?\s*slip|ankle\s*anchor\s*unsafe|no\s*secure\s*anchor/i
const CONTROL_SLOW_ECC_NORDIC_COMPENSATION_PATTERN = /hip\s*break|lumbar\s*break|uncontrolled\s*fall|cannot\s*control\s*descent|breaks?\s*at\s*(?:the\s*)?(?:hip|back)/i
const CONTROL_SLOW_ECC_SYMPTOM_STOP_PATTERN = /sharp\s*pain|numbness|tingling|symptoms?\s*worsen|worsening\s*symptoms?/i
const CONTROL_SLOW_ECC_HIGH_VOLUME_OUTPUT_PATTERN = /high.?volume\s*jump|max\s*sprint|sprint\s*volume|many\s*jump/i
const CONTROL_TISSUE_PAIN_PATTERN = /knee\s*pain|hip\s*pain|groin|ankle\s*pain|shoulder\s*pain|wrist\s*pain|back\s*pain|hamstring\s*pain|pressure\s*symptom/i
const CONTROL_HIGH_SPEED_PATTERN = /high\s*speed|max\s*speed|sprint\s*approach|fast\s*approach/i
const OVERHEAD_MOBILITY_PATTERN = /overhead\s*mobility|shoulder\s*mobility|cannot\s*overhead|overhead\s*restriction/i

const CONTROL_SHORT_REST_SECONDS = 45
const CONTROL_MIN_RPE_STRENGTH = 6

/**
 * @param {object} item
 * @param {Map} slugByExercise
 */
function exerciseSlug(item, slugByExercise) {
  const id = String(item.exercise_id ?? item.exerciseId ?? '')
  return slugByExercise.get(id) ?? item.slug ?? null
}

/**
 * @param {object} draft
 */
function draftWatchText(draft) {
  const parts = []
  if (draft?.watch_points) parts.push(...(Array.isArray(draft.watch_points) ? draft.watch_points : [draft.watch_points]))
  if (draft?.coach_notes) parts.push(String(draft.coach_notes))
  return parts.join(' ')
}

function countVolume(item, dosage) {
  const sets = Number(item.sets ?? item.default_sets ?? dosage?.default_sets) || 1
  const reps = Number(item.reps ?? item.default_reps ?? dosage?.default_reps) || 0
  const work = Number(item.work_seconds ?? item.workSeconds ?? dosage?.default_work_seconds) || 0
  if (reps > 0) return sets * reps
  if (work > 0) return sets
  return sets
}

function itemRpe(item, dosage) {
  return Number(item.rpe ?? item.RPE ?? dosage?.default_rpe_max) || 0
}

const DROP_SQUAT_SLUG = 'drop-squat-to-stick'
const SNAP_DOWN_CONTROL_SLUG = 'snap-down-to-stick-control-version'
const BOX_STEP_OFF_SLUG = 'low-box-step-off-to-stick'
const FORWARD_HOP_SLUG = 'forward-hop-to-stick-low-amplitude'
const LATERAL_HOP_SLUG = 'lateral-hop-to-stick-low-amplitude'
const STOP_STEP_SLUG = 'deceleration-step-down-stop-step-stick'
const JOG_TO_STICK_SLUG = 'jog-to-stick-linear-deceleration'
const LATERAL_SHUFFLE_SLUG = 'lateral-shuffle-to-stick'
const BACKPEDAL_STICK_SLUG = 'backpedal-to-stick'
const SL_BALANCE_HOLD_SLUG = 'single-leg-balance-hold-tripod-foot'
const SL_REACH_CLOCK_SLUG = 'single-leg-balance-reach-clock-control'
const SL_Y_BALANCE_SLUG = 'y-balance-reach-star-reach'
const SL_RDL_REACH_SLUG = 'single-leg-rdl-reach-bodyweight-control'
const HIP_AIRPLANE_SLUG = 'hip-airplane-supported'
const STEP_DOWN_HOVER_SLUG = 'step-down-to-hover'
const LATERAL_STEP_DOWN_SLUG = 'lateral-step-down'
const SL_SQUAT_BOX_SLUG = 'single-leg-squat-to-box'
const BEAM_LINE_FREEZE_SLUG = 'beam-line-balance-freeze'

/** Landing & Braking Control cluster checks (cards 1–10). Pure helper for tests. */
export function analyzeControlLandingReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    controlBlockIndex = 0,
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !CONTROL_LANDING_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  let fitnessBeforeControl = false
  for (let j = 0; j < controlBlockIndex; j++) {
    if (blockMeta[j]?.phaseKey === 'fitness_repeatability') fitnessBeforeControl = true
  }

  const slugsInWorkout = new Set(ordered.map((o) => o.slug))
  for (const meta of blockMeta ?? []) {
    if (meta.phaseKey !== 'control_resilience') continue
    for (const blockItem of meta.block?.items ?? []) {
      const slug = exerciseSlug(blockItem, slugByExercise)
      if (slug && CONTROL_LANDING_SLUGS.has(slug)) slugsInWorkout.add(slug)
    }
  }

  if (fitnessBeforeControl) {
    findings.push({
      rule_key: 'control_resilience_after_fitness_landing',
      severity: 'warning',
      message: 'Landing and braking quality may be degraded by prior Fitness fatigue. Reduce complexity or move Control earlier.',
      affected_items: ordered.map((o) => o.name),
      meta: { after_fitness: true },
    })
  }

  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const volume = countVolume(item, dosage)

    if (CONTROL_LANDING_PAIN_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_landing_pain_stop',
        severity: 'error',
        message: `${name}: end the drill and regress to supported, lower-amplitude, or non-impact control work when pain appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (CONTROL_LANDING_VALGUS_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_landing_valgus',
        severity: 'recommendation',
        message: `${name}: reduce height, distance, or speed. Add foot tripod, mini-band lateral walk, or squat/lunge control when knee valgus appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (CONTROL_LANDING_LOUD_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_landing_loud_contact',
        severity: 'recommendation',
        message: `${name}: reduce amplitude and coach ankle-knee-hip absorption for quiet contact.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (CONTROL_LANDING_EXTRA_STEP_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_landing_extra_steps',
        severity: 'warning',
        message: `${name}: stick was not owned. Reduce speed or distance until the athlete freezes without extra steps.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === DROP_SQUAT_SLUG && CONTROL_LANDING_CANNOT_FREEZE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_landing_drop_squat_regress',
        severity: 'recommendation',
        message: `${name}: regress to squat hold or supported athletic stance when the athlete cannot freeze for 2 seconds.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SNAP_DOWN_CONTROL_SLUG && CONTROL_LANDING_REBOUND_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_landing_snapdown_rebound',
        severity: 'warning',
        message: `${name}: rebounding drifts toward Output intent. Require a stick or reclassify the drill.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === BOX_STEP_OFF_SLUG && CONTROL_LANDING_BOX_HEIGHT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_landing_box_height',
        severity: 'warning',
        message: `${name}: lower the box when landings are loud or uncontrolled.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === FORWARD_HOP_SLUG && CONTROL_LANDING_FORWARD_MOMENTUM_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_landing_forward_momentum',
        severity: 'recommendation',
        message: `${name}: reduce hop distance or return to drop squat / snap-down when forward momentum is not controlled.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === LATERAL_HOP_SLUG && CONTROL_LANDING_LATERAL_COLLAPSE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_landing_lateral_collapse',
        severity: 'recommendation',
        message: `${name}: use lateral step-to-stick, lateral lunge shift, or mini-band lateral walk when knee collapses or ankle rolls.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SL_HOP_SLUG) {
      const hasFoundation = [...CONTROL_BALANCE_FOUNDATION_SLUGS].some((s) => slugsInWorkout.has(s))
      if (!hasFoundation) {
        findings.push({
          rule_key: 'control_resilience_sl_hop_prerequisite',
          severity: 'warning',
          message: `${name}: regress to single-leg balance hold or step-to-balance when balance foundation is not established in this workout.`,
          affected_items: [name],
          meta: { slug, missing_foundation: true },
        })
      }
    }

    if (slug === STOP_STEP_SLUG && CONTROL_LANDING_BRAKE_SKID_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_landing_brake_skid',
        severity: 'recommendation',
        message: `${name}: reduce step length and coach braking position when foot skids or knee collapses.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === JOG_TO_STICK_SLUG && (CONTROL_HIGH_SPEED_PATTERN.test(watchText) || Number(item.work_seconds ?? 0) > 45)) {
      findings.push({
        rule_key: 'control_resilience_decel_high_speed',
        severity: 'recommendation',
        message: `${name}: high approach speed may belong in Output as Sprint to Stick Deceleration. Confirm intent and rest.`,
        affected_items: [name],
        meta: { slug },
      })
    }

    if (slug === LATERAL_SHUFFLE_SLUG && CONTROL_LANDING_SHUFFLE_CROSS_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_landing_shuffle_cross',
        severity: 'recommendation',
        message: `${name}: regress to lateral shuffle mechanics walkthrough when feet cross or click together.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === BACKPEDAL_STICK_SLUG && CONTROL_LANDING_BACKPEDAL_LANE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_landing_backpedal_lane',
        severity: 'error',
        message: `${name}: backward deceleration requires a clear lane and safe stopping distance before use.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (restSeconds > 0 && restSeconds < CONTROL_SHORT_REST_SECONDS && volume >= 8) {
      findings.push({
        rule_key: 'control_resilience_decel_short_rest',
        severity: 'recommendation',
        message: `${name}: repeated landing/braking sticks with short rest may be Fitness / Repeatability rather than Control / Resilience.`,
        affected_items: [name],
        meta: { slug, rest_seconds: restSeconds },
      })
    }
  }

  return findings
}

/** Single-Leg Balance / Foot-Ankle-Hip Control checks (cards 11–20). Pure helper for tests. */
export function analyzeControlSingleLegReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !CONTROL_SINGLE_LEG_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsBefore = new Set()
  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const volume = countVolume(item, dosage)
    const rpe = itemRpe(item, dosage)

    if (CONTROL_SL_PAIN_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_sl_pain_stop',
        severity: 'error',
        message: `${name}: end the drill and regress to supported, lower-range, or bilateral control when ankle, knee, hip, or back pain appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SL_BALANCE_HOLD_SLUG && CONTROL_SL_STATIC_HOLD_FAIL_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_sl_static_hold_fail',
        severity: 'recommendation',
        message: `${name}: add support or regress to foot tripod weight shifts when the athlete cannot hold single-leg balance for 10 seconds.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (CONTROL_SL_TRIPOD_COLLAPSE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_sl_tripod_collapse',
        severity: 'recommendation',
        message: `${name}: reduce task complexity and add short-foot / foot tripod work when the stance foot collapses.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (CONTROL_KNEE_VALGUS_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_sl_knee_valgus',
        severity: 'recommendation',
        message: `${name}: reduce reach depth, add support, or regress to static balance when the stance knee collapses inward.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SL_REACH_CLOCK_SLUG && CONTROL_SL_REACH_WEIGHT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_sl_reach_weight_transfer',
        severity: 'warning',
        message: `${name}: reach foot should tap lightly. Reduce reach distance until the stance leg owns the task.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SL_Y_BALANCE_SLUG && CONTROL_SL_YBALANCE_DISTANCE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_sl_ybalance_distance_chase',
        severity: 'warning',
        message: `${name}: do not chase reach distance before balance quality and return-to-center control are consistent.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SL_RDL_REACH_SLUG && CONTROL_SL_RDL_PELVIS_OPEN_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_sl_rdl_pelvis_open',
        severity: 'recommendation',
        message: `${name}: use wall support, kickstand stance, or reduce range when the pelvis opens during the hinge.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === HIP_AIRPLANE_SLUG) {
      const hasHingePrep = slugsBefore.has(SL_RDL_REACH_SLUG) || slugsBefore.has(SL_BALANCE_HOLD_SLUG)
      if (!hasHingePrep) {
        findings.push({
          rule_key: 'control_resilience_sl_airplane_prerequisite',
          severity: 'warning',
          message: `${name}: use supported hinge hold or single-leg RDL reach first when single-leg hinge control is not established earlier in the block.`,
          affected_items: [name],
          meta: { slug, missing_foundation: true },
        })
      }

      if (CONTROL_SL_AIRPLANE_LUMBAR_PATTERN.test(watchText)) {
        findings.push({
          rule_key: 'control_resilience_sl_airplane_lumbar_twist',
          severity: 'recommendation',
          message: `${name}: reduce rotation range and use more support when rotation comes from the low back instead of the hip.`,
          affected_items: [name],
          meta: { slug, symptom_flags: true },
        })
      }
    }

    if (slug === STEP_DOWN_HOVER_SLUG && CONTROL_SL_STEPDOWN_PUSHOFF_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_sl_stepdown_pushoff',
        severity: 'warning',
        message: `${name}: the free foot should hover or tap lightly, not assist the return. Lower the step or add support.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === LATERAL_STEP_DOWN_SLUG && CONTROL_SL_PELVIC_DROP_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_sl_lateral_pelvic_drop',
        severity: 'recommendation',
        message: `${name}: reduce step height, add support, or add glute med / lateral control prep when the pelvis drops.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SL_SQUAT_BOX_SLUG && CONTROL_SL_BOX_LOW_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_sl_squat_box_low',
        severity: 'warning',
        message: `${name}: raise the box. Soft touch beats deep collapse.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === PERTURBATION_BALANCE_SLUG && CONTROL_SL_PERTURBATION_TOO_STRONG_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_sl_perturbation_too_strong',
        severity: 'error',
        message: `${name}: perturbation is too strong. Reduce intensity so the athlete reacts and recovers safely.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === BEAM_LINE_FREEZE_SLUG && CONTROL_SL_BEAM_SAFETY_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_sl_beam_safety',
        severity: 'error',
        message: `${name}: raised beam work requires a safe surface, matting, and fall-clearance check before use.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (restSeconds > 0 && restSeconds < CONTROL_SHORT_REST_SECONDS && volume >= 12 && rpe >= CONTROL_MIN_RPE_STRENGTH) {
      findings.push({
        rule_key: 'control_resilience_sl_fatigue_circuit',
        severity: 'warning',
        message: `${name}: this may be Fitness / Repeatability rather than Control / Resilience. Confirm intent and preserve balance quality.`,
        affected_items: [name],
        meta: { slug, rest_seconds: restSeconds, volume, rpe },
      })
    }

    slugsBefore.add(slug)
  }

  return findings
}

/** Trunk / Pelvis / Anti-Movement Control checks (cards 21–30). Pure helper for tests. */
export function analyzeControlTrunkReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise = new Map(),
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !CONTROL_TRUNK_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const volume = countVolume(item, dosage)
    const rpe = itemRpe(item, dosage)
    const skillLevel = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    const isBeginner = skillLevel === 'EARLY_STAGE' || skillLevel === 'BEGINNER'

    if (slug === DEAD_BUG_SLUG && CONTROL_TRUNK_LUMBAR_ARCH_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_dead_bug_arch',
        severity: 'recommendation',
        message: `${name}: shorten leg range, keep feet down, or regress to breathing reset when lumbar arching appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === LOADED_DEAD_BUG_SLUG && /rib\s*flare/i.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_loaded_rib_flare',
        severity: 'recommendation',
        message: `${name}: reduce load, reduce overhead range, or return to basic dead bug when rib flare appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === BIRD_DOG_SLUG && CONTROL_TRUNK_PELVIS_ROTATION_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_bird_dog_rotation',
        severity: 'recommendation',
        message: `${name}: use leg-only or arm-only variation when pelvis rotation appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === FRONT_PLANK_SLUG && CONTROL_TRUNK_HIP_SAG_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_plank_hip_sag',
        severity: 'warning',
        message: `${name}: end the set. Quality beats duration when hips sag.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === FRONT_PLANK_SLUG && (CONTROL_TRUNK_LONG_LEVER_PATTERN.test(watchText) || (isBeginner && CONTROL_TRUNK_HIP_SAG_PATTERN.test(watchText)))) {
      findings.push({
        rule_key: 'control_resilience_trunk_long_lever_prerequisite',
        severity: 'warning',
        message: `${name}: long-lever plank requires standard plank competency. Regress to standard or incline plank.`,
        affected_items: [name],
        meta: { slug, skill_level: isBeginner ? 'BEGINNER' : undefined, symptom_flags: true },
      })
    }

    if (slug === SIDE_PLANK_SLUG && CONTROL_TRUNK_SIDE_SAG_ROTATE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_side_plank_regress',
        severity: 'recommendation',
        message: `${name}: use modified/knee side plank when hips sag or torso rotates.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === BEAR_PLANK_SLUG && CONTROL_TRUNK_PRESSURE_WRIST_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_bear_plank_regress',
        severity: 'recommendation',
        message: `${name}: use dead bug, bird dog, or elevated quadruped variation when pressure symptoms or wrist pain appear.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === BEAR_TAP_SLUG && CONTROL_TRUNK_PELVIS_ROTATION_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_bear_tap_rotation',
        severity: 'recommendation',
        message: `${name}: widen base, slow down, or regress to bear plank hold when hip rotation appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === PULL_THROUGH_SLUG && CONTROL_TRUNK_PELVIS_ROTATION_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_pull_through_rotation',
        severity: 'recommendation',
        message: `${name}: use lighter object, wider feet, shorter reach, or Pallof hold when pelvis rotates.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === PALLOF_SLUG && CONTROL_TRUNK_PALLOF_ROTATION_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_pallof_rotation',
        severity: 'recommendation',
        message: `${name}: reduce resistance or shorten lever when torso rotates toward the anchor.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === HALF_KNEELING_ANTI_ROT_SLUG && CONTROL_TRUNK_PELVIS_ROTATION_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_half_kneeling_rotation',
        severity: 'recommendation',
        message: `${name}: use standing Pallof hold or reduce band tension when pelvis rotates.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (CONTROL_TRUNK_UNSAFE_ANCHOR_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_unsafe_anchor',
        severity: 'error',
        message: `${name}: do not perform band/cable trunk drills without a secure anchor.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (CONTROL_TRUNK_BREATH_HOLD_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_breath_hold',
        severity: 'recommendation',
        message: `${name}: reduce intensity and coach breathing behind the brace when breath-holding appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (restSeconds > 0 && restSeconds < CONTROL_SHORT_REST_SECONDS && volume >= 12 && rpe >= CONTROL_MIN_RPE_STRENGTH) {
      findings.push({
        rule_key: 'control_resilience_trunk_fitness_density',
        severity: 'warning',
        message: `${name}: this may be Fitness / Repeatability, not Control / Resilience. Confirm intent and preserve trunk quality.`,
        affected_items: [name],
        meta: { slug, rest_seconds: restSeconds, volume, rpe },
      })
    }

    if (CONTROL_TRUNK_SYMPTOM_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_symptom_substitution',
        severity: 'recommendation',
        message: `${name}: substitute — loaded dead bug→dead bug heel tap; plank→incline plank or dead bug; side plank→modified side plank; bear plank→bird dog or dead bug; pull-through→Pallof hold; half-kneeling anti-rotation→standing Pallof.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }
  }

  return findings
}

/** Slow Eccentric / Isometric Joint Resilience checks (cards 41–50). Pure helper for tests. */
export function analyzeControlSlowEccentricReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise = new Map(),
    blockMeta = [],
    controlBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !CONTROL_SLOW_ECCENTRIC_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  let outputAfterControl = false
  for (let j = controlBlockIndex + 1; j < blockMeta.length; j++) {
    if (blockMeta[j]?.phaseKey === 'output') outputAfterControl = true
  }

  const hardSlowEccSlugs = ordered.filter(({ slug }) =>
    slug !== TIBIALIS_ISO_SLUG && slug !== CALF_ISO_SLUG)
  if (outputAfterControl && hardSlowEccSlugs.length > 0) {
    findings.push({
      rule_key: 'control_resilience_slow_ecc_before_output',
      severity: 'warning',
      message: 'Hard slow-eccentric / joint-resilience work before Output may reduce elastic quality. Confirm low-intensity readiness intent or move later.',
      affected_items: hardSlowEccSlugs.map((o) => o.name),
      meta: { before_output: true },
    })
  }

  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const volume = countVolume(item, dosage)
    const rpe = itemRpe(item, dosage)
    const skillLevel = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    const isBeginner = skillLevel === 'EARLY_STAGE' || skillLevel === 'BEGINNER'

    if (slug === SPLIT_SQUAT_ECC_SLUG && CONTROL_KNEE_VALGUS_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_split_valgus',
        severity: 'recommendation',
        message: `${name}: use supported split squat ISO or reduce range when knee collapses inward.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === LATERAL_LUNGE_ISO_SLUG && CONTROL_GROIN_PAIN_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_lateral_groin_stop',
        severity: 'error',
        message: `${name}: end frontal-plane loading and regress to adductor rockback or adductor squeeze when groin pain appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === COSSACK_HOLD_SLUG && CONTROL_SLOW_ECC_COSSACK_FORCED_DEPTH_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_cossack_forced_depth',
        severity: 'warning',
        message: `${name}: reduce depth and stay in pain-free range when chasing bottom position.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === COSSACK_HOLD_SLUG && CONTROL_SLOW_ECC_IMpingEMENT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_cossack_symptom_stop',
        severity: 'error',
        message: `${name}: end cossack loading when groin, hip, or ankle impingement appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === ADDUCTOR_SQUEEZE_SLUG && CONTROL_GROIN_PAIN_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_adductor_groin_stop',
        severity: 'error',
        message: `${name}: end adductor loading when sharp groin pain appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === HAMSTRING_BRIDGE_ISO_SLUG && CONTROL_SLOW_ECC_BRIDGE_CRAMP_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_bridge_cramp',
        severity: 'recommendation',
        message: `${name}: shorten hold, reduce lever, or regress to short-lever bridge when cramping appears immediately.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SLIDER_HAMSTRING_ECC_SLUG && CONTROL_SLOW_ECC_SLIDER_HIP_DROP_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_slider_hip_drop',
        severity: 'recommendation',
        message: `${name}: reduce range, add hand support, or regress to bridge ISO when hip drops during eccentric.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SLIDER_HAMSTRING_ECC_SLUG && CONTROL_HAMSTRING_PAIN_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_slider_hamstring_stop',
        severity: 'error',
        message: `${name}: end slider eccentric and regress to bridge ISO when sharp hamstring pain appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === CALF_ISO_SLUG && CONTROL_SLOW_ECC_ACHILLES_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_calf_achilles',
        severity: 'recommendation',
        message: `${name}: reduce hold duration or regress to seated calf pump when Achilles pain worsens.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SOLEUS_ISO_SLUG && outputAfterControl
      && (CONTROL_SLOW_ECC_HIGH_VOLUME_OUTPUT_PATTERN.test(watchText) || CONTROL_HIGH_SPEED_PATTERN.test(watchText))) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_soleus_before_output',
        severity: 'warning',
        message: `${name}: soleus fatigue may affect jump and sprint quality when hard soleus ISO precedes high-volume Output in the same session.`,
        affected_items: [name],
        meta: { slug, output_after: true },
      })
    }

    if (slug === TIBIALIS_ISO_SLUG && CONTROL_SLOW_ECC_SHIN_ANKLE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_tibialis_stop',
        severity: 'error',
        message: `${name}: end tibialis loading when sharp shin or anterior ankle pain appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === NORDIC_LEAN_SLUG && isBeginner) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_nordic_beginner',
        severity: 'warning',
        message: `${name}: require secure anchor, partial range, and supervision before Nordic lean for beginner athletes.`,
        affected_items: [name],
        meta: { slug, skill_level: 'BEGINNER' },
      })
    }

    if (slug === NORDIC_LEAN_SLUG && CONTROL_SLOW_ECC_NORDIC_UNSAFE_ANCHOR_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_nordic_unsafe_anchor',
        severity: 'error',
        message: `${name}: do not perform Nordic lean without a secure ankle anchor.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === NORDIC_LEAN_SLUG && CONTROL_SLOW_ECC_NORDIC_COMPENSATION_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_nordic_compensation_stop',
        severity: 'error',
        message: `${name}: end set when hip break, lumbar break, or uncontrolled fall appears during Nordic lean.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if ([SLIDER_HAMSTRING_ECC_SLUG, NORDIC_LEAN_SLUG].includes(slug) && CONTROL_HIGH_SPEED_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_sprint_proximity',
        severity: 'warning',
        message: `${name}: hamstring eccentric or Nordic work near max sprint may increase tissue risk. Confirm spacing from high-speed Output.`,
        affected_items: [name],
        meta: { slug, high_speed: true },
      })
    }

    if (CONTROL_SLOW_ECC_SYMPTOM_STOP_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_symptom_stop',
        severity: 'error',
        message: `${name}: stop joint-resilience drill when sharp pain, numbness, tingling, or worsening symptoms appear.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (restSeconds > 0 && restSeconds < CONTROL_SHORT_REST_SECONDS && volume >= 12 && rpe >= CONTROL_MIN_RPE_STRENGTH) {
      findings.push({
        rule_key: 'control_resilience_slow_ecc_fitness_density',
        severity: 'warning',
        message: `${name}: this may be Fitness / Repeatability, not Control / Resilience. Confirm intent and preserve joint position quality.`,
        affected_items: [name],
        meta: { slug, rest_seconds: restSeconds, volume, rpe },
      })
    }
  }

  return findings
}

/** Scapular / wrist / hand-support cluster (cards 31–40). Pure helper for tests. */
export function analyzeControlHandSupportReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise = new Map(),
    blockMeta = [],
    controlBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !CONTROL_SCAPULAR_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  const slugsInBlock = ordered.map((o) => o.slug)
  const shrugIndex = slugsInBlock.indexOf(WALL_HANDSTAND_SHRUG_SLUG)
  const lineHoldIndex = slugsInBlock.indexOf(WALL_HANDSTAND_SLUG)
  if (shrugIndex >= 0 && (lineHoldIndex < 0 || shrugIndex < lineHoldIndex)) {
    const shrugEntry = ordered[shrugIndex]
    findings.push({
      rule_key: 'control_resilience_hs_shrug_prerequisite',
      severity: 'warning',
      message: `${shrugEntry.name}: program wall handstand line hold before shoulder shrug work in the same block.`,
      affected_items: [shrugEntry.name],
      meta: { slug: WALL_HANDSTAND_SHRUG_SLUG, prerequisite: WALL_HANDSTAND_SLUG },
    })
  }

  let skillAfterControl = false
  for (let j = controlBlockIndex + 1; j < blockMeta.length; j++) {
    if (blockMeta[j]?.phaseKey === 'skill_movement_intelligence') skillAfterControl = true
  }
  if (skillAfterControl) {
    findings.push({
      rule_key: 'control_resilience_hs_before_skill',
      severity: 'warning',
      message: 'Hand-support Control / Resilience work before Skill may reduce handstand, support, and tumbling quality. Confirm fatigue intent or move Skill earlier.',
      affected_items: ordered.map((o) => o.name),
      meta: { before_skill: true },
    })
  }

  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const volume = countVolume(item, dosage)
    const rpe = itemRpe(item, dosage)
    const skillLevel = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    const isBeginner = skillLevel === 'EARLY_STAGE' || skillLevel === 'BEGINNER'

    if (slug === SCAPULAR_PUSHUP_SLUG && CONTROL_HS_ELBOW_BEND_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_hs_scapular_elbow_bend',
        severity: 'warning',
        message: `${name}: keep elbows straight — scapular movement only. Regress range or use wall serratus press if elbows bend.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === PRONE_YTW_SLUG && CONTROL_HS_SHRUG_FAULT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_hs_ytw_shrug',
        severity: 'recommendation',
        message: `${name}: depress shoulder blades and keep neck long — no shrugging into ears during Y-T-W holds.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === TALL_PLANK_TAP_SLUG && CONTROL_TRUNK_PELVIS_ROTATION_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_hs_plank_tap_rotation',
        severity: 'recommendation',
        message: `${name}: widen base, slow taps, or regress to quadruped scapular push when hips rotate on each tap.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === SLOW_BEAR_CRAWL_SLUG
      && (CONTROL_HS_BEAR_CRAWL_FAST_PATTERN.test(watchText)
        || (restSeconds > 0 && restSeconds < CONTROL_SHORT_REST_SECONDS && volume >= 12 && rpe >= CONTROL_MIN_RPE_STRENGTH))) {
      findings.push({
        rule_key: 'control_resilience_hs_bear_crawl_fitness',
        severity: 'warning',
        message: `${name}: this may be Fitness / Repeatability, not Control / Resilience. Use slow tempo, full rest, and short distance.`,
        affected_items: [name],
        meta: { slug, rest_seconds: restSeconds, volume, rpe, symptom_flags: CONTROL_HS_BEAR_CRAWL_FAST_PATTERN.test(watchText) },
      })
    }

    if (slug === CRAB_SLUG && CONTROL_HS_SHOULDER_PINCH_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_hs_crab_pinch_stop',
        severity: 'error',
        message: `${name}: end set when shoulder pinching appears. Regress to bridge ISO or incline crab.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === WALL_HANDSTAND_SLUG && CONTROL_HS_NO_SAFE_EXIT_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_hs_no_safe_exit',
        severity: 'error',
        message: `${name}: do not invert without a rehearsed safe exit, mat, and supervision for beginners.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === WALL_HANDSTAND_SLUG && CONTROL_HS_BANANA_BACK_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_hs_banana_back',
        severity: 'warning',
        message: `${name}: stack ribs over pelvis — reduce arch, push floor away, and shorten hold when banana back or rib flare appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === WALL_HANDSTAND_SLUG && (isBeginner || OVERHEAD_MOBILITY_PATTERN.test(watchText))) {
      findings.push({
        rule_key: 'control_resilience_handstand_prerequisite',
        severity: 'warning',
        message: `${name}: require wrist tolerance, scapular control, safe exit, and supervision — use wall body-line or incline plank first when prerequisites are limited.`,
        affected_items: [name],
        meta: { slug, skill_level: isBeginner ? 'BEGINNER' : undefined },
      })
    }

    if (slug === WALL_HANDSTAND_SHRUG_SLUG && CONTROL_HS_ELBOW_BEND_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_hs_shrug_elbow_bend',
        severity: 'warning',
        message: `${name}: keep elbows straight during scapular shrug — reduce range if elbows bend.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === WALL_WALK_NEGATIVE_SLUG && (CONTROL_HS_WALL_WALK_COLLAPSE_PATTERN.test(watchText) || isBeginner)) {
      findings.push({
        rule_key: isBeginner && !CONTROL_HS_WALL_WALK_COLLAPSE_PATTERN.test(watchText)
          ? 'control_resilience_wall_walk_beginner'
          : 'control_resilience_hs_wall_walk_collapse_stop',
        severity: CONTROL_HS_WALL_WALK_COLLAPSE_PATTERN.test(watchText) ? 'error' : 'warning',
        message: CONTROL_HS_WALL_WALK_COLLAPSE_PATTERN.test(watchText)
          ? `${name}: end descent when collapse or rush appears. Regress to wall line hold or partial walk.`
          : `${name}: use wall body-line drill, incline plank, or partial wall walk before full wall-walk negative for beginners.`,
        affected_items: [name],
        meta: { slug, skill_level: isBeginner ? 'BEGINNER' : undefined, symptom_flags: CONTROL_HS_WALL_WALK_COLLAPSE_PATTERN.test(watchText) },
      })
    }

    if (slug === RING_SUPPORT_SLUG
      && (CONTROL_RING_DRIFT_PATTERN.test(watchText) || CONTROL_HS_ELBOW_BEND_PATTERN.test(watchText) || CONTROL_HS_SHRUG_FAULT_PATTERN.test(watchText))) {
      findings.push({
        rule_key: 'control_resilience_hs_ring_support_regress',
        severity: 'recommendation',
        message: `${name}: regress to assisted support, bar support, or feet-on-floor when rings drift, elbows bend, or shoulders shrug.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === RING_SUPPORT_SLUG && CONTROL_HS_RING_FAILURE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_hs_ring_support_failure',
        severity: 'error',
        message: `${name}: end set when support fails or collapses. Return to quadruped scapular push or assisted ring support.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === WRIST_LEAN_SLUG && CONTROL_HS_WRIST_SHARP_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_hs_wrist_sharp_stop',
        severity: 'error',
        message: `${name}: end wrist loading and regress to mobility / light capacity when sharp pain, thumb-side pain, numbness, or tingling appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (CONTROL_HS_SYMPTOM_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_hs_symptom_substitution',
        severity: 'recommendation',
        message: `${name}: substitute — wrist pain→wrist lean rock hold or fists/handles; shoulder pain→prone Y-T-W or incline scapular push; elbow/neck/pressure→quadruped scapular push or dead bug; inversion pain→floor scapular work only.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }
  }

  return findings
}

/** Control / Resilience cluster checks. Pure helper for tests. */
export function analyzeControlResilienceReadiness(items, ctx) {
  const {
    slugByExercise,
    dosageByExercise,
    blockMeta = [],
    controlBlockIndex = 0,
    exerciseSkillLevelById = new Map(),
    draft = {},
  } = ctx

  const findings = []
  const watchText = draftWatchText(draft)
  const ordered = []

  for (const item of items ?? []) {
    const exerciseId = Number(item.exercise_id ?? item.exerciseId)
    if (!exerciseId) continue
    const name = item.exercise_name ?? item.exerciseName ?? String(exerciseId)
    const slug = exerciseSlug(item, slugByExercise)
    if (!slug || !CONTROL_RESILIENCE_SLUGS.has(slug)) continue
    ordered.push({ item, exerciseId, name, slug })
  }

  if (ordered.length === 0) return findings

  findings.push(...analyzeControlLandingReadiness(items, ctx))
  const singleLegFindings = analyzeControlSingleLegReadiness(items, ctx)
  findings.push(...singleLegFindings)
  findings.push(...analyzeControlTrunkReadiness(items, ctx))
  findings.push(...analyzeControlSlowEccentricReadiness(items, ctx))
  const handSupportFindings = analyzeControlHandSupportReadiness(items, ctx)
  findings.push(...handSupportFindings)

  let outputAfterControl = false
  for (let j = controlBlockIndex + 1; j < blockMeta.length; j++) {
    if (blockMeta[j]?.phaseKey === 'output') outputAfterControl = true
  }

  if (outputAfterControl) {
    const hardSlugs = ordered.filter(({ slug }) =>
      !['drop-squat-to-stick', 'dead-bug-heel-tap-control-progression', 'bird-dog-iso-hold', 'pallof-press-iso-hold',
        'single-leg-balance-hold-tripod-foot', 'tibialis-iso-toe-up-hold', 'wrist-lean-isometric-wrist-support-rock-hold',
        'beam-line-balance-freeze'].includes(slug))
    if (hardSlugs.length > 0) {
      findings.push({
        rule_key: 'control_resilience_before_output',
        severity: 'warning',
        message: 'Hard Control / Resilience work before Output may reduce speed and power quality. Confirm low-intensity readiness intent or move later.',
        affected_items: hardSlugs.map((o) => o.name),
        meta: { before_output: true },
      })
    }
  }

  if (CONTROL_TISSUE_PAIN_PATTERN.test(watchText) && !ordered.some((o) => CONTROL_LANDING_SLUGS.has(o.slug))) {
    findings.push({
      rule_key: 'control_resilience_tissue_substitution',
      severity: 'recommendation',
      message: 'Symptom warning signs — substitute: knee→drop squat/shallow split ISO/Spanish squat hold; hip/groin→adductor squeeze/shallow lateral hold; ankle→supported balance/calf ISO; shoulder/wrist→incline support/scapular drill; back→dead bug/Pallof/bird dog; hamstring→bridge ISO instead of Nordic/slider eccentric.',
      affected_items: ordered.map((o) => o.name),
      meta: { symptom_flags: true },
    })
  }

  let hasHighDensity = false
  for (const { item, exerciseId, name, slug } of ordered) {
    const dosage = dosageByExercise.get(String(exerciseId))
    const restSeconds = Number(item.rest_seconds ?? item.restSeconds ?? dosage?.default_rest_seconds) || 0
    const volume = countVolume(item, dosage)
    const rpe = itemRpe(item, dosage)
    const skillLevel = String(exerciseSkillLevelById.get(String(exerciseId)) ?? '').toUpperCase()
    const isBeginner = skillLevel === 'EARLY_STAGE' || skillLevel === 'BEGINNER'

    if (restSeconds > 0 && restSeconds < CONTROL_SHORT_REST_SECONDS && volume >= 12 && rpe >= CONTROL_MIN_RPE_STRENGTH) {
      hasHighDensity = true
    }

    if (CONTROL_LANDING_SLUGS.has(slug)) continue
    if (CONTROL_TRUNK_SLUGS.has(slug)) continue
    if (CONTROL_SCAPULAR_SLUGS.has(slug)) continue
    if (CONTROL_SLOW_ECCENTRIC_SLUGS.has(slug)) continue

    const hasSpecificSingleLegFinding = singleLegFindings.some((f) => f.affected_items?.includes(name))
    if (CONTROL_SINGLE_LEG_SLUGS.has(slug) && CONTROL_BALANCE_FLAIL_PATTERN.test(watchText) && !hasSpecificSingleLegFinding) {
      findings.push({
        rule_key: 'control_resilience_balance_flail',
        severity: 'recommendation',
        message: `${name}: reduce challenge, add hand support, or shorten hold when balance becomes random flailing.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === PERTURBATION_BALANCE_SLUG && isBeginner) {
      findings.push({
        rule_key: 'control_resilience_perturbation_beginner',
        severity: 'warning',
        message: `${name}: require coach supervision and low perturbation intensity for beginner athletes.`,
        affected_items: [name],
        meta: { slug, skill_level: 'BEGINNER' },
      })
    }

    if (CONTROL_TRUNK_SLUGS.has(slug) && CONTROL_TRUNK_RIB_FLARE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_trunk_rib_flare',
        severity: 'recommendation',
        message: `${name}: reduce lever length, range, load, or hold duration when rib flare, low-back arch, or breath-holding appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (['front-plank-long-lever-plank', 'bear-plank-hold', 'bear-plank-shoulder-tap', 'tall-plank-shoulder-tap'].includes(slug)
      && CONTROL_SHOULDER_WRIST_FATIGUE_PATTERN.test(watchText)) {
      findings.push({
        rule_key: 'control_resilience_plank_shoulder_fatigue',
        severity: 'recommendation',
        message: `${name}: switch to dead bug, Pallof hold, or supported variation when shoulders/wrists fatigue before trunk stimulus.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (CONTROL_HAND_SUPPORT_SLUGS.has(slug) && CONTROL_WRIST_PAIN_PATTERN.test(watchText)
      && !handSupportFindings.some((f) => f.affected_items?.includes(name))) {
      findings.push({
        rule_key: 'control_resilience_hand_wrist_pain',
        severity: 'recommendation',
        message: `${name}: use fists, handles, incline support, or non-hand-support trunk drill when hand/wrist pain appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === WALL_HANDSTAND_SLUG && (isBeginner || OVERHEAD_MOBILITY_PATTERN.test(watchText))) {
      findings.push({
        rule_key: 'control_resilience_handstand_prerequisite',
        severity: 'warning',
        message: `${name}: require wrist tolerance, scapular control, safe exit, and supervision — use wall body-line or incline plank first when prerequisites are limited.`,
        affected_items: [name],
        meta: { slug, skill_level: isBeginner ? 'BEGINNER' : undefined },
      })
    }

    if (slug === WALL_WALK_NEGATIVE_SLUG && isBeginner
      && !handSupportFindings.some((f) => f.affected_items?.includes(name))) {
      findings.push({
        rule_key: 'control_resilience_wall_walk_beginner',
        severity: 'warning',
        message: `${name}: use wall body-line drill, incline plank, or partial wall walk before full wall-walk negative for beginners.`,
        affected_items: [name],
        meta: { slug, skill_level: 'BEGINNER' },
      })
    }

    if (slug === RING_SUPPORT_SLUG && CONTROL_RING_DRIFT_PATTERN.test(watchText)
      && !handSupportFindings.some((f) => f.affected_items?.includes(name))) {
      findings.push({
        rule_key: 'control_resilience_ring_support_drift',
        severity: 'error',
        message: `${name}: end set and regress to assisted or bar support when rings drift wide.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }

    if (slug === WRIST_LEAN_SLUG && /sharp\s*wrist|numbness|tingling/i.test(watchText)
      && !handSupportFindings.some((f) => f.affected_items?.includes(name))) {
      findings.push({
        rule_key: 'control_resilience_wrist_sharp_pain',
        severity: 'error',
        message: `${name}: end wrist loading and regress to wrist mobility / light capacity when sharp pain, numbness, or tingling appears.`,
        affected_items: [name],
        meta: { slug, symptom_flags: true },
      })
    }
  }

  if (hasHighDensity) {
    findings.push({
      rule_key: 'control_resilience_short_rest_density',
      severity: 'warning',
      message: 'This may be Fitness / Repeatability rather than Control / Resilience. Confirm intent — precision work needs full rest between sets.',
      affected_items: ordered.map((o) => o.name),
      meta: {},
    })
  }

  return findings
}
