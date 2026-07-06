/**
 * Generates:
 *   backend/migrations/194_coaching_throwing_athletes_infrastructure_and_seed.sql
 *   backend/migrations/195_coaching_throwing_athletes_cards.sql
 *
 * Run: node scripts/generate-188-throwing-athletes.mjs
 */
import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const SOURCE = path.join(__dirname, 'data/throwers-throwing-athletes-all-cards.json')
const data = JSON.parse(fs.readFileSync(SOURCE, 'utf8'))

const SLUG_CONFLICTS = new Set([
  'wall-slide-with-lift-off',
  'kneeling-medicine-ball-chest-pass',
  'trap-bar-deadlift',
  'front-squat',
  'rear-foot-elevated-split-squat',
  'single-leg-romanian-deadlift',
  'lateral-bound-to-stick',
  'pallof-press-iso-hold',
  'suitcase-carry',
  'farmer-carry',
  'bird-dog-row',
])

function cardSlug(card) {
  return SLUG_CONFLICTS.has(card.slug) ? `throwing-athlete-${card.slug}` : card.slug
}

const CARDS = (data.cards ?? []).map((card) => ({
  ...card,
  slug: cardSlug(card),
}))

const SLUGS = CARDS.map((c) => c.slug)

const PHASE_ORDER_BASE = {
  prepare_and_access: 210,
  movement_intelligence: 710,
  output: 810,
  capacity: 520,
  resilience: 620,
}

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

const TAXONOMY_FIELD = {
  tenet: 'tenets',
  methodology: 'methodologies',
  physiology: 'physiology',
  pattern: 'patterns',
  equipment: 'equipment',
  body_region: 'bodyRegions',
}

const METHODOLOGY_KEY_MAP = {
  activation: 'mobility_flexibility',
  coordination: 'neural',
  isometrics_eccentrics: 'eccentric_negative',
  medicine_ball_power: 'plyometrics',
  neural_output: 'neural',
  perception_action_skill: 'neural',
  power: 'plyometrics',
  resistance_training: 'resistance_calisthenics',
  shoulder_elbow_resilience: 'eccentric_negative',
  strength_training: 'resistance_calisthenics',
  throwing_athlete_preparation: 'mobility_flexibility',
}

const PHYSIOLOGY_KEY_MAP = {
  deceleration_tolerance: 'control_stability',
  max_strength: 'force_tissue_capacity',
  mobility_access: 'control_stability',
  rate_of_force_development: 'neural_output_readiness',
  rotational_power: 'ssc_stiffness',
}

const TENET_KEY_MAP = {
  resilience: 'body_control',
}

const EQUIPMENT_KEY_MAP = {
  band: 'bands',
  band_optional: 'bands',
  band_or_assist_machine_optional: 'bands',
  band_or_cable: 'bands',
  barbell: 'barbell',
  barbell_optional: 'barbell',
  barbell_or_dumbbell: 'barbell',
  bench: 'bench',
  bench_or_floor: 'bench_or_floor',
  cable_machine_or_band: 'bands',
  dumbbell: 'dumbbell',
  dumbbell_optional: 'dumbbell',
  dumbbell_or_band: 'dumbbell',
  dumbbell_or_kettlebell: 'dumbbell',
  dumbbells_optional: 'dumbbells',
  dumbbells_or_kettlebells: 'dumbbells',
  light_dumbbell: 'dumbbell',
  light_dumbbells_optional: 'dumbbells',
  mini_band: 'mini_band',
  mini_band_optional: 'mini_band',
  plates: 'plates',
  plates_optional: 'plates',
  pull_up_bar: 'pull_up_bar',
  rack: 'squat_rack',
  rebound_safe_floor_or_wall: 'wall',
  wall_or_partner: 'wall',
  hammer_or_club_or_dumbbell: 'dumbbell',
  belt_or_harness: 'sled',
  cones_optional: 'cones',
}

const EQUIPMENT_SEED = [
  ['barbell', 'Barbell', 34],
  ['bench', 'Bench', 35],
  ['dumbbells', 'Dumbbells', 36],
  ['foam_roller', 'Foam Roller', 37],
  ['landmine', 'Landmine', 29],
  ['mini_band', 'Mini Band', 38],
  ['partner', 'Partner', 39],
  ['plates', 'Weight Plates', 28],
  ['pull_up_bar', 'Pull-Up Bar', 40],
  ['stability_ball', 'Stability Ball', 41],
  ['trap_bar', 'Trap Bar', 42],
  ['turf', 'Turf / Open Lane', 43],
  ['wall', 'Wall', 44],
  ['kettlebell', 'Kettlebell', 7],
]

const BODY_REGION_SEED = [
  ['thoracic_spine', 'Thoracic Spine', 14],
  ['rib_cage', 'Rib Cage', 15],
  ['pelvis', 'Pelvis', 16],
  ['elbow', 'Elbow', 17],
  ['wrist', 'Wrist', 18],
  ['full_body', 'Full Body', 19],
]

