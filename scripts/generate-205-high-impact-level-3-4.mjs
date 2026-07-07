/**
 * Generates:
 *   backend/migrations/205_coaching_high_impact_level_3_4_infrastructure_and_seed.sql
 *   backend/migrations/206_coaching_high_impact_level_3_4_cards.sql
 *
 * Source: scripts/data/high-impact-level-3-4-exercise-cards-all-50.json
 * Run: node scripts/generate-205-high-impact-level-3-4.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(__dirname, 'data/high-impact-level-3-4-exercise-cards-all-50.json')
const MIG_DIR = path.join(__dirname, '../backend/migrations')

const raw = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))
const lib = raw.library ?? {}

const SUBROLE_MAP = {
  reactive_agility_output: 'reactive_agility_tumbling_output',
}

const SLUG_OVERRIDES = {
  'single-leg-lateral-hop-to-stick': 'single-leg-lateral-hop-to-stick-alt',
}

/** Per-slug YouTube watch URLs for client-facing video embeds. */
const YOUTUBE_BY_SLUG = {
  'snap-down-to-low-vertical-rebound': [
    'https://www.youtube.com/watch?v=d7nTaj0A8Iw',
    'https://www.youtube.com/watch?v=x1nBhDLUUi0',
    'https://www.youtube.com/watch?v=vQqmduv_de8',
  ],
  'low-box-drop-to-quarter-squat-rebound': [
    'https://www.youtube.com/watch?v=6HFB64kFeNk',
    'https://www.youtube.com/watch?v=ic5OtLzSwQI',
    'https://www.youtube.com/watch?v=cScIuuKY5_o',
  ],
  'step-off-to-single-leg-stick': [
    'https://www.youtube.com/watch?v=6HFB64kFeNk',
    'https://www.youtube.com/watch?v=U12iOibPX98',
    'https://www.youtube.com/watch?v=Yq75-6SUn7A',
  ],
  'low-hurdle-hop-to-pause-stick': [
    'https://www.youtube.com/watch?v=4nTDP0G3nhc',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
    'https://www.youtube.com/watch?v=72xY37N_Sww',
  ],
  'split-stance-scissor-hop-to-stick': [
    'https://www.youtube.com/watch?v=ZHg88_EYQ74',
    'https://www.youtube.com/watch?v=Jiukp-0mUIA',
    'https://www.youtube.com/watch?v=N84BAPZKnP4',
  ],
  'lateral-line-hop-to-single-leg-stick': [
    'https://www.youtube.com/watch?v=ZHg88_EYQ74',
    'https://www.youtube.com/watch?v=Jiukp-0mUIA',
    'https://www.youtube.com/watch?v=U12iOibPX98',
  ],
  'two-hop-vertical-rhythm-to-stick': [
    'https://www.youtube.com/watch?v=j0nl5dWuqN4',
    'https://www.youtube.com/watch?v=cQ9JP36zIq4',
    'https://www.youtube.com/watch?v=d7nTaj0A8Iw',
  ],
  'pogo-pogo-stick-series': [
    'https://www.youtube.com/watch?v=j0nl5dWuqN4',
    'https://www.youtube.com/watch?v=cQ9JP36zIq4',
    'https://www.youtube.com/watch?v=N84BAPZKnP4',
  ],
  'low-hurdle-lateral-hop-to-stick': [
    'https://www.youtube.com/watch?v=4nTDP0G3nhc',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
    'https://www.youtube.com/watch?v=ZHg88_EYQ74',
  ],
  'drop-landing-to-45-degree-push-off': [
    'https://www.youtube.com/watch?v=6HFB64kFeNk',
    'https://www.youtube.com/watch?v=atcDcplGsdI',
    'https://www.youtube.com/watch?v=GJsAcnLHqdE',
  ],
  'broad-jump-to-backpedal-reset': [
    'https://www.youtube.com/watch?v=cfR4qXuQAfY',
    'https://www.youtube.com/watch?v=72xY37N_Sww',
    'https://www.youtube.com/watch?v=GqVqQK_j_zQ',
  ],
  'skater-hop-to-forward-re-acceleration': [
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
    'https://www.youtube.com/watch?v=4nTDP0G3nhc',
    'https://www.youtube.com/watch?v=SpJX-LllC4M',
  ],
  'diagonal-bound-to-stick': [
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
    'https://www.youtube.com/watch?v=4nTDP0G3nhc',
    'https://www.youtube.com/watch?v=MCvNd4hBK4A',
  ],
  'single-leg-lateral-hop-to-stick-alt': [
    'https://www.youtube.com/watch?v=ZHg88_EYQ74',
    'https://www.youtube.com/watch?v=U12iOibPX98',
    'https://www.youtube.com/watch?v=Yq75-6SUn7A',
  ],
  'triple-line-hop-and-stick': [
    'https://www.youtube.com/watch?v=ZHg88_EYQ74',
    'https://www.youtube.com/watch?v=Jiukp-0mUIA',
    'https://www.youtube.com/watch?v=U12iOibPX98',
  ],
  'carioca-bound-to-stick': [
    'https://www.youtube.com/watch?v=MCvNd4hBK4A',
    'https://www.youtube.com/watch?v=o0P1XAqXjwU',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
  ],
  'medial-lateral-ankle-hop-series': [
    'https://www.youtube.com/watch?v=j0nl5dWuqN4',
    'https://www.youtube.com/watch?v=N84BAPZKnP4',
    'https://www.youtube.com/watch?v=ZHg88_EYQ74',
  ],
  'crossover-step-to-bound-and-stick': [
    'https://www.youtube.com/watch?v=oAGUbBqD2wI',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
    'https://www.youtube.com/watch?v=YyBMVaxWFsM',
  ],
  'hop-to-hop-to-stick-linear': [
    'https://www.youtube.com/watch?v=U12iOibPX98',
    'https://www.youtube.com/watch?v=Yq75-6SUn7A',
    'https://www.youtube.com/watch?v=ZHg88_EYQ74',
  ],
  'curved-bound-to-stick': [
    'https://www.youtube.com/watch?v=GqVqQK_j_zQ',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
    'https://www.youtube.com/watch?v=MCvNd4hBK4A',
  ],
  '90-degree-jump-turn-to-stick': [
    'https://www.youtube.com/watch?v=oAGUbBqD2wI',
    'https://www.youtube.com/watch?v=YyBMVaxWFsM',
    'https://www.youtube.com/watch?v=z-wV9O8y-a0',
  ],
  'reactive-cone-call-hop-to-stick': [
    'https://www.youtube.com/watch?v=QEk95UCvmwg',
    'https://www.youtube.com/watch?v=x8-eq7RNsaQ',
    'https://www.youtube.com/watch?v=ZHg88_EYQ74',
  ],
  'partner-point-hop-to-stick': [
    'https://www.youtube.com/watch?v=Wm9vYLsJbi0',
    'https://www.youtube.com/watch?v=Pb15pCX16H8',
    'https://www.youtube.com/watch?v=QEk95UCvmwg',
  ],
  'medicine-ball-catch-to-low-hop-and-stick': [
    'https://www.youtube.com/watch?v=e-zHTwXA8mE',
    'https://www.youtube.com/watch?v=Jo2on0-YBPM',
    'https://www.youtube.com/watch?v=d7nTaj0A8Iw',
  ],
  'split-stance-reactive-hop-switch': [
    'https://www.youtube.com/watch?v=QEk95UCvmwg',
    'https://www.youtube.com/watch?v=ZHg88_EYQ74',
    'https://www.youtube.com/watch?v=x8-eq7RNsaQ',
  ],
  'alternate-bounds-for-height-and-distance': [
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
    'https://www.youtube.com/watch?v=4nTDP0G3nhc',
    'https://www.youtube.com/watch?v=cfR4qXuQAfY',
  ],
  'single-leg-triple-hop-to-stick': [
    'https://www.youtube.com/watch?v=U12iOibPX98',
    'https://www.youtube.com/watch?v=Yq75-6SUn7A',
    'https://www.youtube.com/watch?v=N84BAPZKnP4',
  ],
  'repeated-broad-jump-to-sprint-out': [
    'https://www.youtube.com/watch?v=cfR4qXuQAfY',
    'https://www.youtube.com/watch?v=72xY37N_Sww',
    'https://www.youtube.com/watch?v=SpJX-LllC4M',
  ],
  'bounds-to-decel-gate': [
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
    'https://www.youtube.com/watch?v=GqVqQK_j_zQ',
    'https://www.youtube.com/watch?v=SpJX-LllC4M',
  ],
  'lateral-bound-rebound-series': [
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
    'https://www.youtube.com/watch?v=4nTDP0G3nhc',
    'https://www.youtube.com/watch?v=ZHg88_EYQ74',
  ],
  'tuck-jump-to-lateral-stick': [
    'https://www.youtube.com/watch?v=4nTDP0G3nhc',
    'https://www.youtube.com/watch?v=72xY37N_Sww',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
  ],
  'low-hurdle-hop-continuous-with-turn': [
    'https://www.youtube.com/watch?v=4nTDP0G3nhc',
    'https://www.youtube.com/watch?v=oAGUbBqD2wI',
    'https://www.youtube.com/watch?v=72xY37N_Sww',
  ],
  'hurdle-hop-to-broad-jump': [
    'https://www.youtube.com/watch?v=72xY37N_Sww',
    'https://www.youtube.com/watch?v=cfR4qXuQAfY',
    'https://www.youtube.com/watch?v=4nTDP0G3nhc',
  ],
  'depth-drop-to-lateral-rebound': [
    'https://www.youtube.com/watch?v=6HFB64kFeNk',
    'https://www.youtube.com/watch?v=ic5OtLzSwQI',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
  ],
  'depth-drop-to-broad-rebound': [
    'https://www.youtube.com/watch?v=6HFB64kFeNk',
    'https://www.youtube.com/watch?v=cfR4qXuQAfY',
    'https://www.youtube.com/watch?v=72xY37N_Sww',
  ],
  'reactive-45-degree-hop-to-cut': [
    'https://www.youtube.com/watch?v=atcDcplGsdI',
    'https://www.youtube.com/watch?v=GJsAcnLHqdE',
    'https://www.youtube.com/watch?v=QEk95UCvmwg',
  ],
  'crossover-bound-to-re-acceleration': [
    'https://www.youtube.com/watch?v=oAGUbBqD2wI',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
    'https://www.youtube.com/watch?v=YyBMVaxWFsM',
  ],
  'partner-chase-bound-start': [
    'https://www.youtube.com/watch?v=Wm9vYLsJbi0',
    'https://www.youtube.com/watch?v=QEk95UCvmwg',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
  ],
  'shuffle-to-bound-to-sprint': [
    'https://www.youtube.com/watch?v=GqVqQK_j_zQ',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
    'https://www.youtube.com/watch?v=SpJX-LllC4M',
  ],
  'backpedal-turn-to-hop-and-go': [
    'https://www.youtube.com/watch?v=GqVqQK_j_zQ',
    'https://www.youtube.com/watch?v=k7xUw9Sjf-c',
    'https://www.youtube.com/watch?v=d7nTaj0A8Iw',
  ],
  'curved-sprint-bound-series': [
    'https://www.youtube.com/watch?v=GqVqQK_j_zQ',
    'https://www.youtube.com/watch?v=MCvNd4hBK4A',
    'https://www.youtube.com/watch?v=SpJX-LllC4M',
  ],
  'zigzag-bound-rebound-course': [
    'https://www.youtube.com/watch?v=MCvNd4hBK4A',
    'https://www.youtube.com/watch?v=atcDcplGsdI',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
  ],
  '180-jump-rebound-to-sprint-out': [
    'https://www.youtube.com/watch?v=z-wV9O8y-a0',
    'https://www.youtube.com/watch?v=SBx-chygCdE',
    'https://www.youtube.com/watch?v=SpJX-LllC4M',
  ],
  'single-leg-lateral-rebound-to-cut': [
    'https://www.youtube.com/watch?v=atcDcplGsdI',
    'https://www.youtube.com/watch?v=U12iOibPX98',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
  ],
  'reaction-ball-drop-to-hop-and-go': [
    'https://www.youtube.com/watch?v=axhMilEMbnU',
    'https://www.youtube.com/watch?v=r36sPP2pYTw',
    'https://www.youtube.com/watch?v=d7nTaj0A8Iw',
  ],
  'medicine-ball-scoop-toss-to-broad-rebound': [
    'https://www.youtube.com/watch?v=Qq83wji4t2I',
    'https://www.youtube.com/watch?v=cfR4qXuQAfY',
    'https://www.youtube.com/watch?v=GfZlZknuAXA',
  ],
  'medicine-ball-rotational-toss-to-lateral-bound': [
    'https://www.youtube.com/watch?v=Qq83wji4t2I',
    'https://www.youtube.com/watch?v=GfZlZknuAXA',
    'https://www.youtube.com/watch?v=CCJWB9bCBEo',
  ],
  'resisted-band-assisted-rebound-jump': [
    'https://www.youtube.com/watch?v=1PmO6kzBEc8',
    'https://www.youtube.com/watch?v=d7nTaj0A8Iw',
    'https://www.youtube.com/watch?v=aBSwgDWLHtg',
  ],
  'low-hurdle-hop-to-reactive-color-call': [
    'https://www.youtube.com/watch?v=QEk95UCvmwg',
    'https://www.youtube.com/watch?v=4nTDP0G3nhc',
    'https://www.youtube.com/watch?v=x8-eq7RNsaQ',
  ],
  'mirror-bound-and-cut-duel': [
    'https://www.youtube.com/watch?v=Wm9vYLsJbi0',
    'https://www.youtube.com/watch?v=Pb15pCX16H8',
    'https://www.youtube.com/watch?v=atcDcplGsdI',
  ],
}