const PATTERN_SEED = [
  ['reach', 'Reach', 13],
  ['throw', 'Throw', 14],
  ['catch', 'Catch', 15],
  ['project', 'Project', 16],
]

const VALIDATION_EDU = {
  title: 'Throwing-athlete support work without pre-fatigue or wrong phase intent',
  short_summary:
    'Throwing mobility, med-ball power, lower-body force, trunk transfer, and shoulder/elbow capacity must stay phase-honest — fresh for Output throws, controlled for Resilience tissue work, and never disguised conditioning.',
  what_it_is:
    data.cluster?.purpose
    ?? 'Build athletes who can create force from the ground, transfer it through hips and trunk, express it through the arm, decelerate safely, and tolerate repeated throwing without turning support work into fatigue.',
  why_it_matters:
    'Overhead throwing is a full kinetic-chain task. Poor placement, short rest, or high volume after quality fades raises injury risk and steals from skill throwing.',
  programming_guidance:
    'High-speed throws, sprints, bounds, and medicine-ball outputs stay early, low volume, and fully rested; strength and tissue capacity are separated from skill throws when fatigue would corrupt mechanics.',
  common_misuse:
    'Do not turn prep into long mobility circuits, program med-ball work as conditioning, or stack shoulder/elbow capacity on top of high throwing volume when symptoms or velocity are already down.',
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
  return v == null || v === '' ? 'NULL' : String(v)
}

function parseRangeInt(val, fallback = null) {
  if (val == null || val === '') return fallback
  if (typeof val === 'number') return val
  const m = String(val).match(/(\d+)/)
  return m ? parseInt(m[1], 10) : fallback
}

function parseReps(val) {
  if (val == null || val === '') return { reps: 'NULL', note: 'NULL' }
  if (typeof val === 'number') return { reps: String(val), note: 'NULL' }
  const s = String(val)
  if (/^\d+$/.test(s)) return { reps: s, note: 'NULL' }
  return { reps: String(parseRangeInt(s, null) ?? 'NULL'), note: sqlStr(s) }
}

function coachSupervision(val) {
  if (val === true) return 'required'
  if (val === false) return 'optional'
  return val ?? 'optional'
}

function genderNotes(card) {
  return card.scaling?.genderSpecificNotes ?? card.scaling?.gender_specific_notes ?? ''
}

function scalingGuidance(card, cohortKey) {
  const entry = card.scaling?.[cohortKey]
  if (typeof entry === 'string') return entry
  if (entry?.load_guidance) return entry.load_guidance
  const fallback = card.scaling?.adult_beginner
  if (typeof fallback === 'string') return fallback
  return fallback?.load_guidance
    ?? 'Regress range, load, speed, or total reps before removing quality. Progress only after pain-free mechanics and recovery between reps.'
}

function taxonomyTags(card, field) {
  return card.taxonomy?.[field] ?? card[field] ?? []
}

function normalizeTagKey(facet, key) {
  if (facet === 'methodology') return METHODOLOGY_KEY_MAP[key] ?? key
  if (facet === 'physiology') return PHYSIOLOGY_KEY_MAP[key] ?? key
  if (facet === 'tenet') return TENET_KEY_MAP[key] ?? key
  if (facet === 'equipment') return EQUIPMENT_KEY_MAP[key] ?? key
  return key
}

function pairingLogic(card) {
  const pl = card.pairingLogic ?? {}
  return {
    pairs_well_before: pl.pairsWellBefore ?? pl.pairs_well_before ?? [],
    pairs_well_after: pl.pairsWellAfter ?? pl.pairs_well_after ?? [],
    good_for_sessions: pl.goodForSessions ?? pl.good_for_sessions ?? [],
    avoid_before: pl.avoidBefore ?? pl.avoid_before ?? [],
    avoid_after: pl.avoidAfter ?? pl.avoid_after ?? [],
    do_not_use_when: pl.doNotUseWhen ?? pl.do_not_use_when ?? [],
  }
}

function mediaLibrary(card) {
  const m = card.mediaLibrary ?? {}
  return {
    demo_video_sources: m.demo_video_sources ?? [],
    coaching_articles: m.coaching_articles ?? [],
    clinical_or_sport_science_references: m.clinical_or_sport_science_references ?? [],
    internal_notes: m.internal_notes ?? [],
  }
}

function whyFields(card) {
  const w = card.whyLayer ?? {}
  return {
    why_works: w.why_it_works ?? '',
    why_here: w.why_it_goes_here ?? '',
    best_placement: w.programming_guidance ?? '',
    misuse: w.common_misuse ?? '',
    scale_guidance: w.scaling_guidance ?? scalingGuidance(card, 'adult_beginner'),
  }
}

function primaryPhaseProfile(card) {
  const pp = card.phaseProfile
  if (Array.isArray(pp)) return pp.find((p) => p.role === 'primary') ?? pp[0] ?? {}
  return pp ?? {}
}

function seedReq(card) {
  const req = card.movementRequirements ?? {}
  const pp = primaryPhaseProfile(card)
  const safety = card.safetyProfile ?? card.safety ?? {}
  return {
    primary_joint_actions: req.primaryJointActions ?? req.primary_joint_actions ?? [],
    primary_tissues: req.primaryTissues ?? req.primary_tissues ?? [],
    primary_motor_control_demands: req.primaryMotorControlDemands ?? req.primary_motor_control_demands ?? [],
    postural_shape: req.posturalShape ?? req.postural_shape ?? null,
    breathing_demand: req.breathingDemand ?? req.breathing_demand ?? null,
    balance_demand: req.balanceDemand ?? req.balance_demand ?? null,
    coordination_demand: req.coordinationDemand ?? req.coordination_demand ?? null,
    impact_level: req.impactLevel ?? req.impact_level ?? pp.impactLevel ?? pp.impact_level ?? safety.impactLevel ?? safety.impact_level ?? 0,
  }
}

function seedExec(card) {
  const exec = card.coachingExecution ?? {}
  return {
    movement_description: exec.movementDescription ?? exec.movement_description ?? card.description,
    setup: exec.setup ?? [],
    execution_steps: exec.executionSteps ?? exec.execution_steps ?? [],
    coach_cues: exec.coachCues ?? exec.coach_cues ?? [],
    common_faults: exec.commonFaults ?? exec.common_faults ?? [],
    breathing_cues: exec.breathingCues ?? exec.breathing_cues ?? [],
    quality_gate: exec.qualityGate ?? exec.quality_gate ?? null,
    stop_signs: exec.stopSigns ?? exec.stop_signs ?? [],
  }
}

function movementRequirementsJson(card) {
  return jsonb(seedReq(card))
}

function slotName(slot) {
  return slot
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ')
}

function slotRows() {
  const seen = new Map()
  const phaseCounters = {}
  for (const card of CARDS) {
    const key = `${card.primaryPhaseKey}|${card.slot}`
    if (!seen.has(key)) {
      const base = PHASE_ORDER_BASE[card.primaryPhaseKey] ?? 850
      phaseCounters[card.primaryPhaseKey] = (phaseCounters[card.primaryPhaseKey] ?? 0) + 1
      const freshness = ['output', 'movement_intelligence'].includes(card.primaryPhaseKey) ? 5 : 2
      seen.set(key, {
        phase: card.primaryPhaseKey,
        slot: card.slot,
        subrole: card.subrole,
        order_index: base + phaseCounters[card.primaryPhaseKey],
        freshness_sensitivity: freshness,
        name: slotName(card.slot),
        description: `${card.family} — ${card.name}.`,
      })
    }
  }
  return [...seen.values()]
}

function skillLevel(card) {
  if (card.primaryPhaseKey === 'prepare_and_access') return 'BEGINNER'
  if (card.primaryPhaseKey === 'capacity') return 'INTERMEDIATE'
  if (card.primaryPhaseKey === 'output') return 'INTERMEDIATE'
  return 'BEGINNER'
}

function participantStructure(card) {
  if (card.slug.includes('partner') || /\bpartner\b/i.test(card.name)) return 'pairs'
  return 'individual'
}

function tagRows(facet) {
  const field = TAXONOMY_FIELD[facet]
  const rows = []
  for (const card of CARDS) {
    for (const t of taxonomyTags(card, field)) {
      rows.push(`  (${sqlStr(card.slug)}, ${sqlStr(normalizeTagKey(facet, t.key))}, ${t.weight})`)
    }
  }
  return rows
}

function regimen(card) {
  return card.regimenRule ?? card.regimen ?? {}
}

function safety(card) {
  return card.safetyProfile ?? card.safety ?? {}
}

function dosage(card) {
  return card.dosage ?? {}
}

// ── 194: infrastructure + seed ─────────────────────────────────────────────