const NEW_OUTPUT_SUBROLES = [
  ['single_leg_elastic_control', 'Single-Leg Elastic Control', 'Unilateral hop, bound, and stick progressions with landing accountability.', 340],
  ['reactive_jump', 'Reactive Jump', 'Hurdle, box, and reactive jump contacts with quality gates.', 341],
  ['multidirectional_elastic_power', 'Multidirectional Elastic Power', 'Diagonal, curved, and carioca-style elastic projection.', 342],
  ['multidirectional_elastic_control', 'Multidirectional Elastic Control', 'Rotational and reorientation jump landings with stick requirements.', 343],
  ['depth_reactive_jump', 'Depth Reactive Jump', 'Depth-drop and reactive rebound progressions.', 344],
  ['vertical_elastic_power', 'Vertical Elastic Power', 'High vertical plyometric contacts with controlled finish.', 345],
  ['upper_body_trunk_elasticity', 'Upper-Body / Trunk Elasticity', 'Medicine-ball and trunk-linked elastic output.', 346],
]

function detectMergeSlugs(slugs) {
  const exclude = new Set([
    '205_coaching_high_impact_level_3_4_infrastructure_and_seed.sql',
    '206_coaching_high_impact_level_3_4_cards.sql',
  ])
  const merge = new Set()
  for (const slug of slugs) {
    for (const file of fs.readdirSync(MIG_DIR)) {
      if (!file.endsWith('.sql') || exclude.has(file)) continue
      const content = fs.readFileSync(path.join(MIG_DIR, file), 'utf8')
      if (content.includes(`'${slug}'`)) {
        merge.add(slug)
        break
      }
    }
  }
  return merge
}

function normalizeCard(c) {
  const slug = SLUG_OVERRIDES[c.slug] ?? c.slug
  const phaseProfile = Array.isArray(c.phaseProfile) ? (c.phaseProfile[0] ?? {}) : (c.phaseProfile ?? {})
  const pairing = c.pairingLogic ?? {}
  return {
    ...c,
    slug,
    subrole: SUBROLE_MAP[c.subrole] ?? c.subrole,
    phaseProfile,
    pairingLogic: {
      pairs_well_before: pairing.pairsWellBefore ?? pairing.pairs_well_before ?? [],
      pairs_well_after: pairing.pairsWellAfter ?? pairing.pairs_well_after ?? [],
      good_for_sessions: pairing.goodForSessions ?? pairing.good_for_sessions ?? [],
      avoid_before: pairing.avoidBefore ?? pairing.avoid_before ?? [],
      avoid_after: pairing.avoidAfter ?? pairing.avoid_after ?? [],
      do_not_use_when: pairing.doNotUseWhen ?? pairing.do_not_use_when ?? [],
    },
  }
}

const CARDS = (raw.cards ?? []).map(normalizeCard)
const MERGE_SLUGS = detectMergeSlugs(CARDS.map((c) => c.slug))
const INSERT_CARDS = CARDS.filter((c) => !MERGE_SLUGS.has(c.slug))
const SLUGS = CARDS.map((c) => c.slug)

const PHASE_ORDER_BASE = { output: 726 }

const COHORT_KEYS = [
  'youth_beginner', 'youth_intermediate', 'teen', 'adult_beginner',
  'adult_advanced', 'older_adult', 'pregnancy_postpartum',
]

const FACET_TABLE = {
  tenet: 'tenet',
  methodology: 'methodology',
  physiology: 'physiological_emphasis',
  pattern: 'movement_pattern',
  equipment: 'equipment',
  body_regions: 'body_region',
}

const FACET_TAG_FIELD = {
  tenet: 'tenets',
  methodology: 'methodologies',
  physiology: 'physiology',
  pattern: 'patterns',
  equipment: 'equipment',
  body_regions: 'bodyRegions',
}

const VALIDATION_EDU = {
  title: 'High-impact level 3-4 Output without conditioning drift or Prepare & Access misuse',
  short_summary:
    'Level-3 and level-4 plyometric and reactive Output contacts must stay fresh, low-volume, and quality-gated — not warm-up filler, not HIIT, and not late-session fatigue work.',
  what_it_is: lib.title ?? 'Top 50 High-Impact Level 3-4 Exercise Library',
  why_it_matters:
    'Impact levels 3 and 4 bridge controlled landings into useful elastic output. Contacts only count when posture, projection, braking, and reset speed stay repeatable.',
  programming_guidance:
    raw.sourceNotes?.programmingRule
    ?? 'Place after Prepare & Access and Movement Intelligence while fresh; before heavy strength or conditioning; stop when contact quality degrades.',
  common_misuse:
    'Do not use as warm-up prep, conditioning finisher, or volume chase. Progress one variable at a time and stop when landings get loud, slow, or misaligned.',
}

function sqlStr(s) {
  return `'${String(s ?? '').replace(/'/g, "''")}'`
}

function jsonb(obj) {
  return `'${JSON.stringify(obj).replace(/'/g, "''")}'::jsonb`
}

function sqlBool(v) {
  return v ? 'TRUE' : 'FALSE'
}

function sqlTextArray(arr) {
  const items = (arr ?? []).map(sqlStr).join(', ')
  return `ARRAY[${items}]::text[]`
}

function sqlInt(v) {
  return v == null ? 'NULL' : String(v)
}

function normalizeSupervision(val) {
  if (val === true) return 'required'
  if (val === false) return 'optional'
  if (val === 'optional') return 'recommended'
  return val ?? 'recommended'
}

function normalizeMovementRequirements(card) {
  const req = card.movementRequirements ?? {}
  const pp = card.phaseProfile ?? {}
  const safety = card.safety ?? {}
  return {
    primary_joint_actions: req.primaryJointActions ?? req.primary_joint_actions ?? [],
    primary_tissues: req.primaryTissues ?? req.primary_tissues ?? [],
    primary_motor_control_demands: req.primaryMotorControlDemands ?? req.primary_motor_control_demands ?? [],
    postural_shape: req.posturalShape ?? req.postural_shape ?? null,
    breathing_demand: req.breathingDemand ?? req.breathing_demand ?? null,
    balance_demand: req.balanceDemand ?? req.balance_demand ?? null,
    coordination_demand: req.coordinationDemand ?? req.coordination_demand ?? null,
    impact_level: req.impactLevel ?? req.impact_level ?? pp.impactLevel ?? safety.impactLevel ?? 0,
    surface_needs: req.surfaceNeeds ?? req.surface_needs ?? null,
    readiness_prerequisites: req.readinessPrerequisites ?? req.readiness_prerequisites ?? [],
  }
}

function normalizeCoachingExecution(card) {
  const exec = card.coachingExecution ?? {}
  const cues = exec.athleteCues ?? exec.athlete_cues ?? exec.coachingCues ?? exec.coach_cues ?? []
  const quality = exec.qualityGates ?? exec.quality_gate ?? []
  const stops = exec.stopSigns ?? exec.stop_signs ?? []
  return {
    movement_description: exec.movementDescription ?? exec.movement_description ?? card.description,
    setup: exec.setup ?? [],
    execution_steps: exec.executionSteps ?? exec.execution_steps ?? [],
    coach_cues: exec.coachCues ?? exec.coach_cues ?? cues,
    athlete_cues: cues,
    quality_gate: quality,
    common_faults: exec.commonFaults ?? exec.common_faults ?? [],
    stop_signs: stops,
  }
}

function youtubeLinks(card) {
  return YOUTUBE_BY_SLUG[card.slug] ?? []
}

function mediaLibrary(card) {
  const refs = youtubeLinks(card)
  const internal = (card.mediaInternalNotes ?? []).filter(
    (n) => !/card v2 source basis/i.test(n),
  )
  return {
    demo_video_sources: [],
    coaching_articles: [],
    clinical_or_sport_science_references: refs,
    internal_notes: [
      ...internal,
      'Client-facing video embeds use watch?v= URLs in clinical_or_sport_science_references.',
      'Film front and side views when possible; stop sets when contact quality fades.',
    ],
  }
}