let seedSql = `-- Top 50 Throwers / Throwing Athletes — infrastructure, taxonomy, and 50-card seed.
-- IDEMPOTENT. Generated by scripts/generate-188-throwing-athletes.mjs
-- Cluster: ${data.cluster?.title ?? 'Top 50 Throwers / Throwing Athletes Exercise Library'}

ALTER TABLE coaching.exercise DROP CONSTRAINT IF EXISTS exercise_phase_subrole_check;
ALTER TABLE coaching.exercise ADD CONSTRAINT exercise_phase_subrole_check
  CHECK (phase_subrole IS NULL OR phase_subrole IN (
    'raise', 'mobilize', 'activate', 'integrate', 'potentiate_bridge',
    'shape_position_intelligence', 'shape_control', 'inversion_foundation', 'rolling_transition',
    'locomotion_coordination', 'rotation_inversion_tumbling_foundations',
    'locomotion_sprint_mechanics', 'balance_coordination_rhythm', 'perception_action_reactive_movement',
    'acceleration_start_speed', 'max_velocity_exposure', 'elastic_stiffness_plyometric_rudiments',
    'jump_throw_explosive_power', 'deceleration_cod_power', 'reactive_agility_tumbling_output',
    'squat_knee_dominant_strength', 'hinge_posterior_chain_strength', 'upper_body_push_strength',
    'pull_hang_grip_strength', 'carry_trunk_loaded_bracing_strength',
    'tissue_capacity_isometric_eccentric_accessory', 'landing_braking_control',
    'single_leg_balance_foot_ankle_hip_control', 'trunk_pelvis_anti_movement_control',
    'scapular_wrist_hand_support_resilience', 'slow_eccentric_isometric_joint_resilience',
    'conditioning_intervals', 'bodyweight_strength_endurance', 'low_amplitude_elastic_conditioning',
    'crawl_carry_repeatability', 'breathing_downshift',
    'coordinate', 'lateral_lower_body_strength', 'lower_body_strength', 'perception_action_skill',
    'posterior_chain_strength', 'single_leg_strength', 'upper_body_pull_strength'
  ));

INSERT INTO coaching.equipment (key, name, sort_order) VALUES\n`
seedSql += EQUIPMENT_SEED.map(([key, name, sort]) =>
  `  (${sqlStr(key)}, ${sqlStr(name)}, ${sort})`,
).join(',\n')
seedSql += `
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

INSERT INTO coaching.body_region (key, name, sort_order) VALUES\n`
seedSql += BODY_REGION_SEED.map(([key, name, sort]) =>
  `  (${sqlStr(key)}, ${sqlStr(name)}, ${sort})`,
).join(',\n')
seedSql += `
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

INSERT INTO coaching.movement_pattern (key, name, sort_order) VALUES\n`
seedSql += PATTERN_SEED.map(([key, name, sort]) =>
  `  (${sqlStr(key)}, ${sqlStr(name)}, ${sort})`,
).join(',\n')
seedSql += `
ON CONFLICT (key) DO UPDATE SET name = EXCLUDED.name, sort_order = EXCLUDED.sort_order;

`