function participantStructure(card) {
  const name = card.name.toLowerCase()
  if (name.includes('mirror') && name.includes('duel')) return 'pairs'
  if (name.includes('partner') || name.includes('mirror')) return 'pairs'
  const hasPartner = (card.equipment ?? []).some((e) => e.key === 'partner')
  if (hasPartner) return 'pairs'
  return 'individual'
}

function parseDosage(card) {
  const d = card.dosage ?? {}
  if (d.defaultSets != null || d.default_sets != null) {
    return {
      volume_unit: d.volumeUnit ?? d.volume_unit ?? 'reps',
      default_sets: d.defaultSets ?? d.default_sets ?? 3,
      default_reps: d.defaultReps ?? d.default_reps ?? null,
      default_work_seconds: d.defaultWorkSeconds ?? d.default_work_seconds ?? null,
      default_rest_seconds: d.defaultRestSeconds ?? d.default_rest_seconds ?? 75,
      est_seconds_per_set: d.estSecondsPerSet ?? d.est_seconds_per_set ?? 35,
      default_rpe_min: d.defaultRpeMin ?? d.default_rpe_min ?? 6,
      default_rpe_max: d.defaultRpeMax ?? d.default_rpe_max ?? 8,
    }
  }

  const dose = String(d.defaultDose ?? '')
  const setsMatch = dose.match(/^(\d+)\s*x/i) ?? String(d.sets ?? '').match(/(\d+)/)
  const sets = setsMatch ? Number(setsMatch[1]) : 3

  const repsMatch = dose.match(/x\s*(\d+)(?:-(\d+))?/i)
  const reps = repsMatch ? Number(repsMatch[2] ?? repsMatch[1]) : null

  const restMatch = dose.match(/(\d+)(?:-(\d+))?\s*s(?:ec)?\s*rest/i)
    ?? String(d.rest ?? '').match(/(\d+)/)
  let rest = 75
  if (restMatch) {
    const a = Number(restMatch[1])
    const b = restMatch[2] ? Number(restMatch[2]) : a
    rest = Math.round((a + b) / 2)
  }

  const impact = card.safety?.impactLevel ?? card.movementRequirements?.impactLevel ?? 3
  const unit = /contact|rebound|hop|bound/i.test(dose) ? 'contacts' : 'reps'

  return {
    volume_unit: unit,
    default_sets: sets,
    default_reps: reps,
    default_work_seconds: null,
    default_rest_seconds: rest,
    est_seconds_per_set: impact >= 4 ? 45 : 35,
    default_rpe_min: impact >= 4 ? 7 : 6,
    default_rpe_max: impact >= 4 ? 9 : 8,
  }
}

function scalingGuidance(card, cohortKey) {
  const s = card.scaling ?? {}
  const camel = {
    youth_beginner: 'forYouth',
    youth_intermediate: 'forYouth',
    teen: 'forTeens',
    adult_beginner: 'forAdults',
    adult_advanced: 'forAdults',
    older_adult: 'forOlderAdults',
    pregnancy_postpartum: 'forPregnancyPostpartum',
  }[cohortKey]
  return s[camel] ?? card.scalingGuidance ?? 'Scale amplitude, contacts, speed, and cue uncertainty before adding complexity.'
}

function slotName(slot) {
  return slot.split('_').map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(' ')
}

function slotRows() {
  const seen = new Map()
  const phaseCounters = {}
  for (const card of CARDS) {
    const key = `${card.primaryPhaseKey}|${card.slot}`
    if (!seen.has(key)) {
      const base = PHASE_ORDER_BASE[card.primaryPhaseKey] ?? 726
      phaseCounters[card.primaryPhaseKey] = (phaseCounters[card.primaryPhaseKey] ?? 0) + 1
      seen.set(key, {
        phase: card.primaryPhaseKey,
        slot: card.slot,
        subrole: card.subrole,
        order_index: base + phaseCounters[card.primaryPhaseKey],
        name: slotName(card.slot),
        description: `${card.family} — ${card.name}.`,
      })
    }
  }
  return [...seen.values()]
}

function skillForCard(card) {
  const risk = card.safety?.riskLevel ?? card.safety?.risk_level ?? 2
  const impact = card.safety?.impactLevel ?? card.safety?.impact_level ?? 2
  if (risk >= 4 || impact >= 4) return 'ADVANCED'
  if (risk >= 3 || impact >= 3) return 'INTERMEDIATE'
  return 'BEGINNER'
}

function difficultyForCard(card) {
  const impact = card.safety?.impactLevel ?? card.safety?.impact_level ?? 3
  const risk = card.safety?.riskLevel ?? card.safety?.risk_level ?? 3
  const technical = Math.min(10, Math.max(3, impact + 2))
  const load = Math.min(10, Math.max(3, impact + 1))
  const complexity = Math.min(10, Math.max(3, risk + 1))
  const overall = Math.max(technical, load, complexity)
  const attention = impact >= 4 || participantStructure(card) !== 'individual' ? 'high' : 'moderate'
  return {
    technical,
    load,
    complexity,
    overall,
    recommended_age_min: impact >= 4 ? 10 : 8,
    recommended_age_max: null,
    attention_demand: attention,
  }
}

function normalizeRegimen(card) {
  const r = card.regimen ?? {}
  return {
    can_be_daily: r.canBeDaily ?? r.can_be_daily ?? false,
    weekly_max_frequency: r.weeklyMaxFrequency ?? r.weekly_max_frequency ?? 2,
    minimum_hours_between_hard_exposures: r.minimumHoursBetweenHardExposures ?? r.minimum_hours_between_hard_exposures ?? 48,
    counts_as_high_intensity: r.countsAsHighIntensity ?? r.counts_as_high_intensity ?? true,
    counts_as_high_impact: r.countsAsHighImpact ?? r.counts_as_high_impact ?? true,
    counts_as_neural: r.countsAsNeural ?? r.counts_as_neural ?? true,
    counts_as_tissue_stress: r.countsAsTissueStress ?? r.counts_as_tissue_stress ?? true,
    counts_as_conditioning: r.countsAsConditioning ?? r.counts_as_conditioning ?? false,
  }
}

function normalizeSafety(card) {
  const s = card.safety ?? {}
  return {
    risk_level: s.riskLevel ?? s.risk_level ?? 3,
    impact_level: s.impactLevel ?? s.impact_level ?? 3,
    requires_spotting: s.requiresSpotting ?? s.requires_spotting ?? false,
    requires_coach_supervision: normalizeSupervision(s.requiresCoachSupervision ?? s.requires_coach_supervision),
    readiness_checks: s.readinessChecks ?? s.readiness_checks ?? [],
    contraindications: s.contraindications ?? [],
    common_substitutions: s.commonSubstitutions ?? s.common_substitutions ?? [],
  }
}

function normalizePhaseProfile(card) {
  const pp = card.phaseProfile ?? {}
  return {
    role: pp.role ?? 'primary',
    fit_weight: pp.fitWeight ?? pp.fit_weight ?? 5,
    freshness_required: pp.freshnessRequired ?? pp.freshness_required ?? true,
    fatigue_sensitivity: pp.fatigueSensitivity ?? pp.fatigue_sensitivity ?? 5,
    fatigue_cost: pp.fatigueCost ?? pp.fatigue_cost ?? 3,
    technical_complexity: pp.technicalComplexity ?? pp.technical_complexity ?? 3,
    impact_level: pp.impactLevel ?? pp.impact_level ?? card.safety?.impactLevel ?? 3,
    intensity_ceiling: pp.intensityCeiling ?? pp.intensity_ceiling ?? 'high',
  }
}

function movementRequirementsJson(card) {
  return jsonb(normalizeMovementRequirements(card))
}

// ── 205: infrastructure + seed ─────────────────────────────────────────────

let seedSql = `-- High-impact level 3-4 Output exercise library infrastructure and ${INSERT_CARDS.length}-card seed.
-- IDEMPOTENT. Generated by scripts/generate-205-high-impact-level-3-4.mjs (migrations 205/206)
-- ${CARDS.length} total cards (${INSERT_CARDS.length} insert, ${MERGE_SLUGS.size} merge).
-- Library: ${lib.title ?? 'Top 50 High-Impact Level 3-4 Exercise Library'}

ALTER TABLE coaching.exercise DROP CONSTRAINT IF EXISTS exercise_phase_subrole_check;
ALTER TABLE coaching.exercise ADD CONSTRAINT exercise_phase_subrole_check
  CHECK (phase_subrole IS NULL OR phase_subrole IN (
    'raise', 'mobilize', 'activate', 'integrate', 'potentiate_bridge',
    'shape_position_intelligence', 'shape_control', 'inversion_foundation', 'rolling_transition',
    'locomotion_coordination', 'rotation_inversion_tumbling_foundations', 'coordinate',
    'locomotion_sprint_mechanics', 'balance_coordination_rhythm', 'perception_action_reactive_movement',
    'acceleration_start_speed', 'max_velocity_exposure', 'elastic_stiffness_plyometric_rudiments',
    'jump_throw_explosive_power', 'deceleration_cod_power', 'reactive_agility_tumbling_output',
    'single_leg_elastic_control', 'reactive_jump', 'multidirectional_elastic_power',
    'multidirectional_elastic_control', 'depth_reactive_jump', 'vertical_elastic_power',
    'upper_body_trunk_elasticity',
    'squat_knee_dominant_strength', 'hinge_posterior_chain_strength', 'upper_body_push_strength',
    'pull_hang_grip_strength', 'carry_trunk_loaded_bracing_strength', 'frontal_plane_lower_body_strength',
    'rotational_force_transfer_strength',
    'tissue_capacity_isometric_eccentric_accessory', 'landing_braking_control',
    'single_leg_balance_foot_ankle_hip_control', 'trunk_pelvis_anti_movement_control',
    'scapular_wrist_hand_support_resilience', 'slow_eccentric_isometric_joint_resilience',
    'conditioning_intervals', 'bodyweight_strength_endurance', 'low_amplitude_elastic_conditioning',
    'crawl_carry_repeatability', 'breathing_downshift'
  ));

INSERT INTO coaching.phase_subrole (key, name, description, sort_order, phase_id)
SELECT v.key, v.name, v.description, v.sort_order, sp.id
FROM coaching.session_phase sp
CROSS JOIN (VALUES
${NEW_OUTPUT_SUBROLES.map(([k, n, d, o]) => `  (${sqlStr(k)}, ${sqlStr(n)}, ${sqlStr(d)}, ${o})`).join(',\n')}
) AS v(key, name, description, sort_order)
WHERE sp.key = 'output'
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  sort_order = EXCLUDED.sort_order,
  phase_id = EXCLUDED.phase_id;

`

const slots = slotRows()
for (const phase of [...new Set(slots.map((s) => s.phase))]) {
  const phaseSlots = slots.filter((s) => s.phase === phase)
  seedSql += `-- ${phase} high-impact level 3-4 slots\n`
  seedSql += `INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity, subrole_key)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity, v.subrole_key
FROM coaching.session_phase sp
CROSS JOIN (VALUES\n`
  seedSql += phaseSlots.map((s) =>
    `  (${sqlStr(s.slot)}, ${sqlStr(s.name)}, ${sqlStr(s.description)}, ${s.order_index}, 5, ${sqlStr(s.subrole)})`,
  ).join(',\n')
  seedSql += `
) AS v(key, name, description, order_index, freshness_sensitivity, subrole_key)
WHERE sp.key = ${sqlStr(phase)}
ON CONFLICT (key) DO UPDATE SET
  name = EXCLUDED.name,
  description = EXCLUDED.description,
  phase_id = EXCLUDED.phase_id,
  order_index = EXCLUDED.order_index,
  freshness_sensitivity = EXCLUDED.freshness_sensitivity,
  subrole_key = EXCLUDED.subrole_key;

`
}

if (INSERT_CARDS.length > 0) {
  seedSql += `INSERT INTO coaching.exercise (
  facility_id, name, slug, description, sport_id, skill_level, age_min,
  default_sets, default_reps, default_work_seconds, default_rest_seconds, est_seconds_per_set,
  is_published, visibility, participant_structure,
  card_summary, coach_language, athlete_language,
  movement_family, primary_phase_key, phase_subrole, primary_order_slot,
  movement_requirements, coaching_execution
)
SELECT
  f.id,
  d.name, d.slug, d.description,
  (SELECT id FROM coaching.sport WHERE key = 'fitness'),
  d.skill::public.skill_level,
  d.age_min,
  d.sets, d.reps, d.work, d.rest, d.est,
  TRUE, 'facility', d.participant,
  d.summary, d.coach_lang, d.athlete_lang,
  d.family, d.phase_key, d.subrole, d.slot,
  d.req::jsonb, d.exec::jsonb
FROM (VALUES\n`

  seedSql += INSERT_CARDS.map((card) => {
    const d = parseDosage(card)
    const skill = skillForCard(card)
    return `  (${sqlStr(card.name)}, ${sqlStr(card.slug)}, ${sqlStr(card.description)}, ${sqlStr(skill)}, 8, ${sqlInt(d.default_sets)}, ${sqlInt(d.default_reps)}, ${sqlInt(d.default_work_seconds)}, ${sqlInt(d.default_rest_seconds)}, ${sqlInt(d.est_seconds_per_set)}, ${sqlStr(participantStructure(card))}, ${sqlStr(card.cardSummary)}, ${sqlStr(card.coachLanguage)}, ${sqlStr(card.athleteLanguage)}, ${sqlStr(card.family)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(card.subrole)}, ${sqlStr(card.slot)}, ${jsonb(normalizeMovementRequirements(card)).replace('::jsonb', '')}::jsonb, ${jsonb(normalizeCoachingExecution(card)).replace('::jsonb', '')}::jsonb)`
  }).join(',\n')

  seedSql += `
) AS d(name, slug, description, skill, age_min, sets, reps, work, rest, est, participant, summary, coach_lang, athlete_lang, family, phase_key, subrole, slot, req, exec)
CROSS JOIN public.facility f
ON CONFLICT (facility_id, slug) DO NOTHING;

`
}