const slots = slotRows()
for (const phase of [...new Set(slots.map((s) => s.phase))]) {
  const phaseSlots = slots.filter((s) => s.phase === phase)
  seedSql += `-- ${phase} throwing-athlete slots\n`
  seedSql += `INSERT INTO coaching.phase_order_slot (key, name, description, phase_id, order_index, freshness_sensitivity, subrole_key)
SELECT v.key, v.name, v.description, sp.id, v.order_index, v.freshness_sensitivity, v.subrole_key
FROM coaching.session_phase sp
CROSS JOIN (VALUES\n`
  seedSql += phaseSlots.map((s) =>
    `  (${sqlStr(s.slot)}, ${sqlStr(s.name)}, ${sqlStr(s.description)}, ${s.order_index}, ${s.freshness_sensitivity}, ${sqlStr(s.subrole)})`,
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

seedSql += `-- Insert ${CARDS.length} throwing-athlete exercises
INSERT INTO coaching.exercise (
  facility_id, name, slug, description, sport_id, skill_level, age_min,
  default_sets, default_reps, default_work_seconds, default_rest_seconds, est_seconds_per_set,
  is_published, visibility,
  card_summary, coach_language, athlete_language,
  movement_family, primary_phase_key, phase_subrole, primary_order_slot,
  movement_requirements, coaching_execution, pairing_logic, media_library
)
SELECT
  f.id,
  d.name, d.slug, d.description,
  (SELECT id FROM coaching.sport WHERE key = 'fitness'),
  d.skill::public.skill_level,
  d.age_min,
  d.sets, d.reps, d.work, d.rest, d.est,
  TRUE, 'facility',
  d.summary, d.coach_lang, d.athlete_lang,
  d.family, d.phase_key, d.subrole, d.slot,
  d.req::jsonb, d.exec::jsonb, d.pairing::jsonb, d.media::jsonb
FROM (VALUES\n`

seedSql += CARDS.map((card) => {
  const d = dosage(card)
  const repsParsed = parseReps(d.defaultReps ?? d.default_reps)
  const work = d.defaultWorkSeconds ?? d.default_work_seconds ?? null
  return `  (${sqlStr(card.name)}, ${sqlStr(card.slug)}, ${sqlStr(card.description)}, ${sqlStr(skillLevel(card))}, 8, ${sqlInt(d.defaultSets ?? d.default_sets ?? 2)}, ${repsParsed.reps}, ${sqlInt(work)}, ${sqlInt(d.defaultRestSeconds ?? d.default_rest_seconds ?? 30)}, ${sqlInt(d.estSecondsPerSet ?? d.est_seconds_per_set ?? 60)}, ${sqlStr(card.cardSummary)}, ${sqlStr(card.coachLanguage)}, ${sqlStr(card.athleteLanguage)}, ${sqlStr(card.family)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(card.subrole)}, ${sqlStr(card.slot)}, ${jsonb(seedReq(card)).replace('::jsonb', '')}::jsonb, ${jsonb(seedExec(card)).replace('::jsonb', '')}::jsonb, ${jsonb(pairingLogic(card)).replace('::jsonb', '')}::jsonb, ${jsonb(mediaLibrary(card)).replace('::jsonb', '')}::jsonb)`
}).join(',\n')

seedSql += `
) AS d(name, slug, description, skill, age_min, sets, reps, work, rest, est, summary, coach_lang, athlete_lang, family, phase_key, subrole, slot, req, exec, pairing, media)
CROSS JOIN public.facility f
ON CONFLICT (facility_id, slug) DO NOTHING;

`

for (const facet of ['tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region']) {
  const table = FACET_TABLE[facet === 'body_region' ? 'body_regions' : facet]
  const rows = tagRows(facet)
  if (rows.length === 0) continue
  seedSql += `INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, '${facet}', f.id, v.weight
FROM (VALUES\n${rows.join(',\n')}
) AS v(slug, fkey, weight)
JOIN coaching.exercise e ON e.slug = v.slug
JOIN coaching.${table} f ON f.key = v.fkey
ON CONFLICT (exercise_id, facet_type, facet_id) DO NOTHING;

`
}

seedSql += `INSERT INTO coaching.exercise_phase_profile (
  exercise_id, phase_id, fit_weight, role, order_slot, order_index,
  freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling
)
SELECT e.id, sp.id, COALESCE(m.fit_weight, 5), COALESCE(m.role, 'primary'), m.slot, pos.order_index,
  COALESCE(m.freshness_required, FALSE), COALESCE(m.fatigue_sensitivity, 2), COALESCE(m.fatigue_cost, 2),
  COALESCE(m.technical_complexity, 2), COALESCE(m.impact_level, 1), COALESCE(m.intensity_ceiling, 'moderate')
FROM (VALUES\n`
seedSql += CARDS.map((card) => {
  const pp = primaryPhaseProfile(card)
  return `  (${sqlStr(card.slug)}, ${sqlStr(card.primaryPhaseKey)}, ${sqlStr(card.slot)}, ${sqlInt(pp.fitWeight ?? pp.fit_weight ?? 5)}, ${sqlStr(pp.role ?? 'primary')}, ${sqlBool(pp.freshnessRequired ?? pp.freshness_required)}, ${sqlInt(pp.fatigueSensitivity ?? pp.fatigue_sensitivity ?? 2)}, ${sqlInt(pp.fatigueCost ?? pp.fatigue_cost ?? 2)}, ${sqlInt(pp.technicalComplexity ?? pp.technical_complexity ?? 2)}, ${sqlInt(pp.impactLevel ?? pp.impact_level ?? 1)}, ${sqlStr(pp.intensityCeiling ?? pp.intensity_ceiling ?? 'moderate')})`
}).join(',\n')
seedSql += `
) AS m(slug, phase_key, slot, fit_weight, role, freshness_required, fatigue_sensitivity, fatigue_cost, technical_complexity, impact_level, intensity_ceiling)
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
  default_work_seconds, default_rest_seconds, default_distance, est_seconds_per_set,
  default_rpe_min, default_rpe_max, default_load_note
)
SELECT e.id, 'Default', TRUE, m.unit, m.sets, m.reps, m.work, m.rest, m.distance, m.est, m.rpe_min, m.rpe_max, m.load_note
FROM (VALUES\n`
seedSql += CARDS.map((card) => {
  const d = dosage(card)
  const repsParsed = parseReps(d.defaultReps ?? d.default_reps)
  return `  (${sqlStr(card.slug)}, ${sqlStr(d.volumeUnit ?? d.volume_unit ?? 'reps')}, ${sqlInt(d.defaultSets ?? d.default_sets ?? 2)}, ${repsParsed.reps}, ${sqlInt(d.defaultWorkSeconds ?? d.default_work_seconds)}, ${sqlInt(d.defaultRestSeconds ?? d.default_rest_seconds ?? 30)}, ${d.defaultDistance != null ? sqlStr(String(d.defaultDistance)) : 'NULL'}, ${sqlInt(d.estSecondsPerSet ?? d.est_seconds_per_set ?? 60)}, ${sqlInt(d.defaultRpeMin ?? d.default_rpe_min ?? 3)}, ${sqlInt(d.defaultRpeMax ?? d.default_rpe_max ?? 6)}, ${repsParsed.note})`
}).join(',\n')
seedSql += `
) AS m(slug, unit, sets, reps, work, rest, distance, est, rpe_min, rpe_max, load_note)
JOIN coaching.exercise e ON e.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_dosage_profile d WHERE d.exercise_id = e.id AND d.profile_name = 'Default');

`

seedSql += `INSERT INTO coaching.exercise_safety_profile (
  exercise_id, risk_level, impact_level, requires_spotting, requires_coach_supervision,
  readiness_checks, contraindications, common_substitutions
)
SELECT e.id, COALESCE(m.risk_level, 1), COALESCE(m.impact_level, 0), COALESCE(m.requires_spotting, FALSE),
  COALESCE(m.requires_coach_supervision, 'optional'),
  COALESCE(m.readiness_checks, ARRAY[]::text[]),
  COALESCE(m.contraindications, ARRAY[]::text[]),
  COALESCE(m.common_substitutions, ARRAY[]::text[])
FROM (VALUES\n`
seedSql += CARDS.map((card) => {
  const s = safety(card)
  return `  (${sqlStr(card.slug)}, ${sqlInt(s.riskLevel ?? s.risk_level ?? 1)}, ${sqlInt(s.impactLevel ?? s.impact_level ?? 0)}, ${sqlBool(s.requiresSpotting ?? s.requires_spotting)}, ${sqlStr(coachSupervision(s.requiresCoachSupervision ?? s.requires_coach_supervision))}, ${sqlTextArray(s.readinessChecks ?? s.readiness_checks)}, ${sqlTextArray(s.contraindications)}, ${sqlTextArray(s.commonSubstitutions ?? s.common_substitutions)})`
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
  COALESCE(m.weekly_max_frequency, 4),
  COALESCE(m.minimum_hours_between_hard_exposures, 0),
  COALESCE(m.counts_as_high_intensity, FALSE),
  COALESCE(m.counts_as_high_impact, FALSE),
  COALESCE(m.counts_as_neural, FALSE),
  COALESCE(m.counts_as_tissue_stress, FALSE),
  COALESCE(m.counts_as_conditioning, FALSE)
FROM (VALUES\n`
seedSql += CARDS.map((card) => {
  const r = regimen(card)
  return `  (${sqlStr(card.slug)}, ${sqlBool(r.canBeDaily ?? r.can_be_daily)}, ${sqlInt(r.weeklyMaxFrequency ?? r.weekly_max_frequency ?? 4)}, ${sqlInt(r.minimumHoursBetweenHardExposures ?? r.minimum_hours_between_hard_exposures ?? 0)}, ${sqlBool(r.countsAsHighIntensity ?? r.counts_as_high_intensity)}, ${sqlBool(r.countsAsHighImpact ?? r.counts_as_high_impact)}, ${sqlBool(r.countsAsNeural ?? r.counts_as_neural)}, ${sqlBool(r.countsAsTissueStress ?? r.counts_as_tissue_stress)}, ${sqlBool(r.countsAsConditioning ?? r.counts_as_conditioning)})`
}).join(',\n')
seedSql += `
) AS m(slug, can_be_daily, weekly_max_frequency, minimum_hours_between_hard_exposures, counts_as_high_intensity, counts_as_high_impact, counts_as_neural, counts_as_tissue_stress, counts_as_conditioning)
JOIN coaching.exercise e ON e.slug = m.slug
WHERE NOT EXISTS (SELECT 1 FROM coaching.exercise_regimen_rule r WHERE r.exercise_id = e.id);

`

for (const ck of COHORT_KEYS) {
  seedSql += `INSERT INTO coaching.exercise_scaling_profile (exercise_id, cohort_key, label, scale_direction, load_guidance, gender_specific_notes)
SELECT e.id, '${ck}', '${ck.replace(/_/g, ' ')}', 'baseline', v.guidance,
  CASE WHEN '${ck}' = 'adult_beginner' THEN v.gender_notes ELSE NULL END
FROM (VALUES\n`
  seedSql += CARDS.map((card) =>
    `  (${sqlStr(card.slug)}, ${sqlStr(scalingGuidance(card, ck))}, ${sqlStr(genderNotes(card))})`,
  ).join(',\n')
  seedSql += `
) AS v(slug, guidance, gender_notes)
JOIN coaching.exercise e ON e.slug = v.slug
WHERE NOT EXISTS (
  SELECT 1 FROM coaching.exercise_scaling_profile sp
  WHERE sp.exercise_id = e.id AND sp.cohort_key = '${ck}'
);

`
}

seedSql += `-- Why-layer education (seed pass)
INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_works, why_it_matters, why_it_goes_here,
  programming_guidance, common_misuse, scaling_guidance
)
SELECT
  'exercise', e.slug, e.id, e.name, e.card_summary,
  e.description,
  v.why_works,
  'Supports kinetic-chain throwing performance: force creation, transfer, arm expression, deceleration, and tissue tolerance.',
  v.why_here,
  v.best_placement,
  v.misuse,
  v.scale_guidance
FROM (VALUES\n`
seedSql += CARDS.map((c) => {
  const w = whyFields(c)
  return `  (${sqlStr(c.slug)}, ${sqlStr(w.why_works)}, ${sqlStr(w.why_here)}, ${sqlStr(w.best_placement)}, ${sqlStr(w.misuse)}, ${sqlStr(w.scale_guidance)})`
}).join(',\n')
seedSql += `
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

INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_matters, programming_guidance, common_misuse
)
VALUES (
  'validation_rule',
  'throwing_athletes_readiness',
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

// ── 195: full hydration ──────────────────────────────────────────────────────

let hydrateSql = `-- Top 50 Throwers / Throwing Athletes — full card v2 hydration.
-- IDEMPOTENT. Generated by scripts/generate-188-throwing-athletes.mjs

`

for (const card of CARDS) {
  const pp = primaryPhaseProfile(card)
  const d = dosage(card)
  const s = safety(card)
  const r = regimen(card)
  const w = whyFields(card)
  const repsParsed = parseReps(d.defaultReps ?? d.default_reps)
  const pairing = pairingLogic(card)
  const media = mediaLibrary(card)
  const sessionVolMin = d.sessionVolumeMin ?? d.session_volume_min
  const sessionVolMax = d.sessionVolumeMax ?? d.session_volume_max

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
  default_sets = ${sqlInt(d.defaultSets ?? d.default_sets ?? 2)},
  default_reps = ${repsParsed.reps},
  default_work_seconds = ${sqlInt(d.defaultWorkSeconds ?? d.default_work_seconds)},
  default_rest_seconds = ${sqlInt(d.defaultRestSeconds ?? d.default_rest_seconds ?? 30)},
  est_seconds_per_set = ${sqlInt(d.estSecondsPerSet ?? d.est_seconds_per_set ?? 60)},
  movement_requirements = ${movementRequirementsJson(card)},
  coaching_execution = ${jsonb(seedExec(card))},
  pairing_logic = ${jsonb(pairing)},
  media_library = ${jsonb(media)},
  updated_at = now()
WHERE slug = ${sqlStr(card.slug)};

UPDATE coaching.exercise_phase_profile p SET
  role = ${sqlStr(pp.role ?? 'primary')},
  order_slot = ${sqlStr(card.slot)},
  order_index = pos.order_index,
  fit_weight = ${sqlInt(pp.fitWeight ?? pp.fit_weight ?? 5)},
  freshness_required = ${sqlBool(pp.freshnessRequired ?? pp.freshness_required)},
  fatigue_sensitivity = ${sqlInt(pp.fatigueSensitivity ?? pp.fatigue_sensitivity ?? 2)},
  fatigue_cost = ${sqlInt(pp.fatigueCost ?? pp.fatigue_cost ?? 2)},
  technical_complexity = ${sqlInt(pp.technicalComplexity ?? pp.technical_complexity ?? 2)},
  impact_level = ${sqlInt(pp.impactLevel ?? pp.impact_level ?? 1)},
  intensity_ceiling = ${sqlStr(pp.intensityCeiling ?? pp.intensity_ceiling ?? 'moderate')},
  notes = ${sqlStr(pp.notes ?? null)}
FROM coaching.exercise e
JOIN coaching.session_phase sp ON sp.key = ${sqlStr(card.primaryPhaseKey)}
JOIN coaching.phase_order_slot pos ON pos.key = ${sqlStr(card.slot)} AND pos.phase_id = sp.id
WHERE p.exercise_id = e.id AND p.phase_id = sp.id AND e.slug = ${sqlStr(card.slug)};

UPDATE coaching.exercise_dosage_profile d SET
  volume_unit = ${sqlStr(d.volumeUnit ?? d.volume_unit ?? 'reps')},
  default_sets = ${sqlInt(d.defaultSets ?? d.default_sets ?? 2)},
  default_reps = ${repsParsed.reps},
  default_load_note = ${repsParsed.note},
  default_work_seconds = ${sqlInt(d.defaultWorkSeconds ?? d.default_work_seconds)},
  default_rest_seconds = ${sqlInt(d.defaultRestSeconds ?? d.default_rest_seconds ?? 30)},
  est_seconds_per_set = ${sqlInt(d.estSecondsPerSet ?? d.est_seconds_per_set ?? 60)},
  default_rpe_min = ${sqlInt(d.defaultRpeMin ?? d.default_rpe_min ?? 3)},
  default_rpe_max = ${sqlInt(d.defaultRpeMax ?? d.default_rpe_max ?? 6)},
  session_volume_min = ${sessionVolMin != null ? sqlStr(String(sessionVolMin)) : 'NULL'},
  session_volume_max = ${sessionVolMax != null ? sqlStr(String(sessionVolMax)) : 'NULL'}
FROM coaching.exercise e
WHERE d.exercise_id = e.id AND d.profile_name = 'Default' AND e.slug = ${sqlStr(card.slug)};

UPDATE coaching.exercise_regimen_rule r SET
  can_be_daily = ${sqlBool(r.canBeDaily ?? r.can_be_daily)},
  weekly_max_frequency = ${sqlInt(r.weeklyMaxFrequency ?? r.weekly_max_frequency ?? 4)},
  minimum_hours_between_hard_exposures = ${sqlInt(r.minimumHoursBetweenHardExposures ?? r.minimum_hours_between_hard_exposures ?? 0)},
  counts_as_high_intensity = ${sqlBool(r.countsAsHighIntensity ?? r.counts_as_high_intensity)},
  counts_as_high_impact = ${sqlBool(r.countsAsHighImpact ?? r.counts_as_high_impact)},
  counts_as_neural = ${sqlBool(r.countsAsNeural ?? r.counts_as_neural)},
  counts_as_tissue_stress = ${sqlBool(r.countsAsTissueStress ?? r.counts_as_tissue_stress)},
  counts_as_conditioning = ${sqlBool(r.countsAsConditioning ?? r.counts_as_conditioning)}
FROM coaching.exercise e
WHERE r.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

UPDATE coaching.exercise_safety_profile s SET
  risk_level = ${sqlInt(s.riskLevel ?? s.risk_level ?? 1)},
  impact_level = ${sqlInt(s.impactLevel ?? s.impact_level ?? 0)},
  requires_spotting = ${sqlBool(s.requiresSpotting ?? s.requires_spotting)},
  requires_coach_supervision = ${sqlStr(coachSupervision(s.requiresCoachSupervision ?? s.requires_coach_supervision))},
  readiness_checks = ${sqlTextArray(s.readinessChecks ?? s.readiness_checks)},
  contraindications = ${sqlTextArray(s.contraindications)},
  common_substitutions = ${sqlTextArray(s.commonSubstitutions ?? s.common_substitutions)}
FROM coaching.exercise e
WHERE s.exercise_id = e.id AND e.slug = ${sqlStr(card.slug)};

`
}

hydrateSql += `-- Refresh weighted taxonomy tags
DELETE FROM coaching.exercise_tag t
USING coaching.exercise e
WHERE t.exercise_id = e.id
  AND e.slug IN (${SLUGS.map(sqlStr).join(', ')})
  AND t.facet_type IN ('tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region');

`

for (const facet of ['tenet', 'methodology', 'physiology', 'pattern', 'equipment', 'body_region']) {
  const table = FACET_TABLE[facet === 'body_region' ? 'body_regions' : facet]
  const rows = tagRows(facet)
  if (rows.length === 0) continue
  hydrateSql += `INSERT INTO coaching.exercise_tag (exercise_id, facet_type, facet_id, weight)
SELECT e.id, '${facet}', f.id, v.weight
FROM (VALUES\n${rows.join(',\n')}
) AS v(slug, fkey, weight)
JOIN coaching.exercise e ON e.slug = v.slug
JOIN coaching.${table} f ON f.key = v.fkey
ON CONFLICT (exercise_id, facet_type, facet_id) DO UPDATE SET weight = EXCLUDED.weight;

`
}

for (const ck of COHORT_KEYS) {
  hydrateSql += `UPDATE coaching.exercise_scaling_profile sp SET
  load_guidance = v.guidance,
  gender_specific_notes = CASE WHEN '${ck}' = 'adult_beginner' THEN v.gender_notes ELSE sp.gender_specific_notes END
FROM (VALUES\n`
  hydrateSql += CARDS.map((card) =>
    `  (${sqlStr(card.slug)}, ${sqlStr(scalingGuidance(card, ck))}, ${sqlStr(genderNotes(card))})`,
  ).join(',\n')
  hydrateSql += `
) AS v(slug, guidance, gender_notes)
JOIN coaching.exercise e ON e.slug = v.slug
WHERE sp.exercise_id = e.id AND sp.cohort_key = '${ck}';

INSERT INTO coaching.exercise_scaling_profile (exercise_id, cohort_key, label, scale_direction, load_guidance, gender_specific_notes)
SELECT e.id, '${ck}', '${ck.replace(/_/g, ' ')}', 'baseline', v.guidance,
  CASE WHEN '${ck}' = 'adult_beginner' THEN v.gender_notes ELSE NULL END
FROM (VALUES\n`
  hydrateSql += CARDS.map((card) =>
    `  (${sqlStr(card.slug)}, ${sqlStr(scalingGuidance(card, ck))}, ${sqlStr(genderNotes(card))})`,
  ).join(',\n')
  hydrateSql += `
) AS v(slug, guidance, gender_notes)
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
  'Supports kinetic-chain throwing performance: force creation, transfer, arm expression, deceleration, and tissue tolerance.',
  v.why_here,
  v.best_placement,
  v.misuse,
  v.scale_guidance
FROM (VALUES\n`
hydrateSql += CARDS.map((c) => {
  const w = whyFields(c)
  return `  (${sqlStr(c.slug)}, ${sqlStr(w.why_works)}, ${sqlStr(w.why_here)}, ${sqlStr(w.best_placement)}, ${sqlStr(w.misuse)}, ${sqlStr(w.scale_guidance)})`
}).join(',\n')
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

-- Throwing-athlete cluster validation education
INSERT INTO coaching.education_content (
  entity_type, entity_key, entity_id, title, short_summary,
  what_it_is, why_it_matters, programming_guidance, common_misuse
)
VALUES (
  'validation_rule',
  'throwing_athletes_readiness',
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

const seedPath = path.join(__dirname, '../backend/migrations/194_coaching_throwing_athletes_infrastructure_and_seed.sql')
const hydratePath = path.join(__dirname, '../backend/migrations/195_coaching_throwing_athletes_cards.sql')
fs.writeFileSync(seedPath, seedSql)
fs.writeFileSync(hydratePath, hydrateSql)
console.log('Wrote', seedPath)
console.log('Wrote', hydratePath, '—', CARDS.length, 'throwing-athlete cards')
console.log('Slug conflicts prefixed with throwing-athlete-:', SLUG_CONFLICTS.size)