function skeletonTagsFor(cards) {
  for (const facet of ['tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region']) {
    const table = FACET_TABLE[facet === 'body_region' ? 'body_regions' : facet]
    const field = facet === 'body_region' ? 'bodyRegions' : FACET_TAG_FIELD[facet]
    const facetType = facet
    const rows = []
    for (const card of cards) {
      const tags = card[field] ?? []
      for (const t of tags) {
        rows.push(`  (${sqlStr(card.slug)}, ${sqlStr(t.key)}, ${t.weight})`)
      }
    }
    if (rows.length === 0) continue
    seedSql += `INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, '${facetType}', f.id, v.weight
FROM (VALUES\n${rows.join(',\n')}
) AS v(slug, fkey, weight)
JOIN coaching.exercise e ON e.slug = v.slug
JOIN coaching.${table} f ON f.key = v.fkey
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

`
  }
}

if (INSERT_CARDS.length > 0) skeletonTagsFor(INSERT_CARDS)

if (INSERT_CARDS.length > 0) {
  seedSql += `INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, COALESCE(m.fit_weight, 5), COALESCE(m.role, 'primary'), m.slot, pos.order_index,
  COALESCE(m.freshness_required, TRUE), COALESCE(m.fatigue_sensitivity, 5), COALESCE(m.fatigue_cost, 3),
  COALESCE(m.technical_complexity, 3), COALESCE(m.impact_level, 3), COALESCE(m.intensity_ceiling, 'high')
FROM (VALUES\n`
  seedSql += INSERT_CARDS.map((card) => {
    const pp = normalizePhaseProfile(card)
    return `  (${sqlStr(card.slug)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(card.slot)}, ${sqlStr(pp.role)}, ${sqlInt(pp.fit_weight)}, ${sqlBool(pp.freshness_required)}, ${sqlInt(pp.fatigue_sensitivity)}, ${sqlInt(pp.fatigue_cost)}, ${sqlInt(pp.technical_complexity)}, ${sqlInt(pp.impact_level)}, ${sqlStr(pp.intensity_ceiling)})`
  }).join(',\n')
  seedSql += `
) AS m(slug, phase_key, slot, role, fit_weight, freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling)
JOIN coaching.exercise e ON e.slug = m.slug
JOIN coaching.session_phase sp ON sp.key = m.phase_key
JOIN coaching.phase_order_slot pos ON pos.key = m.slot AND pos.phase_id = sp.id
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  role = EXCLUDED.role, order_slot = EXCLUDED.order_slot, fit_weight = EXCLUDED.fit_weight,
  freshness_required = EXCLUDED.freshness_required, fatigue_sensitivity = EXCLUDED.fatigue_sensitivity,
  fatigue_cost = EXCLUDED.fatigue_cost, technical_complexity = EXCLUDED.technical_complexity,
  impact_level = EXCLUDED.impact_level, intensity_ceiling = EXCLUDED.intensity_ceiling;

`

  seedSql += `INSERT INTO coaching.exercise_dosage_profile (
  exercise_id, profile_name, is_default, volume_unit, default_sets, default_reps,
  default_work_seconds, default_rest_seconds, default_distance, est_seconds_per_set, default_rpe_min, default_rpe_max
)
SELECT e.id, 'Default', TRUE, m.unit, m.sets, m.reps, m.work, m.rest, NULL::integer, m.est, m.rpe_min, m.rpe_max
FROM (VALUES\n`
  seedSql += INSERT_CARDS.map((card) => {
    const d = parseDosage(card)
    return `  (${sqlStr(card.slug)}, ${sqlStr(d.volume_unit)}, ${sqlInt(d.default_sets)}, ${sqlInt(d.default_reps)}, ${sqlInt(d.default_work_seconds)}, ${sqlInt(d.default_rest_seconds)}, ${sqlInt(d.est_seconds_per_set)}, ${sqlInt(d.default_rpe_min)}, ${sqlInt(d.default_rpe_max)})`
  }).join(',\n')
  seedSql += `
) AS m(slug, unit, sets, reps, work, rest, est, rpe_min, rpe_max)
JOIN coaching.exercise e ON e.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_dosage_profile d WHERE d.exercise_id = e.id AND d.profile_name = 'Default');

`

  seedSql += `INSERT INTO coaching.exercise_safety_profile (
  exercise_id, risk_level, impact_level, requires_spotting, requires_coach_supervision,
  readiness_checks, contraindications, common_substitutions
)
SELECT e.id, COALESCE(m.risk_level, 3), COALESCE(m.impact_level, 3), COALESCE(m.requires_spotting, FALSE),
  COALESCE(m.requires_coach_supervision, 'required'),
  COALESCE(m.readiness_checks, ARRAY[]::text[]),
  COALESCE(m.contraindications, ARRAY[]::text[]),
  COALESCE(m.common_substitutions, ARRAY[]::text[])
FROM (VALUES\n`
  seedSql += INSERT_CARDS.map((card) => {
    const s = normalizeSafety(card)
    return `  (${sqlStr(card.slug)}, ${sqlInt(s.risk_level)}, ${sqlInt(s.impact_level)}, ${sqlBool(s.requires_spotting)}, ${sqlStr(s.requires_coach_supervision)}, ${sqlTextArray(s.readiness_checks)}, ${sqlTextArray(s.contraindications)}, ${sqlTextArray(s.common_substitutions)})`
  }).join(',\n')
  seedSql += `
) AS m(slug, risk_level, impact_level, requires_spotting, requires_coach_supervision, readiness_checks, contraindications, common_substitutions)
JOIN coaching.exercise e ON e.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_safety_profile s WHERE s.exercise_id = e.id);

`

  seedSql += `INSERT INTO coaching.exercise_regimen_rule (
  exercise_id, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures,
  counts_as_high_intensity, counts_as_high_impact, counts_as_neural, counts_as_tissue_stress, counts_as_conditioning
)
SELECT e.id,
  COALESCE(m.can_be_daily, FALSE),
  COALESCE(m.weekly_max_frequency, 2),
  COALESCE(m.minimum_hours_between_hard_exposures, 48),
  COALESCE(m.counts_as_high_intensity, TRUE),
  COALESCE(m.counts_as_high_impact, TRUE),
  COALESCE(m.counts_as_neural, TRUE),
  COALESCE(m.counts_as_tissue_stress, TRUE),
  COALESCE(m.counts_as_conditioning, FALSE)
FROM (VALUES\n`
  seedSql += INSERT_CARDS.map((card) => {
    const r = normalizeRegimen(card)
    return `  (${sqlStr(card.slug)}, ${sqlBool(r.can_be_daily)}, ${sqlInt(r.weekly_max_frequency)}, ${sqlInt(r.minimum_hours_between_hard_exposures)}, ${sqlBool(r.counts_as_high_intensity)}, ${sqlBool(r.counts_as_high_impact)}, ${sqlBool(r.counts_as_neural)}, ${sqlBool(r.counts_as_tissue_stress)}, ${sqlBool(r.counts_as_conditioning)})`
  }).join(',\n')
  seedSql += `
) AS m(slug, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures, counts_as_high_intensity, counts_as_high_impact, counts_as_neural, counts_as_tissue_stress, counts_as_conditioning)
JOIN coaching.exercise e ON e.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_regimen_rule r WHERE r.exercise_id = e.id);

`

  for (const ck of COHORT_KEYS) {
    seedSql += `INSERT INTO coaching.exercise_scaling_profile (exercise_id, cohort_key, label, scale_direction, load_guidance, gender_specific_notes)
SELECT e.id, '${ck}', '${ck.replace(/_/g, ' ')}', 'baseline', v.guidance, NULL
FROM (VALUES\n`
    seedSql += INSERT_CARDS.map((card) =>
      `  (${sqlStr(card.slug)}, ${sqlStr(scalingGuidance(card, ck))})`,
    ).join(',\n')
    seedSql += `
) AS v(slug, guidance)
JOIN coaching.exercise e ON e.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM coaching.exercise_scaling_profile sp
  WHERE sp.exercise_id = e.id AND sp.cohort_key = '${ck}'
);

`
  }
}

seedSql += `INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_matters, programming_guidance, common_misuse
)
VALUES (
  'validation_rule',
  'high_impact_level_3_4_readiness',
  NULL,
  ${sqlStr(VALIDATION_EDU.title)},
  ${sqlStr(VALIDATION_EDU.short_summary)},
  ${sqlStr(VALIDATION_EDU.what_it_is)},
  ${sqlStr(VALIDATION_EDU.why_it_matters)},
  ${sqlStr(VALIDATION_EDU.programming_guidance)},
  ${sqlStr(VALIDATION_EDU.common_misuse)}
)
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_matters = EXCLUDED.why_it_matters,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  updated_at = now();
`

// ── 206: full hydration ──────────────────────────────────────────────────────

let hydrateSql = `-- High-impact level 3-4 Output ${CARDS.length}-card full hydration (card v2 + client-facing fields).
-- IDEMPOTENT. Generated by scripts/generate-205-high-impact-level-3-4.mjs (migrations 205/206)
-- ${INSERT_CARDS.length} insert + ${MERGE_SLUGS.size} merge

`

for (const card of CARDS) {
  const d = parseDosage(card)
  const pp = normalizePhaseProfile(card)
  const reg = normalizeRegimen(card)
  const saf = normalizeSafety(card)
  const diff = difficultyForCard(card)

  hydrateSql += `-- ${card.name} (${card.slug})
UPDATE coaching.exercise SET
  name = ${sqlStr(card.name)},
  description = ${sqlStr(card.description)},
  card_summary = ${sqlStr(card.cardSummary)},
  coach_language = ${sqlStr(card.coachLanguage)},
  athlete_language = ${sqlStr(card.athleteLanguage)},
  movement_family = ${sqlStr(card.family)},
  primary_phase_key = ${sqlStr(card.primaryPhaseKey)},
  phase_subrole = ${sqlStr(card.subrole)},
  primary_order_slot = ${sqlStr(card.slot)},
  default_sets = ${sqlInt(d.default_sets)},
  default_reps = ${sqlInt(d.default_reps)},
  default_work_seconds = ${sqlInt(d.default_work_seconds)},
  default_rest_seconds = ${sqlInt(d.default_rest_seconds)},
  est_seconds_per_set = ${sqlInt(d.est_seconds_per_set)},
  is_published = TRUE,
  visibility = 'facility',
  participant_structure = ${sqlStr(participantStructure(card))},
  movement_requirements = ${movementRequirementsJson(card)},
  coaching_execution = ${jsonb(normalizeCoachingExecution(card))},
  pairing_logic = ${jsonb(card.pairingLogic)},
  media_library = ${jsonb(mediaLibrary(card))},
  updated_at = now()
WHERE slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, ${sqlInt(pp.fit_weight)}, ${sqlStr(pp.role)}, ${sqlStr(card.slot)}, pos.order_index,
  ${sqlBool(pp.freshness_required)}, ${sqlInt(pp.fatigue_sensitivity)}, ${sqlInt(pp.fatigue_cost)},
  ${sqlInt(pp.technical_complexity)}, ${sqlInt(pp.impact_level)}, ${sqlStr(pp.intensity_ceiling)}
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = ${sqlStr(card.primaryPhaseKey)}
JOIN coaching.phase_order_slot pos ON pos.key = ${sqlStr(card.slot)} AND pos.phase_id = sp.id
WHERE e.slug = ${sqlStr(card.slug)}
ON CONFLICT (exercise_id, phase_id) DO UPDATE SET
  role = EXCLUDED.role,
  order_slot = EXCLUDED.order_slot,
  order_index = EXCLUDED.order_index,
  fit_weight = EXCLUDED.fit_weight,
  freshness_required = EXCLUDED.freshness_required,
  fatigue_sensitivity = EXCLUDED.fatigue_sensitivity,
  fatigue_cost = EXCLUDED.fatigue_cost,
  technical_complexity = EXCLUDED.technical_complexity,
  impact_level = EXCLUDED.impact_level,
  intensity_ceiling = EXCLUDED.intensity_ceiling;

UPDATE coaching.exercise_dosage_profile d SET
  volume_unit = ${sqlStr(d.volume_unit)},
  default_sets = ${sqlInt(d.default_sets)},
  default_reps = ${sqlInt(d.default_reps)},
  default_work_seconds = ${sqlInt(d.default_work_seconds)},
  default_rest_seconds = ${sqlInt(d.default_rest_seconds)},
  est_seconds_per_set = ${sqlInt(d.est_seconds_per_set)},
  default_rpe_min = ${sqlInt(d.default_rpe_min)},
  default_rpe_max = ${sqlInt(d.default_rpe_max)}
FROM coaching.exercise e
WHERE d.exercise_id = e.id AND d.profile_name = 'Default' AND e.slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_dosage_profile (
  exercise_id, profile_name, is_default, volume_unit, default_sets, default_reps,
  default_work_seconds, default_rest_seconds, default_distance, est_seconds_per_set, default_rpe_min, default_rpe_max
)
SELECT e.id, 'Default', TRUE, ${sqlStr(d.volume_unit)}, ${sqlInt(d.default_sets)}, ${sqlInt(d.default_reps)},
  ${sqlInt(d.default_work_seconds)}, ${sqlInt(d.default_rest_seconds)}, NULL::integer,
  ${sqlInt(d.est_seconds_per_set)}, ${sqlInt(d.default_rpe_min)}, ${sqlInt(d.default_rpe_max)}
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_dosage_profile dp WHERE dp.exercise_id = e.id AND dp.profile_name = 'Default');

UPDATE coaching.exercise_regimen_rule r SET
  can_be_daily = ${sqlBool(reg.can_be_daily)},
  weekly_max_frequency = ${sqlInt(reg.weekly_max_frequency)},
  minimum_hours_between_hard_exposures = ${sqlInt(reg.minimum_hours_between_hard_exposures)},
  counts_as_high_intensity = ${sqlBool(reg.counts_as_high_intensity)},
  counts_as_high_impact = ${sqlBool(reg.counts_as_high_impact)},
  counts_as_neural = ${sqlBool(reg.counts_as_neural)},
  counts_as_tissue_stress = ${sqlBool(reg.counts_as_tissue_stress)},
  counts_as_conditioning = ${sqlBool(reg.counts_as_conditioning)}
FROM coaching.exercise e
WHERE r.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_regimen_rule (
  exercise_id, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures,
  counts_as_high_intensity, counts_as_high_impact, counts_as_neural, counts_as_tissue_stress, counts_as_conditioning
)
SELECT e.id, ${sqlBool(reg.can_be_daily)}, ${sqlInt(reg.weekly_max_frequency)}, ${sqlInt(reg.minimum_hours_between_hard_exposures)},
  ${sqlBool(reg.counts_as_high_intensity)}, ${sqlBool(reg.counts_as_high_impact)}, ${sqlBool(reg.counts_as_neural)},
  ${sqlBool(reg.counts_as_tissue_stress)}, ${sqlBool(reg.counts_as_conditioning)}
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_regimen_rule rr WHERE rr.exercise_id = e.id);

UPDATE coaching.exercise_safety_profile s SET
  risk_level = ${sqlInt(saf.risk_level)},
  impact_level = ${sqlInt(saf.impact_level)},
  requires_spotting = ${sqlBool(saf.requires_spotting)},
  requires_coach_supervision = ${sqlStr(saf.requires_coach_supervision)},
  readiness_checks = ${sqlTextArray(saf.readiness_checks)},
  contraindications = ${sqlTextArray(saf.contraindications)},
  common_substitutions = ${sqlTextArray(saf.common_substitutions)}
FROM coaching.exercise e
WHERE s.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

INSERT INTO coaching.exercise_safety_profile (
  exercise_id, risk_level, impact_level, requires_spotting, requires_coach_supervision,
  readiness_checks, contraindications, common_substitutions
)
SELECT e.id, ${sqlInt(saf.risk_level)}, ${sqlInt(saf.impact_level)}, ${sqlBool(saf.requires_spotting)},
  ${sqlStr(saf.requires_coach_supervision)},
  ${sqlTextArray(saf.readiness_checks)}, ${sqlTextArray(saf.contraindications)}, ${sqlTextArray(saf.common_substitutions)}
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
  AND NOT EXISTS (SELECT 1 FROM coaching.exercise_safety_profile sp WHERE sp.exercise_id = e.id);

INSERT INTO coaching.exercise_difficulty_profile (
  exercise_id, technical, load, complexity, overall,
  recommended_age_min, recommended_age_max, attention_demand, source
)
SELECT e.id, ${sqlInt(diff.technical)}, ${sqlInt(diff.load)}, ${sqlInt(diff.complexity)}, ${sqlInt(diff.overall)},
  ${sqlInt(diff.recommended_age_min)}, NULL::integer, ${sqlStr(diff.attention_demand)}, 'derived'
FROM coaching.exercise e
WHERE e.slug = ${sqlStr(card.slug)}
ON CONFLICT (exercise_id) DO UPDATE SET
  technical = EXCLUDED.technical,
  load = EXCLUDED.load,
  complexity = EXCLUDED.complexity,
  overall = EXCLUDED.overall,
  recommended_age_min = EXCLUDED.recommended_age_min,
  attention_demand = EXCLUDED.attention_demand,
  updated_at = now();

`
}

hydrateSql += `-- Refresh weighted taxonomy tags
DELETE FROM coaching.exercise_tag t
USING coaching.exercise e
WHERE t.exercise_id = e.id
  AND e.slug IN (${SLUGS.map(sqlStr).join(', ')})
  AND t.facet_type IN ('tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region');

`

for (const [facetKey, table] of Object.entries(FACET_TABLE)) {
  const facetType = facetKey === 'body_regions' ? 'body_region' : facetKey
  const tagField = FACET_TAG_FIELD[facetKey]
  const rows = []
  for (const card of CARDS) {
    for (const t of card[tagField] ?? []) {
      rows.push(`  (${sqlStr(card.slug)}, ${sqlStr(t.key)}, ${t.weight})`)
    }
  }
  if (rows.length === 0) continue
  hydrateSql += `INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, '${facetType}', f.id, v.weight
FROM (VALUES\n${rows.join(',\n')}
) AS v(slug, fkey, weight)
JOIN coaching.exercise e ON e.slug = v.slug
JOIN coaching.${table} f ON f.key = v.fkey
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight;

`
}

for (const ck of COHORT_KEYS) {
  hydrateSql += `UPDATE coaching.exercise_scaling_profile sp SET load_guidance = v.guidance
FROM (VALUES\n`
  hydrateSql += CARDS.map((card) =>
    `  (${sqlStr(card.slug)}, ${sqlStr(scalingGuidance(card, ck))})`,
  ).join(',\n')
  hydrateSql += `
) AS v(slug, guidance)
JOIN coaching.exercise e ON e.slug = v.slug
WHERE sp.exercise_id = e.id AND sp.cohort_key = '${ck}';

INSERT INTO coaching.exercise_scaling_profile (exercise_id, cohort_key, label, scale_direction, load_guidance, gender_specific_notes)
SELECT e.id, '${ck}', '${ck.replace(/_/g, ' ')}', 'baseline', v.guidance, NULL
FROM (VALUES\n`
  hydrateSql += CARDS.map((card) =>
    `  (${sqlStr(card.slug)}, ${sqlStr(scalingGuidance(card, ck))})`,
  ).join(',\n')
  hydrateSql += `
) AS v(slug, guidance)
JOIN coaching.exercise e ON e.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM coaching.exercise_scaling_profile sp
  WHERE sp.exercise_id = e.id AND sp.cohort_key = '${ck}'
);

`
}

hydrateSql += `-- Why-layer education
INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_works, why_it_matters, why_it_goes_here,
  programming_guidance, common_misuse, scaling_guidance
)
SELECT
  'exercise', e.slug, e.id, e.name, e.card_summary,
  e.description,
  v.why_works,
  'High-impact Output contacts require freshness, low volume, and clean landings before heavier strength or conditioning.',
  v.why_here,
  v.best_placement,
  v.misuse,
  v.scale_guidance
FROM (VALUES\n`
hydrateSql += CARDS.map((c) =>
  `  (${sqlStr(c.slug)}, ${sqlStr(c.whyItWorks)}, ${sqlStr(c.whyItGoesHere)}, ${sqlStr(c.bestPlacement)}, ${sqlStr(c.commonMisuse)}, ${sqlStr(c.scalingGuidance)})`,
).join(',\n')
hydrateSql += `
) AS v(slug, why_works, why_here, best_placement, misuse, scale_guidance)
JOIN coaching.exercise e ON e.slug = v.slug
ON CONFLICT (entity_type, entity_key, entity_id) DO UPDATE SET
  title = EXCLUDED.title,
  short_summary = EXCLUDED.short_summary,
  what_it_is = EXCLUDED.what_it_is,
  why_it_works = EXCLUDED.why_it_works,
  why_it_goes_here = EXCLUDED.why_it_goes_here,
  programming_guidance = EXCLUDED.programming_guidance,
  common_misuse = EXCLUDED.common_misuse,
  scaling_guidance = EXCLUDED.scaling_guidance,
  updated_at = now();
`

const seedPath = path.join(MIG_DIR, '205_coaching_high_impact_level_3_4_infrastructure_and_seed.sql')
const hydratePath = path.join(MIG_DIR, '206_coaching_high_impact_level_3_4_cards.sql')
fs.writeFileSync(seedPath, seedSql)
fs.writeFileSync(hydratePath, hydrateSql)
console.log('Wrote', seedPath)
console.log('Wrote', hydratePath, '—', CARDS.length, 'cards (', INSERT_CARDS.length, 'insert,', MERGE_SLUGS.size, 'merge)')
if (MERGE_SLUGS.size) console.log('Merge slugs:', [...MERGE_SLUGS].sort().join(', '))
